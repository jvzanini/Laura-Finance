package services

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// Duração e limites de códigos OTP (ver migration 000038).
const (
	OTPLength      = 6
	OTPExpiration  = 10 * time.Minute
	OTPMaxAttempts = 5
	OTPMaxPerHour  = 3
)

// Erros tipados devolvidos por VerifyOTP.
var (
	ErrOTPNotFound    = errors.New("otp: código não encontrado")
	ErrOTPExpired     = errors.New("otp: código expirado")
	ErrOTPMaxAttempts = errors.New("otp: máximo de tentativas excedido")
	ErrOTPInvalid     = errors.New("otp: código inválido")
)

// getOTPSecret devolve o segredo HMAC. Em produção é obrigatório
// (crash no boot); em dev tem fallback.
func getOTPSecret() string {
	s := os.Getenv("OTP_SECRET")
	if s != "" {
		return s
	}
	if os.Getenv("APP_ENV") == "production" {
		// Config.LoadConfig já valida, mas garantimos aqui também.
		panic("OTP_SECRET obrigatória em produção")
	}
	return "laura-dev-otp-secret-change-me"
}

// isTestMode indica se devemos aceitar OTP fixo (123456) — usado em CI/E2E.
func isTestMode() bool {
	return os.Getenv("OTP_TEST_MODE") == "true"
}

// hashOTP devolve hex(HMAC-SHA256(secret, code)).
func hashOTP(code string) string {
	mac := hmac.New(sha256.New, []byte(getOTPSecret()))
	mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil))
}

// newSixDigitCode gera um código numérico de 6 dígitos via crypto/rand.
func newSixDigitCode() (string, error) {
	max := big.NewInt(1_000_000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("otp: falha ao gerar código: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// GenerateOTP cria um novo código OTP, grava em otp_codes (hashed) e
// devolve o código em claro (para envio ao usuário). Em OTP_TEST_MODE
// devolve o código fixo 123456 sem persistir (os VerifyOTP/tests aceitam
// tanto esse valor quanto um registro real).
func GenerateOTP(ctx context.Context, targetType, targetValue, purpose string, contextID *uuid.UUID) (string, error) {
	if db.Pool == nil {
		return "", errors.New("otp: pool de banco não inicializado")
	}
	if isTestMode() {
		// Persiste um registro real com código 123456 para que o resto do
		// código funcione normalmente (e2e em CI validam fluxo full).
		code := "123456"
		hash := hashOTP(code)
		_, err := db.Pool.Exec(ctx,
			`INSERT INTO otp_codes (target_type, target_value, code_hmac, purpose, context_id, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			targetType, targetValue, hash, purpose, contextID, time.Now().Add(OTPExpiration),
		)
		if err != nil {
			return "", fmt.Errorf("otp: falha ao persistir (test mode): %w", err)
		}
		return code, nil
	}

	code, err := newSixDigitCode()
	if err != nil {
		return "", err
	}
	hash := hashOTP(code)
	_, err = db.Pool.Exec(ctx,
		`INSERT INTO otp_codes (target_type, target_value, code_hmac, purpose, context_id, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		targetType, targetValue, hash, purpose, contextID, time.Now().Add(OTPExpiration),
	)
	if err != nil {
		return "", fmt.Errorf("otp: falha ao persistir: %w", err)
	}
	return code, nil
}

// VerifyOTP procura o código ativo mais recente para a tupla
// (target, purpose), incrementa attempts e marca used_at em caso de
// sucesso. Retorna contextID associado (útil para linkar com pending
// signups). Erros tipados indicam o motivo da falha.
func VerifyOTP(ctx context.Context, targetType, targetValue, purpose, code string) (*uuid.UUID, error) {
	if db.Pool == nil {
		return nil, errors.New("otp: pool de banco não inicializado")
	}

	var (
		id          uuid.UUID
		codeHmac    string
		contextID   *uuid.UUID
		attempts    int
		maxAttempts int
		expiresAt   time.Time
	)
	err := db.Pool.QueryRow(ctx,
		`SELECT id, code_hmac, context_id, attempts, max_attempts, expires_at
		 FROM otp_codes
		 WHERE target_type = $1 AND target_value = $2 AND purpose = $3
		   AND used_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT 1`,
		targetType, targetValue, purpose,
	).Scan(&id, &codeHmac, &contextID, &attempts, &maxAttempts, &expiresAt)
	if err != nil {
		return nil, ErrOTPNotFound
	}

	if time.Now().After(expiresAt) {
		return nil, ErrOTPExpired
	}
	if attempts >= maxAttempts {
		return nil, ErrOTPMaxAttempts
	}

	// Sempre incrementa attempts (best-effort).
	_, _ = db.Pool.Exec(ctx, `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, id)

	// TEST MODE: aceita 123456 OU o código real armazenado.
	if isTestMode() && code == "123456" {
		_, _ = db.Pool.Exec(ctx, `UPDATE otp_codes SET used_at = CURRENT_TIMESTAMP WHERE id = $1`, id)
		return contextID, nil
	}

	if !hmac.Equal([]byte(hashOTP(code)), []byte(codeHmac)) {
		return nil, ErrOTPInvalid
	}

	_, err = db.Pool.Exec(ctx, `UPDATE otp_codes SET used_at = CURRENT_TIMESTAMP WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("otp: falha ao marcar consumo: %w", err)
	}
	return contextID, nil
}

// CanResendOTP retorna se é permitido enviar novo código e, se não,
// quanto tempo falta. Baseado em rate limit OTPMaxPerHour por (target, purpose).
func CanResendOTP(ctx context.Context, targetType, targetValue, purpose string) (bool, time.Duration, error) {
	if db.Pool == nil {
		return false, 0, errors.New("otp: pool de banco não inicializado")
	}

	var count int
	var earliest *time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT COUNT(*), MIN(created_at)
		 FROM otp_codes
		 WHERE target_type = $1 AND target_value = $2 AND purpose = $3
		   AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
		targetType, targetValue, purpose,
	).Scan(&count, &earliest)
	if err != nil {
		return false, 0, fmt.Errorf("otp: falha ao checar rate limit: %w", err)
	}

	if count < OTPMaxPerHour {
		return true, 0, nil
	}
	if earliest == nil {
		return true, 0, nil
	}
	retryAfter := earliest.Add(1 * time.Hour).Sub(time.Now())
	if retryAfter < 0 {
		return true, 0, nil
	}
	return false, retryAfter, nil
}

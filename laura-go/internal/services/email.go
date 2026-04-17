package services

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/resend/resend-go/v2"
)

// Templates esperados em email_templates (ver migration 000041).
const (
	EmailTypeOTPCode           = "codigo_verificacao_email"
	EmailTypeTrialStarted      = "trial_iniciado"
	EmailTypeTrialEndingD3     = "trial_terminando_d3"
	EmailTypeTrialEndingD1     = "trial_terminando_d1"
	EmailTypeTrialExpired      = "trial_expirado"
	EmailTypePaymentFailed     = "pagamento_falhou"
	EmailTypePaymentResumed    = "pagamento_retomado"
	EmailTypeCanceled          = "assinatura_cancelada"
)

var ErrEmailTemplateNotFound = errors.New("email: template não encontrado ou inativo")

// resendClient é lazy-initialized.
var resendClient *resend.Client

func getResendClient() *resend.Client {
	if resendClient != nil {
		return resendClient
	}
	key := os.Getenv("RESEND_API_KEY")
	if key == "" {
		// Preserva comportamento do PWA: warning, mas retorna cliente com
		// chave vazia (Resend vai falhar no Send).
		slog.Warn("RESEND_API_KEY não configurada")
	}
	resendClient = resend.NewClient(key)
	return resendClient
}

// applyVars substitui {{chave}} no template por valor do map.
func applyVars(s string, vars map[string]string) string {
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}

// getActiveTemplate busca subject e html_body do template ativo do tipo.
func getActiveTemplate(ctx context.Context, tplType string) (subject, htmlBody string, err error) {
	if db.Pool == nil {
		return "", "", errors.New("email: pool de banco não inicializado")
	}
	err = db.Pool.QueryRow(ctx,
		`SELECT subject, html_body FROM email_templates
		 WHERE type = $1 AND active = TRUE LIMIT 1`,
		tplType,
	).Scan(&subject, &htmlBody)
	if err != nil {
		return "", "", ErrEmailTemplateNotFound
	}
	return subject, htmlBody, nil
}

// getSenderAddress retorna o from no formato "Nome <email@dominio>".
// Em produção precisa ser um endereço do domínio verificado no Resend.
func getSenderAddress(ctx context.Context) string {
	// Prioriza system_config, fallback env vars.
	var name, email string
	if db.Pool != nil {
		_ = db.Pool.QueryRow(ctx, `SELECT value FROM system_config WHERE key = 'sender_name' LIMIT 1`).Scan(&name)
		_ = db.Pool.QueryRow(ctx, `SELECT value FROM system_config WHERE key = 'sender_email' LIMIT 1`).Scan(&email)
	}
	if name == "" {
		name = os.Getenv("EMAIL_SENDER_NAME")
	}
	if email == "" {
		email = os.Getenv("EMAIL_SENDER")
	}
	if name == "" {
		name = "Laura Finance"
	}
	if email == "" {
		email = "onboarding@resend.dev" // fallback seguro do Resend em dev
	}
	return fmt.Sprintf("%s <%s>", name, email)
}

// sendTemplated envia um email do template registrado aplicando vars.
func sendTemplated(ctx context.Context, to, tplType string, vars map[string]string) error {
	subject, html, err := getActiveTemplate(ctx, tplType)
	if err != nil {
		// Fallback inline extremamente simples
		subject = "Laura Finance"
		html = fmt.Sprintf(`<div>%s</div>`, vars["code"])
		slog.WarnContext(ctx, "email_template_missing_fallback_inline", "type", tplType)
	}

	subject = applyVars(subject, vars)
	html = applyVars(html, vars)

	client := getResendClient()
	_, err = client.Emails.Send(&resend.SendEmailRequest{
		From:    getSenderAddress(ctx),
		To:      []string{to},
		Subject: subject,
		Html:    html,
	})
	if err != nil {
		return fmt.Errorf("email: falha Resend send: %w", err)
	}
	return nil
}

// SendOTPEmail dispara código OTP de 6 dígitos por email.
func SendOTPEmail(ctx context.Context, to, nome, code string) error {
	return sendTemplated(ctx, to, EmailTypeOTPCode, map[string]string{
		"code":    code,
		"nome":    nome,
		"app_url": appURL(),
	})
}

// SendTrialStartedEmail dispara email pós-finalize do signup.
func SendTrialStartedEmail(ctx context.Context, to, nome, plano string) error {
	return sendTemplated(ctx, to, EmailTypeTrialStarted, map[string]string{
		"nome":    nome,
		"plano":   plano,
		"app_url": appURL(),
	})
}

// SendTrialEndingEmail dispara D-3 ou D-1 conforme `day`.
func SendTrialEndingEmail(ctx context.Context, to, nome string, day int) error {
	tpl := EmailTypeTrialEndingD3
	dias := "3"
	if day == 1 {
		tpl = EmailTypeTrialEndingD1
		dias = "1"
	}
	return sendTemplated(ctx, to, tpl, map[string]string{
		"nome":            nome,
		"dias_restantes":  dias,
		"app_url":         appURL(),
	})
}

func SendTrialExpiredEmail(ctx context.Context, to, nome string) error {
	return sendTemplated(ctx, to, EmailTypeTrialExpired, map[string]string{
		"nome":    nome,
		"app_url": appURL(),
	})
}

func SendPaymentFailedEmail(ctx context.Context, to, nome, plano, valor, dataLimite string) error {
	return sendTemplated(ctx, to, EmailTypePaymentFailed, map[string]string{
		"nome":        nome,
		"plano":       plano,
		"valor":       valor,
		"data_limite": dataLimite,
		"app_url":     appURL(),
	})
}

func SendPaymentResumedEmail(ctx context.Context, to, nome string) error {
	return sendTemplated(ctx, to, EmailTypePaymentResumed, map[string]string{
		"nome":    nome,
		"app_url": appURL(),
	})
}

func SendCanceledEmail(ctx context.Context, to, nome, dataLimite string) error {
	return sendTemplated(ctx, to, EmailTypeCanceled, map[string]string{
		"nome":        nome,
		"data_limite": dataLimite,
		"app_url":     appURL(),
	})
}

func appURL() string {
	if v := os.Getenv("NEXT_PUBLIC_APP_URL"); v != "" {
		return v
	}
	if v := os.Getenv("APP_URL"); v != "" {
		return v
	}
	return "http://localhost:3100"
}

// Package msgsender agrupa wrappers de envio de mensagens (WhatsApp/SMS/etc).
// Isolado em seu próprio package para evitar ciclos de importação entre
// `internal/services` e `internal/whatsapp`.
package msgsender

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strings"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/whatsapp"
)

// ErrNoWhatsappInstance é retornado quando não há instância conectada.
var ErrNoWhatsappInstance = errors.New("whatsapp: nenhuma instância conectada")

var onlyDigitsRe = regexp.MustCompile(`[^0-9]`)

// NormalizeE164 normaliza um número para o formato E.164 sem o '+'.
// Se o input tiver só dígitos e não parecer ter código de país
// (10 ou 11 dígitos = BR), prefixa 55.
func NormalizeE164(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("whatsapp: número vazio")
	}

	digits := onlyDigitsRe.ReplaceAllString(raw, "")
	if len(digits) < 10 {
		return "", fmt.Errorf("whatsapp: número curto demais: %s", raw)
	}

	if len(digits) == 10 || len(digits) == 11 {
		digits = "55" + digits
	}

	if len(digits) > 15 {
		return "", fmt.Errorf("whatsapp: número longo demais: %s", raw)
	}
	return digits, nil
}

// SendOTPWhatsapp envia o código OTP para o número via instância conectada.
func SendOTPWhatsapp(ctx context.Context, phone, code string) error {
	normalized, err := NormalizeE164(phone)
	if err != nil {
		return err
	}

	text := fmt.Sprintf(
		"Seu código de verificação Laura Finance: %s\n\nVálido por 10 minutos. Se você não solicitou, ignore esta mensagem.",
		code,
	)

	if os.Getenv("DISABLE_WHATSAPP") == "true" {
		slog.InfoContext(ctx, "[dev] whatsapp otp",
			"phone", normalized,
			"code", code,
		)
		return nil
	}

	if err := ensureInstanceReady(ctx); err != nil {
		return err
	}

	whatsapp.SendTextMessage(normalized, text)
	return nil
}

func ensureInstanceReady(ctx context.Context) error {
	if db.Pool == nil {
		return errors.New("whatsapp: pool de banco não inicializado")
	}

	var count int
	if id := os.Getenv("WHATSAPP_OTP_INSTANCE_ID"); id != "" {
		err := db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM whatsapp_instances WHERE id = $1 AND status = 'connected'`,
			id,
		).Scan(&count)
		if err != nil {
			return fmt.Errorf("whatsapp: falha lookup instância específica: %w", err)
		}
	} else {
		err := db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM whatsapp_instances WHERE status = 'connected'`,
		).Scan(&count)
		if err != nil {
			return fmt.Errorf("whatsapp: falha lookup instâncias conectadas: %w", err)
		}
	}

	if count == 0 {
		return ErrNoWhatsappInstance
	}
	return nil
}

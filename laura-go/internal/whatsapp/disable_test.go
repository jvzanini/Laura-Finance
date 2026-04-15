package whatsapp

import (
	"testing"
)

// TestInitWhatsmeow_DisableFlag_SkipsInit afirma que, com DISABLE_WHATSAPP=true,
// InitWhatsmeow retorna imediatamente sem tentar conectar a lib sqlstore/WA.
// Esse guard e necessario para rodar CI/E2E headless, sem Postgres com schema
// whatsmeow ou sem rede ate o WhatsApp.
func TestInitWhatsmeow_DisableFlag_SkipsInit(t *testing.T) {
	t.Setenv("DISABLE_WHATSAPP", "true")
	// DATABASE_URL intencionalmente invalida: se o guard nao funcionar, vai
	// travar ou dar log.Fatalf ao tentar conectar.
	t.Setenv("DATABASE_URL", "postgres://bogus:bogus@127.0.0.1:1/none?sslmode=disable")

	// Se o guard estiver funcionando, retorna sem panic/exit.
	InitWhatsmeow()
}

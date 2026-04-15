// Package testutil fornece helpers compartilhados entre testes de
// integração e e2e — evita duplicar lógica de HMAC do cookie de sessão
// entre suites de teste. Deve bater com laura-go/internal/handlers/session.go.
package testutil

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

// SessionCookieName mirrors handlers.SessionCookieName para não criar
// dependência circular de import entre handlers e testutil.
const SessionCookieName = "laura_session_token"

// SignedSession produz um cookie HTTP no mesmo formato que o middleware
// RequireSession valida: base64(payload).base64(HMAC-SHA256(payload, SESSION_SECRET)).
// Lê SESSION_SECRET do ambiente — se vazio, falha o teste imediatamente.
func SignedSession(t *testing.T, userID string) *http.Cookie {
	t.Helper()
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		t.Fatal("SESSION_SECRET vazio em test env — carregar .env.test")
	}
	payload := map[string]any{
		"userId": userID,
		"exp":    time.Now().Add(24 * time.Hour).UnixMilli(),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	payloadB64 := base64.StdEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payloadB64))
	sigB64 := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return &http.Cookie{ // #nosec G124 — test helper, atributos production-grade aplicados pelo handler real em session.go
		Name:     SessionCookieName,
		Value:    fmt.Sprintf("%s.%s", payloadB64, sigB64),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}

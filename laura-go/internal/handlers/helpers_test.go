package handlers

import (
	"strings"
	"testing"
	"time"
)

func TestTimeNowMonth_Format(t *testing.T) {
	got := timeNowMonth()
	if _, err := time.Parse("2006-01", got); err != nil {
		t.Fatalf("timeNowMonth retornou formato inválido %q: %v", got, err)
	}
	if len(got) != 7 {
		t.Errorf("timeNowMonth len=%d, want 7 (YYYY-MM)", len(got))
	}
}

func TestHashPassword_RoundTrip(t *testing.T) {
	hash, err := hashPassword("senha123")
	if err != nil {
		t.Fatalf("hashPassword error: %v", err)
	}
	if hash == "" || hash == "senha123" {
		t.Errorf("hash inválido: %q", hash)
	}
	if !checkPasswordHash("senha123", hash) {
		t.Error("checkPasswordHash deveria validar senha correta")
	}
	if checkPasswordHash("errada", hash) {
		t.Error("checkPasswordHash deveria rejeitar senha errada")
	}
}

func TestMustMarshalJSON(t *testing.T) {
	b := mustMarshalJSON(map[string]string{"foo": "bar"})
	if !strings.Contains(string(b), `"foo":"bar"`) {
		t.Errorf("mustMarshalJSON = %s, want contains foo:bar", b)
	}
}

func TestGetCORSOrigins_FallbackDev(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "")
	got := getCORSOrigins()
	if !strings.Contains(got, "localhost:3100") {
		t.Errorf("fallback deve conter localhost:3100, got %q", got)
	}
}

func TestGetCORSOrigins_EnvOverride(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://app.example.com")
	got := getCORSOrigins()
	if got != "https://app.example.com" {
		t.Errorf("CORS_ORIGINS env deve sobrepor, got %q", got)
	}
}

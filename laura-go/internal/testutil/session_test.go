package testutil

import (
	"strings"
	"testing"
)

func TestSignedSession_FormatAndHMAC(t *testing.T) {
	t.Setenv("SESSION_SECRET", "laura-test-session-secret-deterministic-32b-base64-ABCDEF==")
	c := SignedSession(t, "user-123")
	if c.Name == "" {
		t.Fatalf("nome vazio")
	}
	if c.Name != SessionCookieName {
		t.Fatalf("nome esperado %q, obtido %q", SessionCookieName, c.Name)
	}
	parts := strings.Split(c.Value, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		t.Fatalf("formato inesperado: %q", c.Value)
	}
}

package pluggy_test

import (
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/pluggy"
)

func TestVerifySignature_Valid(t *testing.T) {
	body := []byte(`{"event":"item/updated"}`)
	secret := "s3cr3t"
	header := pluggy.SignPayload(body, secret)
	if !pluggy.VerifySignature(body, header, []string{secret}) {
		t.Fatal("expected true for valid signature")
	}
}

func TestVerifySignature_Invalid(t *testing.T) {
	body := []byte(`{"event":"item/updated"}`)
	header := pluggy.SignPayload(body, "right")
	if pluggy.VerifySignature(body, header, []string{"wrong"}) {
		t.Fatal("expected false for wrong secret")
	}
}

func TestVerifySignature_DualSecret(t *testing.T) {
	body := []byte(`{"event":"x"}`)
	old := "old-secret"
	primary := "new-secret"
	header := pluggy.SignPayload(body, old)
	// Verifica com array [primary, old] — deve passar via old.
	if !pluggy.VerifySignature(body, header, []string{primary, old}) {
		t.Fatal("expected dual-secret to accept old")
	}
}

func TestVerifySignature_MalformedHeader(t *testing.T) {
	body := []byte(`{}`)
	cases := []string{"", "md5=abc", "sha256=not-hex", "sha256="}
	for _, h := range cases {
		if pluggy.VerifySignature(body, h, []string{"x"}) {
			t.Errorf("expected false for header %q", h)
		}
	}
}

func TestVerifySignature_EmptySecrets(t *testing.T) {
	body := []byte(`{}`)
	header := pluggy.SignPayload(body, "x")
	if pluggy.VerifySignature(body, header, []string{"", ""}) {
		t.Fatal("expected false when all secrets empty")
	}
}

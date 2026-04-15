package pluggy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// VerifySignature valida a assinatura HMAC-SHA256 de um payload
// de webhook Pluggy.
//
// O header esperado tem o formato "sha256=<hex>". Ao menos um dos
// secrets precisa bater (suporte a rotação dual-secret). Comparação
// em constant-time.
//
// Retorna false para header malformado, secrets vazios ou mismatch.
func VerifySignature(body []byte, header string, secrets []string) bool {
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	want, err := hex.DecodeString(header[len(prefix):])
	if err != nil {
		return false
	}
	for _, secret := range secrets {
		if secret == "" {
			continue
		}
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(body)
		if hmac.Equal(mac.Sum(nil), want) {
			return true
		}
	}
	return false
}

// SignPayload retorna o header "sha256=<hex>" para um payload com um
// secret. Útil para testes e clientes que publicam webhooks.
func SignPayload(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}


package services

import (
	"context"
	"testing"
)

// TestCheckWebhookSecretAge_NoPool garante que sem db.Pool a função
// retorna -1 sem panic.
func TestCheckWebhookSecretAge_NoPool(t *testing.T) {
	got := CheckWebhookSecretAge(context.Background())
	if got != -1 {
		t.Errorf("sem pool: esperava -1, got %d", got)
	}
}

// TestSeedWebhookSecretSetAt_NoPool garante no-op sem panic.
func TestSeedWebhookSecretSetAt_NoPool(t *testing.T) {
	if err := SeedWebhookSecretSetAt(context.Background()); err != nil {
		t.Errorf("sem pool: esperava nil, got %v", err)
	}
}

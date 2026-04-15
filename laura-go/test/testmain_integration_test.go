//go:build integration

package test

import (
	"testing"
)

// TestIntegrationStub — a suite de integração full (postgres pgvector + redis
// via testcontainers, compartilhada por TestMain) será implementada na Fase 13.
// Este stub valida apenas que a build tag `integration` compila e pode ser
// invocada no pipeline CI sem quebrar.
func TestIntegrationStub(t *testing.T) {
	t.Skip("integration suite stub — implementação completa em Fase 13")
}

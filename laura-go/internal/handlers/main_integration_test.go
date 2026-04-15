//go:build integration

package handlers_test

import (
	"os"
	"testing"

	"github.com/jvzanini/laura-finance/laura-go/internal/testutil"
)

// TestMain inicializa os containers compartilhados (Postgres + Redis)
// antes de rodar qualquer teste do pacote handlers_test. Delega para
// testutil.RunWithContainers para evitar duplicação.
func TestMain(m *testing.M) {
	os.Exit(testutil.RunWithContainers(m))
}

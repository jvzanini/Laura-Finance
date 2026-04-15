package whatsapp

import (
	"context"
	"database/sql"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

// TestSQLStoreNew_AutoCreatesWhatsmeowTables afirma que sqlstore.New
// (via Container.Upgrade interno da lib) cria as tabelas whatsmeow_*.
// Se uma futura versao da lib parar de chamar Upgrade automaticamente,
// este teste falha e sinaliza patch explicito em client.go/instance_manager.go.
//
// Nao chamamos InitWhatsmeow() aqui pois ela tambem conecta ao WA (QR code
// ou sessao existente) e bloqueia. Exercitamos apenas o contrato sqlstore.New
// que e o ponto exato onde o Upgrade ocorre.
func TestSQLStoreNew_AutoCreatesWhatsmeowTables(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL ausente; skip teste de integracao whatsmeow")
	}

	ctx := context.Background()
	dbLog := waLog.Stdout("Database", "ERROR", true)
	if _, err := sqlstore.New(ctx, "postgres", dbURL, dbLog); err != nil {
		t.Fatalf("sqlstore.New: %v", err)
	}

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	defer db.Close()
	var count int
	if err := db.QueryRowContext(ctx,
		`SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'whatsmeow_%'`,
	).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count < 1 {
		t.Fatalf("esperava >=1 tabela whatsmeow_*, veio %d -- sqlstore.New nao esta criando schema; patch Container.Upgrade(ctx) explicito necessario em client.go e instance_manager.go", count)
	}
}

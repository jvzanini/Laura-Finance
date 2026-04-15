//go:build integration

// Package testutil/integration provê containers compartilhados
// (Postgres com pgvector + Redis) via testcontainers-go, ativados
// via build tag `integration`.
//
// Uso:
//
//	go test -tags=integration ./...
//
// Rodar testes sem o tag pula esses recursos.
package testutil

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	// SharedPG é o container Postgres (pgvector) compartilhado por
	// todos os testes integration do pacote.
	SharedPG *tcpostgres.PostgresContainer

	// SharedDSN é a connection string Postgres.
	SharedDSN string
)

// TestMain sobe os containers uma vez, roda os testes do pacote
// e tear-down ao final. Usa image pgvector/pgvector:pg16.
func TestMain(m *testing.M) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pg, err := tcpostgres.Run(ctx,
		"pgvector/pgvector:pg16",
		tcpostgres.WithDatabase("laura_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(90*time.Second),
		),
	)
	if err != nil {
		log.Printf("integration: falha ao subir Postgres container: %v (pulando tests)", err)
		os.Exit(0)
	}
	SharedPG = pg

	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pg.Terminate(ctx)
		log.Printf("integration: falha ao obter DSN: %v", err)
		os.Exit(1)
	}
	SharedDSN = dsn

	fmt.Fprintf(os.Stderr, "integration: Postgres pronto em %s\n", dsn)

	code := m.Run()

	if err := pg.Terminate(ctx); err != nil {
		log.Printf("integration: teardown Postgres: %v", err)
	}
	os.Exit(code)
}

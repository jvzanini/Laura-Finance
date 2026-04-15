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
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	// SharedPG é o container Postgres (pgvector) compartilhado por
	// todos os testes integration do pacote.
	SharedPG *tcpostgres.PostgresContainer

	// SharedDSN é a connection string Postgres.
	SharedDSN string

	// SharedRedis é o container Redis compartilhado por todos os
	// testes integration que precisam de cache / pub-sub.
	SharedRedis *tcredis.RedisContainer

	// SharedRedisURL é a connection string Redis (formato redis://host:port).
	SharedRedisURL string
)

// TestMain local sobe os containers uma vez para o próprio pacote
// `testutil` quando rodado isoladamente. Outros pacotes devem chamar
// `testutil.RunWithContainers(m)` a partir do seu próprio TestMain.
func TestMain(m *testing.M) {
	os.Exit(RunWithContainers(m))
}

// RunWithContainers inicializa Postgres + Redis compartilhados,
// executa `m.Run()` e garante teardown. Exposta para permitir que
// outros pacotes (handlers_test etc.) bootstrapem a mesma
// infraestrutura sem duplicar código.
func RunWithContainers(m *testing.M) int {
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
		return 0
	}
	SharedPG = pg

	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pg.Terminate(ctx)
		log.Printf("integration: falha ao obter DSN: %v", err)
		return 1
	}
	SharedDSN = dsn

	fmt.Fprintf(os.Stderr, "integration: Postgres pronto em %s\n", dsn)

	rd, err := tcredis.Run(ctx, "redis:7-alpine")
	if err != nil {
		_ = pg.Terminate(ctx)
		log.Printf("integration: falha ao subir Redis container: %v", err)
		return 1
	}
	SharedRedis = rd

	redisURL, err := rd.ConnectionString(ctx)
	if err != nil {
		_ = rd.Terminate(ctx)
		_ = pg.Terminate(ctx)
		log.Printf("integration: falha ao obter Redis URL: %v", err)
		return 1
	}
	SharedRedisURL = redisURL

	fmt.Fprintf(os.Stderr, "integration: Redis pronto em %s\n", redisURL)

	code := m.Run()

	if err := rd.Terminate(ctx); err != nil {
		log.Printf("integration: teardown Redis: %v", err)
	}
	if err := pg.Terminate(ctx); err != nil {
		log.Printf("integration: teardown Postgres: %v", err)
	}
	return code
}

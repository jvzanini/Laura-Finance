//go:build integration

// Package testutil fornece, além do bootstrap de containers (ver
// integration.go), uma factory de aplicações Fiber completas prontas
// para testes httptest dos handlers.
//
// `NewTestApp` sobe:
//   - pgxpool conectado ao container compartilhado (SharedPG)
//   - aplica migrations (laura-go/internal/migrations/*.up.sql)
//   - cache InMemory (evita dependência de Redis no caminho crítico)
//   - workspace + user seed + cookie de sessão assinado
//   - Fiber app com RegisterRoutes
//
// Uso típico:
//
//	func TestMyHandler_OK(t *testing.T) {
//	    dep := testutil.NewTestApp(t)
//	    req, _ := http.NewRequest("GET", "/api/v1/me", nil)
//	    req.AddCookie(dep.Cookie)
//	    resp, err := dep.App.Test(req, -1)
//	    ...
//	}
package testutil

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/handlers"
)

// AppDeps expõe dependências úteis aos testes.
type AppDeps struct {
	App         *fiber.App
	Pool        *pgxpool.Pool
	Cache       cache.Cache
	WorkspaceID string
	UserID      string
	Email       string
	Cookie      *http.Cookie
}

var (
	migrationsApplied int32
	migrationsMu      sync.Mutex
	sharedPool        *pgxpool.Pool
	sharedPoolOnce    sync.Once
)

// NewTestApp materializa uma aplicação Fiber testável. Reusa o
// container Postgres compartilhado (SharedPG) para evitar overhead de
// startup entre testes.
func NewTestApp(t *testing.T) *AppDeps {
	t.Helper()

	if SharedPG == nil || SharedDSN == "" {
		t.Skip("container Postgres não disponível — rodar com -tags=integration")
	}
	if os.Getenv("SESSION_SECRET") == "" {
		t.Setenv("SESSION_SECRET", "laura-test-secret-integration-fixed-32bytes")
	}

	ctx := context.Background()
	pool := ensureSharedPool(t, ctx)
	ensureMigrations(t, ctx, pool)

	// Cache in-memory (evita Redis no caminho de testes handler)
	mem, err := cache.NewInMemoryCache(512)
	if err != nil {
		t.Fatalf("cache in-memory: %v", err)
	}

	// Injeta globals dos handlers
	prevPool := db.Pool
	prevCache := handlers.Cache
	db.Pool = pool
	handlers.Cache = mem
	t.Cleanup(func() {
		db.Pool = prevPool
		handlers.Cache = prevCache
	})

	// Seed workspace + user
	workspaceID, userID, email := seedWorkspaceUser(t, ctx, pool)

	// Monta Fiber
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})
	handlers.RegisterRoutes(app)

	return &AppDeps{
		App:         app,
		Pool:        pool,
		Cache:       mem,
		WorkspaceID: workspaceID,
		UserID:      userID,
		Email:       email,
		Cookie:      SignedSession(t, userID),
	}
}

// ensureSharedPool cria pgxpool apontando ao SharedPG uma única vez.
func ensureSharedPool(t *testing.T, ctx context.Context) *pgxpool.Pool {
	t.Helper()
	sharedPoolOnce.Do(func() {
		p, err := pgxpool.New(ctx, SharedDSN)
		if err != nil {
			t.Fatalf("pgxpool: %v", err)
		}
		sharedPool = p
	})
	if sharedPool == nil {
		t.Fatalf("pool não inicializado")
	}
	return sharedPool
}

// ensureMigrations aplica todas as *.up.sql em
// laura-go/internal/migrations apenas uma vez por execução.
func ensureMigrations(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	migrationsMu.Lock()
	defer migrationsMu.Unlock()
	if atomic.LoadInt32(&migrationsApplied) == 1 {
		return
	}
	dir := findMigrationsDir(t)
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ler migrations: %v", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	for _, f := range files {
		b, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			t.Fatalf("ler %s: %v", f, err)
		}
		if _, err := pool.Exec(ctx, string(b)); err != nil {
			t.Fatalf("aplicar %s: %v", f, err)
		}
	}
	atomic.StoreInt32(&migrationsApplied, 1)
}

// findMigrationsDir localiza laura-go/internal/migrations a partir
// do arquivo deste pacote (robusto a cwd variável nos testes).
func findMigrationsDir(t *testing.T) string {
	t.Helper()
	_, thisFile, _, _ := runtime.Caller(0)
	// internal/testutil/app.go → internal/testutil → internal → laura-go
	base := filepath.Dir(filepath.Dir(thisFile))
	dir := filepath.Join(base, "migrations")
	if info, err := os.Stat(dir); err == nil && info.IsDir() {
		return dir
	}
	t.Fatalf("migrations dir não encontrado em %s", dir)
	return ""
}

// seedWorkspaceUser cria workspace + user isolado por chamada,
// reaproveitando o container mas evitando colisão cross-test.
func seedWorkspaceUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool) (string, string, string) {
	t.Helper()
	var workspaceID, userID string
	err := pool.QueryRow(ctx,
		"INSERT INTO workspaces (name) VALUES ($1) RETURNING id",
		"Test WS "+time.Now().Format("150405.000000"),
	).Scan(&workspaceID)
	if err != nil {
		t.Fatalf("insert workspace: %v", err)
	}
	// Email único por chamada para permitir múltiplos NewTestApp no mesmo run.
	email := "user+" + workspaceID[:8] + "@laura.test"
	err = pool.QueryRow(ctx,
		`INSERT INTO users (workspace_id, name, email, password_hash, role, is_super_admin)
		 VALUES ($1, 'Integration User', $2, 'hash', 'proprietário', FALSE)
		 RETURNING id`,
		workspaceID, email,
	).Scan(&userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return workspaceID, userID, email
}

// DecodeJSON é um helper útil nos testes para parse do body.
func DecodeJSON(t *testing.T, resp *http.Response, dst any) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatalf("decode json: %v", err)
	}
}

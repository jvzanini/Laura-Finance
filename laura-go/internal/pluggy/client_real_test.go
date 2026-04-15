package pluggy

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// newMockServer cria um httptest.Server que simula endpoints Pluggy
// conforme o comportamento solicitado.
func newMockServer(t *testing.T, behavior string) *httptest.Server {
	t.Helper()
	var connectHits int32
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/auth"):
			if behavior == "auth-fail" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"apiKey": "test-api-key"})
		case strings.HasSuffix(r.URL.Path, "/connect_tokens"):
			hits := atomic.AddInt32(&connectHits, 1)
			if behavior == "rate-limit-then-ok" && hits == 1 {
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
			if behavior == "rate-limit" {
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"accessToken": "test-connect-token"})
		case strings.Contains(r.URL.Path, "/items/") && strings.HasSuffix(r.URL.Path, "/transactions"):
			if behavior == "not-found" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"results": []map[string]any{
					{"id": "tx-1", "amount": 1000, "description": "Test", "date": time.Now().Format(time.RFC3339)},
				},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func newTestClient(srv *httptest.Server) *Client {
	return &Client{
		baseURL:      srv.URL,
		clientID:     "id",
		clientSecret: "secret",
		http:         srv.Client(),
	}
}

func TestClient_GetAuthToken_Success(t *testing.T) {
	srv := newMockServer(t, "ok")
	defer srv.Close()
	c := newTestClient(srv)
	token, err := c.getAuthToken(context.Background())
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if token != "test-api-key" {
		t.Errorf("token = %q, want test-api-key", token)
	}
}

func TestClient_GetAuthToken_AuthFailed(t *testing.T) {
	srv := newMockServer(t, "auth-fail")
	defer srv.Close()
	c := newTestClient(srv)
	_, err := c.getAuthToken(context.Background())
	if !errors.Is(err, ErrPluggyAuthFailed) {
		t.Fatalf("err = %v, want ErrPluggyAuthFailed", err)
	}
}

func TestClient_GetAuthToken_CachesToken(t *testing.T) {
	srv := newMockServer(t, "ok")
	defer srv.Close()
	c := newTestClient(srv)
	ctx := context.Background()

	t1, err := c.getAuthToken(ctx)
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	// Invalidamos o server; se cache funcionar, segunda chamada ainda passa.
	srv.Close()
	t2, err := c.getAuthToken(ctx)
	if err != nil {
		t.Fatalf("cached: %v", err)
	}
	if t1 != t2 {
		t.Errorf("token mismatch: %q vs %q", t1, t2)
	}
}

func TestClient_CreateConnectToken_Success(t *testing.T) {
	srv := newMockServer(t, "ok")
	defer srv.Close()
	c := newTestClient(srv)
	token, err := c.CreateConnectToken(context.Background())
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if token != "test-connect-token" {
		t.Errorf("token = %q", token)
	}
}

func TestClient_CreateConnectToken_RetriesRateLimit(t *testing.T) {
	srv := newMockServer(t, "rate-limit-then-ok")
	defer srv.Close()
	c := newTestClient(srv)
	token, err := c.CreateConnectToken(context.Background())
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if token != "test-connect-token" {
		t.Errorf("token = %q (esperava retry bem-sucedido)", token)
	}
}

func TestClient_FetchTransactions_NotFound(t *testing.T) {
	srv := newMockServer(t, "not-found")
	defer srv.Close()
	c := newTestClient(srv)
	_, err := c.FetchTransactions(context.Background(), "item-x")
	if !errors.Is(err, ErrPluggyNotFound) {
		t.Fatalf("err = %v, want ErrPluggyNotFound", err)
	}
}

func TestClient_FetchTransactions_Success(t *testing.T) {
	srv := newMockServer(t, "ok")
	defer srv.Close()
	c := newTestClient(srv)
	txs, err := c.FetchTransactions(context.Background(), "item-1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(txs) != 1 {
		t.Fatalf("len = %d, want 1", len(txs))
	}
	if txs[0].ID != "tx-1" || txs[0].Amount != 1000 {
		t.Errorf("unexpected tx: %+v", txs[0])
	}
}

func TestRetryableDo_ReturnsNonRetryableImmediately(t *testing.T) {
	attempts := 0
	err := retryableDo(context.Background(), func(ctx context.Context) error {
		attempts++
		return ErrPluggyAuthFailed
	})
	if attempts != 1 {
		t.Errorf("attempts = %d, want 1 (auth not retryable)", attempts)
	}
	if !errors.Is(err, ErrPluggyAuthFailed) {
		t.Errorf("err = %v", err)
	}
}

func TestRetryableDo_RetriesRateLimited(t *testing.T) {
	attempts := 0
	_ = retryableDo(context.Background(), func(ctx context.Context) error {
		attempts++
		return ErrPluggyRateLimited
	})
	if attempts < 4 {
		t.Errorf("attempts = %d, want >=4 (3 retries + última)", attempts)
	}
}

func TestRetryableDo_RespectsContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := retryableDo(ctx, func(ctx context.Context) error {
		return ErrPluggyRateLimited
	})
	if err == nil {
		t.Fatal("expected error on canceled ctx")
	}
}

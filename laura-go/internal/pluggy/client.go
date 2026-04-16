// Package pluggy fornece cliente HTTP para integração com Pluggy
// (Open Finance Brasil).
//
// Doc: https://docs.pluggy.ai/
package pluggy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

// Client é o cliente HTTP para a API Pluggy. O X-API-KEY obtido via
// POST /auth é cached internamente por 1h50m (TTL oficial é 2h).
type Client struct {
	baseURL      string
	clientID     string
	clientSecret string
	http         *http.Client

	authMu    sync.RWMutex
	authToken string
	authExp   time.Time
}

// NewClient instancia o cliente lendo PLUGGY_CLIENT_ID e
// PLUGGY_CLIENT_SECRET do ambiente. Retorna client sempre não-nil;
// chamadas falham com ErrPluggyAuthFailed se IsConfigured() == false.
func NewClient() *Client {
	return &Client{
		baseURL:      "https://api.pluggy.ai",
		clientID:     os.Getenv("PLUGGY_CLIENT_ID"),
		clientSecret: os.Getenv("PLUGGY_CLIENT_SECRET"),
		http:         &http.Client{Timeout: 10 * time.Second},
	}
}

// IsConfigured retorna true se PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET
// estão setados.
func (c *Client) IsConfigured() bool {
	return c.clientID != "" && c.clientSecret != ""
}

// getAuthToken retorna o API key cached ou obtém novo via POST /auth.
// Cache válido por 1h50m (margem de segurança sobre TTL oficial de 2h).
func (c *Client) getAuthToken(ctx context.Context) (string, error) {
	c.authMu.RLock()
	if c.authToken != "" && time.Now().Before(c.authExp) {
		token := c.authToken
		c.authMu.RUnlock()
		return token, nil
	}
	c.authMu.RUnlock()

	c.authMu.Lock()
	defer c.authMu.Unlock()
	// Double-check pós-lock — outro goroutine pode ter populado.
	if c.authToken != "" && time.Now().Before(c.authExp) {
		return c.authToken, nil
	}

	if !c.IsConfigured() {
		return "", ErrPluggyAuthFailed
	}

	body := map[string]string{
		"clientId":     c.clientID,
		"clientSecret": c.clientSecret,
	}
	rawBody, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/auth", bytes.NewReader(rawBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrPluggyInternal, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode == http.StatusUnauthorized, resp.StatusCode == http.StatusForbidden:
		return "", ErrPluggyAuthFailed
	case resp.StatusCode >= 500:
		return "", ErrPluggyInternal
	case resp.StatusCode != http.StatusOK:
		return "", fmt.Errorf("pluggy auth: status %d", resp.StatusCode)
	}

	var authResp struct {
		APIKey string `json:"apiKey"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return "", err
	}

	c.authToken = authResp.APIKey
	c.authExp = time.Now().Add(110 * time.Minute)
	return c.authToken, nil
}

// backoffSchedule define os delays entre retries para erros retryable.
var backoffSchedule = []time.Duration{
	200 * time.Millisecond,
	500 * time.Millisecond,
	1 * time.Second,
}

// retryableDo executa fn com até 3 retries em erros ErrPluggyRateLimited/
// ErrPluggyInternal. Backoff: 200ms → 500ms → 1s. Erros não-retryable
// retornam imediatamente. Respeita ctx.Done().
func retryableDo(ctx context.Context, fn func(ctx context.Context) error) error {
	var lastErr error
	for i := 0; i < len(backoffSchedule); i++ {
		err := fn(ctx)
		if err == nil {
			return nil
		}
		lastErr = err
		if !isRetryable(err) {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoffSchedule[i]):
		}
	}
	// Última tentativa.
	if err := fn(ctx); err != nil {
		return err
	}
	_ = lastErr
	return nil
}

// CreateConnectToken solicita um connect_token (30min TTL) para o
// Pluggy Widget. Retorna ErrPluggyAuthFailed se credenciais ausentes.
func (c *Client) CreateConnectToken(ctx context.Context) (string, error) {
	if !c.IsConfigured() {
		return "", ErrPluggyAuthFailed
	}

	var token string
	err := retryableDo(ctx, func(ctx context.Context) error {
		apiKey, err := c.getAuthToken(ctx)
		if err != nil {
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/connect_tokens", nil)
		if err != nil {
			return err
		}
		req.Header.Set("X-API-KEY", apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.http.Do(req)
		if err != nil {
			return ErrPluggyInternal
		}
		defer func() { _ = resp.Body.Close() }()

		switch {
		case resp.StatusCode == http.StatusTooManyRequests:
			return ErrPluggyRateLimited
		case resp.StatusCode >= 500:
			return ErrPluggyInternal
		case resp.StatusCode != http.StatusOK:
			return fmt.Errorf("pluggy connect: status %d", resp.StatusCode)
		}

		var body struct {
			AccessToken string `json:"accessToken"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return err
		}
		token = body.AccessToken
		return nil
	})

	return token, err
}

// Transaction representa uma transação bancária retornada pelo Pluggy.
type Transaction struct {
	ID          string
	Amount      int64 // em centavos
	Description string
	Date        time.Time
}

// FetchTransactions busca transações de um item Pluggy (GET
// /items/{id}/transactions). Pagina primeira até 500 resultados.
func (c *Client) FetchTransactions(ctx context.Context, itemID string) ([]Transaction, error) {
	if !c.IsConfigured() {
		return nil, ErrPluggyAuthFailed
	}

	var transactions []Transaction
	err := retryableDo(ctx, func(ctx context.Context) error {
		apiKey, err := c.getAuthToken(ctx)
		if err != nil {
			return err
		}

		url := fmt.Sprintf("%s/items/%s/transactions?pageSize=500", c.baseURL, itemID)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("X-API-KEY", apiKey)

		resp, err := c.http.Do(req)
		if err != nil {
			return ErrPluggyInternal
		}
		defer func() { _ = resp.Body.Close() }()

		switch {
		case resp.StatusCode == http.StatusNotFound:
			return ErrPluggyNotFound
		case resp.StatusCode == http.StatusTooManyRequests:
			return ErrPluggyRateLimited
		case resp.StatusCode >= 500:
			return ErrPluggyInternal
		case resp.StatusCode != http.StatusOK:
			return fmt.Errorf("pluggy transactions: status %d", resp.StatusCode)
		}

		var body struct {
			Results []struct {
				ID          string    `json:"id"`
				Amount      int64     `json:"amount"`
				Description string    `json:"description"`
				Date        time.Time `json:"date"`
			} `json:"results"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return err
		}

		transactions = transactions[:0]
		for _, r := range body.Results {
			transactions = append(transactions, Transaction{
				ID:          r.ID,
				Amount:      r.Amount,
				Description: r.Description,
				Date:        r.Date,
			})
		}
		return nil
	})

	return transactions, err
}

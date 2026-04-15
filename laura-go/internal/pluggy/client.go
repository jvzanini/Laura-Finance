// Package pluggy fornece cliente HTTP para integração com Pluggy
// (Open Finance Brasil). Implementação atual é esqueleto — será
// completa em Fase 14 quando secrets PLUGGY_CLIENT_ID/SECRET estiverem
// disponíveis.
//
// Doc: https://docs.pluggy.ai/
package pluggy

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"
)

// Client é um cliente stub para a API Pluggy.
type Client struct {
	baseURL      string
	clientID     string
	clientSecret string
	http         *http.Client
}

// NewClient instancia o cliente lendo PLUGGY_CLIENT_ID e
// PLUGGY_CLIENT_SECRET do ambiente. Retorna client sempre não-nil;
// chamadas falham se IsConfigured() == false.
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

// CreateConnectToken solicita um connect_token para o Pluggy Widget.
// STUB — STANDBY [PLUGGY-CLIENT-ID/SECRET]. Fase 14: implementar
// POST /auth + POST /connect_token.
func (c *Client) CreateConnectToken(ctx context.Context) (string, error) {
	if !c.IsConfigured() {
		return "", errors.New("pluggy not configured (STANDBY)")
	}
	return "STUB_CONNECT_TOKEN", nil
}

// Transaction representa uma transação bancária retornada pelo Pluggy.
type Transaction struct {
	ID          string
	Amount      int64 // em centavos
	Description string
	Date        time.Time
}

// FetchTransactions busca transações de uma conta. STUB — Fase 14.
func (c *Client) FetchTransactions(ctx context.Context, accountID string) ([]Transaction, error) {
	if !c.IsConfigured() {
		return nil, errors.New("pluggy not configured (STANDBY)")
	}
	return []Transaction{}, nil
}

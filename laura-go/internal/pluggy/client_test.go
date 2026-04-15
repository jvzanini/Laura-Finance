package pluggy

import (
	"context"
	"os"
	"testing"
)

func TestIsConfigured_False(t *testing.T) {
	_ = os.Unsetenv("PLUGGY_CLIENT_ID")
	_ = os.Unsetenv("PLUGGY_CLIENT_SECRET")
	c := NewClient()
	if c.IsConfigured() {
		t.Error("should not be configured when env vars unset")
	}
}

func TestIsConfigured_True(t *testing.T) {
	t.Setenv("PLUGGY_CLIENT_ID", "id")
	t.Setenv("PLUGGY_CLIENT_SECRET", "secret")
	c := NewClient()
	if !c.IsConfigured() {
		t.Error("should be configured when both env vars set")
	}
}

func TestIsConfigured_OnlyOneSet(t *testing.T) {
	t.Setenv("PLUGGY_CLIENT_ID", "id")
	_ = os.Unsetenv("PLUGGY_CLIENT_SECRET")
	c := NewClient()
	if c.IsConfigured() {
		t.Error("should not be configured with only ID")
	}
}

func TestCreateConnectToken_Unconfigured(t *testing.T) {
	_ = os.Unsetenv("PLUGGY_CLIENT_ID")
	_ = os.Unsetenv("PLUGGY_CLIENT_SECRET")
	c := NewClient()
	_, err := c.CreateConnectToken(context.Background())
	if err == nil {
		t.Error("expected error when unconfigured")
	}
}

func TestCreateConnectToken_Configured(t *testing.T) {
	t.Setenv("PLUGGY_CLIENT_ID", "id")
	t.Setenv("PLUGGY_CLIENT_SECRET", "secret")
	c := NewClient()
	token, err := c.CreateConnectToken(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("token should not be empty when configured")
	}
}

func TestFetchTransactions_Unconfigured(t *testing.T) {
	_ = os.Unsetenv("PLUGGY_CLIENT_ID")
	_ = os.Unsetenv("PLUGGY_CLIENT_SECRET")
	c := NewClient()
	_, err := c.FetchTransactions(context.Background(), "acc-1")
	if err == nil {
		t.Error("expected error when unconfigured")
	}
}

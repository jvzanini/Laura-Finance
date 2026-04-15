package obs

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

func TestNewLogger_JSONInProduction(t *testing.T) {
	var buf bytes.Buffer
	h := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(NewContextHandler(h))
	logger.Info("hello", "key", "value")
	var m map[string]any
	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		t.Fatalf("expected JSON, got %v: %s", err, buf.String())
	}
	if m["msg"] != "hello" || m["key"] != "value" {
		t.Fatalf("unexpected payload: %v", m)
	}
}

func TestContextHandler_InjectsRequestID(t *testing.T) {
	var buf bytes.Buffer
	h := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(NewContextHandler(h))
	ctx := WithRequestID(context.Background(), "req-123")
	logger.InfoContext(ctx, "hit")
	if !strings.Contains(buf.String(), `"request_id":"req-123"`) {
		t.Fatalf("expected request_id in log, got: %s", buf.String())
	}
}

func TestContextHandler_NoRequestID_WhenAbsent(t *testing.T) {
	var buf bytes.Buffer
	h := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(NewContextHandler(h))
	logger.Info("no ctx")
	if strings.Contains(buf.String(), `"request_id"`) {
		t.Fatalf("did not expect request_id, got: %s", buf.String())
	}
}

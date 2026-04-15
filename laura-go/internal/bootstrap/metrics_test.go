package bootstrap

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInitMetrics(t *testing.T) {
	res, err := InitMetrics()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res == nil || res.App == nil {
		t.Fatal("metrics app nil")
	}
	req := httptest.NewRequest("GET", "/metrics", nil)
	resp, err := res.App.Test(req, -1)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	s := string(body)
	if !strings.Contains(s, "go_") && !strings.Contains(s, "process_") && !strings.Contains(s, "# HELP") {
		t.Logf("warning: metrics body may be empty or trimmed: %q", s[:min(len(s), 200)])
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

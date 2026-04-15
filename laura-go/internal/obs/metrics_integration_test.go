package obs

import (
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

// TestMetricsApp_ServesMetrics sobe o metricsApp em um listener real
// (porta :0) e faz GET /metrics via net/http. Evita comportamento
// esquisito do fasthttp streaming writer sob app.Test().
func TestMetricsApp_ServesMetrics(t *testing.T) {
	app, _ := NewMetricsApp()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	go func() { _ = app.Listener(ln) }()
	defer func() { _ = app.Shutdown() }()

	// dá tempo pro Fiber subir no listener
	time.Sleep(50 * time.Millisecond)

	url := "http://" + ln.Addr().String() + "/metrics"
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("status %d, want 200", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	bodyStr := string(body)
	if !strings.Contains(bodyStr, "go_") && !strings.Contains(bodyStr, "process_") {
		snip := bodyStr
		if len(snip) > 200 {
			snip = snip[:200]
		}
		t.Fatalf("metrics body missing go_/process_ defaults: %q", snip)
	}
}

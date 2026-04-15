package services

import (
	"os"
	"testing"
)

func TestProviderFromEndpoint(t *testing.T) {
	cases := []struct {
		endpoint string
		want     string
	}{
		{"https://api.groq.com/openai/v1/chat/completions", "groq"},
		{"https://api.openai.com/v1/chat/completions", "openai"},
		{"https://generativelanguage.googleapis.com/v1beta", "google"},
		{"https://gemini.example.com", "google"},
		{"https://other.example.com", "unknown"},
	}
	for _, tc := range cases {
		got := providerFromEndpoint(tc.endpoint)
		if got != tc.want {
			t.Errorf("providerFromEndpoint(%q) = %q, want %q", tc.endpoint, got, tc.want)
		}
	}
}

func TestLookupEnv_Empty(t *testing.T) {
	_ = os.Unsetenv("LAURA_TEST_NEVER_SET")
	v, ok := lookupEnv("LAURA_TEST_NEVER_SET")
	if ok {
		t.Errorf("lookupEnv em var não setada deveria retornar false, got ok=true v=%q", v)
	}
}

func TestLookupEnv_Set(t *testing.T) {
	t.Setenv("LAURA_TEST_SET", "value")
	v, ok := lookupEnv("LAURA_TEST_SET")
	if !ok || v != "value" {
		t.Errorf("lookupEnv = (%q, %v), want (\"value\", true)", v, ok)
	}
}

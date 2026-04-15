package services

import (
	"context"
	"testing"
)

type mockProvider struct {
	receivedCtx context.Context
}

func (m *mockProvider) ChatCompletion(ctx context.Context, sp, um string) (string, error) {
	m.receivedCtx = ctx
	return "mock", nil
}

func (m *mockProvider) TranscribeAudio(data []byte, filename string) (string, error) {
	return "", nil
}

func (m *mockProvider) SupportsImage() bool  { return false }
func (m *mockProvider) ProviderName() string { return "mock" }

func TestChatCompletionLegacyAware_Default_PassesCtx(t *testing.T) {
	t.Setenv("LLM_LEGACY_NOCONTEXT", "false")
	p := &mockProvider{}
	type ctxKey struct{}
	ctx := context.WithValue(context.Background(), ctxKey{}, "marker")
	_, _ = ChatCompletionLegacyAware(ctx, p, "sys", "user")
	if p.receivedCtx.Value(ctxKey{}) != "marker" {
		t.Error("ctx não propagado")
	}
}

func TestChatCompletionLegacyAware_Legacy_UsesBackground(t *testing.T) {
	t.Setenv("LLM_LEGACY_NOCONTEXT", "true")
	p := &mockProvider{}
	type ctxKey struct{}
	ctx := context.WithValue(context.Background(), ctxKey{}, "marker")
	_, _ = ChatCompletionLegacyAware(ctx, p, "sys", "user")
	if p.receivedCtx.Value(ctxKey{}) == "marker" {
		t.Error("ctx legacy deveria ser background, não propagado")
	}
}

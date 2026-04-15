package services

import (
	"context"
	"os"
)

// ChatCompletionLegacyAware delega para ChatCompletion(ctx) ou versão fallback
// quando LLM_LEGACY_NOCONTEXT=true. Usado durante migration period (Fase 13→14).
// Remover quando flag for desligada permanentemente.
func ChatCompletionLegacyAware(ctx context.Context, provider LLMProvider, systemPrompt, userMessage string) (string, error) {
	if os.Getenv("LLM_LEGACY_NOCONTEXT") == "true" {
		// Fallback: usa context.Background() (descarta ctx propagado).
		return provider.ChatCompletion(context.Background(), systemPrompt, userMessage)
	}
	return provider.ChatCompletion(ctx, systemPrompt, userMessage)
}

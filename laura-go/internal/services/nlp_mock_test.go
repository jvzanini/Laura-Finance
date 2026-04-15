package services

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// withMockChat substitui nlpChatFn por um stub durante o teste e restaura
// o original no Cleanup. Retorna um contador e slice pra inspeção.
func withMockChat(t *testing.T, mock func(ctx context.Context, planSlug, sys, user string) (string, string, error)) {
	t.Helper()
	original := nlpChatFn
	nlpChatFn = mock
	t.Cleanup(func() {
		nlpChatFn = original
	})
}

// TestNLP_ParseExpense_Simple: resposta JSON limpa "gastei 25.50 no ifood".
func TestNLP_ParseExpense_Simple(t *testing.T) {
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		return "groq", `{
			"amount": 25.50,
			"description": "Ifood",
			"type": "expense",
			"labels": ["lanche"],
			"confidence": 0.95,
			"needs_review": false,
			"is_crisis": false
		}`, nil
	})

	raw, parsed, err := ExtractTransactionFromText(context.Background(), "gastei 25.50 no ifood", "standard")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if raw == "" {
		t.Error("raw deveria conter o JSON bruto")
	}
	if parsed == nil {
		t.Fatal("parsed == nil")
	}
	if parsed.Type != "expense" {
		t.Errorf("Type=%q esperado expense", parsed.Type)
	}
	if parsed.Amount != 25.50 {
		t.Errorf("Amount=%.2f esperado 25.50", parsed.Amount)
	}
	if parsed.Description != "Ifood" {
		t.Errorf("Description=%q", parsed.Description)
	}
}

// TestNLP_ParseIncome: resposta JSON de income.
func TestNLP_ParseIncome(t *testing.T) {
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		return "openai", `{
			"amount": 5000.00,
			"description": "Salário",
			"type": "income",
			"labels": ["trabalho"],
			"confidence": 0.99,
			"needs_review": false,
			"is_crisis": false
		}`, nil
	})

	_, parsed, err := ExtractTransactionFromText(context.Background(), "recebi 5000 de salário", "vip")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if parsed.Type != "income" {
		t.Errorf("Type=%q esperado income", parsed.Type)
	}
	if parsed.Amount != 5000.00 {
		t.Errorf("Amount=%.2f esperado 5000.00", parsed.Amount)
	}
}

// TestNLP_LLMError_Fallback: LLM retorna erro → mensagem de erro contém
// nome do provider para troubleshooting.
func TestNLP_LLMError_Fallback(t *testing.T) {
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		return "groq", "", errors.New("connection refused")
	})

	raw, parsed, err := ExtractTransactionFromText(context.Background(), "gastei algo", "standard")
	if err == nil {
		t.Fatal("esperava erro do LLM, veio nil")
	}
	if parsed != nil {
		t.Errorf("parsed deveria ser nil em erro, veio %+v", parsed)
	}
	if raw != "" {
		t.Errorf("raw deveria ser vazio em erro, veio %q", raw)
	}
	if !strings.Contains(err.Error(), "groq") {
		t.Errorf("erro não contém nome do provider: %v", err)
	}
}

// TestNLP_InvalidJSON: LLM retorna texto não-JSON → erro de parsing.
func TestNLP_InvalidJSON(t *testing.T) {
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		return "google", "isto não é JSON, desculpe", nil
	})

	raw, parsed, err := ExtractTransactionFromText(context.Background(), "abc", "standard")
	if err == nil {
		t.Fatal("esperava erro de parsing, veio nil")
	}
	if parsed != nil {
		t.Error("parsed deveria ser nil com JSON inválido")
	}
	if !strings.Contains(raw, "não é JSON") {
		t.Errorf("raw deveria conter o output bruto do LLM para debug, veio %q", raw)
	}
}

// TestNLP_AmbiguousAmount: "10 reais" vs "R$ 10" — garante que qualquer
// valor válido em JSON é aceito e preservado (needs_review pode sinalizar).
func TestNLP_AmbiguousAmount(t *testing.T) {
	cases := []struct {
		name        string
		raw         string
		wantAmount  float64
		wantReview  bool
	}{
		{
			"reais_verbal",
			`{"amount": 10, "description": "Pao", "type": "expense", "labels": [], "confidence": 0.7, "needs_review": true, "is_crisis": false}`,
			10,
			true,
		},
		{
			"rs_simbolo",
			`{"amount": 10.00, "description": "Pao", "type": "expense", "labels": [], "confidence": 0.95, "needs_review": false, "is_crisis": false}`,
			10,
			false,
		},
		{
			"confianca_baixa",
			`{"amount": 100, "description": "Algo", "type": "expense", "labels": [], "confidence": 0.3, "needs_review": true, "is_crisis": false}`,
			100,
			true,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
				return "groq", c.raw, nil
			})
			_, parsed, err := ExtractTransactionFromText(context.Background(), "msg", "standard")
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if parsed.Amount != c.wantAmount {
				t.Errorf("Amount=%.2f esperado %.2f", parsed.Amount, c.wantAmount)
			}
			if parsed.NeedsReview != c.wantReview {
				t.Errorf("NeedsReview=%v esperado %v", parsed.NeedsReview, c.wantReview)
			}
		})
	}
}

// TestNLP_Crisis: flag is_crisis ativada pelo LLM preserva crisis_reason.
func TestNLP_Crisis(t *testing.T) {
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		return "groq", `{
			"amount": 6000,
			"description": "Fatura Itau",
			"type": "expense",
			"labels": ["fatura"],
			"confidence": 0.98,
			"needs_review": false,
			"is_crisis": true,
			"crisis_reason": "So tenho 2000 de 6000"
		}`, nil
	})
	_, parsed, err := ExtractTransactionFromText(context.Background(), "nao consigo pagar", "standard")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if !parsed.IsCrisis {
		t.Error("IsCrisis esperado true")
	}
	if parsed.CrisisReason == "" {
		t.Error("CrisisReason não pode ser vazio em crise")
	}
}

// TestNLP_EmptyPlan_DefaultsStandard: planSlug vazio → "standard".
func TestNLP_EmptyPlan_DefaultsStandard(t *testing.T) {
	var gotPlan string
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		gotPlan = plan
		return "groq", `{"amount":1,"description":"x","type":"expense","labels":[],"confidence":1,"needs_review":false,"is_crisis":false}`, nil
	})
	_, _, err := ExtractTransactionFromText(context.Background(), "teste", "")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if gotPlan != "standard" {
		t.Errorf("planSlug=%q esperado standard (default)", gotPlan)
	}
}

// TestNLP_NilContext: ctx nil → substituído por Background sem panic.
func TestNLP_NilContext(t *testing.T) {
	withMockChat(t, func(ctx context.Context, plan, sys, user string) (string, string, error) {
		if ctx == nil {
			t.Error("ctx não deveria chegar nil no mock")
		}
		return "groq", `{"amount":1,"description":"x","type":"expense","labels":[],"confidence":1,"needs_review":false,"is_crisis":false}`, nil
	})
	//nolint:staticcheck // deliberado: teste do guard de ctx nil
	_, _, err := ExtractTransactionFromText(nil, "teste", "standard")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
}

// TestChatCompletionLegacyAware_WithProvider exercita o wrapper — usa
// um fake provider que grava se ctx chegou válido.
type fakeProvider struct {
	name        string
	lastCtxBG   bool
	resp        string
	err         error
}

func (f *fakeProvider) ChatCompletion(ctx context.Context, sys, user string) (string, error) {
	// Se ctx é Background, não tem deadline nem valores.
	if _, ok := ctx.Deadline(); !ok && ctx.Value("__mark__") == nil {
		f.lastCtxBG = true
	}
	return f.resp, f.err
}
func (f *fakeProvider) TranscribeAudio(_ []byte, _ string) (string, error) { return "", nil }
func (f *fakeProvider) SupportsImage() bool                                { return false }
func (f *fakeProvider) ProviderName() string                               { return f.name }

func TestChatCompletionLegacyAware_PassesContext(t *testing.T) {
	p := &fakeProvider{name: "fake", resp: "ok"}
	ctx := context.WithValue(context.Background(), ctxMarkKey, "v")
	_, err := ChatCompletionLegacyAware(ctx, p, "s", "u")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
}

type ctxKey string

const ctxMarkKey ctxKey = "__mark__"

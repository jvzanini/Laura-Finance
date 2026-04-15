package services

import (
	"context"
	"encoding/json"
	"fmt"
)

type ParsedTransactionDef struct {
	Amount       float64  `json:"amount"`
	Description  string   `json:"description"`
	Type         string   `json:"type"` // "expense" or "income"
	Labels       []string `json:"labels"`
	Confidence   float64  `json:"confidence"`
	NeedsReview  bool     `json:"needs_review"`
	IsCrisis     bool     `json:"is_crisis"`
	CrisisReason string   `json:"crisis_reason,omitempty"`
}

const nlpSystemPrompt = `Você é um Analista Financeiro assistente. Extraia as informações de transação financeira do texto do usuário.
Responda APENAS E EXCLUSIVAMENTE COM UM JSON válido. Não inclua texto extra, markdown ou crases, apenas o JSON.

O JSON deve seguir a estrutura exata:
{
  "amount": <number, use positive absolute value, use dot . for float>,
  "description": "<string, extraia o local/motivo do gasto>",
  "type": "<string, 'expense' ou 'income'>",
  "labels": ["<string>", "<string>"],
  "confidence": <number, 0.0 to 1.0 de certeza sobre os dados extraídos>,
  "needs_review": <boolean, true se o texto for confuso ou incompleto>,
  "is_crisis": <boolean, true se o usuário disser que não vai conseguir pagar, está endividado ou pedindo para adiar/rolar dívida>,
  "crisis_reason": "<string, extraia o motivo da crise se houver>"
}

Exemplo:
USER: "Gastei 25.50 no ifood #lanche"
RESPOSTA:
{
  "amount": 25.50,
  "description": "Ifood",
  "type": "expense",
  "labels": ["lanche"],
  "confidence": 0.95,
  "needs_review": false,
  "is_crisis": false
}

Exemplo 2:
USER: "Não vou conseguir pagar o Itaú, a fatura veio 6000 e só tenho 2000"
RESPOSTA:
{
  "amount": 6000,
  "description": "Fatura Itaú",
  "type": "expense",
  "labels": ["fatura"],
  "confidence": 0.98,
  "needs_review": false,
  "is_crisis": true,
  "crisis_reason": "Só tem 2000 para pagar a fatura de 6000"
}`

// nlpChatFn é o hook usado por ExtractTransactionFromText para chamar o LLM.
// Exposto como variável para permitir injeção em testes unitários sem rede.
// Em produção, aponta para ChatCompletionLegacyAware(provider de GetProviderForPlan).
var nlpChatFn = func(ctx context.Context, planSlug, systemPrompt, userMessage string) (string, string, error) {
	provider := GetProviderForPlan(planSlug)
	content, err := ChatCompletionLegacyAware(ctx, provider, systemPrompt, userMessage)
	return provider.ProviderName(), content, err
}

// ExtractTransactionFromText usa o LLMProvider configurado para o plano do workspace.
// Se planSlug estiver vazio, usa o provider default (Groq Llama 70B).
func ExtractTransactionFromText(ctx context.Context, text string, planSlug string) (string, *ParsedTransactionDef, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if planSlug == "" {
		planSlug = "standard"
	}

	providerName, rawContent, err := nlpChatFn(ctx, planSlug, nlpSystemPrompt, text)
	if err != nil {
		return "", nil, fmt.Errorf("LLM (%s) error: %v", providerName, err)
	}

	var parsed ParsedTransactionDef
	if err := json.Unmarshal([]byte(rawContent), &parsed); err != nil {
		return rawContent, nil, fmt.Errorf("failed to parse LLM output as JSON: %v. Output: %s", err, rawContent)
	}

	return rawContent, &parsed, nil
}

// ExtractTransactionFromTextLegacy mantém compatibilidade com código que não passa planSlug.
func ExtractTransactionFromTextLegacy(text string) (string, *ParsedTransactionDef, error) {
	return ExtractTransactionFromText(context.Background(), text, "standard")
}

// TranscribeAudioForPlan usa o provider do plano para transcrever áudio.
func TranscribeAudioForPlan(data []byte, filename string, planSlug string) (string, error) {
	if planSlug == "" {
		planSlug = "standard"
	}
	provider := GetProviderForPlan(planSlug)
	return provider.TranscribeAudio(data, filename)
}

package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type GroqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type GroqCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []GroqMessage `json:"messages"`
	Temperature float32       `json:"temperature"`
}

type ParsedTransactionDef struct {
	Amount       float64  `json:"amount"`
	Description  string   `json:"description"`
	Type         string   `json:"type"` // "expense" or "income"
	Labels       []string `json:"labels"`
	Confidence   float64  `json:"confidence"`
	NeedsReview  bool     `json:"needs_review"`
	IsCrisis     bool     `json:"is_crisis"`
	CrisisReason string   `json:"crisis_reason,omitempty"`
	// Futuramente map categories and cards ids by name based on workspace context
}

// ExtractTransactionFromText sends text to Llama-3-70B on Groq to extract JSON transaction intent
func ExtractTransactionFromText(text string) (string, *ParsedTransactionDef, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return "", nil, fmt.Errorf("GROQ_API_KEY environment variable is not set")
	}

	url := "https://api.groq.com/openai/v1/chat/completions"

	prompt := `Você é um Analista Financeiro assistente. Extraia as informações de transação financeira do texto do usuário.
Responda APENAS E EXCLUSIVAMENTE COM UM JSON válido. Não inclua texto extra, markdown ou crases, apenas o JSON.

O JSON deve seguir a estrutura exata:
{
  "amount": <number, use positive absolute value, use dot . for float>,
  "description": "<string, extraia o local/motivo do gasto>",
  "type": "<string, 'expense' ou 'income'>",
  "labels": ["<string>", "<string>"], // extraia contextos como tags simples sem #, max 3. Exemplo: ["viagem", "refeição"]
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

	reqBody := GroqCompletionRequest{
		Model:       "llama3-70b-8192", // Using large robust model on GROQ for reliable JSON struct
		Temperature: 0.1,
		Messages: []GroqMessage{
			{Role: "system", Content: prompt},
			{Role: "user", Content: text},
		},
	}

	jsonData, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("failed calling Groq Chat API: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return "", nil, fmt.Errorf("groq API error (status %d): %s", resp.StatusCode, respBytes)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", nil, fmt.Errorf("error decoding Groq response: %v", err)
	}

	if len(result.Choices) == 0 {
		return "", nil, fmt.Errorf("empty choices from Groq")
	}

	rawContent := result.Choices[0].Message.Content

	var parsed ParsedTransactionDef
	err = json.Unmarshal([]byte(rawContent), &parsed)
	if err != nil {
		// Retornar o plain text de qualquer forma pra logar o erro
		return rawContent, nil, fmt.Errorf("failed to parse Llama output as JSON: %v. Output was: %s", err, rawContent)
	}

	return rawContent, &parsed, nil
}

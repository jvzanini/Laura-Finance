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
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	Type        string  `json:"type"` // "expense" or "income"
	Confidence  float64 `json:"confidence"`
	NeedsReview bool    `json:"needs_review"`
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
  "confidence": <number, 0.0 to 1.0 de certeza sobre os dados extraídos>,
  "needs_review": <boolean, true se o texto for confuso ou incompleto>
}

Exemplo:
USER: "Gastei 25.50 no ifood"
RESPOSTA:
{
  "amount": 25.50,
  "description": "Ifood",
  "type": "expense",
  "confidence": 0.95,
  "needs_review": false
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

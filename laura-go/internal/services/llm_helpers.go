package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var llmHTTPClient = &http.Client{
	Timeout: 30 * time.Second,
}

func lookupEnv(key string) (string, bool) {
	v := os.Getenv(key)
	return v, v != ""
}

// groqChatCompletion faz uma chamada OpenAI-compatible para Groq.
func groqChatCompletion(ctx context.Context, model string, temperature float32, systemPrompt, userMessage string) (string, error) {
	apiKey := getProviderKey("groq")
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY não configurada")
	}
	return openaiCompatibleChat(ctx, "https://api.groq.com/openai/v1/chat/completions", apiKey, model, temperature, systemPrompt, userMessage)
}

// groqTranscribeAudio faz transcrição via Groq Whisper.
func groqTranscribeAudio(model string, data []byte, filename string) (string, error) {
	apiKey := getProviderKey("groq")
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY não configurada")
	}
	return openaiCompatibleTranscribe("https://api.groq.com/openai/v1/audio/transcriptions", apiKey, model, data, filename)
}

// providerFromEndpoint infere o nome do provider pela URL do endpoint.
func providerFromEndpoint(endpoint string) string {
	switch {
	case strings.Contains(endpoint, "groq.com"):
		return "groq"
	case strings.Contains(endpoint, "openai.com"):
		return "openai"
	case strings.Contains(endpoint, "google") || strings.Contains(endpoint, "gemini"):
		return "google"
	default:
		return "unknown"
	}
}

// openaiCompatibleChat funciona com qualquer API que segue o formato OpenAI (Groq, OpenAI, Gemini).
func openaiCompatibleChat(ctx context.Context, endpoint, apiKey, model string, temperature float32, systemPrompt, userMessage string) (string, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	provider := providerFromEndpoint(endpoint)
	start := time.Now()
	ctx, span := otel.Tracer("laura/llm").Start(ctx, "llm.chat_completion",
		trace.WithAttributes(
			attribute.String("llm.provider", provider),
			attribute.String("llm.model", model),
		),
	)
	defer func() {
		duration := time.Since(start)
		if duration > 10*time.Second {
			slog.Warn("llm_timeout_slow", "provider", provider, "duration_ms", duration.Milliseconds())
			obs.ObserveLLMTimeout(provider)
		}
		span.End()
	}()

	reqBody := map[string]interface{}{
		"model":       model,
		"temperature": temperature,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
	}

	jsonData, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := llmHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("LLM API unreachable: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("LLM API error (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("error decoding LLM response: %v", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("empty choices from LLM")
	}
	return result.Choices[0].Message.Content, nil
}

// openaiCompatibleTranscribe funciona com Groq Whisper e OpenAI Whisper.
func openaiCompatibleTranscribe(endpoint, apiKey, model string, data []byte, filename string) (string, error) {
	provider := providerFromEndpoint(endpoint)
	start := time.Now()
	_, span := otel.Tracer("laura/llm").Start(context.Background(), "llm.transcribe",
		trace.WithAttributes(
			attribute.String("llm.provider", provider),
			attribute.String("llm.model", model),
		),
	)
	defer func() {
		duration := time.Since(start)
		if duration > 10*time.Second {
			slog.Warn("llm_timeout_slow", "provider", provider, "duration_ms", duration.Milliseconds())
			obs.ObserveLLMTimeout(provider)
		}
		span.End()
	}()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, bytes.NewReader(data)); err != nil {
		return "", err
	}
	_ = writer.WriteField("model", model)
	_ = writer.WriteField("language", "pt")
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", endpoint, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := llmHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("whisper API unreachable: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("whisper API error (status %d): %s", resp.StatusCode, respBody)
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Text, nil
}

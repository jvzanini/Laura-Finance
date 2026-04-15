package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// LLMProvider abstrai a comunicação com diferentes provedores de IA.
// Cada plano de assinatura pode usar um provider/modelo diferente.
type LLMProvider interface {
	ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error)
	TranscribeAudio(data []byte, filename string) (string, error)
	SupportsImage() bool
	ProviderName() string
}

// PlanAIConfig é a configuração de IA armazenada no JSONB de subscription_plans.ai_model_config
type PlanAIConfig struct {
	Provider     string  `json:"provider"`      // "groq", "openai", "google"
	ChatModel    string  `json:"chat_model"`     // "llama3-70b-8192", "gpt-4.1", etc.
	WhisperModel string  `json:"whisper_model"`  // "whisper-large-v3-turbo"
	Temperature  float32 `json:"temperature"`    // 0.0 - 1.0
}

// PlanCapabilities define o que cada plano pode processar
type PlanCapabilities struct {
	Text  bool `json:"text"`
	Audio bool `json:"audio"`
	Image bool `json:"image"`
}

// PlanLimits define os limites de uso por plano
type PlanLimits struct {
	MaxMembers           int  `json:"max_members"`
	MaxCards             int  `json:"max_cards"`
	MaxTransactionsMonth int  `json:"max_transactions_month"`
	AdvancedReports      bool `json:"advanced_reports"`
}

// providerCache armazena providers já instanciados por plan_slug
var (
	providerCache   = map[string]LLMProvider{}
	providerCacheMu sync.RWMutex
)

// NewLLMProvider cria um provider baseado na config do plano.
// Retorna o provider atual do Groq como fallback se o provider
// configurado não for suportado.
func NewLLMProvider(config PlanAIConfig) LLMProvider {
	switch config.Provider {
	case "openai":
		return &OpenAIProvider{config: config}
	case "google":
		return &GoogleProvider{config: config}
	default: // "groq" ou qualquer outro
		return &GroqProvider{config: config}
	}
}

// GetProviderForPlan retorna o LLMProvider correto para um plan_slug,
// com cache em memória. Invalida via InvalidateProviderCache().
func GetProviderForPlan(planSlug string) LLMProvider {
	providerCacheMu.RLock()
	if p, ok := providerCache[planSlug]; ok {
		providerCacheMu.RUnlock()
		return p
	}
	providerCacheMu.RUnlock()

	// Buscar config do plano no banco
	config := loadPlanAIConfig(planSlug)
	provider := NewLLMProvider(config)

	providerCacheMu.Lock()
	providerCache[planSlug] = provider
	providerCacheMu.Unlock()

	return provider
}

// InvalidateProviderCache limpa o cache para forçar recarga das configs.
// Chamado quando o admin atualiza um plano.
func InvalidateProviderCache() {
	providerCacheMu.Lock()
	providerCache = map[string]LLMProvider{}
	providerCacheMu.Unlock()
}

// loadPlanAIConfig busca a config de IA do plano no banco.
// Retorna config default (Groq Llama 70B) se não encontrar.
func loadPlanAIConfig(planSlug string) PlanAIConfig {
	defaultConfig := PlanAIConfig{
		Provider:     "groq",
		ChatModel:    "llama3-70b-8192",
		WhisperModel: "whisper-large-v3-turbo",
		Temperature:  0.1,
	}

	if db.Pool == nil {
		return defaultConfig
	}

	ctx := context.Background()
	var config PlanAIConfig
	err := db.Pool.QueryRow(ctx,
		"SELECT ai_model_config FROM subscription_plans WHERE slug = $1 AND active = true",
		planSlug,
	).Scan(&config)
	if err != nil {
		return defaultConfig
	}

	// Preencher campos vazios com defaults
	if config.Provider == "" {
		config.Provider = defaultConfig.Provider
	}
	if config.ChatModel == "" {
		config.ChatModel = defaultConfig.ChatModel
	}
	if config.WhisperModel == "" {
		config.WhisperModel = defaultConfig.WhisperModel
	}

	return config
}

// GetPlanCapabilities retorna as capabilities de um plano.
func GetPlanCapabilities(planSlug string) PlanCapabilities {
	defaultCaps := PlanCapabilities{Text: true, Audio: true, Image: false}

	if db.Pool == nil {
		return defaultCaps
	}

	ctx := context.Background()
	var caps PlanCapabilities
	err := db.Pool.QueryRow(ctx,
		"SELECT capabilities FROM subscription_plans WHERE slug = $1 AND active = true",
		planSlug,
	).Scan(&caps)
	if err != nil {
		return defaultCaps
	}
	return caps
}

// GetWorkspacePlanSlug retorna o plan_slug de um workspace.
func GetWorkspacePlanSlug(workspaceID string) string {
	if db.Pool == nil {
		return "standard"
	}

	ctx := context.Background()
	var slug *string
	err := db.Pool.QueryRow(ctx,
		"SELECT plan_slug FROM workspaces WHERE id = $1",
		workspaceID,
	).Scan(&slug)
	if err != nil || slug == nil {
		return "standard"
	}
	return *slug
}

// ─── Groq Provider ───

type GroqProvider struct {
	config PlanAIConfig
}

func (g *GroqProvider) ProviderName() string { return "groq" }
func (g *GroqProvider) SupportsImage() bool  { return false }

func (g *GroqProvider) ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error) {
	// Reutiliza a lógica existente mas com modelo configurável
	return groqChatCompletion(ctx, g.config.ChatModel, g.config.Temperature, systemPrompt, userMessage)
}

func (g *GroqProvider) TranscribeAudio(data []byte, filename string) (string, error) {
	return groqTranscribeAudio(g.config.WhisperModel, data, filename)
}

// ─── OpenAI Provider ───

type OpenAIProvider struct {
	config PlanAIConfig
}

func (o *OpenAIProvider) ProviderName() string { return "openai" }
func (o *OpenAIProvider) SupportsImage() bool  { return true }

func (o *OpenAIProvider) ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error) {
	apiKey := getProviderKey("openai")
	if apiKey == "" {
		return "", fmt.Errorf("OpenAI API key não configurada")
	}
	return openaiCompatibleChat(ctx, "https://api.openai.com/v1/chat/completions", apiKey, o.config.ChatModel, o.config.Temperature, systemPrompt, userMessage)
}

func (o *OpenAIProvider) TranscribeAudio(data []byte, filename string) (string, error) {
	apiKey := getProviderKey("openai")
	if apiKey == "" {
		return "", fmt.Errorf("OpenAI API key não configurada")
	}
	return openaiCompatibleTranscribe("https://api.openai.com/v1/audio/transcriptions", apiKey, "whisper-1", data, filename)
}

// ─── Google Provider ───

type GoogleProvider struct {
	config PlanAIConfig
}

func (g *GoogleProvider) ProviderName() string { return "google" }
func (g *GoogleProvider) SupportsImage() bool  { return true }

func (g *GoogleProvider) ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error) {
	apiKey := getProviderKey("google")
	if apiKey == "" {
		return "", fmt.Errorf("Google AI API key não configurada")
	}
	// Google Gemini usa endpoint OpenAI-compatible
	return openaiCompatibleChat(
		ctx,
		"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
		apiKey, g.config.ChatModel, g.config.Temperature, systemPrompt, userMessage,
	)
}

func (g *GoogleProvider) TranscribeAudio(data []byte, filename string) (string, error) {
	// Gemini não tem endpoint de áudio compatível — fallback para Groq whisper
	return groqTranscribeAudio("whisper-large-v3-turbo", data, filename)
}

// ─── Helpers compartilhados ───

// getProviderKey busca a API key de um provider em system_config
func getProviderKey(provider string) string {
	if db.Pool == nil {
		// Fallback para env var
		switch provider {
		case "groq":
			return envOrEmpty("GROQ_API_KEY")
		case "openai":
			return envOrEmpty("OPENAI_API_KEY")
		case "google":
			return envOrEmpty("GOOGLE_AI_API_KEY")
		}
		return ""
	}

	ctx := context.Background()
	var keysJSON map[string]string
	err := db.Pool.QueryRow(ctx,
		"SELECT value FROM system_config WHERE key = 'ai_provider_keys'",
	).Scan(&keysJSON)
	if err != nil || keysJSON[provider] == "" {
		// Fallback para env var
		switch provider {
		case "groq":
			return envOrEmpty("GROQ_API_KEY")
		case "openai":
			return envOrEmpty("OPENAI_API_KEY")
		case "google":
			return envOrEmpty("GOOGLE_AI_API_KEY")
		}
	}
	return keysJSON[provider]
}

func envOrEmpty(key string) string {
	return fmt.Sprintf("%s", mustGetenv(key))
}

func mustGetenv(key string) string {
	v, _ := lookupEnv(key)
	return v
}

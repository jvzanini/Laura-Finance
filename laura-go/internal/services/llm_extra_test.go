package services

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

// TestNewLLMProvider exercita o factory para os 3 providers + default fallback.
func TestNewLLMProvider(t *testing.T) {
	cases := []struct {
		provider string
		wantName string
	}{
		{"groq", "groq"},
		{"openai", "openai"},
		{"google", "google"},
		{"inexistente", "groq"}, // fallback default
		{"", "groq"},
	}
	for _, c := range cases {
		t.Run(c.provider, func(t *testing.T) {
			p := NewLLMProvider(PlanAIConfig{Provider: c.provider, ChatModel: "m"})
			if p.ProviderName() != c.wantName {
				t.Errorf("provider=%q got name=%q esperado %q", c.provider, p.ProviderName(), c.wantName)
			}
		})
	}
}

// TestProviderCapabilities_SupportsImage cobre SupportsImage dos 3.
func TestProviderCapabilities_SupportsImage(t *testing.T) {
	if (&GroqProvider{}).SupportsImage() {
		t.Error("Groq não deveria suportar imagem")
	}
	if !(&OpenAIProvider{}).SupportsImage() {
		t.Error("OpenAI deveria suportar imagem")
	}
	if !(&GoogleProvider{}).SupportsImage() {
		t.Error("Google deveria suportar imagem")
	}
}

// TestGetProviderForPlan_CacheReuso: chamadas consecutivas com mesmo slug
// reutilizam o provider. InvalidateProviderCache limpa e força recriação.
func TestGetProviderForPlan_CacheReuso(t *testing.T) {
	InvalidateProviderCache()
	p1 := GetProviderForPlan("plano-x")
	p2 := GetProviderForPlan("plano-x")
	if p1 != p2 {
		t.Error("cache deveria retornar o mesmo ponteiro de provider")
	}

	InvalidateProviderCache()
	p3 := GetProviderForPlan("plano-x")
	if p1 == p3 {
		t.Error("depois de Invalidate, deveria ter criado novo provider")
	}
}

// TestLoadPlanAIConfig_NilPool: sem db.Pool, retorna defaultConfig.
func TestLoadPlanAIConfig_NilPool(t *testing.T) {
	cfg := loadPlanAIConfig("qualquer")
	if cfg.Provider != "groq" {
		t.Errorf("Provider default=%q esperado groq", cfg.Provider)
	}
	if cfg.ChatModel == "" {
		t.Error("ChatModel default não pode ser vazio")
	}
}

// TestGetPlanCapabilities_NilPool: sem pool, Text+Audio=true, Image=false.
func TestGetPlanCapabilities_NilPool(t *testing.T) {
	caps := GetPlanCapabilities("x")
	if !caps.Text || !caps.Audio || caps.Image {
		t.Errorf("caps default inesperadas: %+v", caps)
	}
}

// TestGetWorkspacePlanSlug_NilPool: sem pool, retorna "standard".
func TestGetWorkspacePlanSlug_NilPool(t *testing.T) {
	if s := GetWorkspacePlanSlug("ws"); s != "standard" {
		t.Errorf("plan slug=%q esperado standard", s)
	}
}

// TestLookupEnv: presente e ausente.
func TestLookupEnv(t *testing.T) {
	t.Setenv("LAURA_TEST_ENV_VAR", "valor")
	v, ok := lookupEnv("LAURA_TEST_ENV_VAR")
	if !ok || v != "valor" {
		t.Errorf("lookupEnv = (%q, %v), esperado (valor, true)", v, ok)
	}
	os.Unsetenv("LAURA_TEST_ENV_VAR_MISSING")
	v, ok = lookupEnv("LAURA_TEST_ENV_VAR_MISSING")
	if ok || v != "" {
		t.Errorf("lookupEnv missing = (%q, %v), esperado (\"\", false)", v, ok)
	}
}

// TestGetProviderKey_Fallback: sem db.Pool, usa env var correspondente.
func TestGetProviderKey_Fallback(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "gsk-test")
	if k := getProviderKey("groq"); k != "gsk-test" {
		t.Errorf("groq key=%q esperado gsk-test", k)
	}
	t.Setenv("OPENAI_API_KEY", "sk-test")
	if k := getProviderKey("openai"); k != "sk-test" {
		t.Errorf("openai key=%q", k)
	}
	t.Setenv("GOOGLE_AI_API_KEY", "goog-test")
	if k := getProviderKey("google"); k != "goog-test" {
		t.Errorf("google key=%q", k)
	}
	// Provider desconhecido → string vazia
	if k := getProviderKey("vendor-x"); k != "" {
		t.Errorf("vendor desconhecido=%q esperado vazio", k)
	}
}

// TestProviderFromEndpoint_Matrix cobre os 4 ramos.
func TestProviderFromEndpoint_Matrix(t *testing.T) {
	cases := map[string]string{
		"https://api.groq.com/openai/v1/chat/completions":            "groq",
		"https://api.openai.com/v1/chat/completions":                 "openai",
		"https://generativelanguage.googleapis.com/v1beta/...":       "google",
		"https://custom.example.com/v1/chat":                         "unknown",
	}
	for endpoint, want := range cases {
		if got := providerFromEndpoint(endpoint); got != want {
			t.Errorf("providerFromEndpoint(%q)=%q esperado %q", endpoint, got, want)
		}
	}
}

// TestOpenAICompatibleChat_Success usa httptest.Server para simular resposta 200.
func TestOpenAICompatibleChat_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("Authorization incorreto: %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type: %q", r.Header.Get("Content-Type"))
		}
		// Valida body request
		var body map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["model"] != "m1" {
			t.Errorf("model enviado=%v", body["model"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"olá do mock"}}]}`))
	}))
	defer srv.Close()

	out, err := openaiCompatibleChat(context.Background(), srv.URL, "test-key", "m1", 0.1, "sys", "user")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if out != "olá do mock" {
		t.Errorf("output=%q esperado 'olá do mock'", out)
	}
}

// TestOpenAICompatibleChat_Non200 retorna erro com status code.
func TestOpenAICompatibleChat_Non200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"upstream"}`))
	}))
	defer srv.Close()

	_, err := openaiCompatibleChat(context.Background(), srv.URL, "k", "m", 0.1, "s", "u")
	if err == nil {
		t.Fatal("esperava erro para status 500")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("erro não contém 500: %v", err)
	}
}

// TestOpenAICompatibleChat_EmptyChoices retorna erro quando choices=[]
func TestOpenAICompatibleChat_EmptyChoices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[]}`))
	}))
	defer srv.Close()

	_, err := openaiCompatibleChat(context.Background(), srv.URL, "k", "m", 0, "s", "u")
	if err == nil {
		t.Fatal("esperava erro para choices vazio")
	}
	if !strings.Contains(err.Error(), "empty choices") {
		t.Errorf("erro esperado contém 'empty choices': %v", err)
	}
}

// TestOpenAICompatibleChat_MalformedJSON retorna erro de decode.
func TestOpenAICompatibleChat_MalformedJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`nao eh json`))
	}))
	defer srv.Close()

	_, err := openaiCompatibleChat(context.Background(), srv.URL, "k", "m", 0, "s", "u")
	if err == nil {
		t.Fatal("esperava erro para JSON malformado")
	}
}

// TestOpenAICompatibleChat_NilCtx substitui ctx nil por Background sem panic.
func TestOpenAICompatibleChat_NilCtx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer srv.Close()

	//nolint:staticcheck // testando guard
	out, err := openaiCompatibleChat(nil, srv.URL, "k", "m", 0, "s", "u")
	if err != nil || out != "ok" {
		t.Errorf("out=%q err=%v", out, err)
	}
}

// TestOpenAICompatibleTranscribe_Success usa httptest com multipart.
func TestOpenAICompatibleTranscribe_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			t.Errorf("content-type inesperado: %q", r.Header.Get("Content-Type"))
		}
		_, _ = w.Write([]byte(`{"text":"olá transcrito"}`))
	}))
	defer srv.Close()

	out, err := openaiCompatibleTranscribe(srv.URL, "k", "whisper-1", []byte("audiobytes"), "v.ogg")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if out != "olá transcrito" {
		t.Errorf("out=%q", out)
	}
}

// TestOpenAICompatibleTranscribe_Non200.
func TestOpenAICompatibleTranscribe_Non200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`upstream down`))
	}))
	defer srv.Close()

	_, err := openaiCompatibleTranscribe(srv.URL, "k", "m", []byte{0x1}, "f.ogg")
	if err == nil {
		t.Fatal("esperava erro 502")
	}
	if !strings.Contains(err.Error(), "502") {
		t.Errorf("erro sem 502: %v", err)
	}
}

// TestLLMHTTPClient_Timeout: reduz timeout temporariamente e força um server lento.
func TestLLMHTTPClient_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"late"}}]}`))
	}))
	defer srv.Close()

	orig := llmHTTPClient
	llmHTTPClient = &http.Client{Timeout: 10 * time.Millisecond}
	defer func() { llmHTTPClient = orig }()

	_, err := openaiCompatibleChat(context.Background(), srv.URL, "k", "m", 0, "s", "u")
	if err == nil {
		t.Fatal("esperava timeout")
	}
}

// TestRunDailyBudgetCheck_NilPool: sem pool, retorna imediatamente sem panic.
func TestRunDailyBudgetCheck_NilPool(t *testing.T) {
	called := false
	runDailyBudgetCheck(func(to, msg string) { called = true })
	if called {
		t.Error("sendMessageFunc não deveria ser chamado com pool nil")
	}
}

// TestRunDailyScoreSnapshot_NilPool: idem.
func TestRunDailyScoreSnapshot_NilPool(t *testing.T) {
	runDailyScoreSnapshot() // não deve panicar
}

// TestRunDailyScoreBandCheck_NilPool: idem.
func TestRunDailyScoreBandCheck_NilPool(t *testing.T) {
	called := false
	runDailyScoreBandCheck(func(to, msg string) { called = true })
	if called {
		t.Error("sendMessageFunc não deveria ser chamado com pool nil")
	}
}

// TestGetScoreLookbackDays_NilPool: retorna default 90.
func TestGetScoreLookbackDays_NilPool(t *testing.T) {
	if d := getScoreLookbackDays(); d != 90 {
		t.Errorf("lookback=%d esperado 90", d)
	}
}

// TestOpenAICompatibleChat_InvalidURL cobre erro no NewRequestWithContext.
func TestOpenAICompatibleChat_InvalidURL(t *testing.T) {
	_, err := openaiCompatibleChat(context.Background(), "://url-invalida", "k", "m", 0, "s", "u")
	if err == nil {
		t.Fatal("esperava erro para URL inválida")
	}
}

// TestEnvOrEmpty: wrapper sobre lookupEnv (helper legacy).
func TestEnvOrEmpty(t *testing.T) {
	t.Setenv("LAURA_TEST_XYZ", "xpto")
	if v := envOrEmpty("LAURA_TEST_XYZ"); v != "xpto" {
		t.Errorf("envOrEmpty=%q esperado xpto", v)
	}
}

// TestOpenAIProvider_ChatCompletion_NoAPIKey: quando não há key configurada,
// retorna erro explicativo.
func TestOpenAIProvider_ChatCompletion_NoAPIKey(t *testing.T) {
	os.Unsetenv("OPENAI_API_KEY")
	p := &OpenAIProvider{config: PlanAIConfig{Provider: "openai", ChatModel: "gpt"}}
	_, err := p.ChatCompletion(context.Background(), "s", "u")
	if err == nil {
		t.Fatal("esperava erro por falta de API key")
	}
	if !strings.Contains(err.Error(), "OpenAI") {
		t.Errorf("erro não menciona OpenAI: %v", err)
	}
}

// TestGoogleProvider_ChatCompletion_NoAPIKey idem.
func TestGoogleProvider_ChatCompletion_NoAPIKey(t *testing.T) {
	os.Unsetenv("GOOGLE_AI_API_KEY")
	p := &GoogleProvider{config: PlanAIConfig{Provider: "google", ChatModel: "gemini"}}
	_, err := p.ChatCompletion(context.Background(), "s", "u")
	if err == nil {
		t.Fatal("esperava erro por falta de API key")
	}
}

// TestGroqProvider_ChatCompletion_NoAPIKey idem.
func TestGroqProvider_ChatCompletion_NoAPIKey(t *testing.T) {
	os.Unsetenv("GROQ_API_KEY")
	p := &GroqProvider{config: PlanAIConfig{Provider: "groq", ChatModel: "llama"}}
	_, err := p.ChatCompletion(context.Background(), "s", "u")
	if err == nil {
		t.Fatal("esperava erro por falta de API key")
	}
}

// TestGroqProvider_TranscribeAudio_NoAPIKey.
func TestGroqProvider_TranscribeAudio_NoAPIKey(t *testing.T) {
	os.Unsetenv("GROQ_API_KEY")
	p := &GroqProvider{config: PlanAIConfig{Provider: "groq", WhisperModel: "whisper"}}
	_, err := p.TranscribeAudio([]byte{0x1}, "f.ogg")
	if err == nil {
		t.Fatal("esperava erro por falta de API key")
	}
}

// TestOpenAIProvider_TranscribeAudio_NoAPIKey.
func TestOpenAIProvider_TranscribeAudio_NoAPIKey(t *testing.T) {
	os.Unsetenv("OPENAI_API_KEY")
	p := &OpenAIProvider{config: PlanAIConfig{Provider: "openai"}}
	_, err := p.TranscribeAudio([]byte{0x1}, "f.ogg")
	if err == nil {
		t.Fatal("esperava erro por falta de API key")
	}
}

// TestGoogleProvider_TranscribeAudio_FallbackGroq: Google cai em Groq,
// que também falha sem key → erro.
func TestGoogleProvider_TranscribeAudio_FallbackGroq(t *testing.T) {
	os.Unsetenv("GROQ_API_KEY")
	p := &GoogleProvider{config: PlanAIConfig{Provider: "google"}}
	_, err := p.TranscribeAudio([]byte{0x1}, "f.ogg")
	if err == nil {
		t.Fatal("esperava erro no fallback Groq sem key")
	}
}

// TestTranscribeAudioForPlan_NilPool_DefaultProvider: sem pool, usa provider
// default (Groq) que falha por falta de key.
func TestTranscribeAudioForPlan_NilPool(t *testing.T) {
	os.Unsetenv("GROQ_API_KEY")
	InvalidateProviderCache()
	_, err := TranscribeAudioForPlan([]byte{0x1}, "f.ogg", "")
	if err == nil {
		t.Fatal("esperava erro sem GROQ_API_KEY")
	}
}

// ─── Confirma que o multipart writer serializa bytes corretamente.
func TestOpenAICompatibleTranscribe_BodyContainsAudio(t *testing.T) {
	audio := []byte("ABC123")
	var receivedBody bytes.Buffer
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = receivedBody.ReadFrom(r.Body)
		_, _ = w.Write([]byte(`{"text":"transcrição"}`))
	}))
	defer srv.Close()

	_, err := openaiCompatibleTranscribe(srv.URL, "k", "m", audio, "v.ogg")
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if !bytes.Contains(receivedBody.Bytes(), audio) {
		t.Error("body não contém os bytes de áudio enviados")
	}
	if !bytes.Contains(receivedBody.Bytes(), []byte("v.ogg")) {
		t.Error("body não contém o filename")
	}
}

package services

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// ───────────────────────────────────────────────────────────────
// Helpers: substituem dependências externas do ProcessMessageFlow
// (LLM, provider do plano, capabilities, transcrição) via ponteiros
// de função de pacote. Restauram originais no Cleanup.
// ───────────────────────────────────────────────────────────────

type workflowMocks struct {
	replies    []string
	transcribe func(data []byte, filename string, planSlug string) (string, error)
	capsPlan   PlanCapabilities
	nlpJSON    string
	nlpErr     error
}

// replyCapture retorna um func(string) que grava em slice.
func (m *workflowMocks) replyCapture() func(string) {
	return func(s string) { m.replies = append(m.replies, s) }
}

// stubExternals instala mocks nas funções usadas por ProcessMessageFlow.
// Ele monkey-patcha GetPlanCapabilities/GetWorkspacePlanSlug/TranscribeAudioForPlan
// e nlpChatFn para testes determinísticos sem db.Pool.
func stubExternals(t *testing.T, m *workflowMocks) {
	t.Helper()

	origCaps := getPlanCapsFn
	origSlug := getWorkspacePlanSlugFn
	origTrans := transcribeAudioFn
	origNLP := nlpChatFn

	getPlanCapsFn = func(_ string) PlanCapabilities { return m.capsPlan }
	getWorkspacePlanSlugFn = func(_ string) string { return "standard" }
	transcribeAudioFn = func(data []byte, filename string, plan string) (string, error) {
		if m.transcribe != nil {
			return m.transcribe(data, filename, plan)
		}
		return "", nil
	}
	nlpChatFn = func(ctx context.Context, plan, sys, user string) (string, string, error) {
		return "groq", m.nlpJSON, m.nlpErr
	}

	t.Cleanup(func() {
		getPlanCapsFn = origCaps
		getWorkspacePlanSlugFn = origSlug
		transcribeAudioFn = origTrans
		nlpChatFn = origNLP
	})
}

// TestWorkflow_AudioWithoutCapability: plano sem audio → reply educado, no-error.
func TestWorkflow_AudioWithoutCapability(t *testing.T) {
	m := &workflowMocks{capsPlan: PlanCapabilities{Text: true, Audio: false}}
	stubExternals(t, m)

	err := ProcessMessageFlow(context.Background(), "ws", "+5511", "", []byte{0x1, 0x2}, m.replyCapture())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if len(m.replies) != 1 {
		t.Fatalf("esperava 1 reply, veio %d", len(m.replies))
	}
	if !strings.Contains(m.replies[0], "nao suporta mensagens de audio") {
		t.Errorf("reply não menciona falta de capability: %q", m.replies[0])
	}
}

// TestWorkflow_AudioTranscribeError: transcrição falha → finalText vira
// "[Audio Incompreensível ou Falha]", função retorna early sem reply.
func TestWorkflow_AudioTranscribeError(t *testing.T) {
	m := &workflowMocks{
		capsPlan: PlanCapabilities{Text: true, Audio: true},
		transcribe: func(data []byte, filename string, plan string) (string, error) {
			return "", errors.New("whisper down")
		},
	}
	stubExternals(t, m)
	err := ProcessMessageFlow(context.Background(), "ws", "+5511", "", []byte{0xAA}, m.replyCapture())
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	// finalText fica vazio/fallback → early return, zero replies.
	if len(m.replies) != 0 {
		t.Errorf("esperava 0 replies (early return), veio %d: %v", len(m.replies), m.replies)
	}
}

// TestWorkflow_EmptyText: texto vazio sem áudio → early return sem reply.
func TestWorkflow_EmptyText(t *testing.T) {
	m := &workflowMocks{capsPlan: PlanCapabilities{Text: true, Audio: true}}
	stubExternals(t, m)
	err := ProcessMessageFlow(context.Background(), "ws", "+5511", "", nil, m.replyCapture())
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if len(m.replies) != 0 {
		t.Errorf("esperava 0 replies com texto vazio, veio %d", len(m.replies))
	}
}

// TestWorkflow_ReportIntent: usuário manda "Relatório" → responde com URL
// do chart sem consultar LLM.
func TestWorkflow_ReportIntent(t *testing.T) {
	m := &workflowMocks{
		capsPlan: PlanCapabilities{Text: true, Audio: true},
		nlpErr:   errors.New("não deveria ter chamado LLM"),
	}
	stubExternals(t, m)
	err := ProcessMessageFlow(context.Background(), "ws", "+5511", "Relatório", nil, m.replyCapture())
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if len(m.replies) != 1 {
		t.Fatalf("esperava 1 reply, veio %d", len(m.replies))
	}
	if !strings.Contains(m.replies[0], "DRE Visual") {
		t.Errorf("reply de relatório inesperado: %q", m.replies[0])
	}
}

// TestWorkflow_RolloverConfirm_NoContext: usuário manda "prorroga" mas não
// há CrisisContext ativo → reply educada, não persiste nada.
func TestWorkflow_RolloverConfirm_NoContext(t *testing.T) {
	ClearAllCrisisContexts()
	m := &workflowMocks{capsPlan: PlanCapabilities{Text: true, Audio: true}}
	stubExternals(t, m)

	err := ProcessMessageFlow(context.Background(), "ws", "+5599999", "prorroga", nil, m.replyCapture())
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if len(m.replies) != 1 {
		t.Fatalf("esperava 1 reply, veio %d", len(m.replies))
	}
	if !strings.Contains(m.replies[0], "simulação de rolagem") {
		t.Errorf("reply inesperada: %q", m.replies[0])
	}
}

// TestWorkflow_RolloverConfirm_WithContext_PersistFails: contexto existe mas
// db.Pool=nil → PersistRollover falha → reply de erro, erro retornado.
func TestWorkflow_RolloverConfirm_WithContext_PersistFails(t *testing.T) {
	ClearAllCrisisContexts()
	SetCrisisContext(&CrisisContext{
		WorkspaceID:     "ws",
		PhoneNumber:     "+55abc",
		InvoiceValueCts: 100_000,
		ProcessorSlug:   "infinitepay",
		Installments:    "2x",
	})
	m := &workflowMocks{capsPlan: PlanCapabilities{Text: true, Audio: true}}
	stubExternals(t, m)

	err := ProcessMessageFlow(context.Background(), "ws", "+55abc", "prorroga", nil, m.replyCapture())
	if err == nil {
		t.Fatal("esperava erro (pool nil em PersistRollover)")
	}
	if len(m.replies) == 0 {
		t.Fatal("esperava pelo menos 1 reply")
	}
	if !strings.Contains(strings.Join(m.replies, " "), "gravar a rolagem") {
		t.Errorf("reply inesperada: %v", m.replies)
	}
}

// TestWorkflow_CtxTimeout: um ctx já cancelado propaga — como db.Pool é nil
// o bloco de DB é pulado mas a função completa OK (early paths não observam ctx).
// Este teste captura o comportamento atual e evita regressão silenciosa.
func TestWorkflow_CtxTimeout(t *testing.T) {
	m := &workflowMocks{
		capsPlan: PlanCapabilities{Text: true, Audio: true},
		nlpJSON:  `{"amount":10,"description":"Pao","type":"expense","labels":[],"confidence":0.9,"needs_review":false,"is_crisis":false}`,
	}
	stubExternals(t, m)

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()
	time.Sleep(2 * time.Nanosecond)

	err := ProcessMessageFlow(ctx, "ws", "+55", "gastei 10", nil, m.replyCapture())
	if err != nil {
		t.Fatalf("ProcessMessageFlow não deveria propagar erro com pool nil (ctx expirado): %v", err)
	}
}

// TestWorkflow_NLPError_UserMsg: LLM falha → função não entra no ramo de
// insert de transaction (db.Pool nil de qualquer forma). Garante que não
// há panic e que o audio path também é robusto.
func TestWorkflow_NLPError_UserMsg(t *testing.T) {
	m := &workflowMocks{
		capsPlan: PlanCapabilities{Text: true, Audio: true},
		nlpErr:   errors.New("llm unavailable"),
	}
	stubExternals(t, m)

	err := ProcessMessageFlow(context.Background(), "ws", "+55", "gastei algo", nil, m.replyCapture())
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	// Sem db.Pool, o bloco de reply da falha não é executado (está dentro do if db.Pool != nil).
	// Isso é o comportamento atual — captura para evitar regressão.
	if len(m.replies) != 0 {
		t.Errorf("esperava 0 replies (pool nil), veio %d: %v", len(m.replies), m.replies)
	}
}

// TestWorkflow_AudioTranscribeSuccess_ReportIntent: áudio transcreve para
// "Relatório" → entra no ramo de relatório.
func TestWorkflow_AudioTranscribeSuccess_ReportIntent(t *testing.T) {
	m := &workflowMocks{
		capsPlan: PlanCapabilities{Text: true, Audio: true},
		transcribe: func(data []byte, filename string, plan string) (string, error) {
			return "Relatório", nil
		},
	}
	stubExternals(t, m)
	err := ProcessMessageFlow(context.Background(), "ws", "+55", "", []byte{0x1}, m.replyCapture())
	if err != nil {
		t.Fatalf("erro: %v", err)
	}
	if len(m.replies) != 1 || !strings.Contains(m.replies[0], "DRE Visual") {
		t.Errorf("esperava reply de relatório após transcrição, veio %v", m.replies)
	}
}

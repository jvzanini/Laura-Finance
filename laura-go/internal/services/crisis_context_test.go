package services

import (
	"testing"
	"time"
)

func TestCrisisContext_SetAndConsume(t *testing.T) {
	ClearAllCrisisContexts()
	SetCrisisContext(&CrisisContext{
		WorkspaceID:     "ws-1",
		PhoneNumber:     "+5511999999999",
		InvoiceValueCts: 250_000,
		ProcessorSlug:   "infinitepay",
		Installments:    "2x",
	})

	ctx := GetCrisisContext("+5511999999999")
	if ctx == nil {
		t.Fatal("contexto não encontrado após Set")
	}
	if ctx.InvoiceValueCts != 250_000 {
		t.Errorf("InvoiceValueCts=%d, esperado 250000", ctx.InvoiceValueCts)
	}

	// Consumo único: segunda chamada deve retornar nil
	ctx2 := GetCrisisContext("+5511999999999")
	if ctx2 != nil {
		t.Error("GetCrisisContext deveria consumir o entry, mas retornou de novo")
	}
}

func TestCrisisContext_Peek(t *testing.T) {
	ClearAllCrisisContexts()
	SetCrisisContext(&CrisisContext{
		WorkspaceID:     "ws-1",
		PhoneNumber:     "+5511888888888",
		InvoiceValueCts: 100_000,
		ProcessorSlug:   "ton",
		Installments:    "3x",
	})

	peek1 := PeekCrisisContext("+5511888888888")
	peek2 := PeekCrisisContext("+5511888888888")
	if peek1 == nil || peek2 == nil {
		t.Fatal("Peek deveria retornar o contexto sem consumir")
	}
	// Get depois do peek deve funcionar
	get := GetCrisisContext("+5511888888888")
	if get == nil {
		t.Fatal("Get depois de Peek falhou")
	}
}

func TestCrisisContext_Expiry(t *testing.T) {
	ClearAllCrisisContexts()
	old := &CrisisContext{
		WorkspaceID:     "ws-1",
		PhoneNumber:     "+5511777777777",
		InvoiceValueCts: 100_000,
		ProcessorSlug:   "infinitepay",
		Installments:    "2x",
	}
	// Simula um contexto antigo: seta, depois força CreatedAt pro passado
	SetCrisisContext(old)
	crisisStore.Lock()
	if entry, ok := crisisStore.entries["+5511777777777"]; ok {
		entry.CreatedAt = time.Now().Add(-2 * CrisisContextTTL)
	}
	crisisStore.Unlock()

	ctx := GetCrisisContext("+5511777777777")
	if ctx != nil {
		t.Error("GetCrisisContext deveria ter devolvido nil para contexto expirado")
	}
}

func TestCrisisContext_MultiplePhonesIsolated(t *testing.T) {
	ClearAllCrisisContexts()
	SetCrisisContext(&CrisisContext{PhoneNumber: "+55A", WorkspaceID: "ws-a", InvoiceValueCts: 100, ProcessorSlug: "infinitepay", Installments: "2x"})
	SetCrisisContext(&CrisisContext{PhoneNumber: "+55B", WorkspaceID: "ws-b", InvoiceValueCts: 200, ProcessorSlug: "ton", Installments: "3x"})

	a := GetCrisisContext("+55A")
	b := GetCrisisContext("+55B")

	if a == nil || b == nil {
		t.Fatal("ambos contextos deveriam existir")
	}
	if a.WorkspaceID != "ws-a" || b.WorkspaceID != "ws-b" {
		t.Error("contextos foram misturados entre telefones")
	}
	if a.InvoiceValueCts != 100 || b.InvoiceValueCts != 200 {
		t.Error("valores foram misturados entre telefones")
	}
}

func TestCrisisContext_NilOrEmptyPhoneIgnored(t *testing.T) {
	ClearAllCrisisContexts()
	// Nil ctx deveria ser silenciosamente ignorado
	SetCrisisContext(nil)
	// Empty phone idem
	SetCrisisContext(&CrisisContext{PhoneNumber: "", InvoiceValueCts: 100})
	// Nenhum entry deve ter sido criado
	crisisStore.RLock()
	count := len(crisisStore.entries)
	crisisStore.RUnlock()
	if count != 0 {
		t.Errorf("store deveria estar vazio, tem %d entries", count)
	}
}

func TestCrisisContext_SetOverwrites(t *testing.T) {
	ClearAllCrisisContexts()
	SetCrisisContext(&CrisisContext{
		PhoneNumber:     "+55C",
		WorkspaceID:     "ws",
		InvoiceValueCts: 100_000,
		ProcessorSlug:   "infinitepay",
		Installments:    "2x",
	})
	SetCrisisContext(&CrisisContext{
		PhoneNumber:     "+55C",
		WorkspaceID:     "ws",
		InvoiceValueCts: 500_000,
		ProcessorSlug:   "stone",
		Installments:    "6x",
	})

	ctx := GetCrisisContext("+55C")
	if ctx == nil {
		t.Fatal("contexto deveria existir")
	}
	if ctx.InvoiceValueCts != 500_000 {
		t.Errorf("InvoiceValueCts=%d, esperado 500000 (o segundo Set deveria sobrescrever)", ctx.InvoiceValueCts)
	}
	if ctx.ProcessorSlug != "stone" {
		t.Errorf("ProcessorSlug=%s, esperado stone", ctx.ProcessorSlug)
	}
}

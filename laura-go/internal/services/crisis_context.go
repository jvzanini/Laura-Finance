package services

import (
	"sync"
	"time"
)

// CrisisContext guarda o último estado de detecção de crise por número de
// telefone, para que o handler da confirmação "Sim Laura, prorroga" saiba
// exatamente qual valor e qual simulação está sendo aceita. Resolve o
// problema do hardcoded R$ 1000 que existia antes — agora a persistência
// reflete a mensagem real de crise do usuário.
//
// Implementação: mapa in-memory com TTL, protegido por RWMutex. Para
// escalar horizontalmente (múltiplas instâncias do bot), migrar para
// Redis/pg — mas para o MVP atual (1 processo Go) isso é suficiente e
// não depende de infra extra.
type CrisisContext struct {
	WorkspaceID     string
	PhoneNumber     string
	InvoiceValueCts int
	CardID          *string // nullable — não sabemos o cartão pela mensagem
	ProcessorSlug   string  // escolhido pelo motor na simulação preview
	Installments    string  // ex: "2x"
	CreatedAt       time.Time
}

// CrisisContextTTL é quanto tempo uma detecção de crise fica "ativa"
// esperando a confirmação do usuário. Depois disso, uma mensagem
// "Sim Laura, prorroga" é ignorada (ou tratada como erro amigável).
const CrisisContextTTL = 10 * time.Minute

type crisisContextStore struct {
	sync.RWMutex
	entries map[string]*CrisisContext // key = phoneNumber
}

var crisisStore = &crisisContextStore{
	entries: make(map[string]*CrisisContext),
}

// SetCrisisContext registra/substitui o contexto de crise mais recente de
// um telefone. Chamado pela detecção de crise (Story 5.1) ao enviar a
// mensagem de preview com a simulação.
func SetCrisisContext(ctx *CrisisContext) {
	if ctx == nil || ctx.PhoneNumber == "" {
		return
	}
	ctx.CreatedAt = time.Now()
	crisisStore.Lock()
	crisisStore.entries[ctx.PhoneNumber] = ctx
	crisisStore.Unlock()
}

// GetCrisisContext retorna o contexto ativo para um telefone, removendo-o
// do store (consumo de uma única vez) se ainda dentro do TTL. Se o TTL
// tiver expirado, devolve nil.
func GetCrisisContext(phoneNumber string) *CrisisContext {
	crisisStore.Lock()
	defer crisisStore.Unlock()
	ctx, ok := crisisStore.entries[phoneNumber]
	if !ok {
		return nil
	}
	delete(crisisStore.entries, phoneNumber) // consume
	if time.Since(ctx.CreatedAt) > CrisisContextTTL {
		return nil
	}
	return ctx
}

// PeekCrisisContext retorna o contexto sem consumir — útil em tests ou
// no futuro quando quisermos re-apresentar a simulação sem gravar.
func PeekCrisisContext(phoneNumber string) *CrisisContext {
	crisisStore.RLock()
	defer crisisStore.RUnlock()
	ctx, ok := crisisStore.entries[phoneNumber]
	if !ok {
		return nil
	}
	if time.Since(ctx.CreatedAt) > CrisisContextTTL {
		return nil
	}
	return ctx
}

// ClearAllCrisisContexts é usado em testes para garantir isolamento.
func ClearAllCrisisContexts() {
	crisisStore.Lock()
	crisisStore.entries = make(map[string]*CrisisContext)
	crisisStore.Unlock()
}

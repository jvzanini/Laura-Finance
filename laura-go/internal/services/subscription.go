package services

import (
	"math"
	"time"
)

// SubscriptionState representa o estado computado da assinatura a
// partir dos campos armazenados em workspaces. É função PURA de
// (status, timestamps, now).
type SubscriptionState string

const (
	StateTrialActive     SubscriptionState = "trial_active"
	StateTrialEnded      SubscriptionState = "trial_ended"
	StateActive          SubscriptionState = "active"
	StatePastDueGrace    SubscriptionState = "past_due_grace"
	StatePastDueBlocked  SubscriptionState = "past_due_blocked"
	StateCanceledGrace   SubscriptionState = "canceled_grace"
	StateExpired         SubscriptionState = "expired"
)

// SubscriptionSnapshot carrega os campos relevantes da workspace para
// calcular o estado. Mantém-se agnóstico do tipo de ORM/pgx.
type SubscriptionSnapshot struct {
	SubscriptionStatus  string     // trial | active | past_due | canceled | expired
	TrialEndsAt         *time.Time
	CurrentPeriodEnd    *time.Time
	PastDueGraceUntil   *time.Time
	CanceledAt          *time.Time
}

// ComputeState devolve o estado efetivo a partir do snapshot + now.
// Função pura: sem IO, sem efeitos.
func ComputeState(s SubscriptionSnapshot, now time.Time) SubscriptionState {
	switch s.SubscriptionStatus {
	case "trial":
		if s.TrialEndsAt != nil && now.After(*s.TrialEndsAt) {
			return StateTrialEnded
		}
		return StateTrialActive
	case "active":
		return StateActive
	case "past_due":
		if s.PastDueGraceUntil != nil && now.Before(*s.PastDueGraceUntil) {
			return StatePastDueGrace
		}
		return StatePastDueBlocked
	case "canceled":
		if s.CurrentPeriodEnd != nil && now.Before(*s.CurrentPeriodEnd) {
			return StateCanceledGrace
		}
		return StateExpired
	case "expired":
		return StateExpired
	default:
		return StateExpired
	}
}

// IsBlocked devolve true se o estado bloqueia o acesso ao app.
// O banner de "pagamento atrasado" fica visível em PastDueGrace
// (acesso ainda liberado).
func IsBlocked(st SubscriptionState) bool {
	switch st {
	case StateTrialEnded, StatePastDueBlocked, StateExpired:
		return true
	}
	return false
}

// DaysRemaining devolve quantos dias faltam até o próximo marco
// relevante do estado:
//   - TrialActive → trial_ends_at
//   - Active      → current_period_end
//   - CanceledGrace → current_period_end
//   - PastDueGrace → past_due_grace_until
//   - outros      → 0
// Se negativo (já passou), devolve 0.
func DaysRemaining(s SubscriptionSnapshot, st SubscriptionState, now time.Time) int {
	var target *time.Time
	switch st {
	case StateTrialActive:
		target = s.TrialEndsAt
	case StateActive:
		target = s.CurrentPeriodEnd
	case StateCanceledGrace:
		target = s.CurrentPeriodEnd
	case StatePastDueGrace:
		target = s.PastDueGraceUntil
	}
	if target == nil {
		return 0
	}
	delta := target.Sub(now).Hours() / 24
	if delta < 0 {
		return 0
	}
	return int(math.Ceil(delta))
}

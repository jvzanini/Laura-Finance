package services

import (
	"testing"
	"time"
)

func ptrTime(t time.Time) *time.Time { return &t }

func TestComputeState(t *testing.T) {
	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	future := now.Add(3 * 24 * time.Hour)
	past := now.Add(-2 * time.Hour)

	cases := []struct {
		name string
		snap SubscriptionSnapshot
		want SubscriptionState
	}{
		{
			name: "trial ativo",
			snap: SubscriptionSnapshot{SubscriptionStatus: "trial", TrialEndsAt: ptrTime(future)},
			want: StateTrialActive,
		},
		{
			name: "trial terminado",
			snap: SubscriptionSnapshot{SubscriptionStatus: "trial", TrialEndsAt: ptrTime(past)},
			want: StateTrialEnded,
		},
		{
			name: "active",
			snap: SubscriptionSnapshot{SubscriptionStatus: "active"},
			want: StateActive,
		},
		{
			name: "past_due dentro grace",
			snap: SubscriptionSnapshot{SubscriptionStatus: "past_due", PastDueGraceUntil: ptrTime(future)},
			want: StatePastDueGrace,
		},
		{
			name: "past_due grace expirado",
			snap: SubscriptionSnapshot{SubscriptionStatus: "past_due", PastDueGraceUntil: ptrTime(past)},
			want: StatePastDueBlocked,
		},
		{
			name: "canceled dentro do periodo",
			snap: SubscriptionSnapshot{SubscriptionStatus: "canceled", CurrentPeriodEnd: ptrTime(future)},
			want: StateCanceledGrace,
		},
		{
			name: "canceled fora do periodo",
			snap: SubscriptionSnapshot{SubscriptionStatus: "canceled", CurrentPeriodEnd: ptrTime(past)},
			want: StateExpired,
		},
		{
			name: "expired explicito",
			snap: SubscriptionSnapshot{SubscriptionStatus: "expired"},
			want: StateExpired,
		},
		{
			name: "status desconhecido → expired",
			snap: SubscriptionSnapshot{SubscriptionStatus: "alienigena"},
			want: StateExpired,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeState(tc.snap, now)
			if got != tc.want {
				t.Errorf("ComputeState()=%q want=%q", got, tc.want)
			}
		})
	}
}

func TestIsBlocked(t *testing.T) {
	cases := map[SubscriptionState]bool{
		StateTrialActive:    false,
		StateTrialEnded:     true,
		StateActive:         false,
		StatePastDueGrace:   false,
		StatePastDueBlocked: true,
		StateCanceledGrace:  false,
		StateExpired:        true,
	}
	for st, want := range cases {
		if got := IsBlocked(st); got != want {
			t.Errorf("IsBlocked(%q)=%v want=%v", st, got, want)
		}
	}
}

func TestDaysRemaining(t *testing.T) {
	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	in3d := now.Add(3 * 24 * time.Hour)

	snap := SubscriptionSnapshot{SubscriptionStatus: "trial", TrialEndsAt: ptrTime(in3d)}
	got := DaysRemaining(snap, StateTrialActive, now)
	if got != 3 {
		t.Errorf("DaysRemaining(trial in 3d)=%d want=3", got)
	}

	// Estado que não tem target → 0
	got = DaysRemaining(SubscriptionSnapshot{}, StateExpired, now)
	if got != 0 {
		t.Errorf("DaysRemaining(expired)=%d want=0", got)
	}
}

package services

import "testing"

func TestScoreFactors_Score(t *testing.T) {
	cases := []struct {
		name     string
		factors  ScoreFactors
		expected int
	}{
		{"zeros", ScoreFactors{}, 0},
		{"max", ScoreFactors{BillsOnTime: 100, BudgetRespect: 100, SavingsRate: 100, DebtLevel: 100}, 100},
		// 85*0.35 + 72*0.25 + 65*0.25 + 55*0.15 = 29.75 + 18 + 16.25 + 8.25 = 72.25 → round(72)
		{"fallback", ScoreFactors{BillsOnTime: 85, BudgetRespect: 72, SavingsRate: 65, DebtLevel: 55}, 72},
		{"critico", ScoreFactors{BillsOnTime: 30, BudgetRespect: 40, SavingsRate: 20, DebtLevel: 30}, 30},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := c.factors.Score()
			if got != c.expected {
				t.Errorf("Score() = %d, esperado %d", got, c.expected)
			}
		})
	}
}

func TestScoreFactors_WeightedCorrectly(t *testing.T) {
	// Se apenas billsOnTime estiver em 100, o score deve ser exatamente 35
	// (peso de billsOnTime).
	f := ScoreFactors{BillsOnTime: 100}
	if got := f.Score(); got != 35 {
		t.Errorf("billsOnTime=100 isolado deveria dar 35, deu %d", got)
	}

	// Apenas budgetRespect em 100 = 25
	f = ScoreFactors{BudgetRespect: 100}
	if got := f.Score(); got != 25 {
		t.Errorf("budgetRespect=100 isolado deveria dar 25, deu %d", got)
	}

	// Apenas debtLevel em 100 = 15
	f = ScoreFactors{DebtLevel: 100}
	if got := f.Score(); got != 15 {
		t.Errorf("debtLevel=100 isolado deveria dar 15, deu %d", got)
	}
}

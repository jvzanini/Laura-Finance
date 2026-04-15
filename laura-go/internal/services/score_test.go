package services

import "testing"

// TestScore_AllWeights valida paridade dos pesos 35/25/25/15 contra o cálculo
// manual em várias combinações, incluindo valores redondos, quebrados e mix.
// Espelha fetchFinancialScoreAction.ts do PWA — divergências aqui = bug de paridade.
func TestScore_AllWeights(t *testing.T) {
	cases := []struct {
		name    string
		factors ScoreFactors
		want    int
	}{
		{"zeros", ScoreFactors{}, 0},
		{"all_100", ScoreFactors{100, 100, 100, 100}, 100},
		// Pesos isolados
		{"only_bills_100", ScoreFactors{BillsOnTime: 100}, 35},
		{"only_budget_100", ScoreFactors{BudgetRespect: 100}, 25},
		{"only_savings_100", ScoreFactors{SavingsRate: 100}, 25},
		{"only_debt_100", ScoreFactors{DebtLevel: 100}, 15},
		// Metades
		{"all_50", ScoreFactors{50, 50, 50, 50}, 50},
		{"all_80", ScoreFactors{80, 80, 80, 80}, 80},
		// Pesos mistos — cálculo manual
		// 90*0.35 + 70*0.25 + 60*0.25 + 40*0.15 = 31.5 + 17.5 + 15 + 6 = 70
		{"saudavel", ScoreFactors{90, 70, 60, 40}, 70},
		// 100*0.35 + 0*0.25 + 0*0.25 + 0*0.15 = 35
		{"only_bills_perfect", ScoreFactors{100, 0, 0, 0}, 35},
		// 0*0.35 + 100*0.25 + 100*0.25 + 100*0.15 = 65
		{"sem_bills", ScoreFactors{0, 100, 100, 100}, 65},
		// Fallback exato
		{"fallback_default", ScoreFactors{85, 72, 65, 55}, 72},
		// Crítico típico
		{"critico", ScoreFactors{30, 40, 20, 30}, 30},
		// Bom típico
		// 75*0.35 + 70*0.25 + 65*0.25 + 60*0.15 = 26.25+17.5+16.25+9 = 69
		{"bom", ScoreFactors{75, 70, 65, 60}, 69},
		// Arredondamento — 66.5 round → 67
		// 70*0.35 + 65*0.25 + 65*0.25 + 55*0.15 = 24.5 + 16.25 + 16.25 + 8.25 = 65.25 → 65
		{"arredondamento_down", ScoreFactors{70, 65, 65, 55}, 65},
		// 71*0.35 + 65*0.25 + 65*0.25 + 55*0.15 = 24.85 + 16.25 + 16.25 + 8.25 = 65.6 → 66
		{"arredondamento_up", ScoreFactors{71, 65, 65, 55}, 66},
		// Assimetria: só debt alto
		{"debt_dominante", ScoreFactors{0, 0, 0, 100}, 15},
		// Mix bills+debt (banda crítica em PWA)
		// 40*0.35 + 0*0.25 + 0*0.25 + 40*0.15 = 14 + 6 = 20
		{"mix_bills_debt", ScoreFactors{40, 0, 0, 40}, 20},
		// Mid-range savings alto
		// 50*0.35 + 50*0.25 + 90*0.25 + 50*0.15 = 17.5 + 12.5 + 22.5 + 7.5 = 60
		{"poupador", ScoreFactors{50, 50, 90, 50}, 60},
		// Caso 25/25/50/0 → 25*0.35 + 25*0.25 + 50*0.25 + 0*0.15 = 8.75 + 6.25 + 12.5 = 27.5 → 28
		{"mid_low", ScoreFactors{25, 25, 50, 0}, 28},
		// Valores impares com arredondamento half-up
		// 33*0.35 + 33*0.25 + 33*0.25 + 33*0.15 = 11.55 + 8.25 + 8.25 + 4.95 = 33
		{"uniforme_33", ScoreFactors{33, 33, 33, 33}, 33},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := c.factors.Score()
			if got != c.want {
				t.Errorf("Score() = %d, esperado %d (factors=%+v)", got, c.want, c.factors)
			}
		})
	}
}

// TestScore_Boundary_Zero garante que scores com todos os fatores em 0 dão 0.
func TestScore_Boundary_Zero(t *testing.T) {
	f := ScoreFactors{0, 0, 0, 0}
	if got := f.Score(); got != 0 {
		t.Errorf("Score() com zeros = %d, esperado 0", got)
	}
}

// TestScore_Boundary_Max garante que scores com todos os fatores em 100
// dão exatamente 100 (soma dos pesos = 1.0 por contrato).
func TestScore_Boundary_Max(t *testing.T) {
	f := ScoreFactors{100, 100, 100, 100}
	if got := f.Score(); got != 100 {
		t.Errorf("Score() com 100s = %d, esperado 100", got)
	}
}

// TestScore_NegativeBalance exercita o comportamento quando fatores vêm
// negativos (edge case — não deveria acontecer, mas queremos garantir
// que Score() não panica e produz valor previsível).
func TestScore_NegativeBalance(t *testing.T) {
	cases := []struct {
		name    string
		factors ScoreFactors
		want    int
	}{
		// Todos negativos: soma negativa
		// -50*0.35 + -50*0.25 + -50*0.25 + -50*0.15 = -50
		{"all_neg_50", ScoreFactors{-50, -50, -50, -50}, -50},
		// Só savings negativo: 50*0.35 + 50*0.25 + -50*0.25 + 50*0.15 = 17.5+12.5-12.5+7.5 = 25
		{"neg_savings", ScoreFactors{50, 50, -50, 50}, 25},
		// SavingsRate negativo quando expenses > income (cenário possível na prática)
		// 80*0.35 + 60*0.25 + -20*0.25 + 70*0.15 = 28 + 15 - 5 + 10.5 = 48.5 → 49
		{"savings_negativo_realista", ScoreFactors{80, 60, -20, 70}, 49},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := c.factors.Score()
			if got != c.want {
				t.Errorf("Score() = %d, esperado %d", got, c.want)
			}
		})
	}
}

// TestScoreBand_Emoji cobre scoreBand.emoji() (não coberto por score_nudges_test).
func TestScoreBand_Emoji(t *testing.T) {
	cases := []struct {
		band scoreBand
		want string
	}{
		{bandExcelente, "⭐"},
		{bandBom, "👍"},
		{bandRegular, "⚡"},
		{bandCritico, "⚠️"},
	}
	for _, c := range cases {
		if got := c.band.emoji(); got != c.want {
			t.Errorf("band=%v emoji=%q, esperado %q", c.band, got, c.want)
		}
	}
}

// TestInvalidateScoreWeightsCache garante que chamar Invalidate reseta o
// cache — próxima chamada a getScoreWeights deve reconsultar (neste teste,
// sem db.Pool configurado, retornará defaultWeights).
func TestInvalidateScoreWeightsCache(t *testing.T) {
	// Força um valor em cache distinto do default
	cachedWeightsMu.Lock()
	cachedWeights = &ScoreWeights{BillsOnTime: 0.5, BudgetRespect: 0.2, SavingsRate: 0.2, DebtLevel: 0.1}
	cachedWeightsMu.Unlock()

	got := getScoreWeights()
	if got.BillsOnTime != 0.5 {
		t.Errorf("cache não aplicado: BillsOnTime=%.2f", got.BillsOnTime)
	}

	InvalidateScoreWeightsCache()

	// Sem db.Pool, fallback é defaultWeights
	got = getScoreWeights()
	if got.BillsOnTime != defaultWeights.BillsOnTime {
		t.Errorf("após invalidate, esperava defaultWeights (%.2f), veio %.2f", defaultWeights.BillsOnTime, got.BillsOnTime)
	}
}

// TestComputeScoreFactors_NilPool garante fallback quando db.Pool está nil.
func TestComputeScoreFactors_NilPool(t *testing.T) {
	// db.Pool é nil em testes unitários — ComputeScoreFactors deve retornar fallbackFactors.
	f := ComputeScoreFactors(nil, "any-ws")
	if f != fallbackFactors {
		t.Errorf("ComputeScoreFactors com pool nil = %+v, esperado fallbackFactors=%+v", f, fallbackFactors)
	}
}

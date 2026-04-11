package services

import (
	"context"
	"log"
	"math"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// ScoreFactors é o shape dos 4 fatores ponderados que compõem o Score
// Financeiro (Story 9.2 do BMAD). Precisa ficar em paridade com o tipo
// correspondente em laura-pwa/src/lib/actions/financialScore.ts.
type ScoreFactors struct {
	BillsOnTime   int
	BudgetRespect int
	SavingsRate   int
	DebtLevel     int
}

// Score calcula o score agregado a partir dos fatores.
func (f ScoreFactors) Score() int {
	return int(math.Round(
		float64(f.BillsOnTime)*0.35 +
			float64(f.BudgetRespect)*0.25 +
			float64(f.SavingsRate)*0.25 +
			float64(f.DebtLevel)*0.15,
	))
}

// fallbackFactors é usado quando um workspace não tem dados suficientes
// para calcular um fator. Mantido em paralelo com o FALLBACK do PWA.
var fallbackFactors = ScoreFactors{
	BillsOnTime:   85,
	BudgetRespect: 72,
	SavingsRate:   65,
	DebtLevel:     55,
}

// ComputeScoreFactors calcula os 4 fatores atuais para um workspace.
// Replica a lógica da fetchFinancialScoreAction do PWA — quando alguma
// divergência aparecer, trate como bug e alinhe os dois lados.
func ComputeScoreFactors(ctx context.Context, workspaceID string) ScoreFactors {
	if db.Pool == nil {
		return fallbackFactors
	}
	f := fallbackFactors

	// budgetRespect
	var totalCats, respectedCats int
	err := db.Pool.QueryRow(ctx,
		`SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE COALESCE(spent.total, 0) <= c.monthly_limit_cents)
		 FROM categories c
		 LEFT JOIN (
			SELECT category_id, SUM(amount) AS total
			FROM transactions
			WHERE type = 'expense'
			  AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
			  AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
			GROUP BY category_id
		 ) spent ON spent.category_id = c.id
		 WHERE c.workspace_id = $1 AND c.monthly_limit_cents > 0`,
		workspaceID).Scan(&totalCats, &respectedCats)
	if err == nil && totalCats > 0 {
		f.BudgetRespect = int(math.Round(float64(respectedCats) / float64(totalCats) * 100))
	}

	// savingsRate + debtLevel base
	var incomeCents, expenseCents int
	_ = db.Pool.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int,
			COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int
		 FROM transactions
		 WHERE workspace_id = $1
		   AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
		   AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)`,
		workspaceID).Scan(&incomeCents, &expenseCents)

	if incomeCents > 0 {
		rate := float64(incomeCents-expenseCents) / float64(incomeCents) * 100
		f.SavingsRate = int(math.Max(0, math.Min(100, math.Round(rate))))
	}

	// debtLevel
	var incomeAvg90 int
	_ = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0)::int
		 FROM transactions
		 WHERE workspace_id = $1 AND type = 'income'
		   AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'`,
		workspaceID).Scan(&incomeAvg90)
	monthlyIncomeAvg := 0
	if incomeAvg90 > 0 {
		monthlyIncomeAvg = incomeAvg90 / 3
	} else {
		monthlyIncomeAvg = incomeCents
	}

	var feesCents int
	_ = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_fees_cents), 0)::int
		 FROM debt_rollovers
		 WHERE workspace_id = $1
		   AND created_at >= CURRENT_DATE - INTERVAL '90 days'`,
		workspaceID).Scan(&feesCents)

	if monthlyIncomeAvg > 0 {
		ratio := float64(feesCents) / float64(monthlyIncomeAvg)
		f.DebtLevel = int(math.Max(0, math.Min(100, math.Round(100-ratio*100))))
	}

	// billsOnTime
	var onTime, settled int
	_ = db.Pool.QueryRow(ctx,
		`SELECT
			COUNT(*) FILTER (
				WHERE paid_at IS NOT NULL AND paid_at::date <= due_date + INTERVAL '1 day'
			)::int,
			COUNT(*) FILTER (
				WHERE paid_at IS NOT NULL OR due_date < CURRENT_DATE
			)::int
		 FROM invoices
		 WHERE workspace_id = $1
		   AND due_date >= CURRENT_DATE - INTERVAL '90 days'`,
		workspaceID).Scan(&onTime, &settled)
	if settled > 0 {
		f.BillsOnTime = int(math.Round(float64(onTime) / float64(settled) * 100))
	}

	return f
}

// runDailyScoreSnapshot calcula o score atual para cada workspace e
// persiste em financial_score_snapshots. Se já existir snapshot para o
// dia, atualiza (ON CONFLICT) para capturar o estado mais recente.
func runDailyScoreSnapshot() {
	if db.Pool == nil {
		return
	}
	ctx := context.Background()

	rows, err := db.Pool.Query(ctx, `SELECT id FROM workspaces`)
	if err != nil {
		log.Printf("[CRON Error] listing workspaces for score snapshot: %v\n", err)
		return
	}
	defer rows.Close()

	var workspaceIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			workspaceIDs = append(workspaceIDs, id)
		}
	}

	log.Printf("[CRON] Computing score snapshot for %d workspaces...\n", len(workspaceIDs))
	for _, wsID := range workspaceIDs {
		f := ComputeScoreFactors(ctx, wsID)
		score := f.Score()

		_, err := db.Pool.Exec(ctx,
			`INSERT INTO financial_score_snapshots
				(workspace_id, snapshot_date, score, bills_on_time, budget_respect, savings_rate, debt_level)
			 VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
			 ON CONFLICT (workspace_id, snapshot_date) DO UPDATE
			 SET score = EXCLUDED.score,
				bills_on_time = EXCLUDED.bills_on_time,
				budget_respect = EXCLUDED.budget_respect,
				savings_rate = EXCLUDED.savings_rate,
				debt_level = EXCLUDED.debt_level`,
			wsID, score, f.BillsOnTime, f.BudgetRespect, f.SavingsRate, f.DebtLevel)
		if err != nil {
			log.Printf("[CRON Error] persisting score snapshot for ws %s: %v\n", wsID, err)
		}
	}
}

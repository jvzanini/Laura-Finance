package services

import (
	"context"
	"fmt"
	"log"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/robfig/cron/v3"
)

// StartBudgetAlertCron initializa um Cron param disparar nudges baseados em tempo
func StartBudgetAlertCron(sendMessageFunc func(to string, msg string)) {
	c := cron.New()

	// Every day at 20:00 (8:00 PM) server time
	_, err := c.AddFunc("0 20 * * *", func() {
		log.Println("[CRON] Running daily budget check...")
		runDailyBudgetCheck(sendMessageFunc)
	})

	if err != nil {
		log.Printf("[CRON] Failed to setup cron job: %v", err)
		return
	}

	c.Start()
	log.Println("[CRON] Daily Budget Check started on schedule (0 20 * * *).")
}

func runDailyBudgetCheck(sendMessageFunc func(to string, msg string)) {
	if db.Pool == nil {
		return
	}

	// Finds all categories that exceed budget for this month, and who is the workspace owner phone.
	query := `
		WITH current_spending AS (
			SELECT t.workspace_id, t.category_id, COALESCE(SUM(t.amount), 0) as total_spent
			FROM transactions t
			WHERE t.type = 'expense'
			  AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
			  AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
			GROUP BY t.workspace_id, t.category_id
		)
		SELECT cs.workspace_id, c.name, cs.total_spent, c.monthly_limit_cents, u.phone_number
		FROM current_spending cs
		JOIN categories c ON c.id = cs.category_id
		JOIN users u ON u.workspace_id = cs.workspace_id
		WHERE cs.total_spent > c.monthly_limit_cents
		  AND c.monthly_limit_cents > 0
		  AND u.phone_number IS NOT NULL
	`

	rows, err := db.Pool.Query(context.Background(), query)
	if err != nil {
		log.Printf("[CRON Error] fetching budgets: %v\n", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var ws, catName, phone string
		var spentCents, limitCents int
		if err := rows.Scan(&ws, &catName, &spentCents, &limitCents, &phone); err == nil {
			spent := float64(spentCents) / 100.0
			limit := float64(limitCents) / 100.0
			msg := fmt.Sprintf("🚨 *Aviso Diário Limit:* Você já ultrapassou o teto previsto para *%s*! \nGastos Totais Mês: R$%.2f (Seu Teto: R$%.2f). \nTente segurar os gastos nesta categoria!", catName, spent, limit)
			sendMessageFunc(phone, msg)
		}
	}
}

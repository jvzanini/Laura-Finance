package handlers

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// ============================================================================
// /api/v1/dashboard/cashflow — séries diárias do mês corrente
// ============================================================================

type CashFlowPoint struct {
	Day      string `json:"day"`
	Gastos   int    `json:"gastos_cents"`
	Entradas int    `json:"entradas_cents"`
}

type CashFlowResponse struct {
	Points []CashFlowPoint `json:"points"`
}

func handleCashFlow(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	key := fmt.Sprintf("ws:%s:dashboard:cashflow:%s", sess.WorkspaceID, time.Now().Format("200601"))
	resp, err := cache.GetOrCompute[CashFlowResponse](c.Context(), Cache, key, 60*time.Second, func(ctx context.Context) (CashFlowResponse, error) {
		return computeCashFlow(ctx, sess.WorkspaceID)
	})
	if err != nil {
		slog.Error("handleCashFlow", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(resp)
}

func computeCashFlow(parentCtx context.Context, workspaceID string) (CashFlowResponse, error) {
	ctx, cancel := context.WithTimeout(parentCtx, 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT DATE(transaction_date),
		        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int,
		        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int
		 FROM transactions
		 WHERE workspace_id = $1
		   AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
		   AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
		 GROUP BY DATE(transaction_date)
		 ORDER BY DATE(transaction_date) ASC`,
		workspaceID,
	)
	if err != nil {
		return CashFlowResponse{}, err
	}
	defer rows.Close()

	dayMap := map[string]CashFlowPoint{}
	for rows.Next() {
		var day time.Time
		var gastos, entradas int
		if err := rows.Scan(&day, &gastos, &entradas); err != nil {
			continue
		}
		key := day.Format("02/01")
		dayMap[key] = CashFlowPoint{Day: key, Gastos: gastos, Entradas: entradas}
	}

	// Série contínua: do dia 1 até hoje (inclusive) preenche zeros
	// onde não há movimento — matches o comportamento da action TS.
	now := time.Now()
	year, month, today := now.Date()
	daysInMonth := time.Date(year, month+1, 0, 0, 0, 0, 0, now.Location()).Day()
	lastDay := today
	if lastDay > daysInMonth {
		lastDay = daysInMonth
	}

	out := []CashFlowPoint{}
	for d := 1; d <= lastDay; d++ {
		key := time.Date(year, month, d, 0, 0, 0, 0, now.Location()).Format("02/01")
		if p, ok := dayMap[key]; ok {
			out = append(out, p)
		} else {
			out = append(out, CashFlowPoint{Day: key, Gastos: 0, Entradas: 0})
		}
	}
	return CashFlowResponse{Points: out}, nil
}

// ============================================================================
// /api/v1/dashboard/upcoming-bills — faturas abertas nos próximos 30d
// ============================================================================

type UpcomingBillItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AmountCents int    `json:"amount_cents"`
	DueDate     string `json:"due_date"`  // YYYY-MM-DD
	DueLabel    string `json:"due_label"` // DD/MM
	DaysUntil   int    `json:"days_until"`
	Type        string `json:"type"` // "fatura"
	CardColor   string `json:"card_color"`
}

type UpcomingBillsResponse struct {
	Bills []UpcomingBillItem `json:"bills"`
}

func handleUpcomingBills(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT i.id, COALESCE(c.name, 'Cartão removido'), i.total_cents,
		        i.due_date, COALESCE(c.color, '#71717A')
		 FROM invoices i
		 LEFT JOIN cards c ON c.id = i.card_id
		 WHERE i.workspace_id = $1
		   AND i.paid_at IS NULL
		   AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
		 ORDER BY i.due_date ASC
		 LIMIT 8`,
		sess.WorkspaceID,
	)
	if err != nil {
		slog.Error("handleUpcomingBills", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	today := time.Now()
	year, month, day := today.Date()
	todayMidnight := time.Date(year, month, day, 0, 0, 0, 0, today.Location())

	bills := []UpcomingBillItem{}
	for rows.Next() {
		var id, name, color string
		var dueDate time.Time
		var amount int
		if err := rows.Scan(&id, &name, &amount, &dueDate, &color); err != nil {
			continue
		}
		daysUntil := int(dueDate.Sub(todayMidnight).Hours() / 24)
		bills = append(bills, UpcomingBillItem{
			ID:          id,
			Name:        name,
			AmountCents: amount,
			DueDate:     dueDate.Format("2006-01-02"),
			DueLabel:    dueDate.Format("02/01"),
			DaysUntil:   daysUntil,
			Type:        "fatura",
			CardColor:   color,
		})
	}
	return c.JSON(UpcomingBillsResponse{Bills: bills})
}

// ============================================================================
// /api/v1/dashboard/category-budgets — categorias com teto + spent
// ============================================================================

type CategoryBudgetItem struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	LimitCents int     `json:"limit_cents"`
	SpentCents int     `json:"spent_cents"`
	Color      string  `json:"color"`
	Emoji      *string `json:"emoji"`
}

type CategoryBudgetsResponse struct {
	Categories []CategoryBudgetItem `json:"categories"`
}

func handleCategoryBudgets(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT
		    c.id, c.name, c.monthly_limit_cents, COALESCE(c.color, '#71717A'), c.emoji,
		    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::int AS spent
		 FROM categories c
		 LEFT JOIN transactions t
		    ON t.category_id = c.id
		    AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
		    AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
		 WHERE c.workspace_id = $1
		   AND c.monthly_limit_cents > 0
		 GROUP BY c.id, c.name, c.monthly_limit_cents, c.color, c.emoji
		 ORDER BY (
		    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::numeric
		    / NULLIF(c.monthly_limit_cents, 0)
		 ) DESC NULLS LAST
		 LIMIT 6`,
		sess.WorkspaceID,
	)
	if err != nil {
		slog.Error("handleCategoryBudgets", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	cats := []CategoryBudgetItem{}
	for rows.Next() {
		var c CategoryBudgetItem
		if err := rows.Scan(&c.ID, &c.Name, &c.LimitCents, &c.Color, &c.Emoji, &c.SpentCents); err != nil {
			continue
		}
		cats = append(cats, c)
	}
	return c.JSON(CategoryBudgetsResponse{Categories: cats})
}

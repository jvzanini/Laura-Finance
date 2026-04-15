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

type DRELine struct {
	Label      string `json:"label"`
	Indent     int    `json:"indent"`
	ValueCents int    `json:"value_cents"`
	Sign       string `json:"sign"` // "positive" | "negative" | "neutral"
	Bold       bool   `json:"bold"`
}

type DREResponse struct {
	Month                string    `json:"month"` // "YYYY-MM"
	Lines                []DRELine `json:"lines"`
	TotalIncomeCents     int       `json:"total_income_cents"`
	TotalExpenseCents    int       `json:"total_expense_cents"`
	TotalInvestmentCents int       `json:"total_investment_cents"`
	NetResultCents       int       `json:"net_result_cents"`
}

// handleReportsDRE equivale ao fetchDREAction do PWA, mas via REST.
// Aceita query param ?month=YYYY-MM para filtrar; sem param = mês corrente.
func handleReportsDRE(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	// Resolve targetDate: YYYY-MM-01 ou primeiro dia do mês corrente.
	month := c.Query("month")
	useExplicit := false
	if month != "" && len(month) == 7 && month[4] == '-' {
		useExplicit = true
	}

	monthKey := month
	if !useExplicit {
		monthKey = time.Now().Format("2006-01")
	}
	key := fmt.Sprintf("ws:%s:reports:dre:%s", sess.WorkspaceID, monthKey)
	resp, err := cache.GetOrCompute[DREResponse](c.Context(), Cache, key, 600*time.Second, func(parentCtx context.Context) (DREResponse, error) {
		return computeDRE(parentCtx, sess.WorkspaceID, month, useExplicit)
	})
	if err != nil {
		slog.Error("handleReportsDRE", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(resp)
}

func computeDRE(parentCtx context.Context, workspaceID, month string, useExplicit bool) (DREResponse, error) {
	ctx, cancel := context.WithTimeout(parentCtx, 10*time.Second)
	defer cancel()

	targetDate := month + "-01"

	var monthClause string
	var params []interface{}
	if useExplicit {
		monthClause = "EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM $2::date) AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM $2::date)"
		params = []interface{}{workspaceID, targetDate}
	} else {
		monthClause = "EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)"
		params = []interface{}{workspaceID}
	}

	// Receitas agrupadas por categoria
	incomeRows, err := db.Pool.Query(ctx,
		`SELECT COALESCE(c.name, 'Sem categoria'), COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE t.workspace_id = $1
		   AND t.type = 'income'
		   AND `+monthClause+`
		 GROUP BY c.name
		 HAVING COALESCE(SUM(t.amount), 0) > 0
		 ORDER BY SUM(t.amount) DESC`,
		params...,
	)
	if err != nil {
		slog.Error("handleReportsDRE (income)", "err", err)
		return DREResponse{}, err
	}
	defer incomeRows.Close()

	var incomeLines []DRELine
	totalIncome := 0
	for incomeRows.Next() {
		var name string
		var total int
		if err := incomeRows.Scan(&name, &total); err == nil {
			incomeLines = append(incomeLines, DRELine{Label: name, Indent: 1, ValueCents: total, Sign: "neutral"})
			totalIncome += total
		}
	}

	// Despesas agrupadas por categoria
	expenseRows, err := db.Pool.Query(ctx,
		`SELECT COALESCE(c.name, 'Sem categoria'), COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 LEFT JOIN categories c ON c.id = t.category_id
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND `+monthClause+`
		 GROUP BY c.name
		 HAVING COALESCE(SUM(t.amount), 0) > 0
		 ORDER BY SUM(t.amount) DESC`,
		params...,
	)
	if err != nil {
		slog.Error("handleReportsDRE (expense)", "err", err)
		return DREResponse{}, err
	}
	defer expenseRows.Close()

	var expenseLines []DRELine
	totalExpense := 0
	for expenseRows.Next() {
		var name string
		var total int
		if err := expenseRows.Scan(&name, &total); err == nil {
			expenseLines = append(expenseLines, DRELine{Label: name, Indent: 1, ValueCents: total, Sign: "neutral"})
			totalExpense += total
		}
	}

	// Investimentos
	var totalInvestment int
	_ = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(monthly_contribution_cents), 0)::int
		 FROM investments WHERE workspace_id = $1`,
		workspaceID,
	).Scan(&totalInvestment)

	netResult := totalIncome - totalExpense - totalInvestment

	lines := []DRELine{
		{Label: "(+) Receitas Brutas", Indent: 0, ValueCents: totalIncome, Sign: "positive", Bold: true},
	}
	lines = append(lines, incomeLines...)
	lines = append(lines, DRELine{Label: "(-) Despesas", Indent: 0, ValueCents: totalExpense, Sign: "negative", Bold: true})
	lines = append(lines, expenseLines...)
	if totalInvestment > 0 {
		lines = append(lines, DRELine{Label: "(-) Aporte em Investimentos", Indent: 0, ValueCents: totalInvestment, Sign: "negative", Bold: true})
	}
	sign := "positive"
	if netResult < 0 {
		sign = "negative"
	}
	lines = append(lines, DRELine{Label: "(=) Resultado Líquido", Indent: 0, ValueCents: netResult, Sign: sign, Bold: true})

	monthRef := timeNowMonth()
	if useExplicit {
		monthRef = month
	}

	return DREResponse{
		Month:                monthRef,
		Lines:                lines,
		TotalIncomeCents:     totalIncome,
		TotalExpenseCents:    totalExpense,
		TotalInvestmentCents: totalInvestment,
		NetResultCents:       netResult,
	}, nil
}

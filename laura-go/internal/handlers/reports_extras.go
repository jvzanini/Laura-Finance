package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// Reports secundários que complementam a aba DRE. Todos aceitam
// ?month=YYYY-MM e fallback para CURRENT_DATE. Mantêm paridade com
// as actions TypeScript fetchXxxReportAction do PWA.

// resolveReportMonth devolve (monthClause SQL fragment, targetDate param)
// baseado em ?month. Uso: cada query faz WHERE ${monthClause} e passa
// targetDate como $2.
func resolveReportMonth(c *fiber.Ctx) (string, string) {
	month := c.Query("month")
	if len(month) == 7 && month[4] == '-' {
		return "EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM $2::date) AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM $2::date)",
			month + "-01"
	}
	now := time.Now()
	fallback := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	return "EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM $2::date) AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM $2::date)",
		fallback
}

// ============================================================================
// /api/v1/reports/categories — gasto por categoria
// ============================================================================

type CategoryReportItem struct {
	CategoryID     *string `json:"category_id"`
	Name           string  `json:"name"`
	Emoji          *string `json:"emoji"`
	Color          string  `json:"color"`
	SpentCents     int     `json:"spent_cents"`
	PercentOfTotal float64 `json:"percent_of_total"`
}

type CategoryReportResponse struct {
	Items []CategoryReportItem `json:"items"`
}

func handleReportCategories(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	monthClause, targetDate := resolveReportMonth(c)
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT t.category_id, COALESCE(cat.name, 'Sem categoria'), cat.emoji,
		        COALESCE(cat.color, '#71717A'), COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 LEFT JOIN categories cat ON cat.id = t.category_id
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND `+monthClause+`
		 GROUP BY t.category_id, cat.name, cat.emoji, cat.color
		 HAVING COALESCE(SUM(t.amount), 0) > 0
		 ORDER BY SUM(t.amount) DESC`,
		sess.WorkspaceID, targetDate,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportCategories: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []CategoryReportItem{}
	total := 0
	for rows.Next() {
		var it CategoryReportItem
		if err := rows.Scan(&it.CategoryID, &it.Name, &it.Emoji, &it.Color, &it.SpentCents); err != nil {
			continue
		}
		items = append(items, it)
		total += it.SpentCents
	}
	if total > 0 {
		for i := range items {
			items[i].PercentOfTotal = float64(items[i].SpentCents) / float64(total) * 100
		}
	}
	return c.JSON(CategoryReportResponse{Items: items})
}

// ============================================================================
// /api/v1/reports/subcategories — top 20 por gasto
// ============================================================================

type SubcategoryReportItem struct {
	SubcategoryID  *string `json:"subcategory_id"`
	Name           string  `json:"name"`
	Emoji          *string `json:"emoji"`
	CategoryName   string  `json:"category_name"`
	SpentCents     int     `json:"spent_cents"`
	PercentOfTotal float64 `json:"percent_of_total"`
}

type SubcategoryReportResponse struct {
	Items []SubcategoryReportItem `json:"items"`
}

func handleReportSubcategories(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	monthClause, targetDate := resolveReportMonth(c)
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT t.subcategory_id, COALESCE(sc.name, 'Sem subcategoria'), sc.emoji,
		        COALESCE(cat.name, '—'), COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 LEFT JOIN subcategories sc ON sc.id = t.subcategory_id
		 LEFT JOIN categories cat ON cat.id = t.category_id
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND `+monthClause+`
		 GROUP BY t.subcategory_id, sc.name, sc.emoji, cat.name
		 HAVING COALESCE(SUM(t.amount), 0) > 0
		 ORDER BY SUM(t.amount) DESC
		 LIMIT 20`,
		sess.WorkspaceID, targetDate,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportSubcategories: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []SubcategoryReportItem{}
	total := 0
	for rows.Next() {
		var it SubcategoryReportItem
		if err := rows.Scan(&it.SubcategoryID, &it.Name, &it.Emoji, &it.CategoryName, &it.SpentCents); err != nil {
			continue
		}
		items = append(items, it)
		total += it.SpentCents
	}
	if total > 0 {
		for i := range items {
			items[i].PercentOfTotal = float64(items[i].SpentCents) / float64(total) * 100
		}
	}
	return c.JSON(SubcategoryReportResponse{Items: items})
}

// ============================================================================
// /api/v1/reports/cards — gasto por cartão (com bucket "Sem cartão")
// ============================================================================

type CardReportItem struct {
	CardID           *string `json:"card_id"`
	Name             string  `json:"name"`
	Color            string  `json:"color"`
	TransactionCount int     `json:"transaction_count"`
	TotalSpentCents  int     `json:"total_spent_cents"`
	PercentOfTotal   float64 `json:"percent_of_total"`
}

type CardReportResponse struct {
	Items []CardReportItem `json:"items"`
}

func handleReportCards(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	monthClause, targetDate := resolveReportMonth(c)
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT t.card_id, COALESCE(c.name, 'Sem cartão (dinheiro/pix)'),
		        COALESCE(c.color, '#71717A'), COUNT(*)::int,
		        COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 LEFT JOIN cards c ON c.id = t.card_id
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND `+monthClause+`
		 GROUP BY t.card_id, c.name, c.color
		 HAVING COALESCE(SUM(t.amount), 0) > 0
		 ORDER BY SUM(t.amount) DESC`,
		sess.WorkspaceID, targetDate,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportCards: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []CardReportItem{}
	total := 0
	for rows.Next() {
		var it CardReportItem
		if err := rows.Scan(&it.CardID, &it.Name, &it.Color, &it.TransactionCount, &it.TotalSpentCents); err != nil {
			continue
		}
		items = append(items, it)
		total += it.TotalSpentCents
	}
	if total > 0 {
		for i := range items {
			items[i].PercentOfTotal = float64(items[i].TotalSpentCents) / float64(total) * 100
		}
	}
	return c.JSON(CardReportResponse{Items: items})
}

// ============================================================================
// /api/v1/reports/payment-methods — crédito vs dinheiro/pix (inferido)
// ============================================================================

type PaymentMethodReportItem struct {
	Method           string  `json:"method"`
	Label            string  `json:"label"`
	TransactionCount int     `json:"transaction_count"`
	TotalSpentCents  int     `json:"total_spent_cents"`
	PercentOfTotal   float64 `json:"percent_of_total"`
}

type PaymentMethodReportResponse struct {
	Items []PaymentMethodReportItem `json:"items"`
}

func handleReportPaymentMethods(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	monthClause, targetDate := resolveReportMonth(c)
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT CASE WHEN t.card_id IS NULL THEN 'dinheiro_pix' ELSE 'crédito' END,
		        COUNT(*)::int, COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND `+monthClause+`
		 GROUP BY 1
		 ORDER BY SUM(t.amount) DESC`,
		sess.WorkspaceID, targetDate,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportPaymentMethods: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []PaymentMethodReportItem{}
	total := 0
	for rows.Next() {
		var it PaymentMethodReportItem
		if err := rows.Scan(&it.Method, &it.TransactionCount, &it.TotalSpentCents); err != nil {
			continue
		}
		if it.Method == "crédito" {
			it.Label = "Crédito (cartão)"
		} else {
			it.Label = "Dinheiro / PIX"
		}
		items = append(items, it)
		total += it.TotalSpentCents
	}
	if total > 0 {
		for i := range items {
			items[i].PercentOfTotal = float64(items[i].TotalSpentCents) / float64(total) * 100
		}
	}
	return c.JSON(PaymentMethodReportResponse{Items: items})
}

// ============================================================================
// /api/v1/reports/travel — tags contendo "viagem"
// ============================================================================

type TravelReportItem struct {
	Tag              string `json:"tag"`
	TransactionCount int    `json:"transaction_count"`
	TotalSpentCents  int    `json:"total_spent_cents"`
}

type TravelReportResponse struct {
	Items []TravelReportItem `json:"items"`
}

func handleReportTravel(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT tag, COUNT(*)::int, COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t, LATERAL UNNEST(t.tags) AS tag
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND tag ILIKE '%viagem%'
		 GROUP BY tag
		 ORDER BY SUM(t.amount) DESC`,
		sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportTravel: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []TravelReportItem{}
	for rows.Next() {
		var it TravelReportItem
		if err := rows.Scan(&it.Tag, &it.TransactionCount, &it.TotalSpentCents); err != nil {
			continue
		}
		items = append(items, it)
	}
	return c.JSON(TravelReportResponse{Items: items})
}

// ============================================================================
// /api/v1/reports/comparative — mês atual vs anterior
// ============================================================================

type ComparativeReportResponse struct {
	CurrentMonthLabel    string  `json:"current_month_label"`
	PreviousMonthLabel   string  `json:"previous_month_label"`
	CurrentIncomeCents   int     `json:"current_income_cents"`
	PreviousIncomeCents  int     `json:"previous_income_cents"`
	CurrentExpenseCents  int     `json:"current_expense_cents"`
	PreviousExpenseCents int     `json:"previous_expense_cents"`
	CurrentNetCents      int     `json:"current_net_cents"`
	PreviousNetCents     int     `json:"previous_net_cents"`
	DeltaPercent         float64 `json:"delta_percent"`
}

func handleReportComparative(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	var currInc, currExp, prevInc, prevExp int
	err := db.Pool.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(amount) FILTER (
				WHERE type = 'income'
				  AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
				  AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
			), 0)::int,
			COALESCE(SUM(amount) FILTER (
				WHERE type = 'expense'
				  AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
				  AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
			), 0)::int,
			COALESCE(SUM(amount) FILTER (
				WHERE type = 'income'
				  AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
				  AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE - INTERVAL '1 month')
			), 0)::int,
			COALESCE(SUM(amount) FILTER (
				WHERE type = 'expense'
				  AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
				  AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE - INTERVAL '1 month')
			), 0)::int
		 FROM transactions
		 WHERE workspace_id = $1`,
		sess.WorkspaceID,
	).Scan(&currInc, &currExp, &prevInc, &prevExp)
	if err != nil {
		log.Printf("[ERROR] handleReportComparative: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	currentNet := currInc - currExp
	previousNet := prevInc - prevExp
	var delta float64
	if previousNet != 0 {
		delta = float64(currentNet-previousNet) / abs(float64(previousNet)) * 100
	}

	now := time.Now()
	prev := now.AddDate(0, -1, 0)
	monthNames := []string{"janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"}

	return c.JSON(ComparativeReportResponse{
		CurrentMonthLabel:    monthNames[int(now.Month())-1] + " de " + formatYear(now),
		PreviousMonthLabel:   monthNames[int(prev.Month())-1] + " de " + formatYear(prev),
		CurrentIncomeCents:   currInc,
		PreviousIncomeCents:  prevInc,
		CurrentExpenseCents:  currExp,
		PreviousExpenseCents: prevExp,
		CurrentNetCents:      currentNet,
		PreviousNetCents:     previousNet,
		DeltaPercent:         delta,
	})
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func formatYear(t time.Time) string {
	return t.Format("2006")
}

// ============================================================================
// /api/v1/reports/trend — série 6 meses
// ============================================================================

type TrendReportPoint struct {
	Month        string `json:"month"`
	IncomeCents  int    `json:"income_cents"`
	ExpenseCents int    `json:"expense_cents"`
	NetCents     int    `json:"net_cents"`
}

type TrendReportResponse struct {
	Points []TrendReportPoint `json:"points"`
}

func handleReportTrend(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT DATE_TRUNC('month', transaction_date),
		        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int,
		        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int
		 FROM transactions
		 WHERE workspace_id = $1
		   AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
		 GROUP BY DATE_TRUNC('month', transaction_date)
		 ORDER BY 1 ASC`,
		sess.WorkspaceID,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportTrend: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	monthShort := []string{"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"}
	points := []TrendReportPoint{}
	for rows.Next() {
		var mref time.Time
		var income, expense int
		if err := rows.Scan(&mref, &income, &expense); err != nil {
			continue
		}
		label := monthShort[int(mref.Month())-1] + "/" + mref.Format("06")
		points = append(points, TrendReportPoint{
			Month: label, IncomeCents: income, ExpenseCents: expense, NetCents: income - expense,
		})
	}
	return c.JSON(TrendReportResponse{Points: points})
}

// ============================================================================
// /api/v1/reports/members — agregado por autor
// ============================================================================

type MemberReportItem struct {
	AuthorKey        string  `json:"author_key"`
	AuthorName       string  `json:"author_name"`
	AuthorType       string  `json:"author_type"`
	TransactionCount int     `json:"transaction_count"`
	TotalSpentCents  int     `json:"total_spent_cents"`
	PercentOfTotal   float64 `json:"percent_of_total"`
}

type MemberReportResponse struct {
	Items []MemberReportItem `json:"items"`
}

func handleReportMembers(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}
	monthClause, targetDate := resolveReportMonth(c)
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT
			CASE
				WHEN t.author_user_id IS NOT NULL THEN u.id::text
				WHEN t.author_phone_id IS NOT NULL THEN p.id::text
				ELSE 'unknown'
			END,
			CASE
				WHEN t.author_user_id IS NOT NULL THEN u.name
				WHEN t.author_phone_id IS NOT NULL THEN p.name
				ELSE 'Desconhecido'
			END,
			CASE
				WHEN t.author_user_id IS NOT NULL THEN 'user'
				WHEN t.author_phone_id IS NOT NULL THEN 'phone'
				ELSE 'unknown'
			END,
			COUNT(*)::int, COALESCE(SUM(t.amount), 0)::int
		 FROM transactions t
		 LEFT JOIN users u ON u.id = t.author_user_id
		 LEFT JOIN phones p ON p.id = t.author_phone_id
		 WHERE t.workspace_id = $1
		   AND t.type = 'expense'
		   AND `+monthClause+`
		 GROUP BY 1, 2, 3
		 HAVING COALESCE(SUM(t.amount), 0) > 0
		 ORDER BY SUM(t.amount) DESC`,
		sess.WorkspaceID, targetDate,
	)
	if err != nil {
		log.Printf("[ERROR] handleReportMembers: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []MemberReportItem{}
	total := 0
	for rows.Next() {
		var it MemberReportItem
		if err := rows.Scan(&it.AuthorKey, &it.AuthorName, &it.AuthorType, &it.TransactionCount, &it.TotalSpentCents); err != nil {
			continue
		}
		items = append(items, it)
		total += it.TotalSpentCents
	}
	if total > 0 {
		for i := range items {
			items[i].PercentOfTotal = float64(items[i].TotalSpentCents) / float64(total) * 100
		}
	}
	return c.JSON(MemberReportResponse{Items: items})
}

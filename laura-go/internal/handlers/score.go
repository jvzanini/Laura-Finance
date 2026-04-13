package handlers

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
)

type ScoreFactorsResponse struct {
	BillsOnTime   int `json:"bills_on_time"`
	BudgetRespect int `json:"budget_respect"`
	SavingsRate   int `json:"savings_rate"`
	DebtLevel     int `json:"debt_level"`
	Score         int `json:"score"`
}

// handleCurrentScore computa os 4 fatores do Score Financeiro em
// tempo real via services.ComputeScoreFactors (mesma fórmula do
// snapshot diário). Retorna JSON pronto para o componente
// FinancialScore do PWA.
func handleCurrentScore(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	f := services.ComputeScoreFactors(ctx, sess.WorkspaceID)
	return c.JSON(ScoreFactorsResponse{
		BillsOnTime:   f.BillsOnTime,
		BudgetRespect: f.BudgetRespect,
		SavingsRate:   f.SavingsRate,
		DebtLevel:     f.DebtLevel,
		Score:         f.Score(),
	})
}

type ScoreSnapshotItem struct {
	Date          string `json:"date"` // YYYY-MM-DD
	Score         int    `json:"score"`
	BillsOnTime   int    `json:"bills_on_time"`
	BudgetRespect int    `json:"budget_respect"`
	SavingsRate   int    `json:"savings_rate"`
	DebtLevel     int    `json:"debt_level"`
}

type ScoreHistoryResponse struct {
	History []ScoreSnapshotItem `json:"history"`
}

// handleScoreHistory retorna os últimos N snapshots diários
// (default 30) ordenados cronologicamente ascending para feed de chart.
func handleScoreHistory(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	limit := 30
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 365 {
		limit = l
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT snapshot_date, score, bills_on_time, budget_respect, savings_rate, debt_level
		 FROM financial_score_snapshots
		 WHERE workspace_id = $1
		 ORDER BY snapshot_date DESC
		 LIMIT $2`,
		sess.WorkspaceID, limit,
	)
	if err != nil {
		log.Printf("[ERROR] handleScoreHistory: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []ScoreSnapshotItem{}
	for rows.Next() {
		var s ScoreSnapshotItem
		var date time.Time
		if err := rows.Scan(&date, &s.Score, &s.BillsOnTime, &s.BudgetRespect, &s.SavingsRate, &s.DebtLevel); err != nil {
			continue
		}
		s.Date = date.Format("2006-01-02")
		items = append(items, s)
	}

	// Inverte para ordem ascendente (mais antigo primeiro) — melhor
	// para chart consumption.
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
	return c.JSON(ScoreHistoryResponse{History: items})
}

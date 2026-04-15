package services

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// scoreBand — faixas do Score Financeiro (Story 9.2). Mantidas em paridade
// com o PWA em laura-pwa/src/components/features/FinancialScore.tsx (função
// getScoreConfig). As transições interessantes são as quedas — "subir"
// não dispara nudge porque não é ansiogênico.
type scoreBand int

const (
	bandCritico scoreBand = iota
	bandRegular
	bandBom
	bandExcelente
)

func classifyScore(score int) scoreBand {
	switch {
	case score >= 80:
		return bandExcelente
	case score >= 60:
		return bandBom
	case score >= 40:
		return bandRegular
	default:
		return bandCritico
	}
}

func (b scoreBand) label() string {
	switch b {
	case bandExcelente:
		return "Excelente"
	case bandBom:
		return "Bom"
	case bandRegular:
		return "Regular"
	default:
		return "Crítico"
	}
}

func (b scoreBand) emoji() string {
	switch b {
	case bandExcelente:
		return "⭐"
	case bandBom:
		return "👍"
	case bandRegular:
		return "⚡"
	default:
		return "⚠️"
	}
}

// runDailyScoreBandCheck roda depois do runDailyScoreSnapshot e compara
// o snapshot do dia atual com o imediatamente anterior (por workspace).
// Se a faixa piorou (menor ordinal), dispara um nudge via WhatsApp
// para o owner do workspace. Só envia se o snapshot anterior existir
// E se a queda for entre faixas distintas (não por mudança marginal
// dentro da mesma faixa).
func runDailyScoreBandCheck(sendMessageFunc func(to string, msg string)) {
	if db.Pool == nil {
		return
	}
	ctx := context.Background()

	// CTE: pega os 2 snapshots mais recentes por workspace e compara.
	query := `
		WITH ranked AS (
			SELECT
				workspace_id,
				score,
				snapshot_date,
				ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY snapshot_date DESC) AS rn
			FROM financial_score_snapshots
		),
		pairs AS (
			SELECT
				r1.workspace_id,
				r1.score AS today_score,
				r2.score AS yesterday_score
			FROM ranked r1
			JOIN ranked r2 ON r2.workspace_id = r1.workspace_id AND r2.rn = 2
			WHERE r1.rn = 1
		)
		SELECT p.workspace_id, p.today_score, p.yesterday_score, u.phone_number
		FROM pairs p
		JOIN users u ON u.workspace_id = p.workspace_id AND u.role = 'proprietário'
		WHERE u.phone_number IS NOT NULL AND u.phone_number != ''
	`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		slog.Error("[CRON] score band check query", "err", err)
		return
	}
	defer rows.Close()

	nudgesSent := 0
	for rows.Next() {
		var workspaceID, phone string
		var todayScore, yesterdayScore int
		if err := rows.Scan(&workspaceID, &todayScore, &yesterdayScore, &phone); err != nil {
			continue
		}

		todayBand := classifyScore(todayScore)
		yesterdayBand := classifyScore(yesterdayScore)

		if todayBand >= yesterdayBand {
			continue // manteve ou melhorou
		}

		msg := fmt.Sprintf(
			"%s *Alerta do Score Financeiro*\n\nSeu score saiu de *%s* (%d) para *%s* (%d) desde ontem.\n\nIsso costuma acontecer quando um teto de categoria é estourado, quando uma fatura vence sem pagamento, ou quando novas rolagens de dívida entram.\n\nDá uma olhada no dashboard pra entender o que mudou — ele detalha os 4 fatores do score.",
			todayBand.emoji(),
			yesterdayBand.label(), yesterdayScore,
			todayBand.label(), todayScore,
		)
		sendMessageFunc(phone, msg)
		nudgesSent++
		_ = workspaceID // usado em logs futuros
	}

	if nudgesSent > 0 {
		slog.Info("[CRON] score band check done", "nudges_sent", nudgesSent)
	}
}

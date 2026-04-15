-- Financial score snapshots: snapshot diário do Score Financeiro por
-- workspace, persistido pelo cron do laura-go (ScoreSnapshotJob).
--
-- Habilita:
--   1. Gráfico "evolução do score nos últimos 6 meses" no dashboard do PWA
--   2. Nudges do Epic 4 detectando quedas entre faixas (Bom → Regular)
--   3. Auditoria histórica para debug de "o que aconteceu no meu score"
--
-- Constraint única em (workspace_id, snapshot_date) garante 1 snapshot por
-- dia por workspace. Se o cron rodar mais de uma vez no mesmo dia,
-- ON CONFLICT DO UPDATE atualiza os valores.

CREATE TABLE IF NOT EXISTS financial_score_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    score INTEGER NOT NULL,                  -- 0..100
    bills_on_time INTEGER NOT NULL,          -- fator 0..100
    budget_respect INTEGER NOT NULL,         -- fator 0..100
    savings_rate INTEGER NOT NULL,           -- fator 0..100
    debt_level INTEGER NOT NULL,             -- fator 0..100
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT score_snapshots_workspace_date_unique UNIQUE (workspace_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_workspace ON financial_score_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_date ON financial_score_snapshots(snapshot_date DESC);

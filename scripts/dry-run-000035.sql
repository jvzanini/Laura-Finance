-- scripts/dry-run-000035.sql
-- Quantos registros a migration 000035 removeria?
-- Executar ANTES de aplicar em prod. Threshold: todos = 0 -> prosseguir.
SELECT 'transactions'    AS tabela, COUNT(*) AS rows_to_delete FROM transactions    WHERE workspace_id IS NULL
UNION ALL SELECT 'cards',             COUNT(*) FROM cards             WHERE workspace_id IS NULL
UNION ALL SELECT 'categories',        COUNT(*) FROM categories        WHERE workspace_id IS NULL
UNION ALL SELECT 'subcategories',     COUNT(*) FROM subcategories     WHERE workspace_id IS NULL
UNION ALL SELECT 'message_logs',      COUNT(*) FROM message_logs      WHERE workspace_id IS NULL
UNION ALL SELECT 'financial_goals',   COUNT(*) FROM financial_goals   WHERE workspace_id IS NULL
UNION ALL SELECT 'investments',       COUNT(*) FROM investments       WHERE workspace_id IS NULL
UNION ALL SELECT 'debt_rollovers',    COUNT(*) FROM debt_rollovers    WHERE workspace_id IS NULL;

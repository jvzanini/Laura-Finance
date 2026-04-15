# Workspace isolation runbook

> Arquitetura: [#multi-tenant-model](../../architecture.md#multi-tenant-model)

## Regra
- Toda query DEVE incluir `WHERE workspace_id = $1`.
- Validar via grep de migrations + handlers.

## Auditoria de leak cross-tenant
- `SELECT count(DISTINCT workspace_id) FROM <table>` por user_id.
- Se >1 workspace_id por user → INVESTIGAR.

## Recovery em caso de leak
- Identificar user_id afetado.
- `DELETE FROM <table> WHERE workspace_id != <esperado> AND user_id = <user>`.
- Notificar usuários afetados.

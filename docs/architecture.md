# Arquitetura — Laura Finance

> Documento PT-BR. Última revisão: 2026-04-15 (Fase 12).

## 1. Visão geral

Laura Finance é um SaaS fintech multi-tenant com backend Go (Fiber + pgxpool + slog + Sentry + OTel) e frontend Next.js 16 PWA.

## 2. Fluxo de request

```mermaid
sequenceDiagram
    participant Client
    participant Vercel
    participant API
    participant DB
    Client->>Vercel: HTTPS
    Vercel->>API: /api/v1/*
    API->>DB: pgxpool
    DB-->>API: rows
    API-->>Vercel: JSON
    Vercel-->>Client: HTML/JSON
```

> Runbook relacionado: [ops/runbooks/incident-response.md](./ops/runbooks/incident-response.md)

## 3. Persistência

```mermaid
erDiagram
    workspaces ||--o{ users : has
    workspaces ||--o{ transactions : owns
    workspaces ||--o{ categories : owns
    workspaces ||--o{ cards : owns
    workspaces ||--o{ goals : owns
```

> Runbook relacionado: [ops/runbooks/migrations.md](./ops/runbooks/migrations.md)

## 4. Observability stack

```mermaid
flowchart TB
    Fiber --> slog
    slog --> Sentry
    Fiber --> OTel
    Fiber --> Prometheus
    Prometheus --> Grafana
    Sentry --> Slack
```

> Runbook relacionado: [ops/runbooks/sentry-alerts.md](./ops/runbooks/sentry-alerts.md)

## 5. Deploy pipeline

```mermaid
flowchart LR
    GitHub --> GoCI
    GoCI --> FlyDeploy
    GitHub --> PWACI
    PWACI --> VercelDeploy
    GitHub --> BackupCron
    BackupCron --> FlyPostgres
```

> Runbook relacionado: [ops/runbooks/rollback.md](./ops/runbooks/rollback.md)

## 6. Multi-tenant model

```mermaid
flowchart TB
    Workspace1 --> Members1
    Workspace2 --> Members2
    Members1 -->|workspace_id=1| Data1
    Members2 -->|workspace_id=2| Data2
```

> Runbook relacionado: [ops/runbooks/workspace-isolation.md](./ops/runbooks/workspace-isolation.md)

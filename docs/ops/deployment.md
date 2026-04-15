# Deployment — Laura Finance

Pipeline de deploy e procedimentos operacionais (stub da Fase 10).

---

## 1. Arquitetura de deploy

```
push main
   │
   ├─► GitHub Actions: go-ci.yml     (lint, vet, security, test, build)
   ├─► GitHub Actions: pwa-ci.yml    (typecheck, lint, build, vitest)
   ├─► GitHub Actions: playwright.yml (E2E smoke do PWA)
   └─► GitHub Actions: security.yml  (gitleaks)
             │
             ▼
     [CI verde?]
             │
     ┌───────┴───────┐
     ▼               ▼
  Vercel         Fly.io
  (laura-pwa)    (laura-go)
```

- **Frontend (Vercel):** trigger automático em push para `main` do
  diretório `laura-pwa/`.
- **Backend (Fly.io):** manual (`fly deploy`) ou via workflow futuro com
  `FLY_API_TOKEN`.

---

## 2. Checklist de primeiro deploy

### 2.1 Backend (Fly.io)

```bash
# 1. Login
fly auth login

# 2. Inicializar app (usa laura-go/fly.toml como template)
cd laura-go
fly launch --copy-config --no-deploy
# Confirmar app name "laura-finance" e região "gru".

# 3. Provisionar Postgres (Fly Postgres cluster)
fly postgres create --name laura-finance-db --region gru --initial-cluster-size 1
fly postgres attach laura-finance-db --app laura-finance
# Isso seta DATABASE_URL automaticamente.

# 4. Criar volume para whatsmeow
fly volumes create whatsmeow_data --app laura-finance --region gru --size 1

# 5. Setar secrets
fly secrets set \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  GROQ_API_KEY="gsk_..." \
  OPENAI_API_KEY="sk-..." \
  GOOGLE_API_KEY="AIza..." \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  RESEND_API_KEY="re_..." \
  APP_ENV="production" \
  --app laura-finance

# 6. Aplicar migrations no Fly Postgres
fly postgres connect --app laura-finance-db < ../infrastructure/migrations/000001_init.sql
# Repetir em ordem, OU usar proxy:
fly proxy 5433:5432 --app laura-finance-db &
for f in ../infrastructure/migrations/*.sql; do
    PGPASSWORD=<senha> psql -h localhost -p 5433 -U postgres -d laura_finance -f "$f"
done

# 7. Primeiro deploy
fly deploy --app laura-finance

# 8. Smoke test
curl -f https://laura-finance.fly.dev/health
fly logs --app laura-finance
```

### 2.2 Frontend (Vercel)

```bash
cd laura-pwa
vercel link
# Selecionar/criar projeto "laura-finance-pwa".

# Setar env vars no dashboard Vercel (Settings → Environment Variables):
#   NEXT_PUBLIC_API_URL=https://laura-finance.fly.dev
#   DATABASE_URL=<fly postgres>  (se PWA acessar DB direto)
#   ... outras conforme o módulo

# Primeiro deploy
vercel --prod

# Smoke test
curl -fI https://<projeto>.vercel.app/
```

---

## 3. Deploy contínuo

- **PWA:** push em `main` → Vercel rebuilda automaticamente.
- **Backend:** rodar `fly deploy --app laura-finance` manualmente após
  CI verde. (Futuro: workflow `fly-deploy.yml` com `FLY_API_TOKEN`.)

---

## 4. Rollback

### 4.1 PWA (Vercel)

```bash
# Via CLI
vercel rollback <deployment-url>
# OU dashboard → Deployments → escolher anterior → "Promote to Production".
```

### 4.2 Backend (Fly)

```bash
# Listar releases
fly releases --app laura-finance

# Rollback para release anterior (tag v{N-1})
fly deploy --image registry.fly.io/laura-finance:deployment-<SHA-ANTERIOR> \
           --app laura-finance

# Ou via CLI:
fly releases rollback <version-number> --app laura-finance
```

### 4.3 Migrations

Migrations são **append-only**. Para reverter lógica, criar nova migration
que desfaz o efeito — **nunca** editar migration já aplicada.

---

## 5. Backup do Postgres

### 5.1 Backups automáticos do Fly Postgres

Fly faz snapshots automáticos diários (retenção 7 dias no plano free).

```bash
# Listar
fly postgres backup list --app laura-finance-db

# Restaurar
fly postgres backup restore <backup-id> --app laura-finance-db
```

### 5.2 Dump manual

```bash
fly proxy 5433:5432 --app laura-finance-db &
PGPASSWORD=<senha> pg_dump \
  -h localhost -p 5433 -U postgres -d laura_finance \
  -F c -f laura-$(date +%Y%m%d-%H%M).dump
```

Armazenar dumps em bucket S3 separado (futuro: job cron +
criptografia com `age`).

---

## 6. Healthchecks

- **Backend:** `GET /health` retorna 200 quando DB + whatsmeow OK.
- **Frontend:** Vercel monitora latência da home + build status.
- Fly faz check HTTP a cada 30s (ver `fly.toml`).

---

## 7. Observabilidade (futuro)

- Logs estruturados: pino (frontend) + slog/zerolog (backend).
- Metric endpoint `/metrics` (Prometheus) — pendente.
- Tracing OTel — pendente.

## Secrets observability (fly secrets set)

```sh
fly secrets set OTEL_EXPORTER_OTLP_ENDPOINT="" -a laura-finance-api
fly secrets set SENTRY_DSN_API="" -a laura-finance-api
fly secrets set SENTRY_TRACES_SAMPLE_RATE="0.1" -a laura-finance-api
fly secrets set OTEL_TRACES_SAMPLE_RATE="0.1" -a laura-finance-api
fly secrets set BACKUP_OPS_TOKEN="$(openssl rand -hex 32)" -a laura-finance-api
```

STANDBYs ativam quando DSN/token forem reais.

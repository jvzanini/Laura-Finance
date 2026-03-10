# Story 4.3: Semáforos Orçamentários e Alertas Dinâmicos (CRON)

Status: done

## Story
As an Usuário
I want que o sistema faça verificações de fim de dia (CRON)
So that caso eu tenha ultrapassado ou esquecido de conferir, a IA me chame no WhatsApp e avise: "Você estourou a categoria Lazer!".

## Tasks / Subtasks
- [x] Configurar `robfig/cron/v3` no `main.go`.
- [x] Rodar tarefa diária (ou horária mock para teste) que verifica categorias com `sum(amount) > budget_limit`.
- [x] Caso haja violação > 100%, evocar função disparando alerta de Zap nativo.

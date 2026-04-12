export const EMAIL_TEMPLATE_TYPES = [
    { value: "verificacao_email", label: "Verificação de Email", vars: ["userName", "verifyUrl"] },
    { value: "reset_senha", label: "Reset de Senha", vars: ["userName", "resetUrl"] },
    { value: "convite_membro", label: "Convite de Membro", vars: ["role", "email", "tempPassword"] },
    { value: "comprovante_pagamento", label: "Comprovante de Pagamento", vars: ["planName", "amount"] },
    { value: "cobranca", label: "Cobrança / Lembrete", vars: ["userName", "planName", "dueDate", "amount", "paymentUrl"] },
    { value: "alerta_orcamento", label: "Alerta de Orçamento", vars: ["userName", "percentage", "categoryName", "spent", "budget"] },
    { value: "relatorio_mensal", label: "Relatório Mensal", vars: ["userName", "month", "income", "expenses", "balance", "score"] },
    { value: "marketing", label: "Marketing / Novidades", vars: ["title", "body", "ctaUrl", "ctaText"] },
] as const;

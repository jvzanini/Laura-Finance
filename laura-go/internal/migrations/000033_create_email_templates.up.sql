-- Email templates HTML editáveis pelo super admin.
-- Cada template tem um "type" (verificacao, reset_senha, convite, etc.)
-- e apenas um pode estar ativo por type por vez.
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    description VARCHAR(500),
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_active_per_type
    ON email_templates(type) WHERE active = TRUE;

-- Seed com templates padrão para cada tipo de email do sistema
INSERT INTO email_templates (type, name, subject, html_body, description, active) VALUES
-- Verificação de email
('verificacao_email', 'Verificação Padrão', 'Confirme seu e-mail — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo, {{userName}}! 🎉</h2>
  <p>Obrigado por criar sua conta na Laura Finance! Só falta confirmar seu e-mail para liberar todos os recursos.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{verifyUrl}}" style="display: inline-block; padding: 12px 32px; background: #10B981; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Confirmar e-mail</a>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">O link é válido por <strong>24 horas</strong>. Se você não criou esta conta, ignore esta mensagem.</p>
  <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
  <p style="font-size: 11px; color: #71717A;">Link completo:<br/><code style="word-break: break-all;">{{verifyUrl}}</code></p>
</div>', 'Template padrão de verificação de email', true),

-- Reset de senha
('reset_senha', 'Reset Padrão', 'Recuperação de senha — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Olá, {{userName}}! 👋</h2>
  <p>Recebemos uma solicitação para redefinir a senha da sua conta Laura Finance.</p>
  <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>30 minutos</strong>.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{resetUrl}}" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Redefinir senha</a>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Se você não pediu esse reset, ignore este e-mail — sua senha continua segura.</p>
</div>', 'Template padrão de reset de senha', true),

-- Convite de membro
('convite_membro', 'Convite Padrão', 'Acesso Liberado: Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Você foi convidado! 🥳</h2>
  <p>Um acesso como <strong>{{role}}</strong> foi provisionado para você na Laura Finance.</p>
  <p>Sua credencial de primeiro acesso:</p>
  <div style="background: #18181B; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 4px 0; font-size: 14px;">Login: <strong>{{email}}</strong></p>
    <p style="margin: 4px 0; font-size: 14px;">Senha Temporária: <strong>{{tempPassword}}</strong></p>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Por favor, troque sua senha ao logar no painel.</p>
</div>', 'Template padrão de convite de membro', true),

-- Comprovante de pagamento
('comprovante_pagamento', 'Comprovante Padrão', 'Seu Comprovante Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo à Laura Finance PRO! 🎉</h2>
  <p>Seu pagamento para o plano <strong>{{planName}}</strong> foi aprovado com sucesso.</p>
  <p>Valor faturado: <strong>{{amount}}</strong></p>
  <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
  <p>Você já pode desfrutar dos limites ilimitados da sua Inteligência Artificial no WhatsApp.</p>
  <p style="color: #71717A; font-size: 12px;">Atenciosamente, Equipe Laura</p>
</div>', 'Template padrão de comprovante', true),

-- Cobrança
('cobranca', 'Cobrança Padrão', 'Lembrete de Pagamento — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #F59E0B; margin-top: 0;">Lembrete de Pagamento 💳</h2>
  <p>Olá, {{userName}}!</p>
  <p>Seu plano <strong>{{planName}}</strong> vence em <strong>{{dueDate}}</strong>.</p>
  <p>Valor: <strong>{{amount}}</strong></p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{paymentUrl}}" style="display: inline-block; padding: 12px 32px; background: #F59E0B; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 600;">Pagar Agora</a>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Evite a suspensão do seu acesso mantendo seu plano em dia.</p>
</div>', 'Template padrão de cobrança', true),

-- Alerta de orçamento
('alerta_orcamento', 'Alerta Orçamento Padrão', 'Alerta de Orçamento — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #EF4444; margin-top: 0;">Atenção ao Orçamento! ⚠️</h2>
  <p>Olá, {{userName}}!</p>
  <p>Você já utilizou <strong>{{percentage}}%</strong> do orçamento da categoria <strong>{{categoryName}}</strong> este mês.</p>
  <p>Gasto atual: <strong>{{spent}}</strong> de <strong>{{budget}}</strong></p>
  <p style="font-size: 12px; color: #A1A1AA;">Fique de olho nos gastos para manter suas finanças sob controle!</p>
</div>', 'Template padrão de alerta de orçamento', true),

-- Relatório mensal
('relatorio_mensal', 'Relatório Mensal Padrão', 'Seu Resumo Financeiro — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Resumo de {{month}} 📊</h2>
  <p>Olá, {{userName}}! Aqui está seu resumo financeiro:</p>
  <div style="background: #18181B; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 8px 0;">Receitas: <strong style="color: #10B981;">{{income}}</strong></p>
    <p style="margin: 8px 0;">Despesas: <strong style="color: #EF4444;">{{expenses}}</strong></p>
    <p style="margin: 8px 0;">Saldo: <strong style="color: #7C3AED;">{{balance}}</strong></p>
    <p style="margin: 8px 0;">Score: <strong>{{score}}/100</strong></p>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Acesse o dashboard para ver mais detalhes.</p>
</div>', 'Template padrão de relatório mensal', true),

-- Marketing
('marketing', 'Marketing Padrão', 'Novidades Laura Finance ✨',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">{{title}}</h2>
  <p>{{body}}</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{ctaUrl}}" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">{{ctaText}}</a>
  </div>
  <p style="font-size: 11px; color: #71717A;">Você recebeu este e-mail por ser usuário da Laura Finance.</p>
</div>', 'Template padrão de marketing', true)

ON CONFLICT DO NOTHING;

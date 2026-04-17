-- Migration 000041: seed de templates de email para OTP de signup e ciclo de assinatura.
-- Vars disponíveis: {{code}}, {{nome}}, {{plano}}, {{valor}}, {{data_limite}}, {{app_url}}, {{dias_restantes}}.

INSERT INTO email_templates (type, name, subject, html_body, description, active) VALUES
('codigo_verificacao_email', 'Codigo OTP Padrao', 'Seu codigo de verificacao — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Ola, {{nome}}!</h2>
  <p>Seu codigo de verificacao para criar sua conta na Laura Finance:</p>
  <div style="margin: 32px 0; text-align: center;">
    <div style="display: inline-block; padding: 16px 32px; background: #18181B; border: 1px solid #27272A; border-radius: 12px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #10B981; font-family: monospace;">{{code}}</div>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">O codigo e valido por <strong>10 minutos</strong>. Se voce nao solicitou, ignore esta mensagem.</p>
</div>', 'Codigo OTP de 6 digitos enviado no signup', true),

('trial_iniciado', 'Trial Iniciado Padrao', 'Bem-vindo! Seu trial comecou — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo(a), {{nome}}!</h2>
  <p>Seu periodo gratuito de <strong>7 dias</strong> comecou agora.</p>
  <p>Plano ativo: <strong>{{plano}}</strong></p>
  <p>Aproveite todos os recursos para organizar suas financas familiares no WhatsApp. Voce pode assinar a qualquer momento pelo painel — sem preocupacao com data limite no inicio.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{app_url}}/dashboard" style="display: inline-block; padding: 12px 32px; background: #10B981; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Acessar meu painel</a>
  </div>
</div>', 'Enviado apos finalizar signup', true),

('trial_terminando_d3', 'Trial D-3 Padrao', 'Faltam 3 dias para o fim do trial — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #F59E0B; margin-top: 0;">Seu trial termina em {{dias_restantes}} dias</h2>
  <p>Ola, {{nome}}!</p>
  <p>Falta pouco para o fim do seu periodo gratuito. Assine agora para nao perder o acesso a todos os recursos.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{app_url}}/subscription" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Assinar agora</a>
  </div>
</div>', 'Aviso 3 dias antes do fim do trial', true),

('trial_terminando_d1', 'Trial D-1 Padrao', 'Ultimo dia do trial — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #EF4444; margin-top: 0;">Seu trial termina amanha</h2>
  <p>Ola, {{nome}}!</p>
  <p>Este e o ultimo dia do seu periodo gratuito. Assine agora para manter seu acesso sem interrupcoes.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{app_url}}/subscription" style="display: inline-block; padding: 12px 32px; background: #EF4444; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Assinar agora</a>
  </div>
</div>', 'Aviso no ultimo dia do trial', true),

('trial_expirado', 'Trial Expirado Padrao', 'Seu trial terminou — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #EF4444; margin-top: 0;">Seu trial terminou</h2>
  <p>Ola, {{nome}}!</p>
  <p>Seu periodo gratuito acabou. Para continuar usando a Laura Finance, assine um de nossos planos. Seus dados continuam seguros e te esperando.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{app_url}}/subscription" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Reativar acesso</a>
  </div>
</div>', 'Enviado quando trial expira sem assinatura', true),

('pagamento_falhou', 'Pagamento Falhou Padrao', 'Pagamento nao autorizado — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #EF4444; margin-top: 0;">Nao conseguimos processar seu pagamento</h2>
  <p>Ola, {{nome}}!</p>
  <p>Tentamos cobrar o plano <strong>{{plano}}</strong> no valor de <strong>{{valor}}</strong> mas o pagamento nao foi autorizado.</p>
  <p>Atualize sua forma de pagamento ate <strong>{{data_limite}}</strong> para nao perder acesso aos recursos.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{app_url}}/subscription" style="display: inline-block; padding: 12px 32px; background: #EF4444; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Atualizar pagamento</a>
  </div>
</div>', 'Enviado em invoice.payment_failed', true),

('pagamento_retomado', 'Pagamento Retomado Padrao', 'Pagamento confirmado — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #10B981; margin-top: 0;">Pagamento confirmado</h2>
  <p>Ola, {{nome}}!</p>
  <p>Seu pagamento foi processado com sucesso. Tudo voltou ao normal. Obrigado por continuar com a gente.</p>
</div>', 'Enviado em invoice.paid apos past_due', true),

('assinatura_cancelada', 'Assinatura Cancelada Padrao', 'Assinatura cancelada — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #A1A1AA; margin-top: 0;">Assinatura cancelada</h2>
  <p>Ola, {{nome}}!</p>
  <p>Recebemos o cancelamento da sua assinatura. Seu acesso permanece ativo ate <strong>{{data_limite}}</strong>.</p>
  <p>Se mudar de ideia, voce pode reativar a qualquer momento.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{app_url}}/subscription" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Reativar assinatura</a>
  </div>
</div>', 'Enviado ao cancelar assinatura', true)

ON CONFLICT DO NOTHING;

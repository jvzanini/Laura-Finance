DELETE FROM email_templates WHERE type IN (
    'codigo_verificacao_email',
    'trial_iniciado',
    'trial_terminando_d3',
    'trial_terminando_d1',
    'trial_expirado',
    'pagamento_falhou',
    'pagamento_retomado',
    'assinatura_cancelada'
);

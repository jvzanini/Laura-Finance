-- Adiciona referência de plano e instância WhatsApp aos workspaces.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'plan_slug') THEN
        ALTER TABLE workspaces ADD COLUMN plan_slug VARCHAR(50) DEFAULT 'standard';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'whatsapp_instance_id') THEN
        ALTER TABLE workspaces ADD COLUMN whatsapp_instance_id UUID REFERENCES whatsapp_instances(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'suspended_at') THEN
        ALTER TABLE workspaces ADD COLUMN suspended_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'suspended_reason') THEN
        ALTER TABLE workspaces ADD COLUMN suspended_reason VARCHAR(500);
    END IF;
END $$;

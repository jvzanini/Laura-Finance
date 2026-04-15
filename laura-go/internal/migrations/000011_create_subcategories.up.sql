-- Subcategories (filhas das categorias)
CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    emoji VARCHAR(10),
    description VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_workspace ON subcategories(workspace_id);

-- Add subcategory reference to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

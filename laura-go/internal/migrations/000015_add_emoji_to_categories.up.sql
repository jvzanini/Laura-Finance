-- Add emoji and description to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS emoji VARCHAR(10);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description VARCHAR(500);

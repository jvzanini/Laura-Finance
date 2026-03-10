-- Add tags column to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

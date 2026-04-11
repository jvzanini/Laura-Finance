-- Fix schema drift: transactions.amount estava declarada como
-- numeric(12,2) em algum ambiente mesmo com a migration 000008 pedindo
-- INTEGER. Isso viola a regra crítica do project-context.md de que
-- todo valor monetário deve ser INTEGER em centavos (nunca float/decimal).
--
-- O cast abaixo é idempotente e safe em banco vazio ou com dados que
-- sejam sempre inteiros (como são, já que todo INSERT passa
-- int(Amount*100) do Go). Se houver qualquer linha com fração, o
-- ::integer trunca — o que não deveria acontecer na prática pois o
-- código só produz valores inteiros como cents.
--
-- O bloco DO $$ ... $$ torna a operação idempotente (não refaz o cast
-- se a coluna já for integer) para que rodar múltiplas vezes não
-- quebre.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transactions'
          AND column_name = 'amount'
          AND data_type = 'numeric'
    ) THEN
        ALTER TABLE transactions ALTER COLUMN amount TYPE INTEGER USING amount::integer;
    END IF;
END $$;

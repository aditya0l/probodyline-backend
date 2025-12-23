-- Remove organizationId from all tables
ALTER TABLE "categories" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "products" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "quotations" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "vendors" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "stock_transactions" DROP COLUMN IF EXISTS "organizationId";

-- Make organizationId optional in users table (if not already)
ALTER TABLE "users" ALTER COLUMN "organizationId" DROP NOT NULL;

-- Add unique constraint on categories.name (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key'
    ) THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_name_key" UNIQUE ("name");
    END IF;
END $$;

-- Drop indexes that included organizationId
DROP INDEX IF EXISTS "products_organizationId_idx";
DROP INDEX IF EXISTS "customers_organizationId_idx";
DROP INDEX IF EXISTS "quotations_organizationId_idx";
DROP INDEX IF EXISTS "vendors_organizationId_idx";
DROP INDEX IF EXISTS "stock_transactions_organizationId_idx";
DROP INDEX IF EXISTS "users_organizationId_idx";

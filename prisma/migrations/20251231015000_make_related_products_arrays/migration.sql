-- AlterTable
ALTER TABLE "products" ALTER COLUMN "cousinMachine" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "cousinMachine" TYPE TEXT[] USING CASE WHEN "cousinMachine" IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY["cousinMachine"]::TEXT[] END;
ALTER TABLE "products" ALTER COLUMN "cousinMachine" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ALTER COLUMN "cousinMachine" SET NOT NULL;

ALTER TABLE "products" ALTER COLUMN "orderTogether" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "orderTogether" TYPE TEXT[] USING CASE WHEN "orderTogether" IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY["orderTogether"]::TEXT[] END;
ALTER TABLE "products" ALTER COLUMN "orderTogether" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ALTER COLUMN "orderTogether" SET NOT NULL;

ALTER TABLE "products" ALTER COLUMN "swapMachine" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "swapMachine" TYPE TEXT[] USING CASE WHEN "swapMachine" IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY["swapMachine"]::TEXT[] END;
ALTER TABLE "products" ALTER COLUMN "swapMachine" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ALTER COLUMN "swapMachine" SET NOT NULL;

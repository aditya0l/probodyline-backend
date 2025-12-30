-- AlterTable: Make name nullable, modelNumber required and unique, add isDormant
ALTER TABLE "products" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "products" ALTER COLUMN "modelNumber" SET NOT NULL;
ALTER TABLE "products" ADD COLUMN "isDormant" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Add unique constraint to modelNumber
CREATE UNIQUE INDEX "products_modelNumber_key" ON "products"("modelNumber");

-- CreateIndex: Add index on isDormant for performance
CREATE INDEX "products_isDormant_idx" ON "products"("isDormant");

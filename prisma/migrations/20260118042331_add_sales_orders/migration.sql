/*
  Warnings:

  - You are about to drop the column `salesPerson` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "salesPerson",
ALTER COLUMN "tokenDate" DROP NOT NULL,
ALTER COLUMN "stateCode" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "clientName" DROP NOT NULL,
ALTER COLUMN "salesInitial" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "cousinMachine" DROP DEFAULT,
ALTER COLUMN "orderTogether" DROP DEFAULT,
ALTER COLUMN "swapMachine" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "salesOrderId" TEXT;

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "soNumber" TEXT NOT NULL,
    "dispatchDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookedAt" TIMESTAMP(3),

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_soNumber_key" ON "sales_orders"("soNumber");

-- CreateIndex
CREATE INDEX "sales_orders_quotationId_idx" ON "sales_orders"("quotationId");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "quotation_items_salesOrderId_idx" ON "quotation_items"("salesOrderId");

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

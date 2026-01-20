/*
  Warnings:

  - You are about to drop the column `salesOrderId` on the `quotation_items` table. All the data in the column will be lost.
  - You are about to drop the column `bookedAt` on the `sales_orders` table. All the data in the column will be lost.
  - You are about to drop the column `dispatchDate` on the `sales_orders` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[quotationId]` on the table `sales_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "quotation_items" DROP CONSTRAINT "quotation_items_salesOrderId_fkey";

-- DropIndex
DROP INDEX "quotation_items_salesOrderId_idx";

-- AlterTable
ALTER TABLE "quotation_items" DROP COLUMN "salesOrderId";

-- AlterTable
ALTER TABLE "sales_orders" DROP COLUMN "bookedAt",
DROP COLUMN "dispatchDate";

-- CreateTable
CREATE TABLE "dispatch_splits" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "splitNumber" INTEGER NOT NULL,
    "dispatchDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookedAt" TIMESTAMP(3),

    CONSTRAINT "dispatch_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_split_items" (
    "id" TEXT NOT NULL,
    "dispatchSplitId" TEXT NOT NULL,
    "quotationItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "dispatch_split_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatch_splits_salesOrderId_idx" ON "dispatch_splits"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_splits_salesOrderId_splitNumber_key" ON "dispatch_splits"("salesOrderId", "splitNumber");

-- CreateIndex
CREATE INDEX "dispatch_split_items_dispatchSplitId_idx" ON "dispatch_split_items"("dispatchSplitId");

-- CreateIndex
CREATE INDEX "dispatch_split_items_quotationItemId_idx" ON "dispatch_split_items"("quotationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_quotationId_key" ON "sales_orders"("quotationId");

-- AddForeignKey
ALTER TABLE "dispatch_splits" ADD CONSTRAINT "dispatch_splits_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_split_items" ADD CONSTRAINT "dispatch_split_items_dispatchSplitId_fkey" FOREIGN KEY ("dispatchSplitId") REFERENCES "dispatch_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_split_items" ADD CONSTRAINT "dispatch_split_items_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "quotation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

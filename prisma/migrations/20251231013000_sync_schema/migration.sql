-- DropIndex
DROP INDEX "bookings_productId_idx";

-- DropIndex
DROP INDEX "bookings_status_idx";

-- DropIndex
DROP INDEX "clients_city_idx";

-- DropIndex
DROP INDEX "clients_salesPerson_idx";

-- DropIndex
DROP INDEX "clients_stateCode_idx";

-- DropIndex
DROP INDEX "gyms_city_idx";

-- DropIndex
DROP INDEX "gyms_stateCode_idx";

-- DropIndex
DROP INDEX "leads_city_idx";

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "bookedOn" DROP DEFAULT,
ALTER COLUMN "status" SET DEFAULT 'CONFIRM';

-- AlterTable
ALTER TABLE "gym_media" DROP COLUMN "caption",
DROP COLUMN "mediaUrl",
ADD COLUMN     "uploadedBy" TEXT,
ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "gym_technicians" DROP COLUMN "createdAt",
DROP COLUMN "phone",
DROP COLUMN "specialization",
DROP COLUMN "technicianName",
ADD COLUMN     "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "technicianId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "inauguration_commitments" DROP COLUMN "actualDate",
DROP COLUMN "commitmentDate",
DROP COLUMN "notes",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "committedFor" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "committedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "source" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "lead_status_history" DROP COLUMN "notes",
ADD COLUMN     "changedBy" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "city",
DROP COLUMN "leadName",
DROP COLUMN "stateCode",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "leadNumber" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "qrCode" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "bookings_productId_dispatchDate_idx" ON "bookings"("productId", "dispatchDate");

-- CreateIndex
CREATE INDEX "clients_stateCode_city_idx" ON "clients"("stateCode", "city");

-- CreateIndex
CREATE INDEX "clients_salesInitial_idx" ON "clients"("salesInitial");

-- CreateIndex
CREATE UNIQUE INDEX "gym_technicians_gymId_technicianId_key" ON "gym_technicians"("gymId", "technicianId");

-- CreateIndex
CREATE INDEX "gyms_stateCode_city_idx" ON "gyms"("stateCode", "city");

-- CreateIndex
CREATE INDEX "gyms_salesInitial_idx" ON "gyms"("salesInitial");

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadNumber_key" ON "leads"("leadNumber");

-- CreateIndex
CREATE INDEX "leads_leadNumber_idx" ON "leads"("leadNumber");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE INDEX "quotations_status_createdAt_idx" ON "quotations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "stock_transactions_date_idx" ON "stock_transactions"("date");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");


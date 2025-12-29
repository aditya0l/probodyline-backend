-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRM', 'WAITING_LIST');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationItemId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productThumbnail" TEXT,
    "modelNumber" TEXT,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "bookedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT,
    "gymName" TEXT,
    "requiredQuantity" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "waitingQuantity" INTEGER NOT NULL DEFAULT 0,
    "stateCode" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "tokenDate" TIMESTAMP(3) NOT NULL,
    "stateCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "salesPerson" TEXT NOT NULL,
    "salesInitial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gyms" (
    "id" TEXT NOT NULL,
    "gymCode" TEXT NOT NULL,
    "installationDate" TIMESTAMP(3) NOT NULL,
    "stateCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "gymName" TEXT NOT NULL,
    "branchCode" DOUBLE PRECISION NOT NULL,
    "branchTitle" TEXT NOT NULL,
    "salesInitial" TEXT NOT NULL,
    "instagramLink" TEXT,
    "locationLink" TEXT,
    "locationQR" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_gyms" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_gyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "leadName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_leads" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_partners" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partnerType" TEXT NOT NULL,
    "partnerRefId" TEXT NOT NULL,
    "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inauguration_commitments" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "commitmentDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inauguration_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_technicians" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "technicianName" TEXT NOT NULL,
    "phone" TEXT,
    "specialization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_media" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "changes" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientCode_key" ON "clients"("clientCode");

-- CreateIndex
CREATE INDEX "clients_clientCode_idx" ON "clients"("clientCode");

-- CreateIndex
CREATE INDEX "clients_city_idx" ON "clients"("city");

-- CreateIndex
CREATE INDEX "clients_stateCode_idx" ON "clients"("stateCode");

-- CreateIndex
CREATE INDEX "clients_salesPerson_idx" ON "clients"("salesPerson");

-- CreateIndex
CREATE UNIQUE INDEX "gyms_gymCode_key" ON "gyms"("gymCode");

-- CreateIndex
CREATE INDEX "gyms_gymCode_idx" ON "gyms"("gymCode");

-- CreateIndex
CREATE INDEX "gyms_city_idx" ON "gyms"("city");

-- CreateIndex
CREATE INDEX "gyms_stateCode_idx" ON "gyms"("stateCode");

-- CreateIndex
CREATE UNIQUE INDEX "client_gyms_clientId_gymId_key" ON "client_gyms"("clientId", "gymId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_city_idx" ON "leads"("city");

-- CreateIndex
CREATE UNIQUE INDEX "client_leads_clientId_leadId_key" ON "client_leads"("clientId", "leadId");

-- CreateIndex
CREATE INDEX "bookings_productId_idx" ON "bookings"("productId");

-- CreateIndex
CREATE INDEX "bookings_dispatchDate_idx" ON "bookings"("dispatchDate");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_quotationId_idx" ON "bookings"("quotationId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_gyms" ADD CONSTRAINT "client_gyms_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_gyms" ADD CONSTRAINT "client_gyms_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_leads" ADD CONSTRAINT "client_leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_leads" ADD CONSTRAINT "client_leads_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_partners" ADD CONSTRAINT "client_partners_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inauguration_commitments" ADD CONSTRAINT "inauguration_commitments_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_technicians" ADD CONSTRAINT "gym_technicians_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_media" ADD CONSTRAINT "gym_media_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

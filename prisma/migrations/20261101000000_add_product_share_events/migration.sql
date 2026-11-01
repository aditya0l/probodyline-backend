-- CreateTable
CREATE TABLE "product_share_events" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_share_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_share_events_productId_createdAt_idx" ON "product_share_events"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "product_share_events_createdAt_idx" ON "product_share_events"("createdAt");

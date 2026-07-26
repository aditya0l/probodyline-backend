-- CreateTable
CREATE TABLE "client_phones" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isDormant" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "dormantAt" TIMESTAMP(3),
    "dormantBy" TEXT,
    "supersededByPhoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_phones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (Restrict Deletion)
ALTER TABLE "client_phones" ADD CONSTRAINT "client_phones_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create partial unique index: Only one active record per phone number
CREATE UNIQUE INDEX "unique_active_phone_idx" 
ON "client_phones" ("phone") 
WHERE "isDormant" = false;

-- Create partial unique index: Only one primary number per client
CREATE UNIQUE INDEX "unique_primary_per_client_idx" 
ON "client_phones" ("clientId") 
WHERE "isPrimary" = true;

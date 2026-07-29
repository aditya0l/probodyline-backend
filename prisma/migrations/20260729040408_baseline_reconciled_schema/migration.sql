-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'SALE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "JourneyEventType" AS ENUM ('CREATED', 'PICKUP_SCHEDULED', 'LINKED_TO_CLIENT', 'LINKED_TO_GYM_PARTNER', 'LINKED_TO_GYM_TRAINER', 'DELINKED_FROM_GYM', 'SHOWROOM_VISIT', 'VIDEO_CALL_SCHEDULED', 'QO_SENT', 'MANUAL_NOTE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRM', 'WAITING_LIST');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HOD_TECHNICAL', 'SALES', 'STAFF', 'GUARD');

-- CreateEnum
CREATE TYPE "ServiceCardStatus" AS ENUM ('STARTED', 'PENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "GymDocumentType" AS ENUM ('PAN_CARD_CLIENT', 'AADHAR_CARD', 'GST_CERTIFICATE', 'PAN_CARD_FIRM', 'RENT_AGREEMENT', 'BANK_DETAILS');

-- CreateEnum
CREATE TYPE "ClientDocumentType" AS ENUM ('PAN_CARD_CLIENT', 'AADHAR_CARD', 'GST_CERTIFICATE', 'PAN_CARD_FIRM', 'RENT_AGREEMENT', 'BANK_DETAILS');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gst" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "logo" TEXT,
    "bankDetails" TEXT,
    "termsAndConditions" TEXT,
    "warrantyInfo" TEXT,
    "defaultGstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "srNo" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "modelNumber" TEXT NOT NULL,
    "qrCode" TEXT,
    "image" TEXT,
    "images" TEXT[],
    "price" DECIMAL(12,2),
    "productType" TEXT,
    "categoryId" TEXT,
    "seriesName" TEXT,
    "packagingDescription" TEXT[],
    "keyword" TEXT[],
    "todaysStock" INTEGER DEFAULT 0,
    "stockPlus360Days" INTEGER DEFAULT 0,
    "dateSelectStock" TIMESTAMP(3),
    "stockByDate" JSONB,
    "mrpStickers" TEXT[],
    "customDeclarations" TEXT[],
    "cartonLabel" TEXT,
    "badge" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "machineArtwork" TEXT,
    "brochure" TEXT[],
    "brochureUrl" TEXT,
    "brochureFilename" TEXT,
    "brochureSize" INTEGER,
    "thumbnail" TEXT,
    "lqip" TEXT,
    "instagramLink" TEXT,
    "youtubeLink" TEXT,
    "cousinMachine" TEXT[],
    "orderTogether" TEXT[],
    "swapMachine" TEXT[],
    "brand" TEXT,
    "warranty" TEXT,
    "notes" TEXT,
    "isDormant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gymName" TEXT,
    "address" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "area" TEXT,
    "gst" TEXT,
    "panCard" TEXT,
    "aadharCard" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "contactPerson" TEXT,
    "notes" TEXT,
    "panCardUrl" TEXT,
    "aadharCardUrl" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "customerId" TEXT,
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL,
    "companyLogo" TEXT,
    "companyGST" TEXT NOT NULL,
    "companyPhone" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "companyWebsite" TEXT NOT NULL,
    "companyContactPerson" TEXT NOT NULL,
    "clientName" TEXT,
    "clientAddress" TEXT,
    "clientAddressLine2" TEXT,
    "clientCity" TEXT,
    "gymName" TEXT,
    "gymArea" TEXT,
    "clientGST" TEXT,
    "clientPanCard" TEXT,
    "clientAadharCard" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "leadName" TEXT,
    "bookingDate" TIMESTAMP(3),
    "dispatchDate" TIMESTAMP(3),
    "installationDate" TIMESTAMP(3),
    "inaugurationDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "gstAmount" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "bankDetails" TEXT,
    "termsAndConditions" TEXT,
    "warrantyInfo" TEXT,
    "notes" TEXT,
    "visibleColumns" JSONB,
    "template" TEXT NOT NULL DEFAULT 'default',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "srNo" INTEGER NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productImage" TEXT,
    "modelNumber" TEXT,
    "rate" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "priority" INTEGER,
    "productType" TEXT,
    "seriesName" TEXT,
    "packagingDescription" TEXT[],
    "keyword" TEXT[],
    "todaysStock" INTEGER,
    "stockPlus360Days" INTEGER,
    "cousinMachine" TEXT,
    "orderTogether" TEXT,
    "swapMachine" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "warranty" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "soNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "needsResync" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "quotationItemId" TEXT,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "modelNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "mrp" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quantity_change_requests" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'DECREASE',
    "currentQty" INTEGER NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quantity_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_date_change_requests" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "currentDate" TIMESTAMP(3) NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "requestType" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_date_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_activities" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "sales_order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_splits" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "splitNumber" INTEGER NOT NULL,
    "dispatchDate" TIMESTAMP(3),
    "label" TEXT,
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

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "bookedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jaipurArrival" TIMESTAMP(3),
    "jaipurArrivalManual" BOOLEAN NOT NULL DEFAULT false,
    "piNo" TEXT,
    "piDate" TIMESTAMP(3),
    "approvedOn" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "factoryId" TEXT NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productImage" TEXT,
    "modelNumber" TEXT,
    "rate" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_splits" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "splitNumber" INTEGER NOT NULL,
    "jaipurArrival" TIMESTAMP(3),
    "label" TEXT,
    "sortDate" TIMESTAMP(3),
    "containerNumber" TEXT,
    "invoiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_split_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderSplitId" TEXT,
    "factorySplitId" TEXT,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_split_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "factories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_splits" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "dateRangeLabel" TEXT NOT NULL,
    "tag" TEXT,
    "color" TEXT,
    "sortDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factory_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gst" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionType" "StockTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "tokenDate" TIMESTAMP(3),
    "stateCode" TEXT,
    "city" TEXT,
    "clientName" TEXT,
    "email" TEXT,
    "address" TEXT,
    "addressLine2" TEXT,
    "area" TEXT,
    "gst" TEXT,
    "panCard" TEXT,
    "aadharCard" TEXT,
    "panCardUrl" TEXT,
    "aadharCardUrl" TEXT,
    "profilePhoto" TEXT,
    "salesInitial" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "client_journey_events" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventType" "JourneyEventType" NOT NULL,
    "eventDate" TIMESTAMP(3),
    "details" TEXT,
    "linkedName" TEXT,
    "relationship" TEXT,
    "photoUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gyms" (
    "id" TEXT NOT NULL,
    "gymCode" TEXT NOT NULL,
    "installationDate" TIMESTAMP(3),
    "stateCode" TEXT,
    "city" TEXT,
    "gymName" TEXT,
    "branchCode" DOUBLE PRECISION,
    "branchTitle" TEXT,
    "salesInitial" TEXT,
    "callSign" TEXT,
    "instagramLink" TEXT,
    "locationLink" TEXT,
    "locationQR" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inauguration_commitments" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "committedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedFor" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inauguration_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_technicians" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_media" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_managers" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_trainers" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "linkedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managers" (
    "id" TEXT NOT NULL,
    "managerCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "stateCode" TEXT,
    "city" TEXT,
    "address" TEXT,
    "instagramLink" TEXT,
    "profilePhoto" TEXT,
    "locationLink" TEXT,
    "locationQR" TEXT,
    "notes" TEXT,
    "panCard" TEXT,
    "aadharCard" TEXT,
    "panCardUrl" TEXT,
    "aadharCardUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" TEXT NOT NULL,
    "trainerCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "stateCode" TEXT,
    "city" TEXT,
    "address" TEXT,
    "specialisation" TEXT,
    "experience" INTEGER,
    "instagramLink" TEXT,
    "profilePhoto" TEXT,
    "locationLink" TEXT,
    "locationQR" TEXT,
    "notes" TEXT,
    "panCard" TEXT,
    "aadharCard" TEXT,
    "panCardUrl" TEXT,
    "aadharCardUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

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
    "bookedOn" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "gymName" TEXT,
    "requiredQuantity" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRM',
    "waitingQuantity" INTEGER NOT NULL DEFAULT 0,
    "stateCode" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dispatchSplitId" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_cards" (
    "id" TEXT NOT NULL,
    "serialNumber" SERIAL NOT NULL,
    "filledOnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installationDate" TIMESTAMP(3),
    "stateCode" TEXT,
    "city" TEXT,
    "gymId" TEXT,
    "gymName" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "branchCode" DOUBLE PRECISION,
    "branchTitle" TEXT,
    "salesInitial" TEXT,
    "contactAtGym" TEXT,
    "contactNo" TEXT,
    "engineers" JSONB,
    "landmark" TEXT,
    "locationQR" TEXT,
    "visitType" TEXT,
    "installationAndServiceCharges" DOUBLE PRECISION,
    "estimatedExpense" DOUBLE PRECISION,
    "techEngineerName" TEXT,
    "reimbursementTravel" DOUBLE PRECISION,
    "reimbursementHotel" DOUBLE PRECISION,
    "reimbursementFood" DOUBLE PRECISION,
    "reimbursementOilSpray" DOUBLE PRECISION,
    "reimbursementSpare" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "startTime" TEXT,
    "techActualExpense" DOUBLE PRECISION,
    "expenseLog" JSONB,
    "endDate" TIMESTAMP(3),
    "endTime" TEXT,
    "pendingWork" BOOLEAN NOT NULL DEFAULT false,
    "waitingTimeOnClientRequest" TEXT,
    "engineerSign" TEXT,
    "sAmount" DOUBLE PRECISION,
    "otAmount" DOUBLE PRECISION,
    "accountsActualExpense" DOUBLE PRECISION,
    "accountsReimbursement" DOUBLE PRECISION,
    "netCtc" DOUBLE PRECISION,
    "salesOrderId" TEXT,
    "status" "ServiceCardStatus" NOT NULL DEFAULT 'STARTED',
    "productNotes" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challans" (
    "id" TEXT NOT NULL,
    "chnNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientName" TEXT,
    "address" TEXT,
    "salesOrderId" TEXT,
    "quotationId" TEXT,
    "goodsDispatchedBy" TEXT,
    "checkedBy" TEXT,
    "grNo" TEXT,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "mobNo" TEXT,
    "vehicleType" TEXT,
    "freightAmt" TEXT,
    "editHistory" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challan_items" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "description" TEXT,
    "modelNos" TEXT,
    "packages" TEXT,
    "quantity" INTEGER,
    "editHistory" JSONB,

    CONSTRAINT "challan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "color" TEXT NOT NULL DEFAULT '#FAC775',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_sessions" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "otp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_documents" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "documentType" "GymDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "pdfUrl" TEXT,
    "imageUrls" TEXT[],
    "fieldData" JSONB,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NOT_UPLOADED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "documentType" "ClientDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "pdfUrl" TEXT,
    "imageUrls" TEXT[],
    "fieldData" JSONB,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NOT_UPLOADED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "shared_links" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_visits" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "visitNumber" INTEGER NOT NULL,
    "otpVerifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guard_otp_sessions" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guard_otp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_QuotationMultipleClients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_QuotationMultipleClients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_modelNumber_key" ON "products"("modelNumber");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_modelNumber_idx" ON "products"("modelNumber");

-- CreateIndex
CREATE INDEX "products_seriesName_idx" ON "products"("seriesName");

-- CreateIndex
CREATE INDEX "products_productType_idx" ON "products"("productType");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_isDormant_idx" ON "products"("isDormant");

-- CreateIndex
CREATE INDEX "products_modelNumber_seriesName_categoryId_idx" ON "products"("modelNumber", "seriesName", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quoteNumber_key" ON "quotations"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_createdAt_idx" ON "quotations"("createdAt");

-- CreateIndex
CREATE INDEX "quotations_quoteNumber_idx" ON "quotations"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotations_status_createdAt_idx" ON "quotations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "quotations_createdAt_status_clientName_gymName_idx" ON "quotations"("createdAt", "status", "clientName", "gymName");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_items_productId_idx" ON "quotation_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_quotationId_key" ON "sales_orders"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_soNumber_key" ON "sales_orders"("soNumber");

-- CreateIndex
CREATE INDEX "sales_orders_quotationId_idx" ON "sales_orders"("quotationId");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_createdAt_status_idx" ON "sales_orders"("createdAt", "status");

-- CreateIndex
CREATE INDEX "sales_order_items_salesOrderId_idx" ON "sales_order_items"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_order_items_quotationItemId_idx" ON "sales_order_items"("quotationItemId");

-- CreateIndex
CREATE INDEX "sales_order_items_productId_idx" ON "sales_order_items"("productId");

-- CreateIndex
CREATE INDEX "quantity_change_requests_salesOrderId_idx" ON "quantity_change_requests"("salesOrderId");

-- CreateIndex
CREATE INDEX "quantity_change_requests_status_idx" ON "quantity_change_requests"("status");

-- CreateIndex
CREATE INDEX "dispatch_date_change_requests_salesOrderId_idx" ON "dispatch_date_change_requests"("salesOrderId");

-- CreateIndex
CREATE INDEX "dispatch_date_change_requests_status_idx" ON "dispatch_date_change_requests"("status");

-- CreateIndex
CREATE INDEX "sales_order_activities_salesOrderId_idx" ON "sales_order_activities"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_order_activities_changedAt_idx" ON "sales_order_activities"("changedAt");

-- CreateIndex
CREATE INDEX "dispatch_splits_salesOrderId_idx" ON "dispatch_splits"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_splits_salesOrderId_splitNumber_key" ON "dispatch_splits"("salesOrderId", "splitNumber");

-- CreateIndex
CREATE INDEX "dispatch_split_items_dispatchSplitId_idx" ON "dispatch_split_items"("dispatchSplitId");

-- CreateIndex
CREATE INDEX "dispatch_split_items_quotationItemId_idx" ON "dispatch_split_items"("quotationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_poNumber_idx" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_createdAt_status_jaipurArrival_idx" ON "purchase_orders"("createdAt", "status", "jaipurArrival");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- CreateIndex
CREATE INDEX "purchase_order_splits_purchaseOrderId_idx" ON "purchase_order_splits"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_splits_purchaseOrderId_splitNumber_key" ON "purchase_order_splits"("purchaseOrderId", "splitNumber");

-- CreateIndex
CREATE INDEX "purchase_order_split_items_purchaseOrderSplitId_idx" ON "purchase_order_split_items"("purchaseOrderSplitId");

-- CreateIndex
CREATE INDEX "purchase_order_split_items_purchaseOrderItemId_idx" ON "purchase_order_split_items"("purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "factories_name_key" ON "factories"("name");

-- CreateIndex
CREATE INDEX "factory_splits_factoryId_idx" ON "factory_splits"("factoryId");

-- CreateIndex
CREATE UNIQUE INDEX "factory_splits_factoryId_dateRangeLabel_key" ON "factory_splits"("factoryId", "dateRangeLabel");

-- CreateIndex
CREATE INDEX "stock_transactions_productId_date_idx" ON "stock_transactions"("productId", "date");

-- CreateIndex
CREATE INDEX "stock_transactions_date_idx" ON "stock_transactions"("date");

-- CreateIndex
CREATE INDEX "stock_transactions_productId_date_transactionType_idx" ON "stock_transactions"("productId", "date", "transactionType");

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientCode_key" ON "clients"("clientCode");

-- CreateIndex
CREATE INDEX "clients_clientCode_idx" ON "clients"("clientCode");

-- CreateIndex
CREATE INDEX "clients_stateCode_city_idx" ON "clients"("stateCode", "city");

-- CreateIndex
CREATE INDEX "clients_salesInitial_idx" ON "clients"("salesInitial");

-- CreateIndex
CREATE INDEX "clients_stateCode_city_clientCode_idx" ON "clients"("stateCode", "city", "clientCode");

-- CreateIndex
CREATE UNIQUE INDEX "client_gyms_clientId_gymId_key" ON "client_gyms"("clientId", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "client_leads_clientId_leadId_key" ON "client_leads"("clientId", "leadId");

-- CreateIndex
CREATE INDEX "client_journey_events_clientId_idx" ON "client_journey_events"("clientId");

-- CreateIndex
CREATE INDEX "client_journey_events_clientId_eventType_idx" ON "client_journey_events"("clientId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "gyms_gymCode_key" ON "gyms"("gymCode");

-- CreateIndex
CREATE INDEX "gyms_gymCode_idx" ON "gyms"("gymCode");

-- CreateIndex
CREATE INDEX "gyms_stateCode_city_idx" ON "gyms"("stateCode", "city");

-- CreateIndex
CREATE INDEX "gyms_salesInitial_idx" ON "gyms"("salesInitial");

-- CreateIndex
CREATE INDEX "gyms_stateCode_city_gymName_gymCode_idx" ON "gyms"("stateCode", "city", "gymName", "gymCode");

-- CreateIndex
CREATE UNIQUE INDEX "gym_technicians_gymId_technicianId_key" ON "gym_technicians"("gymId", "technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "gym_managers_gymId_managerId_key" ON "gym_managers"("gymId", "managerId");

-- CreateIndex
CREATE UNIQUE INDEX "gym_trainers_gymId_trainerId_key" ON "gym_trainers"("gymId", "trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "managers_managerCode_key" ON "managers"("managerCode");

-- CreateIndex
CREATE UNIQUE INDEX "managers_email_key" ON "managers"("email");

-- CreateIndex
CREATE INDEX "managers_managerCode_idx" ON "managers"("managerCode");

-- CreateIndex
CREATE INDEX "managers_stateCode_city_idx" ON "managers"("stateCode", "city");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_trainerCode_key" ON "trainers"("trainerCode");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_email_key" ON "trainers"("email");

-- CreateIndex
CREATE INDEX "trainers_trainerCode_idx" ON "trainers"("trainerCode");

-- CreateIndex
CREATE INDEX "trainers_stateCode_city_idx" ON "trainers"("stateCode", "city");

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadNumber_key" ON "leads"("leadNumber");

-- CreateIndex
CREATE INDEX "leads_leadNumber_idx" ON "leads"("leadNumber");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "bookings_productId_dispatchDate_idx" ON "bookings"("productId", "dispatchDate");

-- CreateIndex
CREATE INDEX "bookings_quotationId_idx" ON "bookings"("quotationId");

-- CreateIndex
CREATE INDEX "bookings_dispatchDate_idx" ON "bookings"("dispatchDate");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "service_cards_serialNumber_key" ON "service_cards"("serialNumber");

-- CreateIndex
CREATE INDEX "service_cards_serialNumber_idx" ON "service_cards"("serialNumber");

-- CreateIndex
CREATE INDEX "service_cards_gymId_idx" ON "service_cards"("gymId");

-- CreateIndex
CREATE INDEX "service_cards_salesOrderId_idx" ON "service_cards"("salesOrderId");

-- CreateIndex
CREATE INDEX "service_cards_createdAt_status_gymId_idx" ON "service_cards"("createdAt", "status", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "challans_chnNumber_key" ON "challans"("chnNumber");

-- CreateIndex
CREATE INDEX "challans_chnNumber_idx" ON "challans"("chnNumber");

-- CreateIndex
CREATE INDEX "challans_salesOrderId_idx" ON "challans"("salesOrderId");

-- CreateIndex
CREATE INDEX "challans_quotationId_idx" ON "challans"("quotationId");

-- CreateIndex
CREATE INDEX "challans_date_idx" ON "challans"("date");

-- CreateIndex
CREATE INDEX "challan_items_challanId_idx" ON "challan_items"("challanId");

-- CreateIndex
CREATE INDEX "calendar_events_date_idx" ON "calendar_events"("date");

-- CreateIndex
CREATE INDEX "otp_sessions_phone_otp_idx" ON "otp_sessions"("phone", "otp");

-- CreateIndex
CREATE UNIQUE INDEX "gym_documents_gymId_documentType_key" ON "gym_documents"("gymId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "client_documents_clientId_documentType_key" ON "client_documents"("clientId", "documentType");

-- CreateIndex
CREATE INDEX "client_visits_clientId_idx" ON "client_visits"("clientId");

-- CreateIndex
CREATE INDEX "client_visits_guardId_idx" ON "client_visits"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "guard_otp_sessions_jti_key" ON "guard_otp_sessions"("jti");

-- CreateIndex
CREATE INDEX "guard_otp_sessions_expiresAt_idx" ON "guard_otp_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "guard_otp_sessions_jti_idx" ON "guard_otp_sessions"("jti");

-- CreateIndex
CREATE INDEX "guard_otp_sessions_phone_idx" ON "guard_otp_sessions"("phone");

-- CreateIndex
CREATE INDEX "_QuotationMultipleClients_B_index" ON "_QuotationMultipleClients"("B");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "quotation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quantity_change_requests" ADD CONSTRAINT "quantity_change_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_date_change_requests" ADD CONSTRAINT "dispatch_date_change_requests_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_date_change_requests" ADD CONSTRAINT "dispatch_date_change_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_activities" ADD CONSTRAINT "sales_order_activities_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_activities" ADD CONSTRAINT "sales_order_activities_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_splits" ADD CONSTRAINT "dispatch_splits_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_split_items" ADD CONSTRAINT "dispatch_split_items_dispatchSplitId_fkey" FOREIGN KEY ("dispatchSplitId") REFERENCES "dispatch_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_split_items" ADD CONSTRAINT "dispatch_split_items_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "quotation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_splits" ADD CONSTRAINT "purchase_order_splits_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_split_items" ADD CONSTRAINT "purchase_order_split_items_purchaseOrderSplitId_fkey" FOREIGN KEY ("purchaseOrderSplitId") REFERENCES "purchase_order_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_split_items" ADD CONSTRAINT "purchase_order_split_items_factorySplitId_fkey" FOREIGN KEY ("factorySplitId") REFERENCES "factory_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_split_items" ADD CONSTRAINT "purchase_order_split_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_splits" ADD CONSTRAINT "factory_splits_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "client_journey_events" ADD CONSTRAINT "client_journey_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inauguration_commitments" ADD CONSTRAINT "inauguration_commitments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inauguration_commitments" ADD CONSTRAINT "inauguration_commitments_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_technicians" ADD CONSTRAINT "gym_technicians_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_media" ADD CONSTRAINT "gym_media_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_managers" ADD CONSTRAINT "gym_managers_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_managers" ADD CONSTRAINT "gym_managers_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_trainers" ADD CONSTRAINT "gym_trainers_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_trainers" ADD CONSTRAINT "gym_trainers_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dispatchSplitId_fkey" FOREIGN KEY ("dispatchSplitId") REFERENCES "dispatch_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_cards" ADD CONSTRAINT "service_cards_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_cards" ADD CONSTRAINT "service_cards_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_cards" ADD CONSTRAINT "service_cards_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_cards" ADD CONSTRAINT "service_cards_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_items" ADD CONSTRAINT "challan_items_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_documents" ADD CONSTRAINT "gym_documents_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_phones" ADD CONSTRAINT "client_phones_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_visits" ADD CONSTRAINT "client_visits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_visits" ADD CONSTRAINT "client_visits_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuotationMultipleClients" ADD CONSTRAINT "_QuotationMultipleClients_A_fkey" FOREIGN KEY ("A") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuotationMultipleClients" ADD CONSTRAINT "_QuotationMultipleClients_B_fkey" FOREIGN KEY ("B") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom Partial Unique Indexes
CREATE UNIQUE INDEX unique_active_phone_idx ON public.client_phones USING btree (phone) WHERE ("isDormant" = false);
CREATE UNIQUE INDEX unique_primary_per_client_idx ON public.client_phones USING btree ("clientId") WHERE ("isPrimary" = true);

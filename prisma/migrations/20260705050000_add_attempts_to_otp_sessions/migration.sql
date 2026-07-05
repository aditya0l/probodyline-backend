-- AlterTable
ALTER TABLE "otp_sessions" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

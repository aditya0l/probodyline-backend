-- Drop redundant columns from clients table
ALTER TABLE "clients" DROP COLUMN "phone", 
                      DROP COLUMN "isPhoneVerified";

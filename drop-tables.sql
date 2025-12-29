-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS "gym_media" CASCADE;
DROP TABLE IF EXISTS "gym_technicians" CASCADE;
DROP TABLE IF EXISTS "inauguration_commitments" CASCADE;
DROP TABLE IF EXISTS "lead_status_history" CASCADE;
DROP TABLE IF EXISTS "client_partners" CASCADE;
DROP TABLE IF EXISTS "client_leads" CASCADE;
DROP TABLE IF EXISTS "client_gyms" CASCADE;
DROP TABLE IF EXISTS "bookings" CASCADE;
DROP TABLE IF EXISTS "leads" CASCADE;
DROP TABLE IF EXISTS "gyms" CASCADE;
DROP TABLE IF EXISTS "clients" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;

-- Drop enum if exists
DROP TYPE IF EXISTS "BookingStatus" CASCADE;

-- Now run the migration
-- The migration file will recreate everything with correct schema

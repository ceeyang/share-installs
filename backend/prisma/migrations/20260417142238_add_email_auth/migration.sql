-- AlterTable
ALTER TABLE "users" ADD COLUMN "display_name" TEXT,
ADD COLUMN "password_hash" TEXT;

-- Update existing records: make github_id and github_login optional by handling constraints
ALTER TABLE "users" ALTER COLUMN "github_id" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "github_login" DROP NOT NULL;

-- Add unique constraint to email
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

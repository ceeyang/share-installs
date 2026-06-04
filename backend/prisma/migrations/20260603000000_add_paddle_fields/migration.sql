-- Migration: add_paddle_fields
-- Adds Paddle Billing customer and subscription IDs to the users table.
-- These fields are used to link Share Installs users to their Paddle accounts.

ALTER TABLE "users" ADD COLUMN "paddle_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN "paddle_subscription_id" TEXT;

CREATE UNIQUE INDEX "users_paddle_customer_id_key" ON "users"("paddle_customer_id");
CREATE UNIQUE INDEX "users_paddle_subscription_id_key" ON "users"("paddle_subscription_id");

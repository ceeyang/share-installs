/*
  Warnings:

  - You are about to drop the column `browser_name` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `device_model` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `invite_id` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `invite_id` on the `conversions` table. All the data in the column will be lost.
  - You are about to drop the column `invitee_id` on the `conversions` table. All the data in the column will be lost.
  - You are about to drop the column `opened_at` on the `conversions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `conversions` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `conversions` table. All the data in the column will be lost.
  - You are about to drop the `invites` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `invite_code` to the `click_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invite_code` to the `conversions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "click_events" DROP CONSTRAINT "click_events_invite_id_fkey";

-- DropForeignKey
ALTER TABLE "conversions" DROP CONSTRAINT "conversions_invite_id_fkey";

-- DropForeignKey
ALTER TABLE "invites" DROP CONSTRAINT "invites_project_id_fkey";

-- DropIndex
DROP INDEX "click_events_invite_id_idx";

-- DropIndex
DROP INDEX "conversions_invite_id_idx";

-- AlterTable
ALTER TABLE "click_events" DROP COLUMN "browser_name",
DROP COLUMN "device_model",
DROP COLUMN "invite_id",
ADD COLUMN     "custom_data" JSONB,
ADD COLUMN     "invite_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "conversions" DROP COLUMN "invite_id",
DROP COLUMN "invitee_id",
DROP COLUMN "opened_at",
DROP COLUMN "status",
DROP COLUMN "updated_at",
ADD COLUMN     "invite_code" TEXT NOT NULL;

-- DropTable
DROP TABLE "invites";

-- DropEnum
DROP TYPE "ConversionStatus";

-- DropEnum
DROP TYPE "InviteStatus";

-- CreateIndex
CREATE INDEX "click_events_invite_code_idx" ON "click_events"("invite_code");

-- CreateIndex
CREATE INDEX "conversions_invite_code_idx" ON "conversions"("invite_code");

/*
  Warnings:

  - You are about to drop the column `resolved` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `resolved_at` on the `click_events` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "click_events_resolved_created_at_idx";

-- DropIndex
DROP INDEX "conversions_click_event_id_key";

-- AlterTable
ALTER TABLE "click_events" DROP COLUMN "resolved",
DROP COLUMN "resolved_at";

-- CreateIndex
CREATE INDEX "click_events_created_at_idx" ON "click_events"("created_at");

-- CreateIndex
CREATE INDEX "conversions_click_event_id_idx" ON "conversions"("click_event_id");

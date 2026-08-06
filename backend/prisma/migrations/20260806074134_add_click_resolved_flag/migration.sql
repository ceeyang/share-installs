-- AlterTable
ALTER TABLE "click_events" ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolved_at" TIMESTAMP(3);

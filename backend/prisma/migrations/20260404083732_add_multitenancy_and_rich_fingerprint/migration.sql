-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "code" TEXT NOT NULL,
    "inviter_id" TEXT,
    "custom_data" JSONB,
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "status" "InviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "invite_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "browser_name" TEXT,
    "languages" TEXT,
    "timezone" TEXT,
    "referrer" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "pixel_ratio" DOUBLE PRECISION,
    "color_depth" INTEGER,
    "touch_points" INTEGER,
    "hardware_concurrency" INTEGER,
    "device_memory" DOUBLE PRECISION,
    "canvas_hash" TEXT,
    "webgl_hash" TEXT,
    "audio_hash" TEXT,
    "connection_type" TEXT,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'UNKNOWN',
    "device_model" TEXT,
    "os_version" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "invite_id" TEXT NOT NULL,
    "click_event_id" TEXT,
    "invitee_id" TEXT,
    "platform" "DevicePlatform" NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "match_channel" TEXT,
    "confidence" DOUBLE PRECISION,
    "native_signals" JSONB,
    "installed_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_inviter_id_idx" ON "invites"("inviter_id");

-- CreateIndex
CREATE INDEX "invites_code_idx" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_status_idx" ON "invites"("status");

-- CreateIndex
CREATE INDEX "invites_project_id_idx" ON "invites"("project_id");

-- CreateIndex
CREATE INDEX "click_events_fingerprint_idx" ON "click_events"("fingerprint");

-- CreateIndex
CREATE INDEX "click_events_invite_id_idx" ON "click_events"("invite_id");

-- CreateIndex
CREATE INDEX "click_events_resolved_created_at_idx" ON "click_events"("resolved", "created_at");

-- CreateIndex
CREATE INDEX "click_events_project_id_idx" ON "click_events"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversions_click_event_id_key" ON "conversions"("click_event_id");

-- CreateIndex
CREATE INDEX "conversions_invite_id_idx" ON "conversions"("invite_id");

-- CreateIndex
CREATE INDEX "conversions_project_id_idx" ON "conversions"("project_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_click_event_id_fkey" FOREIGN KEY ("click_event_id") REFERENCES "click_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add slug (unique), widgetId on ChatSession, and indexes.
-- Postgres needs the column added first before we can UPDATE it.

ALTER TABLE "Widget" ADD COLUMN "slug" TEXT;

UPDATE "Widget"
SET "slug" = 'legacy_' || substr(replace("id", '-', ''), 1, 12) || '_ai'
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Widget" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Widget_slug_key" ON "Widget"("slug");

ALTER TABLE "ChatSession" ADD COLUMN "widgetId" TEXT;

CREATE INDEX "ChatSession_widgetId_idx" ON "ChatSession"("widgetId");

ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_widgetId_fkey"
  FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Widget_slug_idx" ON "Widget"("slug");
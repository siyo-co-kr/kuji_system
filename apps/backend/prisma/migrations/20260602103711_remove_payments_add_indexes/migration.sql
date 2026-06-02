-- Remove payment tables and enums
DROP TABLE IF EXISTS "payment_numbers";
DROP TABLE IF EXISTS "payments";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "PaymentStatus";

-- Add indexes (Prisma will handle duplicates gracefully)
CREATE INDEX IF NOT EXISTS "accounts_store_id_idx" ON "accounts"("store_id");
CREATE INDEX IF NOT EXISTS "events_store_id_idx" ON "events"("store_id");
CREATE INDEX IF NOT EXISTS "events_store_id_status_idx" ON "events"("store_id", "status");
CREATE INDEX IF NOT EXISTS "events_deleted_at_idx" ON "events"("deleted_at");
CREATE INDEX IF NOT EXISTS "kuji_numbers_event_id_idx" ON "kuji_numbers"("event_id");
CREATE INDEX IF NOT EXISTS "kuji_numbers_event_id_is_drawn_idx" ON "kuji_numbers"("event_id", "is_drawn");
CREATE INDEX IF NOT EXISTS "kuji_numbers_event_id_is_prize_idx" ON "kuji_numbers"("event_id", "is_prize");
CREATE INDEX IF NOT EXISTS "prizes_event_id_idx" ON "prizes"("event_id");
CREATE INDEX IF NOT EXISTS "prize_images_prize_id_idx" ON "prize_images"("prize_id");
CREATE INDEX IF NOT EXISTS "prize_numbers_prize_id_idx" ON "prize_numbers"("prize_id");
CREATE INDEX IF NOT EXISTS "display_slots_layout_id_idx" ON "display_slots"("layout_id");
CREATE INDEX IF NOT EXISTS "prize_catalog_categories_store_id_idx" ON "prize_catalog_categories"("store_id");
CREATE INDEX IF NOT EXISTS "prize_catalog_store_id_idx" ON "prize_catalog"("store_id");
CREATE INDEX IF NOT EXISTS "prize_catalog_category_id_idx" ON "prize_catalog"("category_id");

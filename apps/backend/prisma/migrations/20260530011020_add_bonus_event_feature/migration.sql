-- AlterTable
ALTER TABLE "events" ADD COLUMN     "bonus_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bonus_threshold" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "payment_numbers" ADD COLUMN     "is_bonus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "bonus_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paid_count" INTEGER NOT NULL DEFAULT 0;

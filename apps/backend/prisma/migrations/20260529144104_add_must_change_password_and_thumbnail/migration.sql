-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "thumbnail_url" TEXT;

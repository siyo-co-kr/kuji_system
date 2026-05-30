-- AlterTable
ALTER TABLE "display_layouts" ADD COLUMN     "display_mode" TEXT NOT NULL DEFAULT 'grid',
ALTER COLUMN "slots" SET DEFAULT 2;

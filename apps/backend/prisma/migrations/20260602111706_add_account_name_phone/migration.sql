-- Add name and phone to accounts
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "phone" TEXT;
UPDATE "accounts" SET "name" = "email" WHERE "name" = '';

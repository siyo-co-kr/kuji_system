-- CreateTable
CREATE TABLE "prize_catalog_categories" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prize_catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prize_catalog" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prize_catalog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "prize_catalog_categories" ADD CONSTRAINT "prize_catalog_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prize_catalog" ADD CONSTRAINT "prize_catalog_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prize_catalog" ADD CONSTRAINT "prize_catalog_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "prize_catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

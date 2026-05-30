-- CreateTable
CREATE TABLE "display_layouts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "display_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "display_slots" (
    "id" TEXT NOT NULL,
    "layout_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "event_id" TEXT,

    CONSTRAINT "display_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "display_layouts_store_id_key" ON "display_layouts"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "display_slots_layout_id_slot_index_key" ON "display_slots"("layout_id", "slot_index");

-- AddForeignKey
ALTER TABLE "display_layouts" ADD CONSTRAINT "display_layouts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "display_slots" ADD CONSTRAINT "display_slots_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "display_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

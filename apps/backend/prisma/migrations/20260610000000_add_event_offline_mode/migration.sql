-- AlterTable: 이벤트에 오프라인 모드 관련 컬럼 추가
ALTER TABLE "events" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "events" ADD COLUMN "max_number" INTEGER;

-- AlterIndex: kuji_numbers (event_id, number) unique → 일반 인덱스
-- 오프라인 모드에서는 같은 번호가 여러 번 등장할 수 있으므로 unique 제약 제거
DROP INDEX "kuji_numbers_event_id_number_key";
CREATE INDEX "kuji_numbers_event_id_number_idx" ON "kuji_numbers"("event_id", "number");

/**
 * Supabase Storage 버킷 초기 설정
 * 실행: tsx prisma/setup-storage.ts
 */
import { config } from 'node:process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// .env 수동 로드 (tsx는 자동으로 .env를 읽지 않음)
try {
  const envPath = resolve(process.cwd(), '.env')
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
} catch { /* .env 없으면 무시 */ }

import { StorageClient } from '@supabase/storage-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://joslhrvkquydphlhfgiu.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET = 'kuji-images'

async function main() {
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경 변수가 없습니다.')
    process.exit(1)
  }

  const storage = new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  })

  // 버킷 목록 조회
  const { data: buckets, error: listError } = await storage.listBuckets()
  if (listError) {
    console.error('❌ 버킷 목록 조회 실패:', listError.message)
    process.exit(1)
  }

  const exists = buckets?.some((b) => b.name === BUCKET)

  if (exists) {
    console.log(`✅ 버킷 '${BUCKET}' 이미 존재합니다.`)
    return
  }

  // 버킷 생성 (public: true — 업로드된 이미지를 공개 URL로 접근 가능)
  const { error: createError } = await storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })

  if (createError) {
    console.error(`❌ 버킷 생성 실패:`, createError.message)
    process.exit(1)
  }

  console.log(`✅ 버킷 '${BUCKET}' 생성 완료 (공개 버킷, 최대 10MB)`)
}

main().catch((e) => { console.error(e); process.exit(1) })

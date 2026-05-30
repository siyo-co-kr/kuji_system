// .env 파일을 명시적으로 로드 (tsx는 자동으로 읽지 않음)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
} catch { /* .env 없으면 시스템 환경변수 사용 */ }

import { buildApp } from './app.js'

const port = Number(process.env.PORT) || 4000
const host = process.env.HOST || '0.0.0.0'

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

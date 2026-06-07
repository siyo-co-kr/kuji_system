import {resolve} from "node:path";
import {readFileSync} from "node:fs";

try {
    const envPath = resolve(process.cwd(), '.env')
    const lines = readFileSync(envPath, 'utf8').split('\n')
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
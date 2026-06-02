import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ── siyo 매장 + 슈퍼 어드민 계정 ─────────────────────────
  const siyoStore = await prisma.store.upsert({
    where: { id: 'seed-store-siyo' },
    update: {},
    create: {
      id: 'seed-store-siyo',
      name: 'siyo 매장',
      address: '서울시',
      phone: '010-0000-0000',
    },
  })

  const siyoHash = await bcrypt.hash('Siyo98031!', 12)
  const siyoAccount = await prisma.account.upsert({
    where: { email: 'siyo@siyo.com' },
    update: { passwordHash: siyoHash, role: 'superadmin', isApproved: true },
    create: {
      storeId: siyoStore.id,
      email: 'siyo@siyo.com',
      passwordHash: siyoHash,
      role: 'superadmin',
      isApproved: true,   // 슈퍼 어드민은 즉시 활성화
    },
  })

  // ── 테스트 매장 + 일반 어드민 계정 ───────────────────────
  const testStore = await prisma.store.upsert({
    where: { id: 'seed-store-test' },
    update: {},
    create: {
      id: 'seed-store-test',
      name: '테스트 매장',
      address: '부산시',
      phone: '010-1234-5678',
    },
  })

  const testHash = await bcrypt.hash('test98031!', 12)
  const testAccount = await prisma.account.upsert({
    where: { email: 'test@test.com' },
    update: { passwordHash: testHash, isApproved: false, mustChangePassword: false },
    create: {
      storeId: testStore.id,
      email: 'test@test.com',
      passwordHash: testHash,
      role: 'admin',
      isApproved: false,  // 슈퍼 어드민 승인 필요
      mustChangePassword: false,
    },
  })

  // 비밀번호는 로그에 출력하지 않음 (보안)
  console.log('\n✅ 시드 완료')
  console.log(`  슈퍼 어드민: ${siyoAccount.email} (${siyoStore.name})`)
  console.log(`  일반 어드민: ${testAccount.email} (${testStore.name}) — 승인 대기`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

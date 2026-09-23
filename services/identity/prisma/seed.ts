import { PrismaClient, Role } from '@prisma/client'
import { randomBytes, scryptSync } from 'node:crypto'

const prisma = new PrismaClient()

function hashPassword (password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

async function main (): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password || password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be set and contain at least 12 characters')
  }

  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { name: 'Demo Childcare Center' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Demo Childcare Center' }
  })
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hashPassword(password) },
    create: { email, passwordHash: hashPassword(password) }
  })
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { role: Role.OWNER },
    create: { userId: user.id, tenantId: tenant.id, role: Role.OWNER }
  })
}

main().finally(() => prisma.$disconnect())

import { PrismaClient } from '@prisma/client'
import fp from 'fastify-plugin'

const prisma = fp(async (fastify) => {
  if (process.env.AUTH_DATABASE_MODE === 'memory') return
  const client = new PrismaClient()
  await client.$connect()
  fastify.decorate('prisma', client)
  fastify.addHook('onClose', async () => client.$disconnect())
})

declare module 'fastify' {
  interface FastifyInstance {
    prisma?: PrismaClient
  }
}

export default prisma

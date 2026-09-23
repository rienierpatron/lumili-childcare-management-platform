import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import type { Role } from '../plugins/auth.js'
import { Role as PrismaRole } from '@prisma/client'

type RegisterBody = {
  email: string
  password: string
  tenantName: string
}

type LoginBody = {
  email: string
  password: string
  tenantId?: string
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: RegisterBody }>('/auth/register', async (request, reply) => {
    const email = request.body.email.trim().toLowerCase()
    if (!email || request.body.password.length < 12 || !request.body.tenantName.trim()) {
      return reply.code(400).send({ error: 'email, password (min 12 characters), and tenantName are required' })
    }
    const existing = fastify.prisma
      ? await fastify.prisma.user.findUnique({ where: { email } })
      : [...fastify.authUsers.values()].find(user => user.email === email)
    if (existing) {
      return reply.code(409).send({ error: 'email already registered' })
    }

    const user = fastify.prisma
      ? await fastify.prisma.user.create({
        data: {
          email,
          passwordHash: fastify.hashPassword(request.body.password),
          memberships: {
            create: {
              role: PrismaRole.OWNER,
              tenant: { create: { name: request.body.tenantName.trim() } }
            }
          }
        },
        include: { memberships: { include: { tenant: true } } }
      })
      : (() => {
          const id = randomUUID()
          const tenantId = randomUUID()
          const memoryUser = {
            id,
            email,
            passwordHash: fastify.hashPassword(request.body.password),
            memberships: [{ tenantId, role: 'owner' as Role }]
          }
          fastify.authUsers.set(id, memoryUser)
          return { ...memoryUser, memberships: [{ ...memoryUser.memberships[0], tenant: { id: tenantId, name: request.body.tenantName.trim() } }] }
        })()
    const membership = user.memberships[0]
    const userId = user.id
    const tenantId = membership.tenantId
    return reply.code(201).send({
      user: { id: userId, email },
      tenant: { id: tenantId, name: membership.tenant.name },
      accessToken: fastify.createAccessToken({ userId, tenantId, role: 'owner' })
    })
  })

  fastify.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
    const email = request.body.email.trim().toLowerCase()
    const user = fastify.prisma
      ? await fastify.prisma.user.findUnique({ where: { email }, include: { memberships: true } })
      : [...fastify.authUsers.values()].find(candidate => candidate.email === email)
    if (!user || !fastify.verifyPassword(request.body.password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }

    const membership = request.body.tenantId
      ? user.memberships.find(item => item.tenantId === request.body.tenantId)
      : user.memberships[0]
    if (!membership) return reply.code(403).send({ error: 'user is not a member of this tenant' })

    return {
      user: { id: user.id, email: user.email },
      tenantId: membership.tenantId,
      role: membership.role.toString().toLowerCase() as Role,
      accessToken: fastify.createAccessToken({
        userId: user.id,
        tenantId: membership.tenantId,
        role: membership.role.toString().toLowerCase() as Role
      })
    }
  })

  fastify.get('/auth/me', { preHandler: fastify.authenticate }, async (request) => {
    const user = fastify.prisma
      ? await fastify.prisma.user.findUnique({ where: { id: request.auth!.userId } })
      : fastify.authUsers.get(request.auth!.userId)
    if (!user) return
    return {
      user: { id: user.id, email: user.email },
      tenantId: request.auth!.tenantId,
      role: request.auth!.role
    }
  })
}

export default authRoutes

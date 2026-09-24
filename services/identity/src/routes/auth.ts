import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import type { PlatformRole, Role } from '../plugins/auth.js'
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
  scope?: 'tenant' | 'platform'
}

type PlatformInvitationBody = {
  email: string
  role: PlatformRole
}

type AcceptInvitationBody = {
  token: string
  password: string
}

const platformRoles = new Set<PlatformRole>(['owner', 'support', 'sales', 'developer', 'ops'])
const platformAdmins = new Set<PlatformRole>(['owner', 'ops'])

function hashInvitationToken (token: string): string {
  return createHash('sha256').update(token).digest('hex')
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
      accountType: 'organization',
      accessToken: fastify.createAccessToken({ userId, accountType: 'organization', tenantId, role: 'owner' })
    })
  })

  fastify.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
    const email = request.body.email.trim().toLowerCase()
    const user = fastify.prisma
      ? await fastify.prisma.user.findUnique({ where: { email }, include: { memberships: true, platformMemberships: true } })
      : [...fastify.authUsers.values()].find(candidate => candidate.email === email)
    if (!user || !fastify.verifyPassword(request.body.password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }

    const membership = request.body.scope === 'platform'
      ? undefined
      : request.body.tenantId
      ? user.memberships.find(item => item.tenantId === request.body.tenantId)
      : user.memberships[0]
    if (!membership) {
      const platformMembership = user.platformMemberships?.[0]
      if (!platformMembership) return reply.code(403).send({ error: 'user is not a member of this tenant or the application team' })
      const platformRole = platformMembership.role.toString().toLowerCase() as PlatformRole
      return {
        user: { id: user.id, email: user.email },
        accountType: 'platform',
        platformRole,
        accessToken: fastify.createAccessToken({ userId: user.id, accountType: 'platform', platformRole })
      }
    }

    return {
      user: { id: user.id, email: user.email },
      accountType: 'organization',
      tenantId: membership.tenantId,
      role: membership.role.toString().toLowerCase() as Role,
      accessToken: fastify.createAccessToken({
        userId: user.id,
        accountType: 'organization',
        tenantId: membership.tenantId,
        role: membership.role.toString().toLowerCase() as Role
      })
    }
  })

  fastify.post<{ Body: PlatformInvitationBody }>('/auth/platform/invitations', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        const creator = request.auth
        const creatorRole = creator?.platformRole
        if (!creatorRole || !platformAdmins.has(creatorRole)) {
          return reply.code(403).send({ error: 'platform administrator access required' })
        }
        const email = request.body.email.trim().toLowerCase()
        const role = request.body.role?.toLowerCase() as PlatformRole
        if (!email || !platformRoles.has(role)) {
          return reply.code(400).send({ error: 'email and a valid platform role are required' })
        }
        const token = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        if (fastify.prisma) {
          await fastify.prisma.platformInvitation.create({
            data: {
              email,
              role: role.toUpperCase() as 'OWNER' | 'SUPPORT' | 'SALES' | 'DEVELOPER' | 'OPS',
              tokenHash: hashInvitationToken(token),
              expiresAt,
              createdById: creator.userId
            }
  })
        }
        return reply.code(201).send({ email, role, token, expiresAt })
      })

      fastify.post<{ Body: AcceptInvitationBody }>('/auth/platform/invitations/accept', async (request, reply) => {
        if (!request.body.token || request.body.password.length < 12) {
          return reply.code(400).send({ error: 'token and password (min 12 characters) are required' })
        }
        if (!fastify.prisma) return reply.code(503).send({ error: 'platform invitations require database mode' })
        const invitation = await fastify.prisma.platformInvitation.findUnique({ where: { tokenHash: hashInvitationToken(request.body.token) } })
        if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
          return reply.code(400).send({ error: 'invitation is invalid or expired' })
        }
        const user = await fastify.prisma.user.upsert({
          where: { email: invitation.email },
          create: { email: invitation.email, passwordHash: fastify.hashPassword(request.body.password) },
          update: { passwordHash: fastify.hashPassword(request.body.password) }
        })
        await fastify.prisma.$transaction([
          fastify.prisma.platformMembership.upsert({
            where: { userId_role: { userId: user.id, role: invitation.role } },
            create: { userId: user.id, role: invitation.role },
            update: {}
          }),
          fastify.prisma.platformInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() }
          })
        ])
        return reply.code(201).send({ user: { id: user.id, email: user.email } })
  })

  fastify.get('/auth/me', { preHandler: fastify.authenticate }, async (request) => {
    const user = fastify.prisma
      ? await fastify.prisma.user.findUnique({ where: { id: request.auth!.userId } })
      : fastify.authUsers.get(request.auth!.userId)
    if (!user) return
    return {
      user: { id: user.id, email: user.email },
      accountType: request.auth!.accountType,
      ...(request.auth!.tenantId ? { tenantId: request.auth!.tenantId, role: request.auth!.role } : { platformRole: request.auth!.platformRole })
    }
  })
}

export default authRoutes

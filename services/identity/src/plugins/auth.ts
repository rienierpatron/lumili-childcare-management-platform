import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'
import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { PrismaClient } from '@prisma/client'

export type Role = 'owner' | 'admin' | 'staff' | 'parent'
export type Permission =
  | 'tenant:read'
  | 'tenant:manage'
  | 'members:read'
  | 'members:manage'

export type TenantMembership = {
  tenantId: string
  role: Role
}

export type AuthUser = {
  id: string
  email: string
  passwordHash: string
  memberships: TenantMembership[]
}

export type AuthContext = {
  userId: string
  tenantId: string
  role: Role
}

type TokenPayload = AuthContext & {
  exp: number
  iat: number
}

type AuthOptions = {
  secret?: string
  accessTokenTtlSeconds?: number
}

const rolePermissions: Record<Role, readonly Permission[]> = {
  owner: ['tenant:read', 'tenant:manage', 'members:read', 'members:manage'],
  admin: ['tenant:read', 'members:read', 'members:manage'],
  staff: ['tenant:read'],
  parent: ['tenant:read']
}

const users = new Map<string, AuthUser>()

function hashPassword (password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword (password: string, storedHash: string): boolean {
  const [salt, expected] = storedHash.split(':')
  if (!salt || !expected) return false
  const actual = scryptSync(password, salt, 64)
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

function encode (value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decode<T> (value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
}

function sign (value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function createToken (context: AuthContext, secret: string, ttl: number): string {
  const now = Math.floor(Date.now() / 1000)
  const encodedHeader = encode({ alg: 'HS256', typ: 'JWT' })
  const encodedPayload = encode({ ...context, iat: now, exp: now + ttl })
  const content = `${encodedHeader}.${encodedPayload}`
  return `${content}.${sign(content, secret)}`
}

function readToken (token: string, secret: string): TokenPayload | null {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null
  const content = `${header}.${payload}`
  const expected = sign(content, secret)
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) return null

  try {
    const parsed = decode<TokenPayload>(payload)
    if (!parsed.userId || !parsed.tenantId || !parsed.role || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function getBearerToken (request: FastifyRequest): string | null {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

const auth = fp<AuthOptions>(async (fastify, options) => {
  const secret = options.secret ?? process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set and contain at least 32 characters')
  }
  const ttl = options.accessTokenTtlSeconds ?? 900

  fastify.decorate('authUsers', users)
  fastify.decorate('hashPassword', hashPassword)
  fastify.decorate('verifyPassword', verifyPassword)
  fastify.decorate('createAccessToken', (context: AuthContext) => createToken(context, secret, ttl))
  fastify.decorateRequest('auth', null)

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const token = getBearerToken(request)
    const context = token ? readToken(token, secret) : null
    const userExists = context && fastify.prisma
      ? await fastify.prisma.user.findUnique({ where: { id: context.userId }, select: { id: true } })
      : context && users.has(context.userId)
    if (!context || !userExists) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    request.auth = context
  })

  fastify.decorate('authorize', (permission: Permission) => {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.auth || !rolePermissions[request.auth.role].includes(permission)) {
        return reply.code(403).send({ error: 'forbidden' })
      }
    }
  })
})

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null
  }

  interface FastifyInstance {
    prisma?: PrismaClient
    authUsers: Map<string, AuthUser>
    hashPassword: (password: string) => string
    verifyPassword: (password: string, storedHash: string) => boolean
    createAccessToken: (context: AuthContext) => string
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
    authorize: (permission: Permission) => (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  }
}

export { auth, hashPassword, verifyPassword, rolePermissions, randomUUID }
export default auth

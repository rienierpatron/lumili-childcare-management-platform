import type { FastifyPluginAsync } from 'fastify'
import { services } from '../config/services.ts'

type ProxyBody = Record<string, unknown>

const auth: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ProxyBody }>('/auth/login', async (request, reply) => {
    const identity = services.find((service) => service.name === 'identity')
    if (!identity) return reply.code(503).send({ error: 'identity service is not configured' })

    try {
      const response = await fetch(`${identity.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request.body)
      })
      const body = await response.json() as unknown
      return reply.code(response.status).send(body)
    } catch {
      return reply.code(503).send({ error: 'identity service is unavailable' })
    }
  })
}

export default auth

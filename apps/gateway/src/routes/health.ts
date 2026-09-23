import type { FastifyPluginAsync } from 'fastify'
import { services } from '../config/services.ts'

const health: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'gateway',
    services
  }))
}

export default health

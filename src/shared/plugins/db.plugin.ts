import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { getDb } from '../../db/client'

export default fp(async (fastify: FastifyInstance) => {
  const db = getDb()
  fastify.decorate('db', db)

  fastify.addHook('onClose', async () => {
    const { Pool } = await import('pg')
  })
}, {
  name: 'db-plugin',
})

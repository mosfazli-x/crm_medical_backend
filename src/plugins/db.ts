import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { db } from '../db'

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('db', db)
})

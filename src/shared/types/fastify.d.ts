import 'fastify'
import type { DB } from '../../db/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
  }
}

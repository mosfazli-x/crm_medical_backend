import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { env } from '../config/env'

let pool: Pool | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err)
    })
  }

  if (!db) {
    db = drizzle(pool, {
      schema,
      logger: env.NODE_ENV === 'development',
    })
  }

  return db
}

export type DB = ReturnType<typeof getDb>

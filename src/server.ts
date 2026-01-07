import 'dotenv/config'
import dbPlugin from './plugins/db'
import { db } from './db'
import { buildApp } from './app'
import { patientRoutes } from './routes/patients'
import { visitRoutes } from './routes/visits'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { env } from './config/env'

const start = async () => {
  const app = buildApp()

  await app.register(dbPlugin)
  await app.register(patientRoutes, { prefix: '/api/patients' })
  await app.register(visitRoutes, { prefix: '/api/visits' })
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });

  try {
    const port = Number(process.env.PORT) || 3001
    await app.listen({ port: env.server.port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

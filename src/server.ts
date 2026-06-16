import './config/env'
import { buildApp } from './app'

async function main() {
  const app = await buildApp()

  try {
    const port = process.env.BACKEND_PORT
      ? Number(process.env.BACKEND_PORT)
      : Number(process.env.PORT) || 3001

    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Server running on port ${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()

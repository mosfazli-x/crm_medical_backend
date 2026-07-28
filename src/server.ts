import './config/env'
import { buildApp } from './app'
import { telegramService } from './shared/services'

async function main() {
  const app = await buildApp()

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)
    try {
      await app.close()
      app.log.info('Server closed successfully')
      process.exit(0)
    } catch (err) {
      app.log.error(err, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  try {
    const port = process.env.BACKEND_PORT
      ? Number(process.env.BACKEND_PORT)
      : Number(process.env.PORT) || 3001

    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Server running on port ${port}`)

    if (telegramService.isConfigured()) {
      telegramService.setWebhook().then((ok) => {
        if (ok) {
          app.log.info('Telegram webhook registered')
        } else {
          app.log.warn('Telegram webhook registration failed')
        }
      })
    }
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()

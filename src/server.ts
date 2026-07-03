import './config/env'
import { buildApp } from './app'
import { telegramService } from './shared/services'

async function main() {
  const app = await buildApp()

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

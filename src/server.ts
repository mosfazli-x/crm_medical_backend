import { env } from './config/env'
import { buildApp } from './app'
import { telegramService } from './shared/services'
import { getDb } from './db/client'
import {
  documentExtractionProvider,
  startDocumentExtractionWorker,
  type DocumentExtractionWorker,
} from './modules/document-intelligence'

async function main() {
  const app = await buildApp()
  let extractionWorker: DocumentExtractionWorker | null = null

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)
    try {
      extractionWorker?.stop()
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

    if (env.DOCUMENT_AI_ENABLED && documentExtractionProvider.isAvailable()) {
      extractionWorker = startDocumentExtractionWorker(getDb())
      app.log.info(`Document extraction worker started (${env.DOCUMENT_AI_PROVIDER})`)
    } else {
      app.log.info('Document extraction worker disabled (missing configuration)')
    }

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

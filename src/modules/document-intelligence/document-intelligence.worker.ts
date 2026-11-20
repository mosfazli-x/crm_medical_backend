import type { DB } from '../../db/client'
import { env } from '../../config/env'
import { DocumentExtractionService } from './document-intelligence.service'

const JOBS_PER_TICK = 1

export interface DocumentExtractionWorker {
  stop: () => void
}

/**
 * Single-process, DB-backed worker loop. It claims queued jobs with
 * `FOR UPDATE SKIP LOCKED`, so it remains safe if the app is later
 * scaled to multiple instances.
 */
export function startDocumentExtractionWorker(db: DB): DocumentExtractionWorker {
  const service = new DocumentExtractionService(db)
  let stopped = false
  let timer: NodeJS.Timeout | null = null

  const tick = async () => {
    if (stopped) return

    try {
      for (let processed = 0; processed < JOBS_PER_TICK; processed++) {
        const hadJob = await service.processNextJob()
        if (!hadJob) break
      }
    } catch (error) {
      console.error(
        'Document extraction worker error:',
        error instanceof Error ? error.message : error,
      )
    } finally {
      if (!stopped) {
        timer = setTimeout(tick, env.DOCUMENT_AI_POLL_INTERVAL_MS)
      }
    }
  }

  service
    .recoverStaleJobs()
    .then((count) => {
      if (count > 0) {
        console.warn(`Recovered ${count} stale document extraction job(s)`)
      }
    })
    .catch((error) => {
      console.error(
        'Document extraction worker recovery error:',
        error instanceof Error ? error.message : error,
      )
    })

  timer = setTimeout(tick, 1_500)

  return {
    stop() {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

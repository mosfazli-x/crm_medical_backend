import type { FastifyInstance } from 'fastify'
import { OcrController } from './ocr.controller'
import { OcrService } from './ocr.service'
import { authenticate } from '../../shared/middleware'

export async function ocrRoutes(fastify: FastifyInstance) {
  const service = new OcrService()
  const controller = new OcrController(service)

  fastify.post('/handwriting', { preHandler: authenticate }, (req, rep) =>
    controller.recognizeHandwriting(req, rep)
  )
}

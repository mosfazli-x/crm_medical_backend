import type { FastifyRequest, FastifyReply } from 'fastify'
import { OcrService } from './ocr.service'
import { parseMultipart } from '../../shared/utils/multipart'

const MAX_OCR_IMAGE_BYTES = 1024 * 1024 // OCR.space free tier upload limit (1 MB)

export class OcrController {
  constructor(private ocrService: OcrService) { }

  async recognizeHandwriting(request: FastifyRequest, reply: FastifyReply) {
    if (!request.isMultipart()) {
      return reply.status(400).send({ success: false, error: 'Request must be multipart/form-data' })
    }

    const { files } = await parseMultipart(request.parts(), ['file'])
    const file = files[0]

    if (!file) {
      return reply.status(400).send({ success: false, error: 'No file uploaded' })
    }

    if (file.buffer.length === 0) {
      return reply.status(400).send({ success: false, error: 'Uploaded file is empty' })
    }

    if (file.buffer.length > MAX_OCR_IMAGE_BYTES) {
      return reply.status(400).send({ success: false, error: 'Image exceeds the 1 MB size limit' })
    }

    const text = await this.ocrService.recognizeHandwriting(
      file.buffer,
      file.mimeType || 'image/png',
      file.originalName || 'handwriting.png'
    )

    return reply.status(200).send({ success: true, text })
  }
}

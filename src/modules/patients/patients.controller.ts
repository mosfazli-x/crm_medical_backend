import type { FastifyRequest, FastifyReply } from 'fastify'
import { PatientService } from './patients.service'
import { CreatePatientSchema, UpdatePatientSchema, SendSmsSchema, SearchPatientsSchema, PatientSelfUpdateSchema } from './patients.schema'
import { parseMultipart, saveBufferedFiles, cleanupFiles } from '../../shared/utils/multipart'
import { fileService } from '../../shared/services'
import { smsService } from '../../shared/services'
import { NotFoundError } from '../../shared/errors'
import { attachments } from '../../db/schema.js'
import { getDb } from '../../db/client.js'
import { eq } from 'drizzle-orm'

export class PatientController {
  constructor(private patientService: PatientService) { }

  async create(request: FastifyRequest, reply: FastifyReply) {
    if (!request.isMultipart()) {
      return reply.status(400).send({ success: false, error: 'Request must be multipart/form-data' })
    }

    const { files: bufferedFiles, fields } = await parseMultipart(request.parts())
    let savedFiles: Awaited<ReturnType<typeof saveBufferedFiles>> = []

    try {
      const rawPatient = fields.patient ? JSON.parse(fields.patient as string) : null

      if (!rawPatient) {
        return reply.status(400).send({ success: false, error: 'Patient data is required' })
      }

      const dto = CreatePatientSchema.parse({ patient: rawPatient })
      const newPatient = await this.patientService.create(dto, [])

      if (bufferedFiles.length > 0) {
        savedFiles = await saveBufferedFiles(bufferedFiles, newPatient.id)
        const attachmentRows = savedFiles.map((file) => ({
          patientId: newPatient.id,
          fileType: file.type || (file.fieldname?.replace(/\[\]$/, '') ?? 'unknown'),
          fileName: file.originalName,
          filePath: file.filePath,
          fileHash: file.fileHash,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          storagePath: file.relativePath,
        }))
        const db = getDb()
        await db.insert(attachments).values(attachmentRows)
      }

      if (newPatient.phone) {
        smsService.send(
          newPatient.phone,
          `سلام ${newPatient.firstName} عزیز، ثبت‌نام شما در کلینیک تخصصی دکتر حسینی با موفقیت انجام شد. برای شما آرزوی سلامتی داریم.`
        )
      }

      return reply.status(201).send({
        success: true,
        message: 'Patient registered successfully',
        patientId: newPatient.id,
      })
    } catch (error) {
      if (savedFiles.length > 0) {
        await cleanupFiles(savedFiles)
      }
      throw error
    }
  }

  async findAll(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.patientService.findAll()
    return reply.status(200).send({ success: true, data })
  }

  async search(request: FastifyRequest, reply: FastifyReply) {
    const query = SearchPatientsSchema.parse(request.query)
    const data = await this.patientService.search(query)
    return reply.status(200).send({ success: true, data })
  }

  async findById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const data = await this.patientService.findById(id)
    return reply.status(200).send({ success: true, data })
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id: patientId } = request.params

    if (!request.isMultipart()) {
      return reply.status(400).send({ success: false, error: 'Request must be multipart/form-data' })
    }

    const { files: bufferedFiles, fields } = await parseMultipart(request.parts())
    let savedFiles: Awaited<ReturnType<typeof saveBufferedFiles>> = []

    try {
      const rawPatient = fields.patient ? JSON.parse(fields.patient as string) : null

      if (!rawPatient) {
        return reply.status(400).send({ success: false, error: 'Patient data is required' })
      }

      const dto = UpdatePatientSchema.parse({ patient: rawPatient })

      if (bufferedFiles.length > 0) {
        savedFiles = await saveBufferedFiles(bufferedFiles, patientId)
      }

      const result = await this.patientService.update(patientId, dto, savedFiles)

      return reply.status(200).send({
        success: true,
        message: 'Patient updated successfully',
        patient: result,
      })
    } catch (error) {
      if (savedFiles.length > 0) {
        await cleanupFiles(savedFiles)
      }
      throw error
    }
  }

  async sendSms(request: FastifyRequest, reply: FastifyReply) {
    const body = SendSmsSchema.parse(request.body)
    const success = await smsService.send(body.phone, body.text)
    if (success) {
      return reply.status(200).send({ success: true, message: 'SMS sent successfully' })
    }
    return reply.status(502).send({ success: false, error: 'Failed to send SMS' })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const result = await this.patientService.softDelete(id)
    return reply.status(200).send({
      success: true,
      message: 'Patient deleted successfully (soft delete)',
      patient: result,
    })
  }

  async updateMyProfile(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = request.user
    if (!patientId) {
      return reply.status(400).send({ success: false, error: 'No patient profile linked to your account' })
    }

    const dto = PatientSelfUpdateSchema.parse(request.body)
    const result = await this.patientService.updateMyProfile(patientId, dto)

    return reply.send({
      success: true,
      message: 'پروفایل با موفقیت به‌روزرسانی شد.',
      patient: result,
    })
  }

  async getDoctors(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.patientService.getDoctors()
    return reply.status(200).send({ success: true, data })
  }

  async deleteAttachment(
    request: FastifyRequest<{ Params: { patientId: string; attachmentId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId, attachmentId } = request.params
    await this.patientService.deleteAttachment(patientId, attachmentId)
    return reply.status(200).send({
      success: true,
      message: 'Attachment deleted successfully',
    })
  }

  async serveFile(
    request: FastifyRequest<{ Params: { attachmentId: string } }>,
    reply: FastifyReply
  ) {
    const { attachmentId } = request.params

    const db = getDb()
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId))

    if (!attachment) {
      throw new NotFoundError('Attachment')
    }

    const storageTarget = attachment.storagePath
      || attachment.filePath.replace('/uploads/', '')

    const result = await fileService.getFileStream(storageTarget)
    if (!result) {
      throw new NotFoundError('File')
    }

    const mimeType = attachment.mimeType || 'application/octet-stream'
    reply.header('Content-Type', mimeType)
    reply.header('Content-Disposition', `inline; filename="${attachment.fileName}"`)
    reply.header('Cache-Control', 'private, max-age=3600')

    if (result.contentType) {
      reply.header('Content-Type', result.contentType)
    }

    if (result.stream && typeof (result.stream as any).pipe === 'function') {
      return reply.send(result.stream as NodeJS.ReadableStream)
    }

    const { createReadStream } = await import('node:fs')
    const filePath = fileService.getAbsolutePath(storageTarget)
    const stream = createReadStream(filePath)
    return reply.send(stream)
  }
}

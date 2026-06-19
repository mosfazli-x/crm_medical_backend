import type { FastifyRequest, FastifyReply } from 'fastify'
import { PatientService } from './patients.service'
import { CreatePatientSchema, UpdatePatientSchema, SendSmsSchema, SearchPatientsSchema } from './patients.schema'
import { saveMultipartFiles, cleanupFiles } from '../../shared/utils/multipart'
import { fileService } from '../../shared/services'
import { smsService } from '../../shared/services'

export class PatientController {
  constructor(private patientService: PatientService) { }

  async create(request: FastifyRequest, reply: FastifyReply) {
    if (!request.isMultipart()) {
      return reply.status(400).send({ success: false, error: 'Request must be multipart/form-data' })
    }

    const uploadDir = fileService.getUploadDir()
    const { files: uploadedFiles, fields } = await saveMultipartFiles(request.parts(), uploadDir)

    try {
      const rawPatient = fields.patient ? JSON.parse(fields.patient as string) : null
      const rawVisit = fields.visit ? JSON.parse(fields.visit as string) : null

      if (!rawPatient || !rawVisit) {
        await cleanupFiles(uploadDir, uploadedFiles)
        return reply.status(400).send({ success: false, error: 'Patient and visit data are required' })
      }

      const dto = CreatePatientSchema.parse({ patient: rawPatient, visit: rawVisit })
      const newPatient = await this.patientService.create(dto, uploadedFiles)

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
      await cleanupFiles(uploadDir, uploadedFiles)
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

    const uploadDir = fileService.getUploadDir()
    const { files: uploadedFiles, fields } = await saveMultipartFiles(request.parts(), uploadDir)

    try {
      const rawPatient = fields.patient ? JSON.parse(fields.patient as string) : null
      const rawPregnancy = fields.pregnancy ? JSON.parse(fields.pregnancy as string) : null

      if (!rawPatient) {
        await cleanupFiles(uploadDir, uploadedFiles)
        return reply.status(400).send({ success: false, error: 'Patient data is required' })
      }

      const dto = UpdatePatientSchema.parse({
        patient: rawPatient,
        pregnancy: rawPregnancy,
      })

      const result = await this.patientService.update(patientId, dto, uploadedFiles)

      return reply.status(200).send({
        success: true,
        message: 'Patient updated successfully',
        patient: result,
      })
    } catch (error) {
      await cleanupFiles(uploadDir, uploadedFiles)
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
}

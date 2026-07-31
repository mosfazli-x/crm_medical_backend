import type { FastifyRequest, FastifyReply } from 'fastify'
import { DoctorProfileService } from './doctor-profiles.service'
import { UpsertDoctorProfileSchema } from './doctor-profiles.schema'
import { ValidationError } from '../../shared/errors'

export class DoctorProfileController {
  constructor(private doctorProfileService: DoctorProfileService) {}

  async getProfile(request: FastifyRequest<{ Params: { doctorId: string } }>, reply: FastifyReply) {
    const { doctorId } = request.params
    const data = await this.doctorProfileService.findByDoctorId(doctorId)
    return reply.status(200).send({ success: true, data })
  }

  async upsert(request: FastifyRequest<{ Params: { doctorId: string } }>, reply: FastifyReply) {
    const { doctorId } = request.params
    const dto = UpsertDoctorProfileSchema.parse(request.body)
    const data = await this.doctorProfileService.upsert(doctorId, dto)
    return reply.status(200).send({
      success: true,
      message: 'Doctor profile updated successfully',
      data,
    })
  }

  async uploadPhoto(request: FastifyRequest<{ Params: { doctorId: string } }>, reply: FastifyReply) {
    const { doctorId } = request.params
    const part = await request.file()

    if (!part) {
      throw new ValidationError('No file uploaded')
    }

    try {
      const buffer = await part.toBuffer()
      const metadata = await this.doctorProfileService.savePhoto(
        doctorId,
        part.filename || 'photo.jpg',
        buffer
      )
      return reply.status(200).send({
        success: true,
        message: 'Doctor photo uploaded successfully',
        data: { photoUrl: metadata.publicPath },
      })
    } finally {
      part.file.destroy()
    }
  }
}

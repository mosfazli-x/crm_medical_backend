import type { FastifyRequest, FastifyReply } from 'fastify'
import { DoctorProfileService } from './doctor-profiles.service'
import { UpsertDoctorProfileSchema } from './doctor-profiles.schema'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { fileService } from '../../shared/services'
import { env } from '../../config/env'

const PHOTO_EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function photoContentType(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
  return PHOTO_EXT_TO_MIME[ext] || 'image/*'
}

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

  async servePhoto(request: FastifyRequest<{ Params: { doctorId: string } }>, reply: FastifyReply) {
    const { doctorId } = request.params
    const profile = await this.doctorProfileService.findByDoctorId(doctorId)

    if (!profile?.photoUrl) {
      throw new NotFoundError('Photo')
    }

    const storageTarget = profile.photoUrl.replace(/^\/uploads\//, '')

    if (env.STORAGE_DRIVER === 's3') {
      const presignedUrl = await fileService.getPresignedUrl(storageTarget, env.PRESIGNED_URL_EXPIRY)
      if (!presignedUrl) {
        throw new NotFoundError('Photo')
      }
      return reply.redirect(presignedUrl, 302)
    }

    const { createReadStream } = await import('node:fs')
    const { stat } = await import('node:fs/promises')
    const absolutePath = fileService.getAbsolutePath(storageTarget)

    try {
      await stat(absolutePath)
    } catch {
      throw new NotFoundError('Photo')
    }

    const stream = createReadStream(absolutePath)
    reply.header('Content-Type', photoContentType(storageTarget))
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(stream)
  }
}

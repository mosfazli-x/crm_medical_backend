import type { DB } from '../../db/client'
import { doctorProfiles, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { fileService } from '../../shared/services'
import type { FileMetadata } from '../../shared/services/file.service'
import type { UpsertDoctorProfileDto } from './doctor-profiles.schema'

export class DoctorProfileService {
  constructor(private db: DB) {}

  async findByDoctorId(doctorId: string) {
    const [profile] = await this.db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.doctorId, doctorId))

    return profile ?? null
  }

  async upsert(doctorId: string, dto: UpsertDoctorProfileDto) {
    await this.ensureDoctor(doctorId)

    const values = {
      specialty: dto.specialty ?? null,
      bio: dto.bio ?? null,
      photoUrl: dto.photoUrl ?? null,
      experienceYears: dto.experienceYears ?? null,
      patientsCount: dto.patientsCount ?? null,
      rating: dto.rating != null ? String(dto.rating) : null,
      sortOrder: dto.sortOrder ?? 0,
      showOnLanding: dto.showOnLanding ?? true,
      updatedAt: new Date(),
    }

    const [profile] = await this.db
      .insert(doctorProfiles)
      .values({ doctorId, ...values, createdAt: new Date() })
      .onConflictDoUpdate({
        target: doctorProfiles.doctorId,
        set: values,
      })
      .returning()

    return profile
  }

  async savePhoto(doctorId: string, originalName: string, buffer: Buffer): Promise<FileMetadata> {
    await this.ensureDoctor(doctorId)

    const metadata = await fileService.saveFile(
      `doctors/${doctorId}`,
      'photo',
      originalName,
      buffer
    )

    await this.db
      .insert(doctorProfiles)
      .values({
        doctorId,
        photoUrl: metadata.publicPath,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: doctorProfiles.doctorId,
        set: { photoUrl: metadata.publicPath, updatedAt: new Date() },
      })

    return metadata
  }

  private async ensureDoctor(doctorId: string) {
    const [user] = await this.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, doctorId))

    if (!user) throw new NotFoundError('User')

    if (user.role !== 'doctor') {
      throw new ConflictError('Only users with the doctor role can have a public profile')
    }
  }
}

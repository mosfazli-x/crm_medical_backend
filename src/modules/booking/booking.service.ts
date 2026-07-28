import type { DB } from '../../db/client'
import { doctorVisitTypes, users } from '../../db/schema'
import { and, eq, sql } from 'drizzle-orm'

export interface ServiceDoctor {
  doctorId: string
  doctorName: string
  visitTypeId: string
  name: string
  description: string | null
  durationMinutes: number
  price: string | null
  color: string | null
}

export interface ServiceGroup {
  name: string
  doctors: ServiceDoctor[]
}

export class BookingService {
  constructor(private db: DB) {}

  async getServices(doctorId?: string): Promise<ServiceGroup[]> {
    const conditions = [
      eq(doctorVisitTypes.isActive, true),
      eq(doctorVisitTypes.isDeleted, false),
      eq(users.status, 'approved'),
      sql`${users.role} IN ('doctor', 'admin_doctor')`,
    ]

    if (doctorId) {
      conditions.push(eq(doctorVisitTypes.doctorId, doctorId))
    }

    const rows = await this.db
      .select({
        doctorId: doctorVisitTypes.doctorId,
        doctorName: users.fullName,
        visitTypeId: doctorVisitTypes.id,
        name: doctorVisitTypes.name,
        description: doctorVisitTypes.description,
        durationMinutes: doctorVisitTypes.durationMinutes,
        price: doctorVisitTypes.price,
        color: doctorVisitTypes.color,
      })
      .from(doctorVisitTypes)
      .innerJoin(users, eq(doctorVisitTypes.doctorId, users.id))
      .where(and(...conditions))
      .orderBy(doctorVisitTypes.name, users.fullName)

    const groups = new Map<string, ServiceGroup>()

    for (const row of rows) {
      if (!groups.has(row.name)) {
        groups.set(row.name, { name: row.name, doctors: [] })
      }
      groups.get(row.name)!.doctors.push({
        doctorId: row.doctorId,
        doctorName: row.doctorName ?? '',
        visitTypeId: row.visitTypeId,
        name: row.name,
        description: row.description,
        durationMinutes: row.durationMinutes,
        price: row.price,
        color: row.color,
      })
    }

    return Array.from(groups.values())
  }
}

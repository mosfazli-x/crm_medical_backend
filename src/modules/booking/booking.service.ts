import type { DB } from '../../db/client'
import { doctorVisitTypes, users, doctorAvailability, appointments, doctorProfiles } from '../../db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { ConflictError } from '../../shared/errors'
import type { BookAppointmentDto } from './booking.schema'

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

  async getDoctors() {
    return this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        specialty: doctorProfiles.specialty,
        bio: doctorProfiles.bio,
        photoUrl: doctorProfiles.photoUrl,
        experienceYears: doctorProfiles.experienceYears,
        patientsCount: doctorProfiles.patientsCount,
        rating: doctorProfiles.rating,
        sortOrder: doctorProfiles.sortOrder,
      })
      .from(users)
      .leftJoin(doctorProfiles, eq(doctorProfiles.doctorId, users.id))
      .where(and(eq(users.role, 'doctor'), eq(users.status, 'approved')))
      .orderBy(sql`${doctorProfiles.sortOrder} ASC NULLS LAST`, users.fullName)
  }

  async getAvailableSlots(doctorId: string, dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = date.getDay()

    const availabilityRows = await this.db
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, doctorId),
          eq(doctorAvailability.dayOfWeek, dayOfWeek),
          eq(doctorAvailability.isActive, true)
        )
      )
      .orderBy(doctorAvailability.startTime)

    if (!availabilityRows.length) return []

    const existingAppointments = await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.appointmentDate, dateStr),
          sql`${appointments.status} IN ('pending', 'confirmed')`
        )
      )

    const bookedTimes = new Set(existingAppointments.map((a) => a.startTime))

    const slots: { startTime: string; endTime: string }[] = []

    for (const avail of availabilityRows) {
      const slotsInRange = this.generateTimeSlots(avail.startTime, avail.endTime, 15)
      for (const slot of slotsInRange) {
        if (!bookedTimes.has(slot.startTime)) {
          slots.push(slot)
        }
      }
    }

    return slots
  }

  private generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number) {
    const slots: { startTime: string; endTime: string }[] = []
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)

    let currentMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    while (currentMinutes + intervalMinutes <= endMinutes) {
      const nextMinutes = currentMinutes + intervalMinutes

      const sh = String(Math.floor(currentMinutes / 60)).padStart(2, '0')
      const sm = String(currentMinutes % 60).padStart(2, '0')
      const eh = String(Math.floor(nextMinutes / 60)).padStart(2, '0')
      const em = String(nextMinutes % 60).padStart(2, '0')

      slots.push({ startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` })
      currentMinutes = nextMinutes
    }

    return slots
  }

  async bookAppointment(dto: BookAppointmentDto) {
    const date = new Date(dto.appointmentDate + 'T00:00:00')
    const dayOfWeek = date.getDay()

    const availability = await this.db
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, dto.doctorId),
          eq(doctorAvailability.dayOfWeek, dayOfWeek),
          eq(doctorAvailability.isActive, true)
        )
      )

    if (!availability.length) {
      throw new ConflictError('Doctor is not available on this day')
    }

    const isWithinAvailability = availability.some(
      (a) => dto.startTime >= a.startTime && dto.endTime <= a.endTime
    )

    if (!isWithinAvailability) {
      throw new ConflictError("Selected time is outside doctor's working hours")
    }

    const [existing] = await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, dto.doctorId),
          eq(appointments.appointmentDate, dto.appointmentDate),
          eq(appointments.startTime, dto.startTime),
          sql`${appointments.status} IN ('pending', 'confirmed')`
        )
      )
      .limit(1)

    if (existing) {
      throw new ConflictError('This time slot is already booked')
    }

    const [appointment] = await this.db
      .insert(appointments)
      .values({
        doctorId: dto.doctorId,
        appointmentDate: dto.appointmentDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        visitTypeId: dto.visitTypeId ?? null,
        patientFirstName: dto.patientFirstName,
        patientLastName: dto.patientLastName,
        patientNationalId: dto.patientNationalId,
        patientPhone: dto.patientPhone,
      })
      .returning()

    const [doctor] = await this.db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, dto.doctorId))
      .limit(1)

    return { appointment, doctorName: doctor?.fullName ?? '' }
  }
}
import type { DB } from '../../db/client'
import { users, doctorAvailability, appointments } from '../../db/schema'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { NotFoundError, ConflictError } from '../../shared/errors'
import type { CreateAvailabilityDto, UpdateAvailabilityDto, BookAppointmentDto, UpdateAppointmentStatusDto } from './scheduling.schema'

export class SchedulingService {
  constructor(private db: DB) {}

  async getDoctors() {
    return this.db
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(and(eq(users.role, 'doctor'), eq(users.status, 'approved')))
      .orderBy(users.fullName)
  }

  async getDoctorAvailability(doctorId: string) {
    const availability = await this.db
      .select()
      .from(doctorAvailability)
      .where(and(eq(doctorAvailability.doctorId, doctorId), eq(doctorAvailability.isActive, true)))
      .orderBy(doctorAvailability.dayOfWeek, doctorAvailability.startTime)

    if (!availability.length) {
      return []
    }

    return availability
  }

  async createAvailability(doctorId: string, dto: CreateAvailabilityDto) {
    const [existing] = await this.db
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, doctorId),
          eq(doctorAvailability.dayOfWeek, dto.dayOfWeek),
          eq(doctorAvailability.isActive, true)
        )
      )
      .limit(1)

    const [newAvailability] = await this.db
      .insert(doctorAvailability)
      .values({
        doctorId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      })
      .returning()

    return newAvailability
  }

  async updateAvailability(id: string, doctorId: string, dto: UpdateAvailabilityDto) {
    const existing = await this.db
      .select()
      .from(doctorAvailability)
      .where(and(eq(doctorAvailability.id, id), eq(doctorAvailability.doctorId, doctorId)))
      .limit(1)

    if (!existing.length) throw new NotFoundError('Availability')

    const updates: Record<string, unknown> = {}
    if (dto.dayOfWeek !== undefined) updates.dayOfWeek = dto.dayOfWeek
    if (dto.startTime !== undefined) updates.startTime = dto.startTime
    if (dto.endTime !== undefined) updates.endTime = dto.endTime
    if (dto.isActive !== undefined) updates.isActive = dto.isActive

    const [updated] = await this.db
      .update(doctorAvailability)
      .set(updates)
      .where(eq(doctorAvailability.id, id))
      .returning()

    return updated
  }

  async deleteAvailability(id: string, doctorId: string) {
    const [deleted] = await this.db
      .delete(doctorAvailability)
      .where(and(eq(doctorAvailability.id, id), eq(doctorAvailability.doctorId, doctorId)))
      .returning()

    if (!deleted) throw new NotFoundError('Availability')

    return deleted
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
      throw new ConflictError('Selected time is outside doctor\'s working hours')
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
        patientFirstName: dto.patientFirstName,
        patientLastName: dto.patientLastName,
        patientNationalId: dto.patientNationalId,
        patientPhone: dto.patientPhone,
      })
      .returning()

    return appointment
  }

  async getDoctorAppointments(doctorId: string, date?: string) {
    const conditions = [eq(appointments.doctorId, doctorId)]

    if (date) {
      conditions.push(eq(appointments.appointmentDate, date))
    }

    return this.db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.appointmentDate, appointments.startTime)
  }

  async updateAppointmentStatus(id: string, doctorId: string, dto: UpdateAppointmentStatusDto) {
    const [existing] = await this.db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.doctorId, doctorId)))
      .limit(1)

    if (!existing) throw new NotFoundError('Appointment')

    const [updated] = await this.db
      .update(appointments)
      .set({ status: dto.status })
      .where(eq(appointments.id, id))
      .returning()

    return updated
  }
}

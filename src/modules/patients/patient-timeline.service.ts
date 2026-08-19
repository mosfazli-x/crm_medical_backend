import type { DB } from '../../db/client'
import {
  patients, visits, appointments, prescriptions, labResults, labOrders,
  screeningSchedules, screeningResults, pregnancies, vaccinations,
  clinicalAssessments, billingRecords, messages, dailyReports, vitalSigns,
  patientNotes, users, diseases, medications, allergies,
} from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export interface TimelineEvent {
  id: string
  type: string
  date: string | null
  title: string
  summary: string
  details: Record<string, any>
  color: string
  icon: string
}

function toDateStr(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') return val
  return null
}

export class PatientTimelineService {
  constructor(private db: DB) {}

  async getTimeline(patientId: string, options?: { from?: string; to?: string; types?: string[] }) {
    const events: TimelineEvent[] = []

    const [
      patient,
      visitsList,
      appointmentsList,
      prescriptionsList,
      labResultsList,
      labOrdersList,
      screeningSchedulesList,
      screeningResultsList,
      pregnanciesList,
      vaccinationsList,
      assessmentsList,
      billingList,
      messagesList,
      dailyReportsList,
      vitalSignsList,
      notesList,
      diseasesList,
      medicationsList,
      allergiesList,
    ] = await Promise.all([
      this.db.select().from(patients).where(eq(patients.id, patientId)).limit(1),
      this.db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.visitDate)),
      this.db.select().from(appointments).where(eq(appointments.patientId, patientId)).orderBy(desc(appointments.appointmentDate)),
      this.db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId)).orderBy(desc(prescriptions.createdAt)),
      this.db.select().from(labResults).where(eq(labResults.patientId, patientId)).orderBy(desc(labResults.performedDate)),
      this.db.select().from(labOrders).where(eq(labOrders.patientId, patientId)).orderBy(desc(labOrders.orderDate)),
      this.db.select().from(screeningSchedules).where(eq(screeningSchedules.patientId, patientId)).orderBy(desc(screeningSchedules.dueDate)),
      this.db.select().from(screeningResults).where(eq(screeningResults.patientId, patientId)).orderBy(desc(screeningResults.performedDate)),
      this.db.select().from(pregnancies).where(eq(pregnancies.patientId, patientId)).orderBy(desc(pregnancies.createdAt)),
      this.db.select().from(vaccinations).where(eq(vaccinations.patientId, patientId)).orderBy(desc(vaccinations.dateAdministered)),
      this.db.select().from(clinicalAssessments).where(eq(clinicalAssessments.patientId, patientId)).orderBy(desc(clinicalAssessments.createdAt)),
      this.db.select().from(billingRecords).where(eq(billingRecords.patientId, patientId)).orderBy(desc(billingRecords.billedDate)),
      this.db.select().from(messages).where(eq(messages.patientId, patientId)).orderBy(desc(messages.createdAt)),
      this.db.select().from(dailyReports).where(eq(dailyReports.patientId, patientId)).orderBy(desc(dailyReports.reportDate)),
      this.db.select().from(vitalSigns).where(eq(vitalSigns.patientId, patientId)).orderBy(desc(vitalSigns.recordedAt)),
      this.db.select({
        id: patientNotes.id,
        content: patientNotes.content,
        eventType: patientNotes.eventType,
        eventDate: patientNotes.eventDate,
        createdAt: patientNotes.createdAt,
        doctorName: users.fullName,
      })
        .from(patientNotes)
        .leftJoin(users, eq(patientNotes.doctorId, users.id))
        .where(and(eq(patientNotes.patientId, patientId), eq(patientNotes.isDeleted, false)))
        .orderBy(desc(patientNotes.eventDate), desc(patientNotes.createdAt)),
      this.db.select().from(diseases).where(eq(diseases.patientId, patientId)),
      this.db.select().from(medications).where(eq(medications.patientId, patientId)),
      this.db.select().from(allergies).where(eq(allergies.patientId, patientId)),
    ])

    if (patient.length === 0) return { patient: null, events: [] }

    for (const v of visitsList) {
      events.push({
        id: v.id,
        type: 'visit',
        date: toDateStr(v.visitDate) || toDateStr(v.createdAt),
        title: `ویزیت — ${v.visitType || 'عمومی'}`,
        summary: v.visitReason || v.notes || '',
        details: { visitType: v.visitType, status: v.status, duration: v.durationMinutes, nextVisit: v.nextVisitDate },
        color: '#4F46E5',
        icon: 'stethoscope',
      })
    }

    for (const a of appointmentsList) {
      events.push({
        id: a.id,
        type: 'appointment',
        date: toDateStr(a.appointmentDate) || toDateStr(a.createdAt),
        title: `نوبت — ${a.startTime || ''}`,
        summary: `وضعیت: ${a.status || 'pending'}`,
        details: { status: a.status, startTime: a.startTime, endTime: a.endTime },
        color: '#7C3AED',
        icon: 'calendar-clock',
      })
    }

    for (const p of prescriptionsList) {
      events.push({
        id: p.id,
        type: 'prescription',
        date: toDateStr(p.startDate) || toDateStr(p.createdAt),
        title: `نسخه — ${p.medicationName}`,
        summary: `${p.dosage || ''} ${p.frequency || ''} ${p.duration || ''}`.trim(),
        details: { dosage: p.dosage, frequency: p.frequency, route: p.route, duration: p.duration, instructions: p.instructions, isActive: p.isActive },
        color: '#059669',
        icon: 'pill',
      })
    }

    for (const lr of labResultsList) {
      events.push({
        id: lr.id,
        type: 'lab_result',
        date: toDateStr(lr.performedDate) || toDateStr(lr.createdAt),
        title: `آزمایش — ${lr.testName}`,
        summary: `${lr.value || ''} ${lr.unit || ''} ${lr.isAbnormal ? '⚠️ غیرعادی' : ''}`.trim(),
        details: { testName: lr.testName, value: lr.value, unit: lr.unit, referenceRangeLow: lr.referenceRangeLow, referenceRangeHigh: lr.referenceRangeHigh, isAbnormal: lr.isAbnormal, category: lr.category },
        color: lr.isAbnormal ? '#DC2626' : '#2563EB',
        icon: 'flask',
      })
    }

    for (const lo of labOrdersList) {
      events.push({
        id: lo.id,
        type: 'lab_order',
        date: toDateStr(lo.orderDate) || toDateStr(lo.createdAt),
        title: `درخواست آزمایش`,
        summary: lo.notes || `وضعیت: ${lo.status || 'pending'}`,
        details: { status: lo.status, notes: lo.notes },
        color: '#6366F1',
        icon: 'clipboard-list',
      })
    }

    for (const ss of screeningSchedulesList) {
      events.push({
        id: ss.id,
        type: 'screening',
        date: toDateStr(ss.dueDate) || toDateStr(ss.createdAt),
        title: `غربالگری — ${ss.screeningType || ''}`,
        summary: `وضعیت: ${ss.status || 'scheduled'}`,
        details: { screeningType: ss.screeningType, status: ss.status, notes: ss.notes },
        color: '#D97706',
        icon: 'shield-check',
      })
    }

    for (const sr of screeningResultsList) {
      events.push({
        id: sr.id,
        type: 'screening_result',
        date: toDateStr(sr.performedDate) || toDateStr(sr.createdAt),
        title: `نتیجه غربالگری — ${sr.screeningType || ''}`,
        summary: sr.result || sr.notes || '',
        details: { screeningType: sr.screeningType, result: sr.result, resultDetails: sr.resultDetails, nextDueDate: sr.nextDueDate },
        color: '#0891B2',
        icon: 'clipboard-check',
      })
    }

    for (const pg of pregnanciesList) {
      events.push({
        id: pg.id,
        type: 'pregnancy',
        date: toDateStr(pg.lmp) || toDateStr(pg.createdAt),
        title: `بارداری — ختم ${pg.gravidaIndex || ''}`,
        summary: `${pg.status || ''} ${pg.outcome || ''} ${pg.deliveryMethod || ''}`.trim(),
        details: { gravidaIndex: pg.gravidaIndex, status: pg.status, lmp: pg.lmp, edd: pg.edd, outcome: pg.outcome, deliveryMethod: pg.deliveryMethod },
        color: '#EC4899',
        icon: 'baby-face',
      })
    }

    for (const vc of vaccinationsList) {
      events.push({
        id: vc.id,
        type: 'vaccination',
        date: toDateStr(vc.dateAdministered),
        title: `واکسن — ${vc.vaccineName}`,
        summary: `دوز ${vc.doseNumber || ''} ${vc.status || ''}`.trim(),
        details: { vaccineName: vc.vaccineName, doseNumber: vc.doseNumber, manufacturer: vc.manufacturer, lotNumber: vc.lotNumber, nextDoseDate: vc.nextDoseDate },
        color: '#10B981',
        icon: 'needle',
      })
    }

    for (const ca of assessmentsList) {
      events.push({
        id: ca.id,
        type: 'assessment',
        date: toDateStr(ca.createdAt),
        title: `ارزیابی بالینی — ${ca.assessmentType || ''}`,
        summary: ca.notes || '',
        details: { assessmentType: ca.assessmentType, result: ca.result },
        color: '#8B5CF6',
        icon: 'clipboard-search',
      })
    }

    for (const b of billingList) {
      events.push({
        id: b.id,
        type: 'billing',
        date: toDateStr(b.billedDate) || toDateStr(b.createdAt),
        title: `صورتحساب — ${b.description || ''}`,
        summary: `${b.amount || 0} تومان — ${b.status || 'pending'}`,
        details: { amount: b.amount, status: b.status, insuranceClaimAmount: b.insuranceClaimAmount, patientPayAmount: b.patientPayAmount },
        color: '#F59E0B',
        icon: 'wallet',
      })
    }

    for (const m of messagesList) {
      events.push({
        id: m.id,
        type: 'message',
        date: toDateStr(m.createdAt),
        title: `پیام — ${m.subject || ''}`,
        summary: m.body || '',
        details: { subject: m.subject, isRead: m.isRead, isConfidential: m.isConfidential },
        color: '#6B7280',
        icon: 'chat',
      })
    }

    for (const dr of dailyReportsList) {
      events.push({
        id: dr.id,
        type: 'daily_report',
        date: toDateStr(dr.reportDate) || toDateStr(dr.createdAt),
        title: `گزارش روزانه`,
        summary: dr.notes || '',
        details: { visitTypes: dr.visitTypes, procedures: dr.procedures, feeCollected: dr.feeCollected, paymentMethod: dr.paymentMethod },
        color: '#374151',
        icon: 'file-text',
      })
    }

    for (const vs of vitalSignsList) {
      events.push({
        id: vs.id,
        type: 'vital_signs',
        date: toDateStr(vs.recordedAt),
        title: `علائم حیاتی`,
        summary: `BP: ${vs.bloodPressureSystolic || '-'}/${vs.bloodPressureDiastolic || '-'} | HR: ${vs.heartRate || '-'} | Temp: ${vs.temperatureCelsius || '-'}`,
        details: { systolicBp: vs.bloodPressureSystolic, diastolicBp: vs.bloodPressureDiastolic, heartRate: vs.heartRate, respiratoryRate: vs.respiratoryRate, temperature: vs.temperatureCelsius, oxygenSaturation: vs.oxygenSaturation, weight: vs.weightKg, height: vs.heightCm, bmi: vs.bmi },
        color: '#EF4444',
        icon: 'heart-pulse',
      })
    }

    for (const n of notesList) {
      events.push({
        id: n.id,
        type: 'note',
        date: toDateStr(n.eventDate) || toDateStr(n.createdAt),
        title: `یادداشت — ${n.doctorName || ''}`,
        summary: n.content,
        details: { eventType: n.eventType, doctorName: n.doctorName },
        color: '#F97316',
        icon: 'note-text',
      })
    }

    for (const d of diseasesList) {
      events.push({
        id: d.id,
        type: 'disease',
        date: toDateStr(d.diagnosedAt),
        title: `بیماری — ${d.name}`,
        summary: `تشخیص: ${d.name}`,
        details: { name: d.name },
        color: '#B91C1C',
        icon: 'alert-circle',
      })
    }

    for (const m of medicationsList) {
      events.push({
        id: m.id,
        type: 'medication',
        date: null,
        title: `دارو — ${m.name}`,
        summary: m.dosage || '',
        details: { name: m.name, dosage: m.dosage },
        color: '#15803D',
        icon: 'pill',
      })
    }

    for (const a of allergiesList) {
      events.push({
        id: a.id,
        type: 'allergy',
        date: null,
        title: `آلرژی — ${a.substance}`,
        summary: `شدت: ${a.severity || 'نامشخص'}`,
        details: { substance: a.substance, severity: a.severity },
        color: '#DC2626',
        icon: 'alert-triangle',
      })
    }

    // Sort by date descending (newest first), nulls at end
    events.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    // Filter by date range if provided
    let filtered = events
    if (options?.from) {
      filtered = filtered.filter(e => e.date && new Date(e.date) >= new Date(options.from!))
    }
    if (options?.to) {
      filtered = filtered.filter(e => e.date && new Date(e.date) <= new Date(options.to!))
    }
    if (options?.types && options.types.length > 0) {
      filtered = filtered.filter(e => options.types!.includes(e.type))
    }

    return {
      patient: {
        id: patient[0].id,
        firstName: patient[0].firstName,
        lastName: patient[0].lastName,
        nationalId: patient[0].nationalId,
        phone: patient[0].phone,
        birthDate: patient[0].birthDate,
      },
      events: filtered,
      totalCount: filtered.length,
    }
  }
}

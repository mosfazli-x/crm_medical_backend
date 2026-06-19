import type { DB } from '../../db/client'
import { pregnancies, prenatalVisits, fetalMeasurements, postpartumCarePlans } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { PrenatalVisitDto, FetalMeasurementDto, PostpartumCarePlanDto } from './pregnancy.schema'

function toPgDate(d: string | null | undefined): string | null {
  return d || null
}

export class PregnancyEnhancedService {
  constructor(private db: DB) {}

  async getPrenatalVisits(pregnancyId: string) {
    return this.db
      .select()
      .from(prenatalVisits)
      .where(eq(prenatalVisits.pregnancyId, pregnancyId))
      .orderBy(prenatalVisits.gestationalAgeWeeks)
  }

  async createPrenatalVisit(dto: PrenatalVisitDto) {
    const [preg] = await this.db
      .select({ id: pregnancies.id })
      .from(pregnancies)
      .where(eq(pregnancies.id, dto.pregnancy_id))
      .limit(1)
    if (!preg) throw new NotFoundError('Pregnancy')

    const [visit] = await this.db
      .insert(prenatalVisits)
      .values({
        pregnancyId: dto.pregnancy_id,
        gestationalAgeWeeks: dto.gestational_age_weeks,
        gestationalAgeDays: dto.gestational_age_days ?? 0,
        visitDate: new Date(dto.visit_date),
        bloodPressureSystolic: dto.blood_pressure_systolic || null,
        bloodPressureDiastolic: dto.blood_pressure_diastolic || null,
        weightKg: dto.weight_kg ? String(dto.weight_kg) : null,
        fundalHeightCm: dto.fundal_height_cm ? String(dto.fundal_height_cm) : null,
        fetalHeartRate: dto.fetal_heart_rate || null,
        urineProtein: dto.urine_protein || null,
        urineGlucose: dto.urine_glucose || null,
        presentation: dto.presentation || null,
        engaged: dto.engaged ?? null,
        cervicalDilation: dto.cervical_dilation ? String(dto.cervical_dilation) : null,
        cervicalEffacement: dto.cervical_effacement || null,
        contractions: dto.contractions || null,
        edema: dto.edema || null,
        varicoseVeins: dto.varicose_veins ?? false,
        fetalMovements: dto.fetal_movements || null,
        labTestsOrdered: dto.lab_tests_ordered || [],
        medicationsPrescribed: dto.medications_prescribed || [],
        notes: dto.notes || null,
        plan: dto.plan || null,
      })
      .returning()
    return visit
  }

  async updatePrenatalVisit(id: string, dto: Partial<PrenatalVisitDto>) {
    const updates: Record<string, unknown> = {}
    if (dto.visit_date !== undefined) updates.visitDate = new Date(dto.visit_date)
    if (dto.gestational_age_weeks !== undefined) updates.gestationalAgeWeeks = dto.gestational_age_weeks
    if (dto.blood_pressure_systolic !== undefined) updates.bloodPressureSystolic = dto.blood_pressure_systolic
    if (dto.blood_pressure_diastolic !== undefined) updates.bloodPressureDiastolic = dto.blood_pressure_diastolic
    if (dto.weight_kg !== undefined) updates.weightKg = String(dto.weight_kg)
    if (dto.fundal_height_cm !== undefined) updates.fundalHeightCm = String(dto.fundal_height_cm)
    if (dto.fetal_heart_rate !== undefined) updates.fetalHeartRate = dto.fetal_heart_rate
    if (dto.urine_protein !== undefined) updates.urineProtein = dto.urine_protein
    if (dto.presentation !== undefined) updates.presentation = dto.presentation
    if (dto.engaged !== undefined) updates.engaged = dto.engaged
    if (dto.cervical_dilation !== undefined) updates.cervicalDilation = String(dto.cervical_dilation)
    if (dto.notes !== undefined) updates.notes = dto.notes
    if (dto.plan !== undefined) updates.plan = dto.plan

    const [updated] = await this.db
      .update(prenatalVisits)
      .set(updates)
      .where(eq(prenatalVisits.id, id))
      .returning()
    if (!updated) throw new NotFoundError('Prenatal visit')
    return updated
  }

  async deletePrenatalVisit(id: string) {
    const [deleted] = await this.db
      .delete(prenatalVisits)
      .where(eq(prenatalVisits.id, id))
      .returning()
    if (!deleted) throw new NotFoundError('Prenatal visit')
    return deleted
  }

  async getFetalMeasurements(pregnancyId: string) {
    return this.db
      .select()
      .from(fetalMeasurements)
      .where(eq(fetalMeasurements.pregnancyId, pregnancyId))
      .orderBy(fetalMeasurements.measurementDate)
  }

  async createFetalMeasurement(dto: FetalMeasurementDto) {
    const [preg] = await this.db
      .select({ id: pregnancies.id })
      .from(pregnancies)
      .where(eq(pregnancies.id, dto.pregnancy_id))
      .limit(1)
    if (!preg) throw new NotFoundError('Pregnancy')

    const [measurement] = await this.db
      .insert(fetalMeasurements)
      .values({
        pregnancyId: dto.pregnancy_id,
        prenatalVisitId: dto.prenatal_visit_id || null,
        measurementDate: new Date(dto.measurement_date),
        gestationalAgeWeeks: dto.gestational_age_weeks || null,
        gestationalAgeDays: dto.gestational_age_days || null,
        biparietalDiameterMm: dto.biparietal_diameter_mm ? String(dto.biparietal_diameter_mm) : null,
        femurLengthMm: dto.femur_length_mm ? String(dto.femur_length_mm) : null,
        abdominalCircumferenceMm: dto.abdominal_circumference_mm ? String(dto.abdominal_circumference_mm) : null,
        headCircumferenceMm: dto.head_circumference_mm ? String(dto.head_circumference_mm) : null,
        estimatedFetalWeightG: dto.estimated_fetal_weight_g ? String(dto.estimated_fetal_weight_g) : null,
        amnioticFluidIndex: dto.amniotic_fluid_index ? String(dto.amniotic_fluid_index) : null,
        placentaPosition: dto.placenta_position || null,
        placentaGrade: dto.placenta_grade || null,
        umbilicalArteryPI: dto.umbilical_artery_pi ? String(dto.umbilical_artery_pi) : null,
        notes: dto.notes || null,
      })
      .returning()
    return measurement
  }

  async deleteFetalMeasurement(id: string) {
    const [deleted] = await this.db
      .delete(fetalMeasurements)
      .where(eq(fetalMeasurements.id, id))
      .returning()
    if (!deleted) throw new NotFoundError('Fetal measurement')
    return deleted
  }

  async getPostpartumCarePlan(pregnancyId: string) {
    const [plan] = await this.db
      .select()
      .from(postpartumCarePlans)
      .where(eq(postpartumCarePlans.pregnancyId, pregnancyId))
      .limit(1)
    return plan || null
  }

  async upsertPostpartumCarePlan(dto: PostpartumCarePlanDto) {
    const [existing] = await this.db
      .select({ id: postpartumCarePlans.id })
      .from(postpartumCarePlans)
      .where(eq(postpartumCarePlans.pregnancyId, dto.pregnancy_id))
      .limit(1)

    const values = {
      pregnancyId: dto.pregnancy_id,
      patientId: dto.patient_id,
      ppdScreeningDate: toPgDate(dto.ppd_screening_date),
      epdsScore: dto.epds_score || null,
      breastfeedingStatus: dto.breastfeeding_status || null,
      breastfeedingChallenges: dto.breastfeeding_challenges || null,
      contraceptionCounseling: dto.contraception_counseling ?? false,
      contraceptionMethod: dto.contraception_method || null,
      perinealWoundHealing: dto.perineal_wound_healing || null,
      csWoundHealing: dto.cs_wound_healing || null,
      lochiaStatus: dto.lochia_status || null,
      moodAssessment: dto.mood_assessment || null,
      followUpDate: toPgDate(dto.follow_up_date),
      notes: dto.notes || null,
    }

    if (existing) {
      const [updated] = await this.db
        .update(postpartumCarePlans)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(postpartumCarePlans.id, existing.id))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(postpartumCarePlans)
      .values(values)
      .returning()
    return created
  }
}
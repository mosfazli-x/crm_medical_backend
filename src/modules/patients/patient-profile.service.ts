import type { DB } from '../../db/client'
import {
  patients, diseases, medications, allergies, visits, pregnancies, attachments,
  menstrualHistory, sexualHistory, gynecologicalSurgeries, contraceptiveHistory,
  familyHistory, reproductiveSummary, prenatalVisits, fetalMeasurements, postpartumCarePlans,
  screeningSchedules, screeningResults, labResults, consentRecords
} from '../../db/schema'
import { eq, desc, inArray, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import { getInsuranceInfo } from '../../shared/constants/insurance'

export interface PatientProfile {
  basicInfo: any
  medicalHistory: {
    diseases: any[]
    medications: any[]
    allergies: any[]
  }
  reproductiveHealth: {
    menstrualHistory: any
    sexualHistory: any
    surgeries: any[]
    contraceptives: any[]
    familyHistory: any[]
    summary: any
  }
  obstetricHistory: {
    pregnancies: any[]
    prenatalVisits: any[]
    fetalMeasurements: any[]
    postpartumCare: any
  }
  visits: any[]
  screenings: {
    schedules: any[]
    results: any[]
  }
  labResults: any[]
  consents: any[]
  attachments: {
    ultrasound: any[]
    lab: any[]
    prescription: any[]
    other: any[]
  }
}

export class PatientProfileService {
  constructor(private db: DB) {}

  async getPatientProfile(patientId: string): Promise<PatientProfile> {
    const patientData = await this.db.transaction(async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(eq(patients.id, patientId))

      if (!patient) throw new NotFoundError('Patient')

      const [diseasesList, medicationsList, allergiesList] = await Promise.all([
        tx.select().from(diseases).where(eq(diseases.patientId, patientId)),
        tx.select().from(medications).where(eq(medications.patientId, patientId)),
        tx.select().from(allergies).where(eq(allergies.patientId, patientId)),
      ])

      const [mh, sh, surgeries, contraceptives, famHistory, rs] = await Promise.all([
        tx.select().from(menstrualHistory).where(eq(menstrualHistory.patientId, patientId)).limit(1),
        tx.select().from(sexualHistory).where(eq(sexualHistory.patientId, patientId)).limit(1),
        tx.select().from(gynecologicalSurgeries).where(eq(gynecologicalSurgeries.patientId, patientId))
          .orderBy(sql`${gynecologicalSurgeries.surgeryDate} DESC NULLS LAST`),
        tx.select().from(contraceptiveHistory).where(eq(contraceptiveHistory.patientId, patientId))
          .orderBy(sql`${contraceptiveHistory.startDate} DESC NULLS LAST`),
        tx.select().from(familyHistory).where(eq(familyHistory.patientId, patientId)),
        tx.select().from(reproductiveSummary).where(eq(reproductiveSummary.patientId, patientId)).limit(1),
      ])

      const pregnanciesList = await tx
        .select()
        .from(pregnancies)
        .where(eq(pregnancies.patientId, patientId))
        .orderBy(pregnancies.gravidaIndex)

      const pregnancyIds = pregnanciesList.map((p) => p.id)

      let prenatalVisitsList: typeof prenatalVisits.$inferSelect[] = []
      let fetalMeasurementsList: typeof fetalMeasurements.$inferSelect[] = []
      let postpartumCareResult: (typeof postpartumCarePlans.$inferSelect)[] = []

      if (pregnancyIds.length > 0) {
        [prenatalVisitsList, fetalMeasurementsList, postpartumCareResult] = await Promise.all([
          tx
            .select()
            .from(prenatalVisits)
            .where(inArray(prenatalVisits.pregnancyId, pregnancyIds))
            .orderBy(desc(prenatalVisits.visitDate)),
          tx
            .select()
            .from(fetalMeasurements)
            .where(inArray(fetalMeasurements.pregnancyId, pregnancyIds))
            .orderBy(desc(fetalMeasurements.measurementDate)),
          tx
            .select()
            .from(postpartumCarePlans)
            .where(inArray(postpartumCarePlans.pregnancyId, pregnancyIds))
            .limit(1),
        ])
      }

      const visitsList = await tx
        .select()
        .from(visits)
        .where(eq(visits.patientId, patientId))
        .orderBy(desc(visits.visitDate))

      const [screeningSchedulesList, screeningResultsList] = await Promise.all([
        tx.select().from(screeningSchedules).where(eq(screeningSchedules.patientId, patientId))
          .orderBy(desc(screeningSchedules.dueDate)),
        tx.select().from(screeningResults).where(eq(screeningResults.patientId, patientId))
          .orderBy(desc(screeningResults.performedDate)),
      ])

      const labResultsList = await tx
        .select()
        .from(labResults)
        .where(eq(labResults.patientId, patientId))
        .orderBy(desc(labResults.performedDate))

      const consentsList = await tx
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.patientId, patientId))
        .orderBy(desc(consentRecords.grantedAt))

      const attachmentsList = await tx
        .select()
        .from(attachments)
        .where(eq(attachments.patientId, patientId))

      const groupedAttachments = {
        ultrasound: attachmentsList.filter((f) => f.fileType === 'ultrasound'),
        lab: attachmentsList.filter((f) => f.fileType === 'lab'),
        prescription: attachmentsList.filter((f) => f.fileType === 'prescription'),
        other: attachmentsList.filter((f) => !['ultrasound', 'lab', 'prescription'].includes(f.fileType)),
      }

      return {
        basicInfo: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          nationalId: patient.nationalId,
          insuranceCode: patient.insuranceCode,
          insuranceType: patient.insuranceType,
          insuranceInfo: getInsuranceInfo(patient.insuranceType),
          birthDate: patient.birthDate,
          phone: patient.phone,
          address: patient.address,
          maritalStatus: patient.maritalStatus,
          smoking: patient.smoking,
          bmi: patient.bmi,
          exercise: patient.exercise,
          alcohol: patient.alcohol,
          confidentialNotes: patient.confidentialNotes,
          createdAt: patient.createdAt,
          updatedAt: patient.updatedAt,
        },
        medicalHistory: {
          diseases: diseasesList,
          medications: medicationsList,
          allergies: allergiesList,
        },
        reproductiveHealth: {
          menstrualHistory: mh[0] || null,
          sexualHistory: sh[0] || null,
          surgeries,
          contraceptives,
          familyHistory: famHistory,
          summary: rs[0] || null,
        },
        obstetricHistory: {
          pregnancies: pregnanciesList,
          prenatalVisits: prenatalVisitsList,
          fetalMeasurements: fetalMeasurementsList,
          postpartumCare: postpartumCareResult[0] || null,
        },
        visits: visitsList,
        screenings: {
          schedules: screeningSchedulesList,
          results: screeningResultsList,
        },
        labResults: labResultsList,
        consents: consentsList,
        attachments: groupedAttachments,
      }
    })

    return patientData
  }
}
# Patient Profile Consolidation - Frontend Integration Guide

## Overview
This guide explains how to use the new consolidated patient profile endpoint that replaces multiple separate API calls with a single, efficient request.

## New Endpoint

### GET `/api/patients/:id/profile`

**Purpose:** Retrieve complete patient information in a single API call

**Authentication:** Requires `admin_doctor` or `doctor` role

**Example Request:**
```typescript
const response = await fetch('/api/patients/123e4567-e89b-12d3-a456-426614174000/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const { success, data } = await response.json()
```

## Response Structure

The response contains all patient information organized into logical sections:

```typescript
{
  "success": true,
  "data": {
    "basicInfo": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "nationalId": "string",
      "insuranceCode": "string | null",
      "insuranceType": "string | null",
      "insuranceInfo": {
        "key": "string",
        "label": "string",
        "logo": "string"
      },
      "birthDate": "string | null",
      "phone": "string | null",
      "address": "string | null",
      "maritalStatus": "string | null",
      "smoking": "string | null",
      "bmi": "string | null",
      "exercise": "string | null",
      "alcohol": "string | null",
      "confidentialNotes": "string | null",
      "createdAt": "string",
      "updatedAt": "string"
    },
    "medicalHistory": {
      "diseases": [
        {
          "id": "uuid",
          "name": "string",
          "diagnosedAt": "string | null",
          "isActive": "boolean | null",
          "notes": "string | null"
        }
      ],
      "medications": [
        {
          "id": "uuid",
          "name": "string",
          "dosage": "string | null",
          "isCurrent": "boolean | null",
          "notes": "string | null"
        }
      ],
      "allergies": [
        {
          "id": "uuid",
          "substance": "string",
          "severity": "string | null",
          "createdAt": "string"
        }
      ]
    },
    "reproductiveHealth": {
      "menstrualHistory": {
        "id": "uuid",
        "patientId": "uuid",
        "menarcheAge": "number | null",
        "cycleLength": "number | null",
        "cycleLengthMax": "number | null",
        "flowDuration": "number | null",
        "flowSeverity": "string | null",
        "lmpDate": "string | null",
        "dysmenorrheaSeverity": "string | null",
        "dysmenorrheaVAS": "number | null",
        "pmsPmdd": "string | null",
        "intermenstrualBleeding": "boolean",
        "notes": "string | null",
        "updatedAt": "string"
      } | null,
      "sexualHistory": {
        "id": "uuid",
        "patientId": "uuid",
        "isActive": "boolean | null",
        "partnersCount": "number | null",
        "dyspareunia": "string | null",
        "dyspareuniaNotes": "string | null",
        "notes": "string | null",
        "updatedAt": "string"
      } | null,
      "surgeries": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "surgeryType": "string",
          "surgeryDate": "string | null",
          "hospital": "string | null",
          "surgeonName": "string | null",
          "indication": "string | null",
          "findings": "string | null",
          "notes": "string | null",
          "createdAt": "string"
        }
      ],
      "contraceptives": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "method": "string",
          "startDate": "string | null",
          "endDate": "string | null",
          "isCurrent": "boolean",
          "reasonForDiscontinuation": "string | null",
          "notes": "string | null",
          "createdAt": "string"
        }
      ],
      "familyHistory": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "relationship": "string",
          "condition": "string",
          "ageAtDiagnosis": "number | null",
          "isDeceased": "boolean",
          "notes": "string | null",
          "createdAt": "string"
        }
      ],
      "summary": {
        "id": "uuid",
        "patientId": "uuid",
        "gravida": "number",
        "para": "number",
        "abortions": "number",
        "ectopics": "number",
        "liveBirths": "number",
        "pretermBirths": "number",
        "stillbirths": "number",
        "cesareanSections": "number",
        "vaginalDeliveries": "number",
        "updatedAt": "string"
      } | null
    },
    "obstetricHistory": {
      "pregnancies": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "gravidaIndex": "number | null",
          "status": "string",
          "lmp": "string | null",
          "edd": "string | null",
          "endDate": "string | null",
          "gestationalAgeWeeks": "number | null",
          "gestationalAgeDays": "number | null",
          "outcome": "string | null",
          "deliveryMethod": "string | null",
          "anesthesiaType": "string | null",
          "maternalComplications": "array",
          "prenatalScreenings": "object",
          "newbornsDetails": "array",
          "notes": "string | null",
          "createdAt": "string",
          "updatedAt": "string"
        }
      ],
      "prenatalVisits": [
        {
          "id": "uuid",
          "pregnancyId": "uuid",
          "gestationalAgeWeeks": "number",
          "gestationalAgeDays": "number",
          "visitDate": "string",
          "bloodPressureSystolic": "number | null",
          "bloodPressureDiastolic": "number | null",
          "weightKg": "string | null",
          "fundalHeightCm": "string | null",
          "fetalHeartRate": "number | null",
          "urineProtein": "string | null",
          "urineGlucose": "string | null",
          "presentation": "string | null",
          "engaged": "boolean | null",
          "cervicalDilation": "string | null",
          "cervicalEffacement": "number | null",
          "contractions": "string | null",
          "edema": "string | null",
          "varicoseVeins": "boolean",
          "fetalMovements": "string | null",
          "labTestsOrdered": "array",
          "medicationsPrescribed": "array",
          "notes": "string | null",
          "plan": "string | null",
          "createdAt": "string"
        }
      ],
      "fetalMeasurements": [
        {
          "id": "uuid",
          "pregnancyId": "uuid",
          "prenatalVisitId": "uuid | null",
          "measurementDate": "string",
          "gestationalAgeWeeks": "number | null",
          "gestationalAgeDays": "number | null",
          "biparietalDiameterMm": "string | null",
          "femurLengthMm": "string | null",
          "abdominalCircumferenceMm": "string | null",
          "headCircumferenceMm": "string | null",
          "estimatedFetalWeightG": "string | null",
          "amnioticFluidIndex": "string | null",
          "placentaPosition": "string | null",
          "placentaGrade": "string | null",
          "umbilicalArteryPI": "string | null",
          "notes": "string | null",
          "createdAt": "string"
        }
      ],
      "postpartumCare": {
        "id": "uuid",
        "pregnancyId": "uuid",
        "patientId": "uuid",
        "ppdScreeningDate": "string | null",
        "epdsScore": "number | null",
        "breastfeedingStatus": "string | null",
        "breastfeedingChallenges": "string | null",
        "contraceptionCounseling": "boolean",
        "contraceptionMethod": "string | null",
        "perinealWoundHealing": "string | null",
        "csWoundHealing": "string | null",
        "lochiaStatus": "string | null",
        "moodAssessment": "string | null",
        "followUpDate": "string | null",
        "notes": "string | null",
        "createdAt": "string",
        "updatedAt": "string"
      } | null
    },
    "visits": [
      {
        "id": "uuid",
        "patientId": "uuid",
        "doctorId": "uuid | null",
        "visitType": "string | null",
        "visitReason": "string | null",
        "notes": "string | null",
        "visitDate": "string",
        "durationMinutes": "number",
        "status": "string",
        "reminderSent": "boolean",
        "nextVisitDate": "string | null",
        "createdAt": "string"
      }
    ],
    "screenings": {
      "schedules": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "screeningType": "string",
          "dueDate": "string",
          "status": "string",
          "riskLevel": "string | null",
          "assignedToId": "uuid | null",
          "notes": "string | null",
          "createdAt": "string",
          "updatedAt": "string"
        }
      ],
      "results": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "screeningType": "string",
          "performedDate": "string",
          "result": "string | null",
          "resultDetails": "object | null",
          "providerId": "uuid | null",
          "facilityName": "string | null",
          "notes": "string | null",
          "nextDueDate": "string | null",
          "createdAt": "string"
        }
      ]
    },
    "labResults": [
      {
        "id": "uuid",
        "patientId": "uuid",
        "category": "string",
        "testName": "string",
        "testCode": "string | null",
        "value": "string",
        "unit": "string | null",
        "referenceRangeLow": "string | null",
        "referenceRangeHigh": "string | null",
        "isAbnormal": "boolean | null",
        "performedDate": "string",
        "performedBy": "string | null",
        "notes": "string | null",
        "createdAt": "string"
      }
    ],
    "consents": [
      {
        "id": "uuid",
        "patientId": "uuid",
        "consentType": "string",
        "isGranted": "boolean",
        "grantedAt": "string",
        "revokedAt": "string | null",
        "expiresAt": "string | null",
        "grantedById": "uuid | null",
        "notes": "string | null",
        "createdAt": "string"
      }
    ],
    "attachments": {
      "ultrasound": [
        {
          "id": "uuid",
          "patientId": "uuid",
          "fileType": "string",
          "fileName": "string",
          "filePath": "string",
          "createdAt": "string"
        }
      ],
      "lab": [...],
      "prescription": [...],
      "other": [...]
    }
  }
}
```

## Migration Guide: From Multiple Calls to Single Call

### ❌ OLD APPROACH (Multiple API Calls)

```typescript
// Before: 7+ separate API calls
const [patient, diseases, medications, allergies, reproductive, obstetric, attachments] = 
  await Promise.all([
    fetch(`/api/patients/${id}`).then(r => r.json()),
    fetch(`/api/reproductive/${id}/bundle`).then(r => r.json()),
    fetch(`/api/pregnancy/${id}/prenatal-visits`).then(r => r.json()),
    fetch(`/api/pregnancy/${id}/fetal-measurements`).then(r => r.json()),
    fetch(`/api/pregnancy/${id}/postpartum-care`).then(r => r.json()),
    fetch(`/api/visits?patientId=${id}`).then(r => r.json()),
    fetch(`/api/screening?patientId=${id}`).then(r => r.json()),
    fetch(`/api/lab-results?patientId=${id}`).then(r => r.json()),
    fetch(`/api/consent?patientId=${id}`).then(r => r.json()),
  ])

// Complex data merging required
const patientData = {
  ...patient.data,
  diseases: diseases.data,
  medications: medications.data,
  // ... more merging
}
```

### ✅ NEW APPROACH (Single API Call)

```typescript
// After: Single API call
const response = await fetch(`/api/patients/${id}/profile`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const { success, data } = await response.json()

// All data is already organized and ready to use
const {
  basicInfo,
  medicalHistory,
  reproductiveHealth,
  obstetricHistory,
  visits,
  screenings,
  labResults,
  consents,
  attachments
} = data
```

## Implementation Examples

### Example 1: React Component

```typescript
import { useState, useEffect } from 'react'

interface PatientProfile {
  basicInfo: any
  medicalHistory: any
  reproductiveHealth: any
  obstetricHistory: any
  visits: any[]
  screenings: any
  labResults: any[]
  consents: any[]
  attachments: any
}

function PatientProfilePage({ patientId }: { patientId: string }) {
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPatientProfile()
  }, [patientId])

  const loadPatientProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/patients/${patientId}/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const result = await response.json()
      
      if (result.success) {
        setProfile(result.data)
      } else {
        setError('Failed to load patient profile')
      }
    } catch (err) {
      setError('Error loading patient profile')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!profile) return <div>No profile found</div>

  return (
    <div className="patient-profile">
      {/* Basic Info Section */}
      <section>
        <h2>Basic Information</h2>
        <div>
          <p>Name: {profile.basicInfo.firstName} {profile.basicInfo.lastName}</p>
          <p>National ID: {profile.basicInfo.nationalId}</p>
          <p>Phone: {profile.basicInfo.phone}</p>
          <p>Insurance: {profile.basicInfo.insuranceInfo?.label}</p>
        </div>
      </section>

      {/* Medical History Section */}
      <section>
        <h2>Medical History</h2>
        
        <div>
          <h3>Diseases</h3>
          {profile.medicalHistory.diseases.map(disease => (
            <div key={disease.id}>
              <p>{disease.name} - {disease.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          ))}
        </div>

        <div>
          <h3>Medications</h3>
          {profile.medicalHistory.medications.map(med => (
            <div key={med.id}>
              <p>{med.name} - {med.dosage}</p>
            </div>
          ))}
        </div>

        <div>
          <h3>Allergies</h3>
          {profile.medicalHistory.allergies.map(allergy => (
            <div key={allergy.id}>
              <p>{allergy.substance} - Severity: {allergy.severity}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reproductive Health Section */}
      <section>
        <h2>Reproductive Health</h2>
        
        {profile.reproductiveHealth.menstrualHistory && (
          <div>
            <h3>Menstrual History</h3>
            <p>Menarche Age: {profile.reproductiveHealth.menstrualHistory.menarcheAge}</p>
            <p>Cycle Length: {profile.reproductiveHealth.menstrualHistory.cycleLength} days</p>
            <p>LMP: {profile.reproductiveHealth.menstrualHistory.lmpDate}</p>
          </div>
        )}

        <div>
          <h3>Surgeries</h3>
          {profile.reproductiveHealth.surgeries.map(surgery => (
            <div key={surgery.id}>
              <p>{surgery.surgeryType} - {surgery.surgeryDate}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Obstetric History Section */}
      <section>
        <h2>Obstetric History</h2>
        
        <div>
          <h3>Pregnancies</h3>
          {profile.obstetricHistory.pregnancies.map(preg => (
            <div key={preg.id}>
              <p>Pregnancy #{preg.gravidaIndex} - Status: {preg.status}</p>
              <p>EDD: {preg.edd}</p>
              <p>Outcome: {preg.outcome}</p>
            </div>
          ))}
        </div>

        <div>
          <h3>Recent Visits</h3>
          {profile.obstetricHistory.prenatalVisits.slice(0, 5).map(visit => (
            <div key={visit.id}>
              <p>{visit.visitDate} - GA: {visit.gestationalAgeWeeks}w {visit.gestationalAgeDays}d</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visits Section */}
      <section>
        <h2>Visit History</h2>
        {profile.visits.map(visit => (
          <div key={visit.id}>
            <p>{visit.visitDate} - {visit.visitType}</p>
            <p>Status: {visit.status}</p>
          </div>
        ))}
      </section>

      {/* Attachments Section */}
      <section>
        <h2>Attachments</h2>
        
        {profile.attachments.ultrasound.length > 0 && (
          <div>
            <h3>Ultrasounds</h3>
            {profile.attachments.ultrasound.map(file => (
              <div key={file.id}>
                <a href={file.filePath} target="_blank" rel="noopener noreferrer">
                  {file.fileName}
                </a>
              </div>
            ))}
          </div>
        )}

        {profile.attachments.lab.length > 0 && (
          <div>
            <h3>Lab Results</h3>
            {profile.attachments.lab.map(file => (
              <div key={file.id}>
                <a href={file.filePath} target="_blank" rel="noopener noreferrer">
                  {file.fileName}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default PatientProfilePage
```

### Example 2: Vue.js Component

```vue
<template>
  <div v-if="profile" class="patient-profile">
    <section>
      <h2>Basic Information</h2>
      <p>Name: {{ profile.basicInfo.firstName }} {{ profile.basicInfo.lastName }}</p>
      <p>National ID: {{ profile.basicInfo.nationalId }}</p>
    </section>

    <section>
      <h2>Medical History</h2>
      <div v-for="disease in profile.medicalHistory.diseases" :key="disease.id">
        {{ disease.name }}
      </div>
    </section>
  </div>
  <div v-else>Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const profile = ref(null)

onMounted(async () => {
  const patientId = route.params.id
  const response = await fetch(`/api/patients/${patientId}/profile`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  
  const result = await response.json()
  if (result.success) {
    profile.value = result.data
  }
})
</script>
```

### Example 3: Angular Service

```typescript
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'

export interface PatientProfile {
  basicInfo: any
  medicalHistory: any
  reproductiveHealth: any
  obstetricHistory: any
  visits: any[]
  screenings: any
  labResults: any[]
  consents: any[]
  attachments: any
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private baseUrl = '/api/patients'

  constructor(private http: HttpClient) {}

  getPatientProfile(patientId: string): Observable<{ success: boolean; data: PatientProfile }> {
    return this.http.get<{ success: boolean; data: PatientProfile }>(
      `${this.baseUrl}/${patientId}/profile`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    )
  }
}

// Component usage
@Component({
  selector: 'app-patient',
  template: `
    <div *ngIf="profile">
      <h2>{{ profile.basicInfo.firstName }} {{ profile.basicInfo.lastName }}</h2>
    </div>
  `
})
export class PatientComponent implements OnInit {
  profile: PatientProfile | null = null

  constructor(private patientService: PatientService, private route: ActivatedRoute) {}

  ngOnInit() {
    const patientId = this.route.snapshot.paramMap.get('id')!
    this.patientService.getPatientProfile(patientId).subscribe(result => {
      if (result.success) {
        this.profile = result.data
      }
    })
  }
}
```

## Benefits of New Structure

### 1. **Performance**
- **Before:** 7-10 API calls = 7-10 network round trips
- **After:** 1 API call = 1 network round trip
- **Result:** 70-90% reduction in API calls

### 2. **Data Consistency**
- All data retrieved in a single database transaction
- No risk of data inconsistency between calls
- Atomic operation ensures data integrity

### 3. **Simplified Code**
- No complex data merging from multiple sources
- Single source of truth for patient data
- Easier to maintain and debug

### 4. **Better UX**
- Faster page loads (single request)
- No loading spinners for multiple sections
- Smoother user experience

### 5. **Reduced Server Load**
- Fewer database queries
- Better connection pooling
- Lower server resource usage

## Backward Compatibility

All existing endpoints remain functional:
- `GET /api/patients/:id` - Still works
- `GET /api/reproductive/:id/bundle` - Still works
- `GET /api/pregnancy/*` - Still works
- All other existing endpoints - Still work

You can migrate gradually:
1. Start using `/profile` for new features
2. Keep old endpoints for existing features
3. Migrate old features when convenient

## TypeScript Types

```typescript
// Export these types in your frontend for type safety
export interface PatientProfile {
  basicInfo: {
    id: string
    firstName: string
    lastName: string
    nationalId: string
    insuranceCode: string | null
    insuranceType: string | null
    insuranceInfo: {
      key: string
      label: string
      logo: string
    }
    birthDate: string | null
    phone: string | null
    address: string | null
    maritalStatus: string | null
    smoking: string | null
    bmi: string | null
    exercise: string | null
    alcohol: string | null
    confidentialNotes: string | null
    createdAt: string
    updatedAt: string
  }
  medicalHistory: {
    diseases: Array<{
      id: string
      name: string
      diagnosedAt: string | null
      isActive: boolean | null
      notes: string | null
    }>
    medications: Array<{
      id: string
      name: string
      dosage: string | null
      isCurrent: boolean | null
      notes: string | null
    }>
    allergies: Array<{
      id: string
      substance: string
      severity: string | null
      createdAt: string
    }>
  }
  reproductiveHealth: {
    menstrualHistory: any | null
    sexualHistory: any | null
    surgeries: any[]
    contraceptives: any[]
    familyHistory: any[]
    summary: any | null
  }
  obstetricHistory: {
    pregnancies: any[]
    prenatalVisits: any[]
    fetalMeasurements: any[]
    postpartumCare: any | null
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

// API Response type
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}
```

## Error Handling

```typescript
async function loadPatientProfile(patientId: string) {
  try {
    const response = await fetch(`/api/patients/${patientId}/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const result: ApiResponse<PatientProfile> = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to load profile')
    }

    if (result.success) {
      return result.data
    } else {
      throw new Error(result.error || 'Unknown error')
    }
  } catch (error) {
    console.error('Error loading patient profile:', error)
    throw error
  }
}
```

## Testing

```typescript
// Test the new endpoint
describe('Patient Profile API', () => {
  it('should return complete patient profile', async () => {
    const response = await fetch('/api/patients/test-id/profile', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })

    const result = await response.json()
    
    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.basicInfo).toBeDefined()
    expect(result.data.medicalHistory).toBeDefined()
    expect(result.data.reproductiveHealth).toBeDefined()
    expect(result.data.obstetricHistory).toBeDefined()
    expect(result.data.visits).toBeDefined()
    expect(result.data.screenings).toBeDefined()
    expect(result.data.labResults).toBeDefined()
    expect(result.data.consents).toBeDefined()
    expect(result.data.attachments).toBeDefined()
  })
})
```

## Questions?

If you have questions about implementing this in your frontend, please refer to:
1. The API response structure above
2. The implementation examples
3. The TypeScript types provided

The new endpoint is fully backward compatible, so you can migrate at your own pace.
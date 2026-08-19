/**
 * Comprehensive system knowledge for AI support.
 * This is injected into the LLM system prompt so the AI can answer
 * any question about the CRM system accurately.
 */

export function getSystemKnowledgeDoc(): string {
  return `
## MEDICAL CLINIC CRM SYSTEM — COMPLETE REFERENCE

This is a bilingual (Farsi/English) medical clinic CRM system built with:
- Frontend: Nuxt 3 + Vue 3 + Vuetify 3 + TailwindCSS
- Backend: Express + TypeScript + Drizzle ORM + PostgreSQL
- AI: Gemini API (primary) + Groq/Llama (fallback) for AI support chat
- Auth: JWT-based with role-based access control

---

### USER ROLES (6 roles, strict hierarchy)

1. **admin_doctor** — Full system access. Can manage users, staff, settings, finances, clinical data, and all other modules.
2. **doctor** — Clinical access: calendar, scheduling, appointments, patients, prescriptions, lab results, medical history, messaging, daily reports, consumables, attendance, scheduling.
3. **pharmacy** — Prescriptions (view/update status), inventory, lab results (view), messaging.
4. **lab** — Lab results (upload/update), lab-test-programs, lab-result-templates, patients (view), messaging.
5. **patient** — Limited access: patient profile, my-record, messaging, AI support chat.
6. **clinic_staff** — Scheduling only.

---

### NAVIGATION GROUPS & PAGES

**Main (all users):**
- /dashboard — Dashboard with widgets and statistics
- /my-profile — User's own profile settings

**Clinical (doctor, admin_doctor):**
- /calendar — Appointment calendar (doctor-centric, filterable)
- /scheduling — Today's schedule for a specific doctor (date + doctor dropdown)
- /appointments — Appointment list management
- /visit-types — Configure visit types and their durations
- /clinical-tools — Clinical calculator tools
- /screening — Patient screening/assessment tools
- /lab-results — Lab results (doctors see their patients' results)
- /prescriptions — Prescription management (doctors create, pharmacy updates status)

**Patients (doctor, admin_doctor):**
- /patients — Patient list with medical records
- /leads — Lead management (potential patients from marketing)
- /lead-sources — Configure where leads come from (admin only)

**Communication:**
- /messaging — Internal staff messaging (admin_doctor, doctor, lab, pharmacy)
- /patient/messaging — Patient-facing messaging (patient role only)

**Management (admin_doctor primarily):**
- /users — System user management
- /staff — Staff directory management
- /attendance — Employee attendance tracking
- /schedule — Personal schedule view
- /admin/schedule — Admin schedule management (assign schedules to staff)
- /admin/settings — System settings (SMS templates, clinic info, tariff categories)
- /admin/audit — Audit logs (who changed what)
- /admin/faq-management — FAQ management for AI support

**Finance (admin_doctor primarily):**
- /billing — Patient billing and payments
- /inventory — Drug inventory management
- /accounting — Financial accounting reports
- /consumables — Medical supply tracking
- /daily-reports — Daily clinic operation reports

---

### KEY FEATURES & WORKFLOWS

**Patient Management:**
- Patient profiles with: fullName, age, gender, phone, insurance info, allergyAlerts, pregnancyStatus
- Medical history tracking (chronological per patient)
- Medical history fields: dynamic key-value pairs with medical categories (yes/no/numeric/free text)
- Pregnancy history, vaccination tracking, reproductive health tabs
- Family planning status tracking
- Lab results attached to patients (per-doctor filtered)

**Appointment System:**
- Appointments linked to patient + doctor + visitType + tariff
- Visit types define appointment durations and pricing categories
- Calendar view shows appointments on date-based grid
- Scheduling shows today's appointments for a specific doctor

**Prescription Workflow:**
- Doctor creates prescription → pharmacy sees it → pharmacy marks as dispensed
- Prescriptions contain medications (medicineName, dosage, frequency, duration, instructions)
- Handwriting OCR available for medication entry

**Lab Results Workflow:**
- Lab staff uploads results → doctor sees them for their patients
- Results contain: test name, value, unit, reference range, status (normal/abnormal/critical)
- Lab result templates for standardized test programs
- Handwriting OCR available for lab result entry

**Lead Management (Marketing):**
- Leads are potential patients from various sources
- Lead sources configurable (Facebook ads, referrals, etc.)
- Lead statuses: new, contacted, qualified, converted, lost
- Pipeline view for tracking conversion
- Follow-up tasks with dates

**Messaging:**
- Real-time internal messaging between staff roles
- Patient messaging (separate system for patient ↔ clinic communication)
- Role-based filtering (doctors see only their patients' messages)

**Financial Systems:**
- Billing: create invoices, track payments, insurance claims
- Inventory: drug stock management with minimum stock alerts
- Accounting: financial reports and summaries
- Consumables: medical supply tracking with low-stock alerts

**AI Support:**
- FAQ system with 119 entries (bilingual Farsi/English)
- Gemini AI primary, Groq fallback
- Questions are searched against FAQ first (high confidence → direct answer)
- Lower confidence → AI generates answer with FAQ context
- All AI → fails → escalated to Telegram admin group
- User feedback loop: helpful → creates draft FAQ for admin approval
- Admin can manage/publish FAQ entries

**Handwriting OCR:**
- Pen icons on text input fields open handwriting dialog
- Camera captures handwriting → OCR extracts text → inserts into field
- Numeric mode for number-only fields (lab values, quantities)
- Available on: patient forms, prescriptions, lab results, tasks, lead forms, messaging

**Other Features:**
- Dark/light theme toggle
- Farsi/English language switch
- Tutorial system for new users
- Audit logging (all changes tracked)
- Role-based menu visibility
- Responsive design (mobile + desktop)
- RTL support for Farsi

---

### COMMON USER QUESTIONS & ACCURATE ANSWERS

**Q: How do I add a new patient?**
A: Go to Patients page → click "Add Patient" button → fill in required fields (fullName, phone, age, gender) → save. You can add medical history, prescriptions, and lab results from the patient's detail page.

**Q: How do I create a prescription?**
A: Go to Prescriptions page → click "Create Prescription" → select patient → add medications with name, dosage, frequency, and duration → save. The pharmacy will see it in their prescription list.

**Q: How do I record lab results?**
A: Go to Lab Results page → click "Add Result" → select patient → enter test name, value, unit, and reference range → save. You can also use handwriting OCR (pen icon) for manual entry.

**Q: How do I schedule an appointment?**
A: Go to Calendar → click on a date/time slot → select patient and visit type → save. Or go to Appointments page for a list view.

**Q: How do I use handwriting OCR?**
A: Look for the pen icon (draw-pen) on text input fields. Click it → allow camera access → write on the paper shown → tap "Capture" → the system will extract your handwriting and fill the field. For numbers, the numeric mode is available.

**Q: How do I manage my schedule?**
A: Go to Schedule page to see your personal schedule. Admins can go to Admin Schedule to assign schedules to staff members.

**Q: How do I track leads?**
A: Go to Leads page → see the pipeline view → update lead status as you progress (new → contacted → qualified → converted). You can add notes and set follow-up dates.

**Q: How do I manage inventory?**
A: Go to Inventory page → view current stock levels → update quantities when stock arrives or is used. Set minimum stock levels to get alerts.

**Q: How do I view reports?**
A: Go to Daily Reports for daily operation summaries. Accounting page shows financial reports. Dashboard has overview widgets.

**Q: How do I change my password?**
A: Go to My Profile page → click "Change Password" → enter current and new password → save.

**Q: I can't see a page in the menu.**
A: Menu items are role-based. If you can't see a page, your role may not have access. Contact your admin to request access.

**Q: How do I switch language?**
A: Click the globe icon in the top-right corner → select Farsi or English. The entire interface switches.

**Q: How do I enable dark mode?**
A: Click the sun/moon icon in the top-right corner to toggle between light and dark themes.

**Q: How do I send a message to a colleague?**
A: Go to Messaging page → select the recipient → type your message → send. Only staff roles can use internal messaging.

**Q: How do I contact AI support?**
A: Click the FAQ/Support widget at the bottom-right of any page → type your question → the AI will answer. If the AI can't help, it escalates to admin.

**Q: Where are my attendance records?**
A: Go to Attendance page to see your check-in/check-out records. Admins can manage attendance for all staff.

**Q: How do I add a new user/staff?**
A: Admins only: Go to Users page → "Add User" → fill details and assign role. Or go to Staff for staff directory management.

**Q: What are visit types?**
A: Visit types define appointment categories (e.g., "Consultation", "Follow-up") with durations and pricing. Configure them at Visit Types page.

**Q: How do I use clinical tools?**
A: Go to Clinical Tools page for medical calculators (BMI, dosage calculators, etc.).

**Q: How do screening work?**
A: Go to Screening page to run patient screening assessments. Select patient and screening type.

**Q: How do I manage billing?**
A: Go to Billing page → create invoices for patients → track payments → manage insurance claims.

**Q: What is the daily report?**
A: Daily Reports shows summary of clinic operations each day: appointments, revenue, patient visits, staff attendance.

**Q: How do I track consumables?**
A: Go to Consumables page to track medical supplies usage and stock levels.

**Q: How do I set up SMS notifications?**
A: Admins: Go to Admin Settings → configure SMS templates for appointment reminders, follow-ups, etc.

**Q: What is the audit log?**
A: Audit Logs track all changes in the system — who changed what and when. Admins can view at Admin Audit page.

**Q: How do I update a prescription status?**
A: Pharmacy role: Go to Prescriptions → find the prescription → update status (pending → dispensed).

**Q: How do I upload lab results?**
A: Lab role: Go to Lab Results → click "Add Result" → select patient → enter test details → upload.

**Q: Can patients see my messages?**
A: No. Staff messaging is separate from patient messaging. Patients have their own messaging portal.

**Q: How do I check if I have access to a feature?**
A: Check the sidebar menu. If a menu item isn't visible, your role doesn't have access. Contact your admin.

**Q: How do I add a lead source?**
A: Admins only: Go to Lead Sources → add new source (e.g., "Facebook Ads", "Referral") → configure tracking.

**Q: How do I use the pipeline view?**
A: Leads page has a pipeline/kanban view showing leads by status (new → contacted → qualified → converted → lost). Drag and drop or click to update status.

**Q: How do I filter lab results by doctor?**
A: Lab Results page has a doctor filter dropdown. Select a doctor to see only their patients' results.

**Q: How do I use pregnancy tracking?**
A: Patient profile has a Pregnancy tab showing pregnancy history and status. Update during visits.

**Q: How do I track vaccinations?**
A: Patient profile has a Vaccination tab. Add vaccination records with date, type, and batch number.

**Q: How do I set minimum stock levels?**
A: Inventory page → edit a drug item → set minimumStock field → system alerts when stock falls below this level.

**Q: How do I view financial reports?**
A: Accounting page shows revenue, expenses, and profit reports. Daily Reports has day-by-day breakdown.

**Q: How do I manage insurance claims?**
A: Billing page → create invoice → select insurance type → submit claim → track status.

**Q: What happens if AI can't answer my question?**
A: The system escalates to Telegram admin group. An admin will respond. You can also try rephrasing your question.

**Q: How do I approve AI-generated FAQ entries?**
A: Admins: Go to FAQ Management page → review pending entries → approve or reject.

**Q: How do I edit FAQ entries?**
A: Admins: Go to FAQ Management → select entry → edit question/answer → save.

**Q: How do I add a new FAQ entry?**
A: Admins: Go to FAQ Management → "Add FAQ" → enter question and answer in Farsi and/or English → save.

**Q: Can the AI answer clinical medical questions?**
A: No. The AI is for system support only (how to use the CRM). Clinical questions are outside its scope.

**Q: How do I use the handwriting feature on my phone?**
A: Tap the pen icon on any text field → allow camera → place paper with handwriting in view → tap Capture → text appears in field.

**Q: How do I set up my clinic information?**
A: Admins: Go to Admin Settings → update clinic name, address, phone, and other details.

**Q: How do I manage visit type pricing?**
A: Admins: Go to Visit Types → set tariff category and pricing for each visit type.
`
}

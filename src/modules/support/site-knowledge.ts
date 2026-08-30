/**
 * Public website knowledge for AI support.
 * Covers the patient-facing website (landing, booking, blog, screening,
 * auth, Telegram mini app) so the AI can answer visitor/patient questions.
 * Persian labels are included inline so Farsi queries retrieve these chunks.
 */

export function getSiteKnowledgeDoc(): string {
  return `
## PUBLIC WEBSITE — HASTI HOSSEINI CLINIC (کلینیک هستی حسینی)

The public website is bilingual (Farsi/English, RTL supported) and serves a
women's aesthetic medicine practice in Tehran. Consultations are by appointment.

### PAGES & ROUTES

- / — Landing page (صفحه اصلی): brand intro, primary navigation rail with links to Appointment Booking (/booking), Account Login (/auth/login), Tutorials, Blog (/blog), About Us (/about). Footer notes "Consultations by appointment".
- /about — About Us (درباره ما): practice philosophy ("one patient at a time"), team, services, visit info, contact details.
- /booking — Online Appointment Booking (رزرو نوبت آنلاین).
- /blog and /blog/[slug] — Blog (وبلاگ): medical articles and health journal with categories; readers can comment (comments are reviewed/approved by admins before appearing).
- /screening — Health screening/assessment entry point.
- /auth/login — Patient portal login (ورود). /auth/register — registration (ثبت‌نام). /auth/forgot-password and /auth/reset-password — password reset via SMS one-time password.
- /tg/* — Telegram Mini App pages: home, appointments, booking, profile.

### SERVICES (خدمات)

1. Facial Harmonisation (هارمونی صورت) — injectables, contour and profile balancing.
2. Regenerative Skin Medicine (پوست بازساختی) — PRP, polynucleotides, biostimulators.
3. Laser & Light (لیزر) — pigment, vascular and resurfacing programmes.
4. Women's Intimate Health (سلامت زنان) — non-surgical restorative protocols.
5. Medical Skincare (مراقبت پوست) — prescription-grade, individually formulated.
6. Longevity Consultations (مشاوره طول عمر) — preventive, whole-face planning over years.

Positioning: board certified, absolute privacy, bespoke protocols; waiting room is never shared (buffer time between patients).

### TEAM (تیم)

- Dr. Hasti Hosseini — Clinic Director · Aesthetic Physician (founder, board certified).
- Dr. Leyla Amini — Associate Aesthetic Physician (injectables, skin-quality medicine).
- Nasrin Farhadi, RN — Lead Clinical Nurse (treatment safety, laser protocols, aftercare).
- Sara Mehrabi — Patient Care Director (scheduling, discretion, continuity of care).

### CONTACT & HOURS (تماس و ساعات کاری)

- Phone/WhatsApp: +98 21 8800 4120
- Email: care@hastihosseini.clinic
- Address: No. 24, Farmanieh Boulevard, Tehran 1938713, Iran (فرمانیه)
- Instagram: @hastihosseiniclinic · LinkedIn: Hasti Hosseini Clinic · Telegram: @hhclinic
- Hours: Saturday–Wednesday 09:00–20:00; Thursday 09:00–14:00; Friday by private appointment.

### ONLINE BOOKING FLOW (فرآیند رزرو نوبت)

Step-by-step wizard with 5 steps: Service (انتخاب خدمت) → Doctor (انتخاب پزشک) → Date (تاریخ) → Time (ساعت) → Visitor Info (اطلاعات بیمار).

Required visitor information:
- First name and last name (نام و نام خانوادگی) — required.
- National ID (کد ملی) — exactly 10 digits, no dashes.
- Mobile number (شماره موبایل) — Iranian format like 09123456789.

After "Confirm & Book" the appointment request is registered and sent for doctor approval; the patient sees a success message stating the request will be confirmed after the doctor approves. Visit types define duration (minutes) and price shown in Toman. If a day shows no slots, try another day. If a doctor has no visit types defined, booking is unavailable for that doctor.

### ACCOUNTS & PATIENT PORTAL (حساب کاربری)

- Login uses phone number + password. New registrations may be "pending" until an administrator approves them.
- Forgot Password: enter registered phone number → receive OTP via SMS → set new password.
- Patients can message the clinic from the patient portal messaging page.
- The Telegram Mini App mirrors core patient features: view appointments, book, manage profile.

### SUPPORT ESCALATION

If the AI assistant cannot answer, the question escalates to the clinic's admin team via Telegram and the user is told they will receive an answer. Users can also contact the clinic directly via phone/email above.
`
}

import type { PatientProfile } from './patient-profile.service'

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '—'
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function faNum(n: number | null | undefined): string {
  if (n == null) return '—'
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  return String(n).replace(/\d/g, (d) => fa[+d])
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('fa-IR')
  } catch {
    return '—'
  }
}

function section(id: string, title: string, icon: string, content: string): string {
  return `
    <section class="section" id="${id}">
      <div class="section-header">
        <span class="section-icon">${icon}</span>
        <h2 class="section-title">${title}</h2>
      </div>
      <div class="section-body">${content}</div>
    </section>`
}

function kvGrid(items: { label: string; value: string; ltr?: boolean }[]): string {
  return `<div class="kv-grid">
    ${items.map((i) => `
      <div class="kv-item">
        <span class="kv-label">${i.label}</span>
        <span class="kv-value${i.ltr ? ' ltr' : ''}">${escapeHtml(i.value)}</span>
      </div>`).join('')}
  </div>`
}

function dataTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '<p class="empty-note">داده‌ای ثبت نشده است.</p>'
  return `<div class="table-wrap"><table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`
}

export function buildFullRecordHtml(profile: PatientProfile, generatedAt: string): string {
  const b = profile.basicInfo
  const m = profile.medicalHistory
  const r = profile.reproductiveHealth
  const o = profile.obstetricHistory

  const sections: string[] = []

  // ── Basic Info ──
  sections.push(section('basic-info', 'اطلاعات هویتی و شناسایی', '📋', kvGrid([
    { label: 'نام و نام خانوادگی', value: `${b.firstName || ''} ${b.lastName || ''}` },
    { label: 'کد ملی', value: b.nationalId, ltr: true },
    { label: 'شماره تماس', value: b.phone, ltr: true },
    { label: 'تاریخ تولد', value: formatDate(b.birthDate) },
    { label: 'وضعیت تأهل', value: b.maritalStatus || '—' },
    { label: 'آدرس', value: b.address },
  ])))

  // ── Insurance ──
  sections.push(section('insurance', 'اطلاعات بیمه‌ای', '🏥', kvGrid([
    { label: 'نوع بیمه', value: b.insuranceType || '—' },
    { label: 'کد بیمه', value: b.insuranceCode, ltr: true },
  ])))

  // ── Lifestyle ──
  const lifestyleItems: { label: string; value: string }[] = []
  if (b.smoking != null) lifestyleItems.push({ label: 'استعمال دخانیات', value: b.smoking ? 'بله' : 'خیر' })
  if (b.alcohol != null) lifestyleItems.push({ label: 'مصرف الکل', value: b.alcohol ? 'بله' : 'خیر' })
  if (b.exercise) lifestyleItems.push({ label: 'فعالیت بدنی', value: b.exercise })
  if (b.bmi) lifestyleItems.push({ label: 'شاخص توده بدنی (BMI)', value: String(b.bmi) })
  if (lifestyleItems.length > 0) {
    sections.push(section('lifestyle', 'سبک زندگی', '🏃', kvGrid(lifestyleItems)))
  }

  // ── Medical History: Diseases ──
  sections.push(section('diseases', 'سابقه بیماری‌ها', '🩺',
    dataTable(
      ['نام بیماری', 'تاریخ تشخیص', 'وضعیت', 'توضیحات'],
      (m.diseases || []).map((d: any) => [
        d.name,
        formatDate(d.diagnosedAt),
        d.isActive ? 'فعال' : 'غیرفعال',
        d.notes || '',
      ])
    )
  ))

  // ── Medications ──
  sections.push(section('medications', 'داروها', '💊',
    dataTable(
      ['نام دارو', 'دوز', 'وضعیت', 'توضیحات'],
      (m.medications || []).map((d: any) => [
        d.name,
        d.dosage || '',
        d.isCurrent ? 'فعلی' : ' سابق',
        d.notes || '',
      ])
    )
  ))

  // ── Allergies ──
  sections.push(section('allergies', 'آلرژی‌ها', '⚠️',
    dataTable(
      ['ماده آلرژن', 'شدت'],
      (m.allergies || []).map((a: any) => [a.substance, a.severity || ''])
    )
  ))

  // ── Vaccinations ──
  sections.push(section('vaccinations', 'سابقه واکسیناسیون', '💉',
    dataTable(
      ['نام واکسن', 'دوز', 'تاریخ', ' Lot', 'سازنده', 'محل تزریق', 'وضعیت'],
      (m.vaccinations || []).map((v: any) => [
        v.vaccineName,
        v.doseNumber != null ? `#${v.doseNumber}` : '',
        formatDate(v.dateAdministered),
        v.lotNumber || '',
        v.manufacturer || '',
        v.site || '',
        v.status || '',
      ])
    )
  ))

  // ── Reproductive Health: Menstrual History ──
  if (r.menstrualHistory) {
    const mh = r.menstrualHistory
    sections.push(section('menstrual', 'تاریخچه قاعدگی', '🩸', kvGrid([
      { label: 'سن بلوغ', value: mh.menarcheAge != null ? `${faNum(mh.menarcheAge)} سال` : '—' },
      { label: 'طول دوره', value: mh.cycleLength != null ? `${faNum(mh.cycleLength)} روز` : '—' },
      { label: 'مدت خونریزی', value: mh.flowDuration != null ? `${faNum(mh.flowDuration)} روز` : '—' },
      { label: 'شدت خونریزی', value: mh.flowSeverity || '—' },
      { label: 'آخرین قاعدگی', value: formatDate(mh.lmpDate) },
      { label: 'دیسمنوره', value: mh.dysmenorrhea != null ? (mh.dysmenorrhea ? 'بله' : 'خیر') : '—' },
      { label: 'PMS/PMDD', value: mh.pmsPmdd != null ? (mh.pmsPmdd ? 'بله' : 'خیر') : '—' },
      { label: 'خونریزی بین‌قاعدگی', value: mh.intermenstrualBleeding != null ? (mh.intermenstrualBleeding ? 'بله' : 'خیر') : '—' },
      { label: 'توضیحات', value: mh.notes },
    ])))
  }

  // ── Sexual History ──
  if (r.sexualHistory) {
    const sh = r.sexualHistory
    sections.push(section('sexual', 'تاریخچه جنسی', '🔞', kvGrid([
      { label: 'فعالیت جنسی', value: sh.isActive != null ? (sh.isActive ? 'بله' : 'خیر') : '—' },
      { label: 'تعداد شرکای جنسی', value: sh.partnersCount != null ? faNum(sh.partnersCount) : '—' },
      { label: 'دیسپارونی', value: sh.dyspareunia != null ? (sh.dyspareunia ? 'بله' : 'خیر') : '—' },
      { label: 'توضیحات', value: sh.notes },
    ])))
  }

  // ── Gynecological Surgeries ──
  if (r.surgeries?.length) {
    sections.push(section('surgeries', 'جراحی‌های زنانه', '🔬',
      dataTable(
        ['نوع جراحی', 'تاریخ', 'بیمارستان', 'جراح', ' indications', 'یافته‌ها', 'توضیحات'],
        r.surgeries.map((s: any) => [
          s.surgeryType, formatDate(s.surgeryDate), s.hospital || '',
          s.surgeonName || '', s.indication || '', s.findings || '', s.notes || '',
        ])
      )
    ))
  }

  // ── Contraceptive History ──
  if (r.contraceptives?.length) {
    sections.push(section('contraceptives', 'سابقه روش‌های جلوگیری', '💊',
      dataTable(
        ['روش', 'تاریخ شروع', 'تاریخ پایان', 'فعلی', 'دلیل قطع', 'توضیحات'],
        r.contraceptives.map((c: any) => [
          c.method, formatDate(c.startDate), formatDate(c.endDate),
          c.isCurrent ? 'بله' : 'خیر',
          c.reasonForDiscontinuation || '', c.notes || '',
        ])
      )
    ))
  }

  // ── Family History ──
  if (r.familyHistory?.length) {
    sections.push(section('family-history', 'سابقه خانوادگی', '👨‍👩‍👧‍👦',
      dataTable(
        ['نسبت', 'بیماری', 'سن در تشخیص', 'فوت‌شده', 'توضیحات'],
        r.familyHistory.map((f: any) => [
          f.relationship, f.condition, f.ageAtDiagnosis != null ? `${faNum(f.ageAtDiagnosis)} سال` : '',
          f.isDeceased != null ? (f.isDeceased ? 'بله' : 'خیر') : '', f.notes || '',
        ])
      )
    ))
  }

  // ── Reproductive Summary ──
  if (r.summary) {
    const s = r.summary
    sections.push(section('repro-summary', 'خلاصه باروری', '🤰', kvGrid([
      { label: 'گراویدا', value: s.gravida != null ? faNum(s.gravida) : '—' },
      { label: 'پارا', value: s.para != null ? faNum(s.para) : '—' },
      { label: 'سقط', value: s.abortions != null ? faNum(s.abortions) : '—' },
      { label: 'خارج‌رحمی', value: s.ectopics != null ? faNum(s.ectopics) : '—' },
      { label: 'زایمان زنده', value: s.liveBirths != null ? faNum(s.liveBirths) : '—' },
      { label: 'زایمان زودرس', value: s.pretermBirths != null ? faNum(s.pretermBirths) : '—' },
      { label: 'مرگ جنین', value: s.stillbirths != null ? faNum(s.stillbirths) : '—' },
      { label: ' سزارین', value: s.cesareanSections != null ? faNum(s.cesareanSections) : '—' },
      { label: ' زایمان طبیعی', value: s.vaginalDeliveries != null ? faNum(s.vaginalDeliveries) : '—' },
    ])))
  }

  // ── Pregnancies ──
  if (o.pregnancies?.length) {
    sections.push(section('pregnancies', 'سابقه بارداری', '🤰',
      dataTable(
        ['هفته', 'وضعیت', 'Last Period', 'EDD', 'نتیجه', 'نحوه زایمان', 'بیهوشی', 'عوارض مادری', 'توضیحات'],
        o.pregnancies.map((p: any) => [
          `#${p.gravidaIndex}`,
          p.status || '',
          formatDate(p.lmp),
          formatDate(p.edd),
          p.outcome || '',
          p.deliveryMethod || '',
          p.anesthesiaType || '',
          Array.isArray(p.maternalComplications) ? p.maternalComplications.join(', ') : (p.maternalComplications || ''),
          p.notes || '',
        ])
      )
    ))
  }

  // ── Prenatal Visits ──
  if (o.prenatalVisits?.length) {
    sections.push(section('prenatal-visits', 'ویزیت‌های قبل از زایمان', '🩺',
      dataTable(
        ['هفته', 'تاریخ', 'فشار خون', 'وزن', 'ارتفاع رحم', 'ضربان قلب جنین', 'ارائه', 'توضیحات'],
        o.prenatalVisits.map((v: any) => [
          v.gestationalAgeWeeks != null ? `${faNum(v.gestationalAgeWeeks)}+${faNum(v.gestationalAgeDays)}` : '',
          formatDate(v.visitDate),
          [v.bloodPressureSystolic, v.bloodPressureDiagonal].filter(Boolean).join('/') || '',
          v.weightKg != null ? `${v.weightKg} kg` : '',
          v.fundalHeightCm != null ? `${v.fundalHeightCm} cm` : '',
          v.fetalHeartRate != null ? `${v.fetalHeartRate} bpm` : '',
          v.presentation || '',
          v.notes || '',
        ])
      )
    ))
  }

  // ── Fetal Measurements ──
  if (o.fetalMeasurements?.length) {
    sections.push(section('fetal', 'اندازه‌گیری جنین', '📈',
      dataTable(
        ['تاریخ', 'هفته', 'BPD', 'FL', 'AC', 'HC', 'EFW', 'AFI', 'جفت', 'شریان نافی'],
        o.fetalMeasurements.map((f: any) => [
          formatDate(f.measurementDate),
          f.gestationalAgeWeeks != null ? `${faNum(f.gestationalAgeWeeks)}+${faNum(f.gestationalAgeDays)}` : '',
          f.bpd || '', f.fl || '', f.ac || '', f.hc || '',
          f.efw || '', f.afi || '',
          f.placentaLocation || '',
          f.umbilicalArteryPI || '',
        ])
      )
    ))
  }

  // ── Postpartum Care ──
  if (o.postpartumCare) {
    const pc = o.postpartumCare
    sections.push(section('postpartum', 'مراقبت‌های پس از زایمان', '👶', kvGrid([
      { label: 'تاریخ غربالگری افسردگی', value: formatDate(pc.ppdScreeningDate) },
      { label: 'نمره EPDS', value: pc.epdsScore != null ? faNum(pc.epdsScore) : '—' },
      { label: 'شیردهی', value: pc.breastfeeding || '—' },
      { label: 'contraception', value: pc.contraception || '—' },
      { label: 'زخم', value: pc.wound || '—' },
      { label: 'لوشیا', value: pc.lochia || '—' },
      { label: 'خلق و خو', value: pc.mood || '—' },
      { label: 'تاریخ پیگیری', value: formatDate(pc.followUpDate) },
      { label: 'توضیحات', value: pc.notes },
    ])))
  }

  // ── Visits ──
  sections.push(section('visits', 'تاریخچه ویزیت‌ها', '📅',
    dataTable(
      ['تاریخ', 'نوع', 'دلیل', 'مدت', 'وضعیت', 'یادداشت'],
      (profile.visits || []).map((v: any) => [
        formatDate(v.visitDate),
        v.visitType || '',
        v.visitReason || '',
        v.durationMinutes != null ? `${faNum(v.durationMinutes)} دقیقه` : '',
        v.status || '',
        v.notes || '',
      ])
    )
  ))

  // ── Screenings ──
  const screens = profile.screenings || {}
  if (screens.schedules?.length || screens.results?.length) {
    let html = ''
    if (screens.schedules?.length) {
      html += '<h3 class="sub-heading">برنامه‌ریزی غربالگری</h3>'
      html += dataTable(
        ['نوع', 'سررسید', 'وضعیت', 'سطح خطر', 'مسئول', 'توضیحات'],
        screens.schedules.map((s: any) => [
          s.screeningType, formatDate(s.dueDate), s.status || '',
          s.riskLevel || '', s.assignedToId || '', s.notes || '',
        ])
      )
    }
    if (screens.results?.length) {
      html += '<h3 class="sub-heading">نتایج غربالگری</h3>'
      html += dataTable(
        ['نوع', 'تاریخ انجام', 'نتیجه', 'مرکز', 'توضیحات'],
        screens.results.map((s: any) => [
          s.screeningType, formatDate(s.performedDate),
          s.result || '', s.facilityName || '', s.notes || '',
        ])
      )
    }
    sections.push(section('screenings', 'غربالگری‌ها', '🔍', html))
  }

  // ── Lab Results ──
  sections.push(section('lab-results', 'نتایج آزمایشگاهی', '🧪',
    dataTable(
      ['دسته', 'نام آزمایش', 'مقدار', 'واحد', 'محدوده مرجع', 'غیرعادی', 'تاریخ'],
      (profile.labResults || []).map((l: any) => [
        l.category || '',
        l.testName || '',
        l.value || '',
        l.unit || '',
        [l.referenceRangeLow, l.referenceRangeHigh].filter(Boolean).join(' – ') || '',
        l.isAbnormal ? '⚠️ بله' : 'خیر',
        formatDate(l.performedDate),
      ])
    )
  ))

  // ── Consents ──
  if (profile.consents?.length) {
    sections.push(section('consents', 'رضایت‌نامه‌ها', '📝',
      dataTable(
        ['نوع رضایت', 'وضعیت', 'تاریخ اعطا', 'تاریخ انقضا', 'توضیحات'],
        profile.consents.map((c: any) => [
          c.consentType || '',
          c.isGranted ? 'اعطا شده' : 'لغو شده',
          formatDate(c.grantedAt),
          formatDate(c.expiresAt),
          c.notes || '',
        ])
      )
    ))
  }

  // ── Attachments ──
  const att = profile.attachments || {}
  const allAttachments = [
    ...(att.ultrasound || []).map((a: any) => ({ ...a, group: 'سونوگرافی' })),
    ...(att.lab || []).map((a: any) => ({ ...a, group: 'آزمایشگاه' })),
    ...(att.prescription || []).map((a: any) => ({ ...a, group: 'نسخه' })),
    ...(att.other || []).map((a: any) => ({ ...a, group: 'سایر' })),
  ]
  if (allAttachments.length) {
    sections.push(section('attachments', 'پیوست‌ها', '📎',
      dataTable(
        ['نام فایل', 'دسته‌بندی', 'نوع', 'اندازه'],
        allAttachments.map((a: any) => [
          a.fileName || '',
          a.group,
          a.mimeType || '',
          a.fileSize != null ? `${(a.fileSize / 1024).toFixed(1)} KB` : '',
        ])
      )
    ))
  }

  // ── Confidential Notes ──
  if (b.confidentialNotes) {
    sections.push(section('confidential', 'یادداشت‌های محرمانه', '🔒',
      `<div class="confidential-box"><p>${escapeHtml(b.confidentialNotes)}</p></div>`
    ))
  }

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>پرونده کامل بیمار — ${escapeHtml(b.firstName)} ${escapeHtml(b.lastName)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0;
    --text: #1e293b; --text-secondary: #64748b; --text-muted: #94a3b8;
    --accent: #3b82f6; --accent-light: #eff6ff;
    --danger: #ef4444; --success: #22c55e; --warning: #f59e0b;
    --radius: 12px; --shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Vazirmatn', 'Tahoma', sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.7; font-size: 14px;
    direction: rtl;
  }

  .container { max-width: 900px; margin: 0 auto; padding: 24px 20px; }

  /* Header */
  .record-header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #3b82f6 100%);
    color: white; border-radius: var(--radius); padding: 40px 36px;
    margin-bottom: 32px; position: relative; overflow: hidden;
  }
  .record-header::before {
    content: ''; position: absolute; top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .record-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; position: relative; }
  .record-header .subtitle { font-size: 14px; opacity: .85; position: relative; }
  .record-header .meta { margin-top: 16px; display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; opacity: .8; position: relative; }
  .record-header .meta span { display: flex; align-items: center; gap: 6px; }

  /* Actions bar */
  .actions-bar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
  }
  .actions-bar .clinic-name { font-size: 13px; color: var(--text-secondary); }

  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 8px; font-size: 13px;
    font-weight: 600; border: none; cursor: pointer;
    font-family: inherit; transition: all .15s;
  }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: #2563eb; }
  .btn-outline { background: white; color: var(--text); border: 1.5px solid var(--border); }
  .btn-outline:hover { border-color: var(--accent); color: var(--accent); }

  /* TOC */
  .toc {
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 24px 28px; margin-bottom: 32px;
    box-shadow: var(--shadow);
  }
  .toc h3 { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: var(--text-secondary); }
  .toc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
  .toc-grid a {
    font-size: 13px; color: var(--accent); text-decoration: none;
    padding: 4px 8px; border-radius: 6px; transition: background .15s;
  }
  .toc-grid a:hover { background: var(--accent-light); }

  /* Sections */
  .section {
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 20px;
    box-shadow: var(--shadow); overflow: hidden;
  }
  .section-header {
    display: flex; align-items: center; gap: 10px;
    padding: 16px 24px; border-bottom: 1px solid var(--border);
    background: #fafbfc;
  }
  .section-icon { font-size: 20px; }
  .section-title { font-size: 16px; font-weight: 700; }
  .section-body { padding: 20px 24px; }

  /* KV Grid */
  .kv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .kv-item { display: flex; flex-direction: column; gap: 2px; }
  .kv-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }
  .kv-value { font-size: 14px; font-weight: 600; color: var(--text); word-break: break-word; }
  .kv-value.ltr { direction: ltr; text-align: left; font-family: 'Courier New', monospace; }

  /* Tables */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: right; padding: 10px 14px; font-weight: 600;
    font-size: 12px; color: var(--text-secondary);
    background: #f8fafc; border-bottom: 2px solid var(--border);
    white-space: nowrap;
  }
  td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }

  .sub-heading { font-size: 14px; font-weight: 700; margin: 20px 0 10px; color: var(--text); }

  .empty-note { color: var(--text-muted); font-style: italic; text-align: center; padding: 20px; }

  .confidential-box {
    background: #fef2f2; border: 1px solid #fecaca;
    border-radius: 8px; padding: 16px; color: var(--danger);
  }

  /* Footer */
  .record-footer {
    text-align: center; padding: 24px; margin-top: 32px;
    font-size: 12px; color: var(--text-muted);
    border-top: 1px solid var(--border);
  }

  /* Print Styles */
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; font-size: 11px; }
    .container { max-width: 100%; padding: 0; margin: 0; }
    .record-header { border-radius: 0; padding: 24px; break-after: avoid; }
    .actions-bar, .no-print { display: none !important; }
    .section { break-inside: avoid; box-shadow: none; border: 1px solid #ddd; margin-bottom: 12px; }
    .section-body { padding: 12px 16px; }
    .toc { break-after: page; }
    table { font-size: 10px; }
    th, td { padding: 6px 8px; }
    .record-footer { position: fixed; bottom: 0; width: 100%; }
  }

  @page { margin: 1.5cm; size: A4; }
</style>
</head>
<body>
<div class="container">

  <div class="record-header">
    <h1>پرونده کامل بیمار</h1>
    <div class="subtitle">${escapeHtml(b.firstName)} ${escapeHtml(b.lastName)}</div>
    <div class="meta">
      <span>📋 کد ملی: ${escapeHtml(b.nationalId)}</span>
      ${b.phone ? `<span>📞 ${escapeHtml(b.phone)}</span>` : ''}
      <span>🎂 ${formatDate(b.birthDate)}</span>
    </div>
  </div>

  <div class="actions-bar no-print">
    <span class="clinic-name">سیستم مدیریت کلینیک</span>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary" onclick="window.print()">📥 دریافت PDF / چاپ</button>
      <button class="btn btn-outline" onclick="window.close()">✖ بستن</button>
    </div>
  </div>

  <nav class="toc">
    <h3>فهرست بخش‌ها</h3>
    <div class="toc-grid">
      <a href="#basic-info">اطلاعات هویتی</a>
      <a href="#insurance">بیمه</a>
      ${lifestyleItems.length ? '<a href="#lifestyle">سبک زندگی</a>' : ''}
      <a href="#diseases">بیماری‌ها</a>
      <a href="#medications">داروها</a>
      <a href="#allergies">آلرژی‌ها</a>
      <a href="#vaccinations">واکسن‌ها</a>
      ${r.menstrualHistory ? '<a href="#menstrual">قاعدگی</a>' : ''}
      ${r.sexualHistory ? '<a href="#sexual">تاریخچه جنسی</a>' : ''}
      ${r.surgeries?.length ? '<a href="#surgeries">جراحی‌ها</a>' : ''}
      ${r.contraceptives?.length ? '<a href="#contraceptives">جلوگیری</a>' : ''}
      ${r.familyHistory?.length ? '<a href="#family-history">سابقه خانوادگی</a>' : ''}
      ${r.summary ? '<a href="#repro-summary">خلاصه باروری</a>' : ''}
      ${o.pregnancies?.length ? '<a href="#pregnancies">بارداری</a>' : ''}
      ${o.prenatalVisits?.length ? '<a href="#prenatal-visits">ویزیت‌های بارداری</a>' : ''}
      ${o.fetalMeasurements?.length ? '<a href="#fetal">اندازه جنین</a>' : ''}
      ${o.postpartumCare ? '<a href="#postpartum">پس از زایمان</a>' : ''}
      <a href="#visits">ویزیت‌ها</a>
      <a href="#screenings">غربالگری</a>
      <a href="#lab-results">آزمایشات</a>
      ${profile.consents?.length ? '<a href="#consents">رضایت‌نامه</a>' : ''}
      ${allAttachments.length ? '<a href="#attachments">پیوست‌ها</a>' : ''}
      ${b.confidentialNotes ? '<a href="#confidential">محرمانه</a>' : ''}
    </div>
  </nav>

  ${sections.join('\n')}

  <div class="record-footer">
    <p>این پرونده به صورت خودکار در تاریخ ${generatedAt} تولید شده است.</p>
    <p>فقط برای استفاده پزشکی و بالینی — محرمانه</p>
  </div>

</div>
</body>
</html>`
}

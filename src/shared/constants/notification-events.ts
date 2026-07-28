/**
 * Notification event definitions.
 *
 * Each event has a unique key used in clinic_settings as:
 *   notif_sms_{key}    → 'true' | 'false'
 *   notif_tg_{key}     → 'true' | 'false'
 *
 * The admin panel reads/writes these to control per-event per-channel delivery.
 */

export interface NotificationEvent {
  key: string
  label: string
  description: string
  category: 'auth' | 'patient' | 'appointment' | 'messaging'
  channels: ('sms' | 'telegram')[]
  /** If true, this event is critical and cannot be fully disabled (e.g. OTP) */
  critical?: boolean
}

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  // ── Authentication ──
  {
    key: 'auth_register',
    label: 'خوش‌آمدگویی ثبت‌نام کاربر',
    description: 'ارسال پیام خوش‌آمدگویی هنگام ثبت‌نام جدید کاربر در سیستم',
    category: 'auth',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'auth_otp',
    label: 'کد تایید تغییر رمز',
    description: 'ارسال کد OTP برای بازیابی رمز عبور',
    category: 'auth',
    channels: ['sms'],
    critical: true,
  },

  // ── Patient Management ──
  {
    key: 'patient_create',
    label: 'خوش‌آمدگویی بیمار جدید',
    description: 'ارسال پیام خوش‌آمدگویی هنگام ثبت بیمار جدید توسط پزشک',
    category: 'patient',
    channels: ['sms', 'telegram'],
  },

  // ── Appointments ──
  {
    key: 'appointment_book',
    label: 'ثبت نوبت',
    description: 'اعلام ثبت موفق نوبت به بیمار',
    category: 'appointment',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'appointment_confirmed',
    label: 'تایید نوبت',
    description: 'اعلام تایید نوبت توسط پزشک به بیمار',
    category: 'appointment',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'appointment_rejected',
    label: 'رد نوبت',
    description: 'اعلام رد نوبت توسط پزشک به بیمار',
    category: 'appointment',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'appointment_manual_sms',
    label: 'پیامک دستی نوبت',
    description: 'ارسال پیامک دستی پزشک به بیمار از بخش نوبت‌ها',
    category: 'appointment',
    channels: ['sms', 'telegram'],
  },

  // ── Messaging ──
  {
    key: 'message_patient_to_doctor',
    label: 'پیام بیمار به پزشک',
    description: 'اعلام پیام جدید بیمار به پزشک',
    category: 'messaging',
    channels: ['sms', 'telegram'],
  },
  {
    key: 'message_doctor_to_patient',
    label: 'پیام پزشک به بیمار',
    description: 'اعلام پیام جدید پزشک به بیمار',
    category: 'messaging',
    channels: ['sms', 'telegram'],
  },
]

export const NOTIFICATION_CATEGORIES = [
  { key: 'auth', label: 'احراز هویت', icon: 'mdi-shield-lock', color: 'blue' },
  { key: 'patient', label: 'مدیریت بیمار', icon: 'mdi-account-group', color: 'green' },
  { key: 'appointment', label: 'نوبت‌دهی', icon: 'mdi-calendar-clock', color: 'orange' },
  { key: 'messaging', label: 'پیام‌رسانی', icon: 'mdi-message-text', color: 'purple' },
] as const

export function getSettingKeyForEvent(eventKey: string, channel: 'sms' | 'telegram'): string {
  return `notif_${channel}_${eventKey}`
}

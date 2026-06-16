export const INSURANCE_TYPES = {
  social_security: {
    key: 'social_security',
    label: 'تامین اجتماعی',
    logo: '/uploads/insurance-logos/social-security.svg',
  },
  health: {
    key: 'health',
    label: 'بیمه سلامت',
    logo: '/uploads/insurance-logos/health.svg',
  },
  armed_forces: {
    key: 'armed_forces',
    label: 'نیروهای مسلح',
    logo: '/uploads/insurance-logos/armed-forces.svg',
  },
  relief_committee: {
    key: 'relief_committee',
    label: 'کمیته امداد',
    logo: '/uploads/insurance-logos/relief-committee.svg',
  },
  iran: {
    key: 'iran',
    label: 'بیمه ایران',
    logo: '/uploads/insurance-logos/iran.svg',
  },
  supplementary: {
    key: 'supplementary',
    label: 'بیمه تکمیلی',
    logo: '/uploads/insurance-logos/supplementary.svg',
  },
  other: {
    key: 'other',
    label: 'سایر',
    logo: '/uploads/insurance-logos/other.svg',
  },
} as const

export type InsuranceTypeKey = keyof typeof INSURANCE_TYPES

export const INSURANCE_TYPE_KEYS = Object.keys(INSURANCE_TYPES) as InsuranceTypeKey[]

export const INSURANCE_TYPE_VALUES = Object.values(INSURANCE_TYPES)

export function getInsuranceInfo(key: string | null | undefined) {
  if (!key) return null
  return INSURANCE_TYPES[key as InsuranceTypeKey] || null
}

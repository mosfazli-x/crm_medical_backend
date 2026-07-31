import type { DB } from '../../db/client'
import { leadSources } from '../../db/schema'
import { asc, eq } from 'drizzle-orm'
import { NotFoundError, ConflictError } from '../../shared/errors'
import type { CreateLeadSourceDto, UpdateLeadSourceDto } from './lead-sources.schema'

const DEFAULT_SOURCES: Array<{
  name: string
  type: string
  category: string
  description: string
  color: string
  sortOrder: number
}> = [
  { name: 'Instagram', type: 'instagram', category: 'social', description: 'لیدهای ورودی از اینستاگرام', color: '#E1306C', sortOrder: 1 },
  { name: 'Google Ads', type: 'google_ads', category: 'paid_ads', description: 'لیدهای تبلیغات گوگل', color: '#4285F4', sortOrder: 2 },
  { name: 'Google Search', type: 'google_search', category: 'organic', description: 'جستجوی گوگل (سئو)', color: '#34A853', sortOrder: 3 },
  { name: 'Website', type: 'website', category: 'organic', description: 'فرم تماس وب‌سایت', color: '#FBBC05', sortOrder: 4 },
  { name: 'Referral', type: 'referral', category: 'referral', description: 'معرفی بیماران یا پزشکان', color: '#16A34A', sortOrder: 5 },
  { name: 'Walk-in', type: 'walk_in', category: 'direct', description: 'مراجعه حضوری', color: '#64748B', sortOrder: 6 },
  { name: 'WhatsApp', type: 'whatsapp', category: 'messaging', description: 'تماس از طریق واتساپ', color: '#25D366', sortOrder: 7 },
  { name: 'Telegram', type: 'telegram', category: 'messaging', description: 'تماس از طریق تلگرام', color: '#229ED9', sortOrder: 8 },
  { name: 'Phone Call', type: 'phone_call', category: 'direct', description: 'تماس تلفنی با کلینیک', color: '#0EA5E9', sortOrder: 9 },
]

export class LeadSourcesService {
  constructor(private db: DB) {}

  async ensureDefaults() {
    const [existing] = await this.db
      .select({ id: leadSources.id })
      .from(leadSources)
      .limit(1)

    if (existing) return

    await this.db.insert(leadSources).values(DEFAULT_SOURCES)
  }

  async findAll(includeInactive = false) {
    const query = this.db.select().from(leadSources)
    const filtered = includeInactive
      ? query
      : query.where(eq(leadSources.isActive, true))

    return filtered.orderBy(asc(leadSources.sortOrder), asc(leadSources.name))
  }

  async getById(id: string) {
    const [source] = await this.db
      .select()
      .from(leadSources)
      .where(eq(leadSources.id, id))
      .limit(1)

    if (!source) throw new NotFoundError('Lead source')
    return source
  }

  async create(dto: CreateLeadSourceDto) {
    const [existing] = await this.db
      .select({ id: leadSources.id })
      .from(leadSources)
      .where(eq(leadSources.name, dto.name))
      .limit(1)

    if (existing) throw new ConflictError('Lead source with this name already exists')

    const [source] = await this.db
      .insert(leadSources)
      .values({
        name: dto.name,
        type: dto.type,
        category: dto.category ?? 'other',
        description: dto.description ?? null,
        color: dto.color ?? null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning()

    return source
  }

  async update(id: string, dto: UpdateLeadSourceDto) {
    await this.getById(id)

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.type !== undefined) updates.type = dto.type
    if (dto.category !== undefined) updates.category = dto.category
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.color !== undefined) updates.color = dto.color
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder
    if (dto.isActive !== undefined) updates.isActive = dto.isActive

    const [updated] = await this.db
      .update(leadSources)
      .set(updates)
      .where(eq(leadSources.id, id))
      .returning()

    return updated
  }

  async deactivate(id: string) {
    const existing = await this.getById(id)
    if (!existing.isActive) throw new ConflictError('Lead source is already inactive')

    const [updated] = await this.db
      .update(leadSources)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(leadSources.id, id))
      .returning()

    return updated
  }
}

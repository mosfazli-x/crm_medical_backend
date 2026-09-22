import { eq } from 'drizzle-orm'
import type { DB } from '../../db/client'
import { dashboardLayouts } from '../../db/schema'
import type { DashboardLayoutDto } from './dashboard-layout.schema'

export class DashboardLayoutService {
  constructor(private db: DB) {}

  async findByUserId(userId: string) {
    const [row] = await this.db
      .select({ layout: dashboardLayouts.layout })
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))

    return row?.layout ?? null
  }

  async upsert(userId: string, layout: DashboardLayoutDto) {
    const values = {
      userId,
      layout,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const [row] = await this.db
      .insert(dashboardLayouts)
      .values(values)
      .onConflictDoUpdate({
        target: dashboardLayouts.userId,
        set: { layout, updatedAt: new Date() },
      })
      .returning({ layout: dashboardLayouts.layout })

    return row.layout
  }
}
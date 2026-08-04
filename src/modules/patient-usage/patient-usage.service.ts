import type { DB } from '../../db/client'
import { patientItemUsages, patients, products, stockMovements, users, visits } from '../../db/schema'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type {
  PatientUsageDto,
  PatientUsageListQueryDto,
  SearchUsagePatientsDto,
  SearchUsageVisitsDto,
} from './patient-usage.schema'

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

const USAGE_SELECT = {
  id: patientItemUsages.id,
  patientId: patientItemUsages.patientId,
  patientName: patients.firstName,
  patientLastName: patients.lastName,
  productId: patientItemUsages.productId,
  productName: products.name,
  productSku: products.sku,
  productUnit: products.unit,
  visitId: patientItemUsages.visitId,
  visitType: visits.visitType,
  visitDate: visits.visitDate,
  quantity: patientItemUsages.quantity,
  unitPrice: patientItemUsages.unitPrice,
  totalPrice: patientItemUsages.totalPrice,
  performedById: patientItemUsages.performedById,
  performedByName: users.fullName,
  notes: patientItemUsages.notes,
  usedAt: patientItemUsages.usedAt,
}

export class PatientUsageService {
  constructor(private db: DB) {}

  private async lockProduct(tx: Tx, productId: string) {
    const [product] = await tx
      .select({ id: products.id, currentStock: products.currentStock, isActive: products.isActive })
      .from(products)
      .where(eq(products.id, productId))
      .for('update')
      .limit(1)

    if (!product) throw new NotFoundError('Product')
    if (!product.isActive) throw new ValidationError('Product is deactivated')
    return product
  }

  async list(filters: PatientUsageListQueryDto) {
    const conditions: ReturnType<typeof eq>[] = []
    if (filters.patient_id) conditions.push(eq(patientItemUsages.patientId, filters.patient_id))
    if (filters.product_id) conditions.push(eq(patientItemUsages.productId, filters.product_id))

    const query = this.db
      .select(USAGE_SELECT)
      .from(patientItemUsages)
      .leftJoin(patients, eq(patientItemUsages.patientId, patients.id))
      .leftJoin(products, eq(patientItemUsages.productId, products.id))
      .leftJoin(users, eq(patientItemUsages.performedById, users.id))
      .leftJoin(visits, eq(patientItemUsages.visitId, visits.id))
      .orderBy(desc(patientItemUsages.usedAt))

    if (conditions.length > 0) return query.where(and(...conditions))
    return query
  }

  async create(dto: PatientUsageDto, userId: string) {
    const qty = dto.quantity
    const unitPrice = dto.unit_price ?? null
    const totalPrice = unitPrice !== null ? Math.round(qty * unitPrice * 100) / 100 : null

    return this.db.transaction(async (tx) => {
      const product = await this.lockProduct(tx, dto.product_id)
      const currentStock = Number(product.currentStock)
      if (qty > currentStock) {
        throw new ValidationError(`Insufficient stock. Current stock: ${currentStock}, requested: ${qty}`)
      }

      const [usage] = await tx
        .insert(patientItemUsages)
        .values({
          patientId: dto.patient_id,
          productId: dto.product_id,
          visitId: dto.visit_id ?? null,
          quantity: String(qty),
          unitPrice: unitPrice !== null ? String(unitPrice) : null,
          totalPrice: totalPrice !== null ? String(totalPrice) : null,
          performedById: userId,
          notes: dto.notes ?? null,
        })
        .returning()

      await tx
        .update(products)
        .set({ currentStock: String(currentStock - qty), updatedAt: new Date() })
        .where(eq(products.id, dto.product_id))

      await tx.insert(stockMovements).values({
        productId: dto.product_id,
        movementType: 'out',
        quantity: String(qty),
        unitPrice: unitPrice !== null ? String(unitPrice) : null,
        totalPrice: totalPrice !== null ? String(totalPrice) : null,
        reference: usage.id,
        referenceType: 'patient_usage',
        description: dto.notes ?? null,
        performedById: userId,
      })

      return usage
    })
  }

  async remove(id: string) {
    return this.db.transaction(async (tx) => {
      const [usage] = await tx
        .select({ id: patientItemUsages.id, productId: patientItemUsages.productId, quantity: patientItemUsages.quantity })
        .from(patientItemUsages)
        .where(eq(patientItemUsages.id, id))
        .limit(1)

      if (!usage) throw new NotFoundError('Patient usage')

      const product = await this.lockProduct(tx, usage.productId)
      await tx
        .update(products)
        .set({ currentStock: String(Number(product.currentStock) + Number(usage.quantity)), updatedAt: new Date() })
        .where(eq(products.id, usage.productId))

      await tx
        .delete(stockMovements)
        .where(and(eq(stockMovements.reference, usage.id), eq(stockMovements.referenceType, 'patient_usage')))

      await tx.delete(patientItemUsages).where(eq(patientItemUsages.id, id))

      return usage
    })
  }

  async searchPatients(dto: SearchUsagePatientsDto) {
    const filters: any[] = [eq(patients.isDeleted, false)]

    if (dto.q?.trim()) {
      const pattern = `%${dto.q.trim()}%`
      filters.push(
        or(
          ilike(patients.firstName, pattern),
          ilike(patients.lastName, pattern),
          ilike(patients.phone, pattern),
          ilike(patients.nationalId, pattern),
        )
      )
    }

    return this.db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        nationalId: patients.nationalId,
        phone: patients.phone,
      })
      .from(patients)
      .where(and(...filters))
      .orderBy(desc(patients.createdAt))
      .limit(20)
  }

  async searchVisits(dto: SearchUsageVisitsDto) {
    return this.db
      .select({
        id: visits.id,
        visitDate: visits.visitDate,
        visitType: visits.visitType,
        visitReason: visits.visitReason,
        status: visits.status,
      })
      .from(visits)
      .where(eq(visits.patientId, dto.patient_id))
      .orderBy(desc(visits.visitDate))
      .limit(20)
  }
}

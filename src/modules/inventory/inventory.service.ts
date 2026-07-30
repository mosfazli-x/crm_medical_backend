import type { DB } from '../../db/client'
import {
  inventoryCategories,
  products,
  stockMovements,
  users,
} from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type { InventoryCategoryDto, ProductDto, StockMovementDto } from './inventory.schema'

export class InventoryService {
  constructor(private db: DB) {}

  // ─── Categories ───

  async getCategories() {
    return this.db
      .select({
        id: inventoryCategories.id,
        name: inventoryCategories.name,
        description: inventoryCategories.description,
        isActive: inventoryCategories.isActive,
        createdAt: inventoryCategories.createdAt,
        productCount: sql<number>`(SELECT COUNT(*) FROM products WHERE products.category_id = inventory_categories.id)`,
      })
      .from(inventoryCategories)
      .where(eq(inventoryCategories.isActive, true))
      .orderBy(inventoryCategories.name)
  }

  async createCategory(dto: InventoryCategoryDto) {
    const [category] = await this.db
      .insert(inventoryCategories)
      .values({
        name: dto.name,
        description: dto.description || null,
      })
      .returning()
    return category
  }

  async updateCategory(id: string, dto: Partial<InventoryCategoryDto>) {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.description !== undefined) updates.description = dto.description

    const [category] = await this.db
      .update(inventoryCategories)
      .set(updates)
      .where(eq(inventoryCategories.id, id))
      .returning()
    if (!category) throw new NotFoundError('Category')
    return category
  }

  async deleteCategory(id: string) {
    const [category] = await this.db
      .update(inventoryCategories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(inventoryCategories.id, id))
      .returning()
    if (!category) throw new NotFoundError('Category')
    return category
  }

  // ─── Products ───

  async getProducts(categoryId?: string, lowStock?: boolean) {
    const conditions: ReturnType<typeof eq>[] = [eq(products.isActive, true)]
    if (categoryId) conditions.push(eq(products.categoryId, categoryId))

    let query = this.db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        categoryId: products.categoryId,
        categoryName: inventoryCategories.name,
        unit: products.unit,
        purchasePrice: products.purchasePrice,
        sellingPrice: products.sellingPrice,
        currentStock: products.currentStock,
        minStockLevel: products.minStockLevel,
        description: products.description,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        stockValue: sql<string>`COALESCE(CAST(${products.currentStock} AS DECIMAL) * COALESCE(${products.purchasePrice}, 0), 0)`,
      })
      .from(products)
      .leftJoin(inventoryCategories, eq(products.categoryId, inventoryCategories.id))
      .where(and(...conditions))
      .orderBy(products.name)

    return query
  }

  async getProductById(id: string) {
    const [product] = await this.db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        categoryId: products.categoryId,
        categoryName: inventoryCategories.name,
        unit: products.unit,
        purchasePrice: products.purchasePrice,
        sellingPrice: products.sellingPrice,
        currentStock: products.currentStock,
        minStockLevel: products.minStockLevel,
        description: products.description,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(inventoryCategories, eq(products.categoryId, inventoryCategories.id))
      .where(eq(products.id, id))
      .limit(1)
    if (!product) throw new NotFoundError('Product')
    return product
  }

  async createProduct(dto: ProductDto) {
    const values: Record<string, unknown> = {
      name: dto.name,
      sku: dto.sku || null,
      barcode: dto.barcode || null,
      categoryId: dto.category_id || null,
      unit: dto.unit || 'عدد',
      purchasePrice: dto.purchase_price !== undefined && dto.purchase_price !== null ? String(dto.purchase_price) : null,
      sellingPrice: dto.selling_price !== undefined && dto.selling_price !== null ? String(dto.selling_price) : null,
      minStockLevel: dto.min_stock_level !== undefined && dto.min_stock_level !== null ? String(dto.min_stock_level) : '0',
      description: dto.description || null,
    }

    const [product] = await this.db
      .insert(products)
      .values(values as typeof products.$inferInsert)
      .returning()
    return product
  }

  async updateProduct(id: string, dto: Partial<ProductDto>) {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.sku !== undefined) updates.sku = dto.sku
    if (dto.barcode !== undefined) updates.barcode = dto.barcode
    if (dto.category_id !== undefined) updates.categoryId = dto.category_id
    if (dto.unit !== undefined) updates.unit = dto.unit
    if (dto.purchase_price !== undefined) updates.purchasePrice = dto.purchase_price !== null ? String(dto.purchase_price) : null
    if (dto.selling_price !== undefined) updates.sellingPrice = dto.selling_price !== null ? String(dto.selling_price) : null
    if (dto.min_stock_level !== undefined) updates.minStockLevel = dto.min_stock_level !== null ? String(dto.min_stock_level) : '0'
    if (dto.description !== undefined) updates.description = dto.description

    const [product] = await this.db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning()
    if (!product) throw new NotFoundError('Product')
    return product
  }

  async deleteProduct(id: string) {
    const [product] = await this.db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning()
    if (!product) throw new NotFoundError('Product')
    return product
  }

  // ─── Stock Movements ───

  async getStockMovements(productId?: string, movementType?: string) {
    const conditions: ReturnType<typeof eq>[] = []
    if (productId) conditions.push(eq(stockMovements.productId, productId))
    if (movementType) conditions.push(eq(stockMovements.movementType, movementType))

    const query = this.db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        productSku: products.sku,
        movementType: stockMovements.movementType,
        quantity: stockMovements.quantity,
        unitPrice: stockMovements.unitPrice,
        totalPrice: stockMovements.totalPrice,
        reference: stockMovements.reference,
        referenceType: stockMovements.referenceType,
        description: stockMovements.description,
        performedById: stockMovements.performedById,
        performedByName: users.fullName,
        performedAt: stockMovements.performedAt,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(users, eq(stockMovements.performedById, users.id))
      .orderBy(desc(stockMovements.performedAt))

    if (conditions.length > 0) return query.where(and(...conditions))
    return query
  }

  async createStockMovement(dto: StockMovementDto, userId: string) {
    const [product] = await this.db
      .select({ id: products.id, currentStock: products.currentStock })
      .from(products)
      .where(eq(products.id, dto.product_id))
      .limit(1)
    if (!product) throw new NotFoundError('Product')

    const qty = dto.quantity
    const unitPrice = dto.unit_price || 0
    const totalPrice = qty * unitPrice

    if (dto.movement_type === 'out' || dto.movement_type === 'adjustment') {
      const currentStock = Number(product.currentStock)
      if (dto.movement_type === 'out' && qty > currentStock) {
        throw new ValidationError(`Insufficient stock. Current stock: ${currentStock}, requested: ${qty}`)
      }
    }

    const [movement] = await this.db
      .insert(stockMovements)
      .values({
        productId: dto.product_id,
        movementType: dto.movement_type,
        quantity: String(qty),
        unitPrice: unitPrice > 0 ? String(unitPrice) : null,
        totalPrice: totalPrice > 0 ? String(totalPrice) : null,
        reference: dto.reference || null,
        referenceType: dto.reference_type || null,
        description: dto.description || null,
        performedById: userId,
      })
      .returning()

    const stockChange = dto.movement_type === 'in'
      ? qty
      : dto.movement_type === 'out'
        ? -qty
        : qty

    const newStock = Number(product.currentStock) + stockChange
    await this.db
      .update(products)
      .set({
        currentStock: String(Math.max(0, newStock)),
        updatedAt: new Date(),
      })
      .where(eq(products.id, dto.product_id))

    return movement
  }

  async getInventorySummary() {
    const [summary] = await this.db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        totalStockValue: sql<string>`COALESCE(SUM(CAST(current_stock AS DECIMAL) * COALESCE(CAST(purchase_price AS DECIMAL), 0)), 0)`,
        lowStockCount: sql<number>`COUNT(*) FILTER (WHERE CAST(current_stock AS DECIMAL) <= CAST(min_stock_level AS DECIMAL) AND CAST(min_stock_level AS DECIMAL) > 0)`,
        outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE CAST(current_stock AS DECIMAL) <= 0)`,
      })
      .from(products)
      .where(eq(products.isActive, true))

    return summary
  }

  async getLowStockProducts() {
    return this.db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        currentStock: products.currentStock,
        minStockLevel: products.minStockLevel,
        unit: products.unit,
        categoryName: inventoryCategories.name,
      })
      .from(products)
      .leftJoin(inventoryCategories, eq(products.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(products.isActive, true),
          sql`CAST(${products.currentStock} AS DECIMAL) <= CAST(${products.minStockLevel} AS DECIMAL)`,
          sql`CAST(${products.minStockLevel} AS DECIMAL) > 0`,
        )
      )
      .orderBy(sql`CAST(${products.currentStock} AS DECIMAL)`)
  }
}

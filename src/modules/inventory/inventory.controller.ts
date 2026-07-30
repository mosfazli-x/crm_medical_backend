import type { FastifyRequest, FastifyReply } from 'fastify'
import { InventoryService } from './inventory.service'
import { InventoryCategorySchema, ProductSchema, StockMovementSchema } from './inventory.schema'

export class InventoryController {
  constructor(private service: InventoryService) {}

  async getCategories(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getCategories()
    return reply.send({ success: true, data })
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const dto = InventoryCategorySchema.parse(request.body)
    const data = await this.service.createCategory(dto)
    return reply.status(201).send({ success: true, data, message: 'Category created' })
  }

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const dto = InventoryCategorySchema.partial().parse(request.body)
    const data = await this.service.updateCategory(id, dto)
    return reply.send({ success: true, data, message: 'Category updated' })
  }

  async deleteCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.deleteCategory(id)
    return reply.send({ success: true, data, message: 'Category deleted' })
  }

  async getProducts(request: FastifyRequest, reply: FastifyReply) {
    const { category_id, low_stock } = request.query as { category_id?: string; low_stock?: string }
    const data = await this.service.getProducts(category_id, low_stock === 'true')
    return reply.send({ success: true, data })
  }

  async getProductById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.getProductById(id)
    return reply.send({ success: true, data })
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    const dto = ProductSchema.parse(request.body)
    const data = await this.service.createProduct(dto)
    return reply.status(201).send({ success: true, data, message: 'Product created' })
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const dto = ProductSchema.partial().parse(request.body)
    const data = await this.service.updateProduct(id, dto)
    return reply.send({ success: true, data, message: 'Product updated' })
  }

  async deleteProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.deleteProduct(id)
    return reply.send({ success: true, data, message: 'Product deactivated' })
  }

  async getStockMovements(request: FastifyRequest, reply: FastifyReply) {
    const { product_id, movement_type } = request.query as { product_id?: string; movement_type?: string }
    const data = await this.service.getStockMovements(product_id, movement_type)
    return reply.send({ success: true, data })
  }

  async createStockMovement(request: FastifyRequest, reply: FastifyReply) {
    const dto = StockMovementSchema.parse(request.body)
    const user = request.user as { id: string }
    const data = await this.service.createStockMovement(dto, user.id)
    return reply.status(201).send({ success: true, data, message: 'Stock movement recorded' })
  }

  async getSummary(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getInventorySummary()
    return reply.send({ success: true, data })
  }

  async getLowStockProducts(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getLowStockProducts()
    return reply.send({ success: true, data })
  }
}

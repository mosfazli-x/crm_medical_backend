import type { FastifyInstance } from 'fastify'
import { InventoryController } from './inventory.controller'
import { InventoryService } from './inventory.service'
import { requireRole } from '../../shared/middleware'

export async function inventoryRoutes(fastify: FastifyInstance) {
  const service = new InventoryService(fastify.db)
  const controller = new InventoryController(service)

  // Categories
  fastify.get('/categories', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getCategories.bind(controller))
  fastify.post('/categories', { preHandler: requireRole('admin_doctor') }, controller.createCategory.bind(controller))
  fastify.put('/categories/:id', { preHandler: requireRole('admin_doctor') }, controller.updateCategory.bind(controller))
  fastify.delete('/categories/:id', { preHandler: requireRole('admin_doctor') }, controller.deleteCategory.bind(controller))

  // Products
  fastify.get('/products', { preHandler: requireRole('admin_doctor', 'doctor', 'pharmacy') }, controller.getProducts.bind(controller))
  fastify.get('/products/:id', { preHandler: requireRole('admin_doctor', 'doctor', 'pharmacy') }, controller.getProductById.bind(controller))
  fastify.post('/products', { preHandler: requireRole('admin_doctor', 'pharmacy') }, controller.createProduct.bind(controller))
  fastify.put('/products/:id', { preHandler: requireRole('admin_doctor', 'pharmacy') }, controller.updateProduct.bind(controller))
  fastify.delete('/products/:id', { preHandler: requireRole('admin_doctor') }, controller.deleteProduct.bind(controller))

  // Stock Movements
  fastify.get('/stock-movements', { preHandler: requireRole('admin_doctor', 'pharmacy') }, controller.getStockMovements.bind(controller))
  fastify.post('/stock-movements', { preHandler: requireRole('admin_doctor', 'pharmacy') }, controller.createStockMovement.bind(controller))

  // Dashboard / Summary
  fastify.get('/summary', { preHandler: requireRole('admin_doctor') }, controller.getSummary.bind(controller))
  fastify.get('/low-stock', { preHandler: requireRole('admin_doctor', 'pharmacy') }, controller.getLowStockProducts.bind(controller))
}

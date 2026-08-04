import type { FastifyRequest, FastifyReply } from 'fastify'
import { DashboardService } from './dashboard.service'
import { InventoryService } from '../inventory'

export class DashboardController {
  constructor(private service: DashboardService, private inventoryService: InventoryService) {}

  async index(request: FastifyRequest, reply: FastifyReply) {
    const { role, id, patientId } = request.user

    if (role === 'patient') {
      if (!patientId) {
        return reply.status(400).send({ success: false, error: 'No patient profile linked to your account' })
      }
      const data = await this.service.getPatientDashboard(id, patientId)
      return reply.send({ success: true, data })
    }

    const data = await this.service.getDashboard()

    if (role === 'admin_doctor' || role === 'pharmacy') {
      const items = await this.inventoryService.getLowStockProducts()
      data.low_stock = {
        count: items.length,
        items: items.map(({ id, name, sku, currentStock, minStockLevel, unit }) => ({
          id,
          name,
          sku,
          currentStock,
          minStockLevel,
          unit,
        })),
      }
    }

    return reply.send({ success: true, data })
  }
}

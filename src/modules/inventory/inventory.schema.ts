import { z } from 'zod'

export const InventoryCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
})

export const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  unit: z.string().optional().default('عدد'),
  purchase_price: z.number().min(0).optional().nullable(),
  selling_price: z.number().min(0).optional().nullable(),
  min_stock_level: z.number().int().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
})

export const StockMovementSchema = z.object({
  product_id: z.string().uuid(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number(),
  unit_price: z.number().min(0).optional().nullable(),
  reference: z.string().optional().nullable(),
  reference_type: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export type InventoryCategoryDto = z.infer<typeof InventoryCategorySchema>
export type ProductDto = z.infer<typeof ProductSchema>
export type StockMovementDto = z.infer<typeof StockMovementSchema>

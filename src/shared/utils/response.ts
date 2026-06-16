import type { FastifyReply } from 'fastify'

interface SuccessResponse<T = unknown> {
  success: true
  message?: string
  data?: T
}

interface PaginatedResponse<T = unknown> extends SuccessResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ErrorResponse {
  success: false
  error: string
  details?: unknown
}

export function sendSuccess<T>(reply: FastifyReply, data?: T, message?: string, statusCode = 200) {
  const body: SuccessResponse<T> = { success: true }
  if (message) body.message = message
  if (data !== undefined) body.data = data
  return reply.status(statusCode).send(body)
}

export function sendCreated<T>(reply: FastifyReply, data?: T, message?: string) {
  return sendSuccess(reply, data, message, 201)
}

export function sendPaginated<T>(
  reply: FastifyReply,
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  const body: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  }
  return reply.status(200).send(body)
}

export function sendError(reply: FastifyReply, statusCode: number, error: string, details?: unknown) {
  const body: ErrorResponse = { success: false, error }
  if (details) body.details = details
  return reply.status(statusCode).send(body)
}

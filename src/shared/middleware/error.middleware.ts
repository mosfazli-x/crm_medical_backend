import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { AppError, ValidationError, ConflictError } from '../errors'

export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    const body: Record<string, unknown> = {
      success: false,
      error: error.message,
    }
    if (error instanceof ValidationError && error.details) {
      body.details = error.details
    }
    if (error instanceof ConflictError && error.data !== undefined) {
      body.data = error.data
    }
    reply.status(error.statusCode).send(body)
    return
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      success: false,
      error: 'Validation failed',
      details: error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    })
    return
  }

  const fastifyError = error as FastifyError
  if (fastifyError.statusCode === 429) {
    reply.status(429).send({
      success: false,
      error: 'Too many requests. Please try again later.',
    })
    return
  }

  if (fastifyError.validation) {
    reply.status(400).send({
      success: false,
      error: 'Request validation failed',
      details: fastifyError.validation,
    })
    return
  }

  _request.log.error(error, 'Unhandled error')

  const statusCode = fastifyError.statusCode || 500
  const isProduction = process.env.NODE_ENV === 'production'

  reply.status(statusCode).send({
    success: false,
    error: isProduction && statusCode === 500
      ? 'Internal server error'
      : error.message || 'Unknown error',
  })
}

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { AppError, ValidationError } from '../errors'

export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: error.message,
      ...(error instanceof ValidationError && error.details
        ? { details: error.details }
        : {}),
    })
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
  reply.status(statusCode).send({
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message || 'Unknown error',
  })
}

import 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    bcrypt: typeof import('bcrypt')
  }
}
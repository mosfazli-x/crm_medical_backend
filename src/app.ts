import Fastify from 'fastify'
import jwt from '@fastify/jwt';

export const buildApp = () => {
  const app = Fastify({ logger: true })
  app.register(require('@fastify/cors'), {
    origin: '*'
  });
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  });

  app.register(require('fastify-bcrypt'), {
    saltWorkFactor: 12
  })

  return app
}

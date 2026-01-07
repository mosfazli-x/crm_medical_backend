import fp from 'fastify-plugin'
import dotenv from 'dotenv'

export default fp(async (fastify) => {
  dotenv.config()
})

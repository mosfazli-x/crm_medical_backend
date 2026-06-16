export interface JwtPayload {
  id: string
  fullName: string | null
  role: string
  patientId: string | null
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

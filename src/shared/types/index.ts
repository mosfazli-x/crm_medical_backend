export interface JwtPayload {
  id: string
  fullName: string | null
  role: string
  patientId: string | null
  sessionId?: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

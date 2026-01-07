export const env = {
  isProd: process.env.ENV === 'production',

  server: {
    port: Number(process.env.BACKEND_PORT) || 3101,
  },

  db: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
  },

  auth: {
    secret: process.env.TOKEN_SECRET!,
    expiresInMinutes: Number(process.env.TOKEN_EXPIRE_MINUTES),
  }
}

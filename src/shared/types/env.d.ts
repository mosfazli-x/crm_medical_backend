declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test'
    PORT?: string
    BACKEND_PORT?: string
    DATABASE_URL: string
    JWT_SECRET: string
    JWT_EXPIRES_IN?: string
    SMS_USERNAME?: string
    SMS_PASSWORD?: string
    SMS_LINE?: string
    SMS_API_BASE_URL?: string
  }
}

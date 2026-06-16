import type { DB } from '../../db/client'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { ConflictError, UnauthorizedError, ForbiddenError, NotFoundError } from '../../shared/errors'
import { smsService } from '../../shared/services'
import type { LoginDto, RegisterDto } from './auth.schema'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export class AuthService {
  constructor(private db: DB) { }

  async login(dto: LoginDto) {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        passwordHash: users.passwordHash,
        patientId: users.patientId,
        requiresPasswordChange: users.requiresPasswordChange,
        status: users.status,
        phoneConfirmed: users.phoneConfirmed,
      })
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1)

    if (!user) {
      throw new UnauthorizedError('Invalid phone or password')
    }

    if (user.status !== 'approved') {
      throw new ForbiddenError('Account is not active')
    }

    if (!user.phoneConfirmed) {
      throw new ForbiddenError('Phone number not confirmed')
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash)
    if (!match) {
      throw new UnauthorizedError('Invalid phone or password')
    }

    return {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      patientId: user.patientId,
      requiresPasswordChange: user.requiresPasswordChange,
    }
  }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

    try {
      const [newUser] = await this.db
        .insert(users)
        .values({
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          role: dto.role,
          phoneConfirmed: false,
          status: 'pending',
          requiresPasswordChange: false,
        })
        .returning({
          id: users.id,
          fullName: users.fullName,
          role: users.role,
          phone: users.phone,
        })



      return newUser
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as Record<string, unknown>).code === '23505'
      ) {
        throw new ConflictError('Phone number already registered')
      }
      throw error
    }
  }

  async me(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        patientId: users.patientId,
        requiresPasswordChange: users.requiresPasswordChange,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundError('User not found')
    }

    return user
  }
}

import type { DB } from '../../db/client'
import { messages, patients, users } from '../../db/schema'
import { eq, and, desc, or, sql, ne, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { NotFoundError, ForbiddenError } from '../../shared/errors'
import { notificationService } from '../../shared/services'
import type { SendMessageDto } from './messaging.schema'

const senderUsers = alias(users, 'sender_users')
const receiverUsers = alias(users, 'receiver_users')

const PATIENT_ALLOWED_RECEIVER_ROLES = ['doctor', 'admin_doctor'] as const

export class MessagingService {
  constructor(private db: DB) { }

  async sendMessage(
    senderId: string,
    senderRole: string,
    dto: SendMessageDto,
    senderPatientId?: string | null,
  ) {
    let resolvedReceiverRole: string | null | undefined = dto.receiver_role

    if (senderRole === 'patient') {
      if (!dto.receiver_id && senderPatientId) {
        const [lastMsg] = await this.db
          .select({ senderId: messages.senderId, senderRole: messages.senderRole })
          .from(messages)
          .where(
            and(
              eq(messages.patientId, senderPatientId),
              ne(messages.senderId, senderId),
              inArray(messages.senderRole, ['doctor', 'admin_doctor']),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1)
        if (lastMsg) {
          dto.receiver_id = lastMsg.senderId
          resolvedReceiverRole = lastMsg.senderRole
        }
      }

      if (!dto.receiver_id && !resolvedReceiverRole) {
        resolvedReceiverRole = 'doctor'
      }

      if (dto.receiver_id) {
        if (!resolvedReceiverRole) {
          const [receiver] = await this.db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, dto.receiver_id))
            .limit(1)
          if (receiver) {
            resolvedReceiverRole = receiver.role
          }
        }

        if (
          !resolvedReceiverRole ||
          !PATIENT_ALLOWED_RECEIVER_ROLES.includes(
            resolvedReceiverRole as (typeof PATIENT_ALLOWED_RECEIVER_ROLES)[number],
          )
        ) {
          throw new ForbiddenError('Patients can only send messages to doctors')
        }
      }
    }

    const patientId = dto.patient_id || (senderRole === 'patient' ? senderPatientId : null)

    const [msg] = await this.db
      .insert(messages)
      .values({
        senderId,
        senderRole,
        receiverId: dto.receiver_id || null,
        receiverRole: resolvedReceiverRole || null,
        patientId: patientId || null,
        subject: dto.subject || null,
        body: dto.body,
        isConfidential: dto.is_confidential || false,
      })
      .returning()

    if (senderRole === 'patient' && dto.receiver_id) {
      const [patientInfo] = await this.db
        .select({ firstName: patients.firstName, lastName: patients.lastName })
        .from(patients)
        .where(eq(patients.id, patientId!))
        .limit(1)

      const patientName = patientInfo ? `${patientInfo.firstName} ${patientInfo.lastName}` : 'یک بیمار'
      const preview = dto.body.length > 100 ? dto.body.substring(0, 100) + '...' : dto.body
      notificationService.notifyByUser(dto.receiver_id, `\u067E\u06CC\u0627\u0645 \u062C\u062F\u06CC\u062F \u0627\u0632 ${patientName}: ${preview}`)
    } else if (senderRole !== 'patient' && patientId) {
      const [patient] = await this.db
        .select({ phone: patients.phone, firstName: patients.firstName })
        .from(patients)
        .where(eq(patients.id, patientId))

      if (patient?.phone) {
        const text = `\u0633\u0644\u0627\u0645 ${patient.firstName} \u0639\u0632\u06CC\u0632\u060C \u067E\u06CC\u0627\u0645 \u062C\u062F\u06CC\u062F\u06CC \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u06A9\u0644\u06CC\u0646\u06CC\u06A9 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u0648\u0627\u0631\u062F \u067E\u0646\u0644 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F \u0634\u0648\u06CC\u062F \u0648 \u067E\u06CC\u0627\u0645\u200C\u0647\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F.`
        notificationService.notifyByPatient(patientId, text, patient.phone)
      }
    }

    const [enriched] = await this.db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderRole: messages.senderRole,
        senderFullName: senderUsers.fullName,
        receiverId: messages.receiverId,
        receiverRole: messages.receiverRole,
        receiverFullName: receiverUsers.fullName,
        patientId: messages.patientId,
        subject: messages.subject,
        body: messages.body,
        isRead: messages.isRead,
        readAt: messages.readAt,
        isConfidential: messages.isConfidential,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(senderUsers, eq(messages.senderId, senderUsers.id))
      .leftJoin(receiverUsers, eq(messages.receiverId, receiverUsers.id))
      .where(eq(messages.id, msg.id))
      .limit(1)

    return enriched || msg
  }

  async getInbox(userId: string, role: string, userPatientId?: string | null) {
    const baseCondition = and(
      eq(messages.deletedByReceiver, false),
      or(
        eq(messages.receiverId, userId),
        and(eq(messages.receiverRole, role), sql`${messages.receiverId} IS NULL`),
      ),
    )

    const selectWithNames = {
      id: messages.id,
      senderId: messages.senderId,
      senderRole: messages.senderRole,
      senderFullName: senderUsers.fullName,
      receiverId: messages.receiverId,
      receiverRole: messages.receiverRole,
      receiverFullName: receiverUsers.fullName,
      patientId: messages.patientId,
      subject: messages.subject,
      body: messages.body,
      isRead: messages.isRead,
      readAt: messages.readAt,
      isConfidential: messages.isConfidential,
      createdAt: messages.createdAt,
    }

    if (role === 'patient' && userPatientId) {
      return this.db
        .select(selectWithNames)
        .from(messages)
        .leftJoin(senderUsers, eq(messages.senderId, senderUsers.id))
        .leftJoin(receiverUsers, eq(messages.receiverId, receiverUsers.id))
        .where(
          or(
            and(
              eq(messages.receiverId, userId),
              eq(messages.deletedByReceiver, false),
            ),
            and(
              eq(messages.receiverRole, role),
              sql`${messages.receiverId} IS NULL`,
            ),
            and(
              eq(messages.patientId, userPatientId),
              sql`NOT (
                (${messages.senderId} = ${userId} AND ${messages.deletedBySender} = true)
                OR
                (${messages.receiverId} = ${userId} AND ${messages.deletedByReceiver} = true)
              )`,
            ),
          ),
        )
        .orderBy(desc(messages.createdAt))
    }

    return this.db
      .select(selectWithNames)
      .from(messages)
      .leftJoin(senderUsers, eq(messages.senderId, senderUsers.id))
      .leftJoin(receiverUsers, eq(messages.receiverId, receiverUsers.id))
      .where(baseCondition)
      .orderBy(desc(messages.createdAt))
  }

  async getSentMessages(senderId: string) {
    return this.db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderRole: messages.senderRole,
        senderFullName: senderUsers.fullName,
        receiverId: messages.receiverId,
        receiverRole: messages.receiverRole,
        receiverFullName: receiverUsers.fullName,
        patientId: messages.patientId,
        subject: messages.subject,
        body: messages.body,
        isRead: messages.isRead,
        readAt: messages.readAt,
        isConfidential: messages.isConfidential,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(senderUsers, eq(messages.senderId, senderUsers.id))
      .leftJoin(receiverUsers, eq(messages.receiverId, receiverUsers.id))
      .where(
        and(
          eq(messages.senderId, senderId),
          eq(messages.deletedBySender, false),
        ),
      )
      .orderBy(desc(messages.createdAt))
  }

  async getPatientMessages(patientId: string) {
    return this.db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderRole: messages.senderRole,
        senderFullName: senderUsers.fullName,
        receiverId: messages.receiverId,
        receiverRole: messages.receiverRole,
        receiverFullName: receiverUsers.fullName,
        patientId: messages.patientId,
        subject: messages.subject,
        body: messages.body,
        isRead: messages.isRead,
        readAt: messages.readAt,
        isConfidential: messages.isConfidential,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(senderUsers, eq(messages.senderId, senderUsers.id))
      .leftJoin(receiverUsers, eq(messages.receiverId, receiverUsers.id))
      .where(eq(messages.patientId, patientId))
      .orderBy(desc(messages.createdAt))
  }

  async getMyMessages(userId: string, patientId: string) {
    return this.db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderRole: messages.senderRole,
        senderFullName: senderUsers.fullName,
        receiverId: messages.receiverId,
        receiverRole: messages.receiverRole,
        receiverFullName: receiverUsers.fullName,
        patientId: messages.patientId,
        subject: messages.subject,
        body: messages.body,
        isRead: messages.isRead,
        readAt: messages.readAt,
        isConfidential: messages.isConfidential,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(senderUsers, eq(messages.senderId, senderUsers.id))
      .leftJoin(receiverUsers, eq(messages.receiverId, receiverUsers.id))
      .where(
        and(
          or(
            eq(messages.senderId, userId),
            eq(messages.receiverId, userId),
            eq(messages.patientId, patientId),
          ),
          sql`NOT (
            (${messages.senderId} = ${userId} AND ${messages.deletedBySender} = true)
            OR
            (${messages.receiverId} = ${userId} AND ${messages.deletedByReceiver} = true)
          )`,
        ),
      )
      .orderBy(desc(messages.createdAt))
  }

  async markAsRead(messageId: string, userId: string, role: string, userPatientId?: string | null) {
    let resolvedPatientId = userPatientId

    if (role === 'patient' && !resolvedPatientId) {
      const [user] = await this.db
        .select({ patientId: users.patientId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      resolvedPatientId = user?.patientId
    }

    const matchConditions = [eq(messages.receiverId, userId)]

    if (role === 'patient' && resolvedPatientId) {
      matchConditions.push(eq(messages.patientId, resolvedPatientId))
    }

    const [msg] = await this.db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(messages.id, messageId), or(...matchConditions)))
      .returning()
    if (!msg) throw new NotFoundError('Message')
    return msg
  }

  async deleteMessage(messageId: string, userId: string, role: string) {
    const [msg] = await this.db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        deletedBySender: messages.deletedBySender,
        deletedByReceiver: messages.deletedByReceiver,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!msg) throw new NotFoundError('Message')

    const isDoctor = role === 'doctor' || role === 'admin_doctor'

    if (msg.senderId === userId) {
      if (msg.deletedBySender && !isDoctor) {
        return { id: msg.id, deleted: true }
      }
      if (isDoctor && msg.deletedBySender && msg.deletedByReceiver) {
        return { id: msg.id, deleted: true }
      }
      await this.db
        .update(messages)
        .set({
          deletedBySender: true,
          ...(isDoctor ? { deletedByReceiver: true } : {}),
        })
        .where(eq(messages.id, messageId))
      return { id: msg.id, deleted: true }
    }

    if (msg.receiverId === userId) {
      if (msg.deletedByReceiver && !isDoctor) {
        return { id: msg.id, deleted: true }
      }
      if (isDoctor && msg.deletedBySender && msg.deletedByReceiver) {
        return { id: msg.id, deleted: true }
      }
      await this.db
        .update(messages)
        .set({
          deletedByReceiver: true,
          ...(isDoctor ? { deletedBySender: true } : {}),
        })
        .where(eq(messages.id, messageId))
      return { id: msg.id, deleted: true }
    }

    throw new ForbiddenError('You can only delete your own messages')
  }

  async getUnreadCount(userId: string, role: string, userPatientId?: string | null) {
    let resolvedPatientId = userPatientId

    if (role === 'patient' && !resolvedPatientId) {
      const [user] = await this.db
        .select({ patientId: users.patientId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      resolvedPatientId = user?.patientId
    }

    const matchConditions = [eq(messages.receiverId, userId)]

    if (role === 'patient' && resolvedPatientId) {
      matchConditions.push(eq(messages.patientId, resolvedPatientId))
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(eq(messages.isRead, false), or(...matchConditions)))
    return result.count
  }
}
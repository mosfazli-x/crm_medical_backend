import type { DB } from '../../db/client'
import { messages, patients, users } from '../../db/schema'
import { eq, and, desc, or, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import { smsService } from '../../shared/services'
import type { SendMessageDto } from './messaging.schema'

export class MessagingService {
  constructor(private db: DB) {}

  async sendMessage(senderId: string, senderRole: string, dto: SendMessageDto) {
    const [msg] = await this.db
      .insert(messages)
      .values({
        senderId,
        senderRole,
        receiverId: dto.receiver_id || null,
        receiverRole: dto.receiver_role || null,
        patientId: dto.patient_id || null,
        subject: dto.subject || null,
        body: dto.body,
        isConfidential: dto.is_confidential || false,
      })
      .returning()

    if (dto.patient_id) {
      const [patient] = await this.db
        .select({ phone: patients.phone, firstName: patients.firstName })
        .from(patients)
        .where(eq(patients.id, dto.patient_id))

      if (patient?.phone) {
        smsService.send(
          patient.phone,
          `\u0633\u0644\u0627\u0645 ${patient.firstName} \u0639\u0632\u06CC\u0632\u060C \u067E\u06CC\u0627\u0645 \u062C\u062F\u06CC\u062F\u06CC \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u06A9\u0644\u06CC\u0646\u06CC\u06A9 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u0648\u0627\u0631\u062F \u067E\u0646\u0644 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F \u0634\u0648\u06CC\u062F \u0648 \u067E\u06CC\u0627\u0645\u200C\u0647\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F.`
        )
      }
    }

    return msg
  }

  async getInbox(userId: string, role: string) {
    return this.db
      .select()
      .from(messages)
      .where(
        or(
          eq(messages.receiverId, userId),
          and(eq(messages.receiverRole, role), sql`${messages.receiverId} IS NULL`),
        )
      )
      .orderBy(desc(messages.createdAt))
  }

  async getSentMessages(senderId: string) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.senderId, senderId))
      .orderBy(desc(messages.createdAt))
  }

  async getPatientMessages(patientId: string) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.patientId, patientId))
      .orderBy(desc(messages.createdAt))
  }

  async markAsRead(messageId: string, userId: string) {
    const [msg] = await this.db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(messages.id, messageId), eq(messages.receiverId, userId)))
      .returning()
    if (!msg) throw new NotFoundError('Message')
    return msg
  }

  async getUnreadCount(userId: string) {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(eq(messages.receiverId, userId), eq(messages.isRead, false)))
    return result.count
  }
}
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  ApproveMessageSchema,
  CreateSourceSchema,
  CreateTokenSchema,
  FinanceIdSchema,
  IngestSmsSchema,
  MessageListQuerySchema,
  PasteSmsSchema,
  UpdateSourceSchema,
} from './finance-ingest.schema'
import { FinanceIngestService } from './finance-ingest.service'

export class FinanceIngestController {
  constructor(private service: FinanceIngestService) {}

  /* Device ingestion — authenticated by the ingest token header, not JWT. */
  async ingestDevice(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers['x-ingest-token']
    const token = Array.isArray(header) ? header[0] : header
    const dto = IngestSmsSchema.parse(request.body)
    const data = await this.service.ingestWithToken(String(token ?? ''), dto.messages)
    return reply.send({ success: true, data })
  }

  async paste(request: FastifyRequest, reply: FastifyReply) {
    const dto = PasteSmsSchema.parse(request.body)
    const data = await this.service.pasteForUser(request.user.id, dto.text, dto.sender, dto.sourceId)
    return reply.send({ success: true, data })
  }

  async listSources(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.listSources(request.user.id)
    return reply.send({ success: true, data })
  }

  async createSource(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateSourceSchema.parse(request.body)
    const data = await this.service.createSource(request.user.id, dto)
    return reply.status(201).send({ success: true, data, message: 'Finance source created' })
  }

  async updateSource(request: FastifyRequest, reply: FastifyReply) {
    const id = FinanceIdSchema.parse((request.params as { id: string }).id)
    const dto = UpdateSourceSchema.parse(request.body)
    const data = await this.service.updateSource(request.user.id, id, dto)
    return reply.send({ success: true, data, message: 'Finance source updated' })
  }

  async deleteSource(request: FastifyRequest, reply: FastifyReply) {
    const id = FinanceIdSchema.parse((request.params as { id: string }).id)
    const data = await this.service.deleteSource(request.user.id, id)
    return reply.send({ success: true, data, message: 'Finance source disabled' })
  }

  async listTokens(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.listTokens(request.user.id)
    return reply.send({ success: true, data })
  }

  async createToken(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateTokenSchema.parse(request.body)
    const data = await this.service.createToken(request.user.id, dto)
    return reply.status(201).send({ success: true, data, message: 'Ingest token created' })
  }

  async revokeToken(request: FastifyRequest, reply: FastifyReply) {
    const id = FinanceIdSchema.parse((request.params as { id: string }).id)
    const data = await this.service.revokeToken(request.user.id, id)
    return reply.send({ success: true, data, message: 'Ingest token revoked' })
  }

  async listMessages(request: FastifyRequest, reply: FastifyReply) {
    const query = MessageListQuerySchema.parse(request.query)
    const data = await this.service.listMessages(request.user.id, query)
    return reply.send({ success: true, ...data })
  }

  async approveMessage(request: FastifyRequest, reply: FastifyReply) {
    const id = FinanceIdSchema.parse((request.params as { id: string }).id)
    const dto = ApproveMessageSchema.parse(request.body)
    const data = await this.service.approveMessage(request.user.id, id, dto)
    return reply.send({ success: true, data, message: 'Message posted to cashbook' })
  }

  async ignoreMessage(request: FastifyRequest, reply: FastifyReply) {
    const id = FinanceIdSchema.parse((request.params as { id: string }).id)
    const data = await this.service.ignoreMessage(request.user.id, id)
    return reply.send({ success: true, data, message: 'Message ignored' })
  }

  async stats(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.stats(request.user.id)
    return reply.send({ success: true, data })
  }
}

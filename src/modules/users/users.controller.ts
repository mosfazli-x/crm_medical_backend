import type { FastifyRequest, FastifyReply } from 'fastify'
import { UserService } from './users.service'
import { ApprovePatientSchema } from './users.schema'

export class UserController {
  constructor(private userService: UserService) {}

  async findAll(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.userService.findAll()
    return reply.status(200).send({ success: true, data })
  }

  async findById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const data = await this.userService.findById(id)
    return reply.status(200).send({ success: true, data })
  }

  async approve(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const user = await this.userService.approve(id)
    return reply.status(200).send({
      success: true,
      message: 'User approved successfully',
      user,
    })
  }

  async reject(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const user = await this.userService.reject(id)
    return reply.status(200).send({
      success: true,
      message: 'User rejected',
      user,
    })
  }

  async deactivate(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const user = await this.userService.deactivate(id)
    return reply.status(200).send({
      success: true,
      message: 'User deactivated',
      user,
    })
  }

  async activate(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const user = await this.userService.activate(id)
    return reply.status(200).send({
      success: true,
      message: 'User activated',
      user,
    })
  }

  async approvePatient(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = ApprovePatientSchema.parse(request.body)
    const data = await this.userService.approvePatient(id, dto)
    return reply.status(200).send({
      success: true,
      message: 'Patient approved and record created',
      data,
    })
  }
}

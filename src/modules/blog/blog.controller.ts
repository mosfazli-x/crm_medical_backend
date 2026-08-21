import type { FastifyRequest, FastifyReply } from 'fastify'
import { BlogService } from './blog.service'
import {
  CreateBlogPostSchema,
  UpdateBlogPostSchema,
  CreateBlogCommentSchema,
  UpdateCommentStatusSchema,
  CreateBlogCategorySchema,
} from './blog.schema'

export class BlogController {
  constructor(private service: BlogService) {}

  // ─── Posts (public) ───────────────────────────────

  async listPosts(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, limit = 12, category_id } = request.query as any
    const result = await this.service.listPublishedPosts(Number(page), Number(limit), category_id)
    return reply.send({ success: true, data: result.data, pagination: result.pagination })
  }

  async getPostBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string }
    const post = await this.service.getPostBySlug(slug)
    return reply.send({ success: true, data: post })
  }

  // ─── Posts (admin) ────────────────────────────────

  async listAllPosts(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, limit = 20 } = request.query as any
    const result = await this.service.listAllPosts(Number(page), Number(limit))
    return reply.send({ success: true, data: result.data, pagination: result.pagination })
  }

  async createPost(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateBlogPostSchema.parse(request.body)
    const post = await this.service.createPost(dto, request.user.id)
    return reply.status(201).send({ success: true, data: post, message: 'Blog post created' })
  }

  async updatePost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const dto = UpdateBlogPostSchema.parse(request.body)
    const post = await this.service.updatePost(id, dto)
    return reply.send({ success: true, data: post, message: 'Blog post updated' })
  }

  async deletePost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const result = await this.service.deletePost(id)
    return reply.send({ success: true, data: result, message: 'Blog post deleted' })
  }

  // ─── Comments ─────────────────────────────────────

  async getApprovedComments(request: FastifyRequest, reply: FastifyReply) {
    const { postId } = request.params as { postId: string }
    const comments = await this.service.getApprovedComments(postId)
    return reply.send({ success: true, data: comments })
  }

  async submitComment(request: FastifyRequest, reply: FastifyReply) {
    const { postId } = request.params as { postId: string }
    const dto = CreateBlogCommentSchema.parse(request.body)
    const comment = await this.service.submitComment(postId, dto)
    return reply.status(201).send({ success: true, data: comment, message: 'Comment submitted for review' })
  }

  async listAllComments(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, limit = 20, status } = request.query as any
    const result = await this.service.listAllComments(Number(page), Number(limit), status)
    return reply.send({ success: true, data: result.data, pagination: result.pagination })
  }

  async updateCommentStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const dto = UpdateCommentStatusSchema.parse(request.body)
    const comment = await this.service.updateCommentStatus(id, dto.status)
    return reply.send({ success: true, data: comment, message: 'Comment status updated' })
  }

  async deleteComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const result = await this.service.deleteComment(id)
    return reply.send({ success: true, data: result, message: 'Comment deleted' })
  }

  // ─── Categories ───────────────────────────────────

  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const categories = await this.service.listCategories()
    return reply.send({ success: true, data: categories })
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateBlogCategorySchema.parse(request.body)
    const category = await this.service.createCategory(dto)
    return reply.status(201).send({ success: true, data: category, message: 'Category created' })
  }

  async deleteCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const result = await this.service.deleteCategory(id)
    return reply.send({ success: true, data: result, message: 'Category deleted' })
  }
}

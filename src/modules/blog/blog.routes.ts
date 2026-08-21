import type { FastifyInstance } from 'fastify'
import { BlogController } from './blog.controller'
import { BlogService } from './blog.service'
import { requireRole } from '../../shared/middleware'
import { parseMultipart } from '../../shared/utils/multipart'
import { ValidationError } from '../../shared/errors'
import { fileService } from '../../shared/services/file.service'

export async function blogRoutes(fastify: FastifyInstance) {
  const service = new BlogService(fastify.db)
  const controller = new BlogController(service)

  // ─── Public routes ────────────────────────────────

  fastify.get('/categories', (req, rep) => controller.listCategories(req, rep))
  fastify.get('/', (req, rep) => controller.listPosts(req, rep))
  fastify.get<{ Params: { slug: string } }>('/:slug', (req, rep) => controller.getPostBySlug(req, rep))
  fastify.get<{ Params: { postId: string } }>('/:postId/comments', (req, rep) => controller.getApprovedComments(req, rep))
  fastify.post<{ Params: { postId: string } }>('/:postId/comments', (req, rep) => controller.submitComment(req, rep))

  // ─── Admin routes ─────────────────────────────────

  fastify.post('/upload', { preHandler: requireRole('admin_doctor') }, async (request, reply) => {
    const contentType = request.headers['content-type'] || ''
    if (!contentType.includes('multipart')) {
      throw new ValidationError('Request must be multipart/form-data')
    }

    const parts = request.parts()
    const { files } = await parseMultipart(parts, ['blog_image'])

    if (files.length === 0) {
      throw new ValidationError('No file uploaded')
    }

    const bf = files[0]
    const metadata = await fileService.saveFile('blog', 'images', bf.originalName, bf.buffer)

    return reply.status(201).send({
      success: true,
      data: { url: metadata.publicPath },
      message: 'Image uploaded successfully',
    })
  })

  fastify.get('/admin/posts', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.listAllPosts(req, rep))
  fastify.post('/posts', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.createPost(req, rep))
  fastify.patch<{ Params: { id: string } }>('/posts/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.updatePost(req, rep))
  fastify.delete<{ Params: { id: string } }>('/posts/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.deletePost(req, rep))

  fastify.get('/admin/comments', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.listAllComments(req, rep))
  fastify.patch<{ Params: { id: string } }>('/admin/comments/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.updateCommentStatus(req, rep))
  fastify.delete<{ Params: { id: string } }>('/admin/comments/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.deleteComment(req, rep))

  fastify.post('/admin/categories', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.createCategory(req, rep))
  fastify.delete<{ Params: { id: string } }>('/admin/categories/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.deleteCategory(req, rep))
}

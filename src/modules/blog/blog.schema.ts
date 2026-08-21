import { z } from 'zod'

export const CreateBlogPostSchema = z.object({
  title_fa: z.string().min(2).max(500),
  title_en: z.string().max(500).optional().nullable(),
  slug: z.string().min(2).max(500).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  excerpt_fa: z.string().min(2).max(2000),
  excerpt_en: z.string().max(2000).optional().nullable(),
  content_fa: z.string().min(2),
  content_en: z.string().optional().nullable(),
  cover_image: z.string().max(1000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  is_published: z.boolean().default(false),
})

export const UpdateBlogPostSchema = CreateBlogPostSchema.partial()

export const CreateBlogCommentSchema = z.object({
  author_name: z.string().min(1).max(200),
  author_email: z.string().email().max(300),
  content: z.string().min(1).max(5000),
})

export const UpdateCommentStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
})

export const CreateBlogCategorySchema = z.object({
  name_fa: z.string().min(2).max(200),
  name_en: z.string().max(200).optional().nullable(),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  sort_order: z.number().int().default(0),
})

export const UpdateBlogCategorySchema = CreateBlogCategorySchema.partial()

export type CreateBlogPostDto = z.infer<typeof CreateBlogPostSchema>
export type UpdateBlogPostDto = z.infer<typeof UpdateBlogPostSchema>
export type CreateBlogCommentDto = z.infer<typeof CreateBlogCommentSchema>
export type UpdateCommentStatusDto = z.infer<typeof UpdateCommentStatusSchema>
export type CreateBlogCategoryDto = z.infer<typeof CreateBlogCategorySchema>
export type UpdateBlogCategoryDto = z.infer<typeof UpdateBlogCategorySchema>

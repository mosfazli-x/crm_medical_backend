import type { DB } from '../../db/client'
import { blogPosts, blogComments, blogCategories, users } from '../../db/schema'
import { eq, and, desc, sql, ilike, or, SQL } from 'drizzle-orm'
import { NotFoundError, ConflictError } from '../../shared/errors'
import type { CreateBlogPostDto, UpdateBlogPostDto, CreateBlogCommentDto, CreateBlogCategoryDto } from './blog.schema'

function slugify(text: string): string {
  // Transliterate common Farsi characters to ASCII equivalents
  const transliterated = text
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48)) // Persian digits → ASCII
    .replace(/[آأإا]/g, 'a').replace(/[ب]/g, 'b').replace(/[پ]/g, 'p').replace(/[ت]/g, 't')
    .replace(/[ث]/g, 's').replace(/[ج]/g, 'j').replace(/[چ]/g, 'ch').replace(/[ح]/g, 'h')
    .replace(/[خ]/g, 'kh').replace(/[د]/g, 'd').replace(/[ذ]/g, 'z').replace(/[ر]/g, 'r')
    .replace(/[ز]/g, 'z').replace(/[ژ]/g, 'zh').replace(/[س]/g, 's').replace(/[ش]/g, 'sh')
    .replace(/[ص]/g, 's').replace(/[ض]/g, 'z').replace(/[ط]/g, 't').replace(/[ظ]/g, 'z')
    .replace(/[ع]/g, 'a').replace(/[غ]/g, 'gh').replace(/[ف]/g, 'f').replace(/[ق]/g, 'gh')
    .replace(/[ک]/g, 'k').replace(/[گ]/g, 'g').replace(/[ل]/g, 'l').replace(/[م]/g, 'm')
    .replace(/[ن]/g, 'n').replace(/[و]/g, 'v').replace(/[ه]/g, 'h').replace(/[ی]/g, 'y')

  const slug = transliterated
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200)

  // Fallback: if slug is empty (e.g. all special chars), use a timestamp-based slug
  return slug || `post-${Date.now()}`
}

export class BlogService {
  constructor(private db: DB) {}

  // ─── Posts (public) ───────────────────────────────

  async listPublishedPosts(page = 1, limit = 12, categoryId?: string) {
    const offset = (page - 1) * limit
    const conditions: SQL[] = [eq(blogPosts.isPublished, true)]

    if (categoryId) {
      conditions.push(eq(blogPosts.categoryId, categoryId))
    }

    const whereClause = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: blogPosts.id,
          titleFa: blogPosts.titleFa,
          titleEn: blogPosts.titleEn,
          slug: blogPosts.slug,
          excerptFa: blogPosts.excerptFa,
          excerptEn: blogPosts.excerptEn,
          coverImage: blogPosts.coverImage,
          categoryId: blogPosts.categoryId,
          authorId: blogPosts.authorId,
          publishedAt: blogPosts.publishedAt,
          viewCount: blogPosts.viewCount,
          createdAt: blogPosts.createdAt,
          authorName: users.fullName,
        })
        .from(blogPosts)
        .leftJoin(users, eq(blogPosts.authorId, users.id))
        .where(whereClause)
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(blogPosts)
        .where(whereClause),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    }
  }

  async getPostBySlug(slug: string) {
    const [post] = await this.db
      .select({
        id: blogPosts.id,
        titleFa: blogPosts.titleFa,
        titleEn: blogPosts.titleEn,
        slug: blogPosts.slug,
        excerptFa: blogPosts.excerptFa,
        excerptEn: blogPosts.excerptEn,
        contentFa: blogPosts.contentFa,
        contentEn: blogPosts.contentEn,
        coverImage: blogPosts.coverImage,
        categoryId: blogPosts.categoryId,
        authorId: blogPosts.authorId,
        isPublished: blogPosts.isPublished,
        publishedAt: blogPosts.publishedAt,
        viewCount: blogPosts.viewCount,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        authorName: users.fullName,
      })
      .from(blogPosts)
      .leftJoin(users, eq(blogPosts.authorId, users.id))
      .where(eq(blogPosts.slug, slug))
      .limit(1)

    if (!post) throw new NotFoundError('Blog post')

    await this.db
      .update(blogPosts)
      .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.id, post.id))

    return { ...post, viewCount: (post.viewCount || 0) + 1 }
  }

  // ─── Posts (admin) ────────────────────────────────

  async listAllPosts(page = 1, limit = 20) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: blogPosts.id,
          titleFa: blogPosts.titleFa,
          titleEn: blogPosts.titleEn,
          slug: blogPosts.slug,
          excerptFa: blogPosts.excerptFa,
          coverImage: blogPosts.coverImage,
          categoryId: blogPosts.categoryId,
          authorId: blogPosts.authorId,
          isPublished: blogPosts.isPublished,
          publishedAt: blogPosts.publishedAt,
          viewCount: blogPosts.viewCount,
          createdAt: blogPosts.createdAt,
          updatedAt: blogPosts.updatedAt,
          authorName: users.fullName,
        })
        .from(blogPosts)
        .leftJoin(users, eq(blogPosts.authorId, users.id))
        .orderBy(desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(blogPosts),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    }
  }

  async createPost(dto: CreateBlogPostDto, authorId: string) {
    const slug = dto.slug || slugify(dto.title_fa)

    const existing = await this.db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1)
    if (existing.length > 0) throw new ConflictError('A post with this slug already exists')

    const [post] = await this.db
      .insert(blogPosts)
      .values({
        titleFa: dto.title_fa,
        titleEn: dto.title_en || null,
        slug,
        excerptFa: dto.excerpt_fa,
        excerptEn: dto.excerpt_en || null,
        contentFa: dto.content_fa,
        contentEn: dto.content_en || null,
        coverImage: dto.cover_image || null,
        categoryId: dto.category_id || null,
        authorId,
        isPublished: dto.is_published || false,
        publishedAt: dto.is_published ? new Date() : null,
      })
      .returning()

    return post
  }

  async updatePost(id: string, dto: UpdateBlogPostDto) {
    const existing = await this.db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1)
    if (existing.length === 0) throw new NotFoundError('Blog post')

    const updateData: Record<string, unknown> = {}
    if (dto.title_fa !== undefined) updateData.titleFa = dto.title_fa
    if (dto.title_en !== undefined) updateData.titleEn = dto.title_en
    if (dto.excerpt_fa !== undefined) updateData.excerptFa = dto.excerpt_fa
    if (dto.excerpt_en !== undefined) updateData.excerptEn = dto.excerpt_en
    if (dto.content_fa !== undefined) updateData.contentFa = dto.content_fa
    if (dto.content_en !== undefined) updateData.contentEn = dto.content_en
    if (dto.cover_image !== undefined) updateData.coverImage = dto.cover_image
    if (dto.category_id !== undefined) updateData.categoryId = dto.category_id

    if (dto.slug && dto.slug !== existing[0].slug) {
      const slugConflict = await this.db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.slug, dto.slug), sql`${blogPosts.id} != ${id}`)).limit(1)
      if (slugConflict.length > 0) throw new ConflictError('A post with this slug already exists')
      updateData.slug = dto.slug
    } else if (dto.title_fa !== undefined && dto.slug === undefined) {
      const newSlug = slugify(dto.title_fa)
      if (newSlug !== existing[0].slug) {
        const slugConflict = await this.db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.slug, newSlug), sql`${blogPosts.id} != ${id}`)).limit(1)
        if (slugConflict.length > 0) throw new ConflictError('A post with this slug already exists')
        updateData.slug = newSlug
      }
    }

    if (dto.is_published !== undefined) {
      updateData.isPublished = dto.is_published
      if (dto.is_published && !existing[0].publishedAt) {
        updateData.publishedAt = new Date()
      }
    }

    updateData.updatedAt = new Date()

    const [updated] = await this.db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning()

    return updated
  }

  async deletePost(id: string) {
    const [deleted] = await this.db
      .delete(blogPosts)
      .where(eq(blogPosts.id, id))
      .returning()

    if (!deleted) throw new NotFoundError('Blog post')
    return { id: deleted.id, deleted: true }
  }

  // ─── Comments ─────────────────────────────────────

  async getApprovedComments(postId: string) {
    return this.db
      .select({
        id: blogComments.id,
        authorName: blogComments.authorName,
        content: blogComments.content,
        createdAt: blogComments.createdAt,
      })
      .from(blogComments)
      .where(and(eq(blogComments.postId, postId), eq(blogComments.status, 'approved')))
      .orderBy(desc(blogComments.createdAt))
  }

  async submitComment(postId: string, dto: CreateBlogCommentDto) {
    const [post] = await this.db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)
    if (!post) throw new NotFoundError('Blog post')

    const [comment] = await this.db
      .insert(blogComments)
      .values({
        postId,
        authorName: dto.author_name,
        authorEmail: dto.author_email,
        content: dto.content,
        status: 'pending',
      })
      .returning()

    return comment
  }

  async listAllComments(page = 1, limit = 20, status?: string) {
    const offset = (page - 1) * limit
    const conditions: SQL[] = []
    if (status) {
      conditions.push(eq(blogComments.status, status))
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: blogComments.id,
          postId: blogComments.postId,
          authorName: blogComments.authorName,
          authorEmail: blogComments.authorEmail,
          content: blogComments.content,
          status: blogComments.status,
          createdAt: blogComments.createdAt,
          postTitle: blogPosts.titleFa,
          postSlug: blogPosts.slug,
        })
        .from(blogComments)
        .leftJoin(blogPosts, eq(blogComments.postId, blogPosts.id))
        .where(whereClause)
        .orderBy(desc(blogComments.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(blogComments)
        .where(whereClause),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    }
  }

  async updateCommentStatus(id: string, status: string) {
    const [updated] = await this.db
      .update(blogComments)
      .set({ status })
      .where(eq(blogComments.id, id))
      .returning()

    if (!updated) throw new NotFoundError('Blog comment')
    return updated
  }

  async deleteComment(id: string) {
    const [deleted] = await this.db
      .delete(blogComments)
      .where(eq(blogComments.id, id))
      .returning()

    if (!deleted) throw new NotFoundError('Blog comment')
    return { id: deleted.id, deleted: true }
  }

  // ─── Categories ───────────────────────────────────

  async listCategories() {
    return this.db
      .select()
      .from(blogCategories)
      .orderBy(blogCategories.sortOrder, blogCategories.nameFa)
  }

  async createCategory(dto: CreateBlogCategoryDto) {
    const existing = await this.db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, dto.slug)).limit(1)
    if (existing.length > 0) throw new ConflictError('A category with this slug already exists')

    const [category] = await this.db
      .insert(blogCategories)
      .values({
        nameFa: dto.name_fa,
        nameEn: dto.name_en || null,
        slug: dto.slug,
        sortOrder: dto.sort_order || 0,
      })
      .returning()

    return category
  }

  async deleteCategory(id: string) {
    const [deleted] = await this.db
      .delete(blogCategories)
      .where(eq(blogCategories.id, id))
      .returning()

    if (!deleted) throw new NotFoundError('Blog category')
    return { id: deleted.id, deleted: true }
  }
}

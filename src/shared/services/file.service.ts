import path from 'node:path'
import fs from 'node:fs/promises'
import { env } from '../../config/env'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export class FileService {
  async ensureUploadDir(): Promise<void> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }

  getUploadDir(): string {
    return UPLOAD_DIR
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, filename))
    } catch {
      // File already deleted or not found
    }
  }

  buildPublicPath(filename: string): string {
    return `/uploads/${filename}`
  }

  generateFilename(originalName: string): string {
    const ext = path.extname(originalName)
    return `${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`
  }
}

export const fileService = new FileService()

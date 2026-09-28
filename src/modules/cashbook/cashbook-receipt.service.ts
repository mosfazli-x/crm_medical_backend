import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { env } from '../../config/env'
import { ValidationError } from '../../shared/errors'
import { S3StorageProvider } from '../../shared/services/storage/s3.provider.js'

const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const S3_RECEIPT_PREFIX = 'private/cashbook-receipts'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif'
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  return null
}

function comparablePath(value: string): string {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function assertPrivateBase(): string {
  const base = path.resolve(env.CASHBOOK_RECEIPT_DIR)
  const publicBase = path.resolve(env.UPLOAD_DIR)
  const comparableBase = comparablePath(base)
  const comparablePublicBase = comparablePath(publicBase)
  if (comparableBase === comparablePublicBase || comparableBase.startsWith(`${comparablePublicBase}${path.sep}`)) {
    throw new Error('Cashbook receipt storage must be outside the public upload directory')
  }
  return base
}

export interface StoredCashbookReceipt {
  storageKey: string
  originalName: string
  mimeType: string
  fileSize: number
  fileHash: string
}

export class CashbookReceiptStorage {
  private readonly driver = env.STORAGE_DRIVER
  private readonly baseDir = this.driver === 'local' ? assertPrivateBase() : ''
  private readonly s3Provider = this.driver === 's3' ? new S3StorageProvider() : null

  async save(buffer: Buffer, originalName: string): Promise<StoredCashbookReceipt> {
    if (buffer.length === 0) throw new ValidationError('Receipt file is empty')
    if (buffer.length > env.MAX_FILE_SIZE) throw new ValidationError('Receipt file exceeds the maximum allowed size')

    const mimeType = detectMimeType(buffer)
    if (!mimeType || !RECEIPT_MIME_TYPES.has(mimeType)) {
      throw new ValidationError('Receipt must be a JPEG, PNG, WebP, GIF, or PDF file')
    }

    const extension = EXTENSIONS[mimeType]!
    const safeOriginalName = path.basename(originalName || `receipt.${extension}`).slice(0, 255)
    const fileHash = createHash('sha256').update(buffer).digest('hex')
    const year = new Date().getUTCFullYear()
    const fileName = `${randomUUID()}.${extension}`

    if (this.s3Provider) {
      const storageKey = `${S3_RECEIPT_PREFIX}/${year}/${fileName}`
      await this.s3Provider.putPrivateFile(storageKey, buffer, mimeType, {
        originalName: safeOriginalName,
        fileHash,
      })
      return { storageKey, originalName: safeOriginalName, mimeType, fileSize: buffer.length, fileHash }
    }

    const storageKey = `${year}/${fileName}`
    const absolutePath = this.resolve(storageKey)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' })

    return { storageKey, originalName: safeOriginalName, mimeType, fileSize: buffer.length, fileHash }
  }

  async remove(storageKey: string): Promise<void> {
    if (this.s3Provider) {
      await this.s3Provider.deleteFile(this.resolveS3Key(storageKey))
      return
    }
    try {
      await fs.unlink(this.resolve(storageKey))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async open(storageKey: string): Promise<{ stream: NodeJS.ReadableStream; size: number } | null> {
    if (this.s3Provider) {
      const file = await this.s3Provider.getFileStream(this.resolveS3Key(storageKey))
      return file ? { stream: file.stream, size: file.size } : null
    }
    const absolutePath = this.resolve(storageKey)
    try {
      const stats = await fs.stat(absolutePath)
      if (!stats.isFile()) return null
      return { stream: (await import('node:fs')).createReadStream(absolutePath), size: stats.size }
    } catch {
      return null
    }
  }

  private resolveS3Key(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, '/')
    if (!normalized.startsWith(`${S3_RECEIPT_PREFIX}/`) || normalized.includes('..')) {
      throw new ValidationError('Invalid receipt storage path')
    }
    return normalized
  }

  private resolve(storageKey: string): string {
    const resolved = path.resolve(this.baseDir, storageKey)
    const comparableBase = comparablePath(this.baseDir)
    const comparableResolved = comparablePath(resolved)
    if (comparableResolved !== comparableBase && !comparableResolved.startsWith(`${comparableBase}${path.sep}`)) {
      throw new ValidationError('Invalid receipt storage path')
    }
    return resolved
  }
}

export const cashbookReceiptStorage = new CashbookReceiptStorage()

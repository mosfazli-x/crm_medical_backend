import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  GetObjectCommandInput,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash, randomUUID } from 'node:crypto'
import { env } from '../../../config/env.js'

const MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffdb'],
  'image/png': ['89504e47'],
  'image/webp': ['52494646'],
  'image/svg+xml': ['3c737667', '3c3f786d'],
  'application/pdf': ['25504446'],
  'image/gif': ['47494638'],
  'image/bmp': ['424d'],
}

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
}

export interface S3FileMetadata {
  originalName: string
  savedName: string
  key: string
  publicPath: string
  mimeType: string
  fileHash: string
  fileSize: number
}

export class S3StorageProvider {
  private client: S3Client
  private bucket: string
  private endpoint: string

  constructor() {
    this.bucket = env.S3_BUCKET
    this.endpoint = `https://${env.S3_ENDPOINT}`

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY!,
        secretAccessKey: env.S3_SECRET_KEY!,
      },
      forcePathStyle: true,
    })
  }

  getAllowedMimeTypes(): string[] {
    return env.ALLOWED_MIME_TYPES.split(',').map((t) => t.trim())
  }

  getMaxFileSize(): number {
    return env.MAX_FILE_SIZE
  }

  private detectMimeType(buffer: Buffer, originalName: string): string {
    const hexSignature = buffer.subarray(0, 8).toString('hex').toLowerCase()
    for (const [mime, signatures] of Object.entries(MIME_TYPES)) {
      for (const sig of signatures) {
        if (hexSignature.startsWith(sig)) return mime
      }
    }
    const ext = Object.keys(EXTENSION_TO_MIME).find((e) => originalName.toLowerCase().endsWith(e))
    return ext ? EXTENSION_TO_MIME[ext] : 'application/octet-stream'
  }

  private isAllowedMimeType(mimeType: string): boolean {
    return this.getAllowedMimeTypes().includes(mimeType)
  }

  private generateFilename(originalName: string): string {
    const ext = Object.keys(EXTENSION_TO_MIME).find((e) => originalName.toLowerCase().endsWith(e)) || '.bin'
    const uuid = randomUUID().replace(/-/g, '').substring(0, 12)
    return `${Date.now()}-${uuid}${ext}`
  }

  private computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  buildKey(patientId: string, fileType: string, savedName: string): string {
    return `patients/${patientId}/${fileType}/${savedName}`
  }

  async saveFile(
    patientId: string,
    fileType: string,
    originalName: string,
    buffer: Buffer
  ): Promise<S3FileMetadata> {
    const mimeType = this.detectMimeType(buffer, originalName)
    if (!this.isAllowedMimeType(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed. Allowed: ${this.getAllowedMimeTypes().join(', ')}`)
    }

    if (buffer.length > this.getMaxFileSize()) {
      throw new Error(`File size ${buffer.length} exceeds maximum ${this.getMaxFileSize()}`)
    }

    const fileHash = this.computeHash(buffer)
    const savedName = this.generateFilename(originalName)
    const key = this.buildKey(patientId, fileType, savedName)

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          originalName,
          fileHash,
          patientId,
          fileType,
        },
      })
    )

    return {
      originalName,
      savedName,
      key,
      publicPath: `/uploads/${key}`,
      mimeType,
      fileHash,
      fileSize: buffer.length,
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      )
    } catch (error) {
      console.error(`Failed to delete S3 object: ${key}`, error)
    }
  }

  async moveFileToTrash(key: string): Promise<void> {
    try {
      const trashKey = `.trash/${Date.now()}-${key.replace(/\//g, '_')}`
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${key}`,
          Key: trashKey,
        })
      )
      await this.deleteFile(key)
    } catch (error) {
      console.error(`Failed to move S3 object to trash: ${key}`, error)
    }
  }

  async getFileStream(key: string): Promise<{ stream: NodeJS.ReadableStream; size: number; contentType: string } | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      )

      return {
        stream: response.Body as NodeJS.ReadableStream,
        size: Number(response.ContentLength) || 0,
        contentType: response.ContentType || 'application/octet-stream',
      }
    } catch (error: any) {
      if (error.name === 'NoSuchKey') return null
      console.error(`Failed to get S3 object: ${key}`, error)
      return null
    }
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600, contentDisposition?: string): Promise<string | null> {
    try {
      const params: GetObjectCommandInput = {
        Bucket: this.bucket,
        Key: key,
      }
      if (contentDisposition) {
        params.ResponseContentDisposition = contentDisposition
      }
      const command = new GetObjectCommand(params)
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } catch (error) {
      console.error(`Failed to generate presigned URL: ${key}`, error)
      return null
    }
  }

  async getStorageUsage(): Promise<{ usedBytes: number; usedFormatted: string }> {
    let totalBytes = 0
    try {
      let continuationToken: string | undefined
      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            ContinuationToken: continuationToken,
          })
        )

        if (response.Contents) {
          for (const obj of response.Contents) {
            totalBytes += obj.Size || 0
          }
        }

        continuationToken = response.NextContinuationToken
      } while (continuationToken)
    } catch (error) {
      console.error('Failed to calculate S3 storage usage', error)
    }

    return { usedBytes: totalBytes, usedFormatted: this.formatBytes(totalBytes) }
  }

  async verifyFileIntegrity(key: string, expectedHash: string): Promise<boolean> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      )

      const body = await response.Body?.transformToByteArray()
      if (!body) return false

      const actualHash = this.computeHash(Buffer.from(body))
      return actualHash === expectedHash
    } catch {
      return false
    }
  }

  async cleanTrash(maxAgeDays: number = 30): Promise<number> {
    let cleaned = 0
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: '.trash/',
        })
      )

      if (response.Contents) {
        const now = Date.now()
        for (const obj of response.Contents) {
          const ageMs = now - (obj.LastModified?.getTime() || 0)
          if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000 && obj.Key) {
            await this.deleteFile(obj.Key)
            cleaned++
          }
        }
      }
    } catch (error) {
      console.error('Failed to clean S3 trash', error)
    }
    return cleaned
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}

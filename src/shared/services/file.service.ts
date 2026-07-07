import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { env } from '../../config/env'
import { S3StorageProvider } from './storage/s3.provider.js'

export interface FileMetadata {
  originalName: string
  savedName: string
  relativePath: string
  absolutePath: string
  publicPath: string
  mimeType: string
  fileHash: string
  fileSize: number
}

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

export class FileService {
  private driver: 'local' | 's3'
  private baseDir: string
  private backupDir: string | null
  private s3Provider: S3StorageProvider | null = null

  constructor() {
    this.driver = env.STORAGE_DRIVER
    this.baseDir = path.resolve(env.UPLOAD_DIR)
    this.backupDir = env.BACKUP_ENABLED && env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : null

    if (this.driver === 's3') {
      this.s3Provider = new S3StorageProvider()
    }
  }

  getBaseDir(): string {
    return this.baseDir
  }

  getAllowedMimeTypes(): string[] {
    return env.ALLOWED_MIME_TYPES.split(',').map((t) => t.trim())
  }

  getMaxFileSize(): number {
    return env.MAX_FILE_SIZE
  }

  private computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
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

  async savePatientFile(
    patientId: string,
    fileType: string,
    originalName: string,
    buffer: Buffer
  ): Promise<FileMetadata> {
    const mimeType = this.detectMimeType(buffer, originalName)
    if (!this.isAllowedMimeType(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed. Allowed: ${this.getAllowedMimeTypes().join(', ')}`)
    }

    if (buffer.length > this.getMaxFileSize()) {
      throw new Error(`File size ${buffer.length} exceeds maximum ${this.getMaxFileSize()}`)
    }

    const fileHash = this.computeHash(buffer)
    const savedName = this.generateFilename(originalName)

    if (this.driver === 's3' && this.s3Provider) {
      const result = await this.s3Provider.saveFile(patientId, fileType, originalName, buffer)
      return {
        originalName: result.originalName,
        savedName: result.savedName,
        relativePath: result.key,
        absolutePath: result.key,
        publicPath: result.publicPath,
        mimeType: result.mimeType,
        fileHash: result.fileHash,
        fileSize: result.fileSize,
      }
    }

    const relativePath = path.join('patients', patientId, fileType, savedName)
    const targetDir = path.join(this.baseDir, 'patients', patientId, fileType)
    const absolutePath = path.join(targetDir, savedName)

    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(absolutePath, buffer)

    if (this.backupDir) {
      await this.backupLocalFile(buffer, patientId, fileType, savedName)
    }

    return {
      originalName,
      savedName,
      relativePath: relativePath.replace(/\\/g, '/'),
      absolutePath,
      publicPath: `/uploads/${relativePath.replace(/\\/g, '/')}`,
      mimeType,
      fileHash,
      fileSize: buffer.length,
    }
  }

  private async backupLocalFile(buffer: Buffer, patientId: string, fileType: string, savedName: string): Promise<void> {
    try {
      const backupDir = path.join(this.backupDir!, 'patients', patientId, fileType)
      await fs.mkdir(backupDir, { recursive: true })
      await fs.writeFile(path.join(backupDir, savedName), buffer)
    } catch (error) {
      console.error(`Backup failed for ${patientId}/${fileType}/${savedName}:`, error)
    }
  }

  async moveFileToTrash(relativePathOrKey: string): Promise<void> {
    if (this.driver === 's3' && this.s3Provider) {
      return this.s3Provider.moveFileToTrash(relativePathOrKey)
    }

    try {
      const sourcePath = path.join(this.baseDir, relativePathOrKey)
      const trashDir = path.join(this.baseDir, '.trash')
      await fs.mkdir(trashDir, { recursive: true })
      const trashName = `${Date.now()}-${path.basename(relativePathOrKey)}`
      await fs.rename(sourcePath, path.join(trashDir, trashName))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Failed to move file to trash: ${relativePathOrKey}`, error)
      }
    }
  }

  async deleteFile(target: string): Promise<void> {
    if (this.driver === 's3' && this.s3Provider) {
      return this.s3Provider.deleteFile(target)
    }

    try {
      await fs.unlink(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Failed to delete file: ${target}`, error)
      }
    }
  }

  async getFileStream(absolutePathOrKey: string): Promise<{
    stream: NodeJS.ReadableStream | fs.FileHandle
    size: number
    contentType?: string
  } | null> {
    if (this.driver === 's3' && this.s3Provider) {
      const result = await this.s3Provider.getFileStream(absolutePathOrKey)
      if (!result) return null
      return {
        stream: result.stream,
        size: result.size,
        contentType: result.contentType,
      }
    }

    try {
      const stats = await fs.stat(absolutePathOrKey)
      const fileHandle = await fs.open(absolutePathOrKey, 'r')
      return { stream: fileHandle, size: stats.size }
    } catch {
      return null
    }
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string | null> {
    if (this.driver === 's3' && this.s3Provider) {
      return this.s3Provider.getPresignedUrl(key, expiresInSeconds)
    }
    return null
  }

  getAbsolutePath(relativePath: string): string {
    return path.join(this.baseDir, relativePath)
  }

  async verifyFileIntegrity(target: string, expectedHash: string): Promise<boolean> {
    if (this.driver === 's3' && this.s3Provider) {
      return this.s3Provider.verifyFileIntegrity(target, expectedHash)
    }

    try {
      const filePath = path.isAbsolute(target) ? target : path.join(this.baseDir, target)
      const buffer = await fs.readFile(filePath)
      const actualHash = this.computeHash(buffer)
      return actualHash === expectedHash
    } catch {
      return false
    }
  }

  async getStorageUsage(): Promise<{ usedBytes: number; usedFormatted: string }> {
    if (this.driver === 's3' && this.s3Provider) {
      return this.s3Provider.getStorageUsage()
    }

    const usedBytes = await this.calculateDirectorySize(this.baseDir)
    return { usedBytes, usedFormatted: this.formatBytes(usedBytes) }
  }

  async cleanTrash(maxAgeDays: number = 30): Promise<number> {
    if (this.driver === 's3' && this.s3Provider) {
      return this.s3Provider.cleanTrash(maxAgeDays)
    }

    const trashDir = path.join(this.baseDir, '.trash')
    let cleaned = 0
    try {
      const entries = await fs.readdir(trashDir)
      const now = Date.now()
      for (const entry of entries) {
        const fullPath = path.join(trashDir, entry)
        try {
          const stats = await fs.stat(fullPath)
          if (now - stats.mtimeMs > maxAgeDays * 24 * 60 * 60 * 1000) {
            await fs.unlink(fullPath)
            cleaned++
          }
        } catch {
          // skip
        }
      }
    } catch {
      // trash dir doesn't exist
    }
    return cleaned
  }

  async performFullBackup(): Promise<{ success: boolean; filesCopied: number }> {
    if (this.driver === 's3') return { success: false, filesCopied: 0 }

    if (!this.backupDir) return { success: false, filesCopied: 0 }

    let filesCopied = 0
    try {
      filesCopied = await this.copyDirRecursive(this.baseDir, this.backupDir, ['.trash'])
      return { success: true, filesCopied }
    } catch (error) {
      console.error('Full backup failed:', error)
      return { success: false, filesCopied }
    }
  }

  private async copyDirRecursive(src: string, dest: string, exclude: string[] = []): Promise<number> {
    let count = 0
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        count += await this.copyDirRecursive(srcPath, destPath, exclude)
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath)
        count++
      }
    }
    return count
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath)
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath)
          totalSize += stat.size
        }
      }
    } catch {
      // dir doesn't exist
    }
    return totalSize
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}

export const fileService = new FileService()

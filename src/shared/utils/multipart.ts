import { fileService, type FileMetadata } from '../services/file.service.js'

export interface SavedFile {
  type: 'ultrasound' | 'lab' | 'prescription' | 'patient_files'
  fieldname?: string
  originalName: string
  savedName: string
  publicPath: string
  filePath: string
  fileHash: string
  fileSize: number
  mimeType: string
  relativePath: string
}

export interface BufferedFile {
  type: string
  fieldname: string
  originalName: string
  buffer: Buffer
}

export const ATTACHMENT_TYPES = [
  'ultrasound',
  'lab',
  'prescription',
  'patient_files',
  'hormone',
  'tumor_marker',
  'cytology',
  'pathology',
  'microbiology',
  'genetics',
  'hematology',
  'biochemistry',
  'urinalysis',
  'molecular',
  'other',
] as const

const ALLOWED_FILE_TYPES = [...ATTACHMENT_TYPES] as const

export async function parseMultipart(
  parts: AsyncIterable<unknown>,
  allowedTypes: readonly string[] = ALLOWED_FILE_TYPES
): Promise<{ files: BufferedFile[]; fields: Record<string, string | string[]> }> {
  const files: BufferedFile[] = []
  const fields: Record<string, string | string[]> = {}

  for await (const part of parts) {
    const typedPart = part as {
      type: string
      fieldname: string
      filename?: string
      toBuffer?: () => Promise<Buffer>
      value?: string
    }

    if (typedPart.type === 'file' && typedPart.toBuffer) {
      const fieldName = typedPart.fieldname.replace('[]', '')
      if (allowedTypes.includes(fieldName)) {
        const buffer = await typedPart.toBuffer()
        files.push({
          type: fieldName,
          fieldname: typedPart.fieldname,
          originalName: typedPart.filename || 'unknown',
          buffer,
        })
      }
    } else if (typedPart.value !== undefined) {
      const val = typedPart.value
      if (fields[typedPart.fieldname]) {
        const cur = fields[typedPart.fieldname]
        if (Array.isArray(cur)) {
          cur.push(val)
        } else {
          fields[typedPart.fieldname] = [cur, val]
        }
      } else {
        fields[typedPart.fieldname] = val
      }
    }
  }

  return { files, fields }
}

export async function saveBufferedFiles(
  bufferedFiles: BufferedFile[],
  patientId: string
): Promise<SavedFile[]> {
  const saved: SavedFile[] = []

  for (const bf of bufferedFiles) {
    const metadata: FileMetadata = await fileService.savePatientFile(
      patientId,
      bf.type,
      bf.originalName,
      bf.buffer
    )

    saved.push({
      type: bf.type as SavedFile['type'],
      fieldname: bf.fieldname,
      originalName: bf.originalName,
      savedName: metadata.savedName,
      publicPath: metadata.publicPath,
      filePath: metadata.publicPath,
      fileHash: metadata.fileHash,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      relativePath: metadata.relativePath,
    })
  }

  return saved
}

export async function cleanupFiles(files: SavedFile[]) {
  await Promise.all(
    files.map((f) =>
      fileService.deleteFile(fileService.getAbsolutePath(f.relativePath)).catch(() => {})
    )
  )
}

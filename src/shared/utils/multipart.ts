import path from 'node:path'
import fs from 'node:fs/promises'

export interface SavedFile {
  type: 'ultrasound' | 'lab' | 'prescription'
  fieldname?: string
  originalName: string
  savedName: string
  publicPath: string
  filePath: string
}

const ALLOWED_FILE_TYPES = ['ultrasound', 'lab', 'prescription'] as const

export async function saveMultipartFiles(
  parts: AsyncIterable<unknown>,
  uploadDir: string
): Promise<{ files: SavedFile[]; fields: Record<string, string | string[]> }> {
  const files: SavedFile[] = []
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
      if (ALLOWED_FILE_TYPES.includes(fieldName as (typeof ALLOWED_FILE_TYPES)[number])) {
        await fs.mkdir(uploadDir, { recursive: true })
        const ext = path.extname(typedPart.filename || '')
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`
        const targetPath = path.join(uploadDir, uniqueFilename)

        const buffer = await typedPart.toBuffer()
        await fs.writeFile(targetPath, buffer)

        const publicPath = `/uploads/${uniqueFilename}`
        files.push({
          type: fieldName as SavedFile['type'],
          originalName: typedPart.filename || 'unknown',
          savedName: uniqueFilename,
          publicPath,
          filePath: publicPath,
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

export async function cleanupFiles(uploadDir: string, files: SavedFile[]) {
  await Promise.all(
    files.map((f) =>
      fs.unlink(path.join(uploadDir, f.savedName)).catch(() => {
      })
    )
  )
}

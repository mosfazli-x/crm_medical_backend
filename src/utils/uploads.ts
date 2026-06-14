import path from 'path'
import fs from 'fs/promises'

export type SavedFile = {
  type: 'ultrasound' | 'lab' | 'prescription'
  fieldname?: string
  originalName: string
  savedName: string
  publicPath: string
}

export async function saveMultipartParts(parts: AsyncIterable<any>, uploadDir: string) {
  const files: SavedFile[] = []
  const fields: Record<string, string | string[]> = {}

  for await (const part of parts) {
    if (part.type === 'file') {
      const fieldName = (part.fieldname || '').replace('[]', '') as SavedFile['type']
      if (['ultrasound', 'lab', 'prescription'].includes(fieldName)) {
        await fs.mkdir(uploadDir, { recursive: true })
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}${path.extname(part.filename || '')}`
        const targetPath = path.join(uploadDir, uniqueFilename)
        await fs.writeFile(targetPath, await part.toBuffer())
        files.push({
          type: fieldName,
          originalName: part.filename,
          savedName: uniqueFilename,
          publicPath: `/uploads/${uniqueFilename}`,
        })
      }
    } else {
      const val = part.value as string
      if (fields[part.fieldname]) {
        const cur = fields[part.fieldname]
        if (Array.isArray(cur)) cur.push(val)
        else fields[part.fieldname] = [cur as string, val]
      } else {
        fields[part.fieldname] = val
      }
    }
  }

  return { files, fields }
}

export async function cleanupSavedFiles(uploadDir: string, files: SavedFile[]) {
  for (const f of files) {
    try {
      await fs.unlink(path.join(uploadDir, f.savedName))
    } catch (e) {
      // ignore
    }
  }
}

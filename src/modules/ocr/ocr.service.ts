import { ProxyAgent } from 'undici'
import { env } from '../../config/env'
import { AppError } from '../../shared/errors'

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image'

/**
 * Engine 3 is OCR.space's handwriting-optimised engine.
 * See: https://ocr.space/ocrapi#ocrengine
 */
const OCR_ENGINE_HANDWRITING = '3'

interface OcrSpaceWord {
  WordText: string
  Left: number
  Top: number
  Height: number
  Width: number
}

interface OcrSpaceLine {
  Words: OcrSpaceWord[]
  MaxHeight: number
  MinTop: number
}

interface OcrSpaceParsedResult {
  TextOverlay: { Lines: OcrSpaceLine[]; HasOverlay: boolean; Message: string | null } | null
  FileParseExitCode: number | string
  ParsedText: string | null
  ErrorMessage: string | null
  ErrorDetails: string | null
}

interface OcrSpaceResponse {
  ParsedResults?: OcrSpaceParsedResult[]
  OCRExitCode?: number | string
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | null
  ErrorDetails?: string | null
}

export class OcrService {
  private static proxyAgent: ProxyAgent | undefined

  /**
   * Sends an image to OCR.space (Engine 3) and returns the recognised text.
   * The API key is read from the environment and never leaves the server.
   */
  async recognizeHandwriting(image: Buffer, mimeType: string, filename: string): Promise<string> {
    const apiKey = env.OCR_SPACE_API_KEY
    if (!apiKey) {
      throw new AppError('OCR service is not configured', 503)
    }

    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(image)], { type: mimeType }), filename)
    form.append('language', 'auto')
    form.append('OCREngine', OCR_ENGINE_HANDWRITING)
    form.append('scale', 'true')
    form.append('detectOrientation', 'true')
    form.append('isOverlayRequired', 'false')

    let response: Response
    try {
      response = await fetch(OCR_SPACE_ENDPOINT, {
        method: 'POST',
        headers: { apikey: apiKey },
        body: form,
        ...(env.OCR_SPACE_PROXY ? { dispatcher: OcrService.getProxyAgent() } : {}),
      })
    } catch {
      throw new AppError('Failed to reach the OCR service', 502)
    }

    let data: OcrSpaceResponse
    try {
      data = await response.json()
    } catch {
      throw new AppError('Invalid response from the OCR service', 502)
    }

    if (!response.ok) {
      throw new AppError(`OCR service error (${response.status})`, 502)
    }

    if (data.IsErroredOnProcessing) {
      throw new AppError(data.ErrorMessage || 'OCR processing failed', 502)
    }

    const exitCode = Number(data.OCRExitCode)
    // 1: fully parsed, 2: partially parsed
    if (exitCode === 1 || exitCode === 2) {
      return (data.ParsedResults ?? [])
        .map((result) => result.ParsedText ?? '')
        .filter(Boolean)
        .join('\n')
        .trim()
    }

    throw new AppError(data.ErrorMessage || data.ErrorDetails || 'OCR failed', 502)
  }

  private static getProxyAgent(): ProxyAgent {
    if (!OcrService.proxyAgent) {
      OcrService.proxyAgent = new ProxyAgent(env.OCR_SPACE_PROXY as string)
    }
    return OcrService.proxyAgent
  }
}

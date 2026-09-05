import { widgetSpecSchema, type WidgetSpec } from '../agent/widgets/widgetSpec'

export type GenieChatResult = {
  text: string
  widget?: WidgetSpec
}

export type GenieRequestErrorCode = 'cancelled' | 'timeout'

export class GenieRequestError extends Error {
  readonly code: GenieRequestErrorCode

  constructor(
    code: GenieRequestErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'GenieRequestError'
    this.code = code
  }
}

type AskGenieOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

type ModelResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>
    }
  }>
  data?: {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string }>
      }
    }>
  }
  error?: {
    message?: string
  } | string
}

function extractText(response: ModelResponse): string {
  const content = response.choices?.[0]?.message?.content ?? response.data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((item) => item.text ?? '').join('')
  return ''
}

export function parseGenieContent(content: string): GenieChatResult {
  const match = content.match(/<widget>\s*([\s\S]*?)\s*<\/widget>/i)
  if (!match) return { text: content.trim() }

  const text = content.replace(match[0], '').trim()
  try {
    const parsedWidget = widgetSpecSchema.safeParse(JSON.parse(match[1]))
    return parsedWidget.success ? { text, widget: parsedWidget.data } : { text }
  } catch {
    return { text }
  }
}

export async function askGenie(
  prompt: string,
  options: AskGenieOptions = {},
): Promise<GenieChatResult> {
  const controller = new AbortController()
  let didTimeout = false
  const abortFromCaller = () => controller.abort()
  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, options.timeoutMs ?? 15_000)

  if (options.signal?.aborted) {
    controller.abort()
  } else {
    options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  }

  try {
    const response = await fetch('/api/genie/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })
    const payload = await response.json() as ModelResponse
    const text = extractText(payload)

    if (!response.ok || !text) {
      const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
      throw new Error(message || 'Genie 暂时无法生成建议。')
    }

    return parseGenieContent(text)
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GenieRequestError(
        didTimeout ? 'timeout' : 'cancelled',
        didTimeout ? 'Genie 响应超时，请重试。' : '已取消本次生成。',
      )
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

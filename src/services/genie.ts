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
  instruction?: string
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

function readExplicitPercentage(instruction: string, labels: string): number | undefined {
  const match = instruction.match(
    new RegExp(`(?:${labels})\\s*(?:(?:调(?:整)?|设(?:置)?)(?:为|到)?|为|到)?\\s*([-+＋－]?\\d+(?:\\.\\d+)?)\\s*%?`, 'i'),
  )
  if (!match) return undefined

  const value = Number(match[1].replace('＋', '+').replace('－', '-'))
  return Number.isFinite(value) ? value : undefined
}

function normalizeExplicitVisualSettings(
  widget: WidgetSpec,
  instruction: string,
): WidgetSpec {
  if (widget.type !== 'visual-adjustment' || !instruction) return widget

  const brightness = readExplicitPercentage(instruction, '亮度|补光')
  const contrast = readExplicitPercentage(instruction, '对比度')
  const warmth = readExplicitPercentage(instruction, '暖色|暖肤')
  if (brightness === undefined && contrast === undefined && warmth === undefined) return widget

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))
  const settings = {
    ...widget.props.settings,
    ...(brightness === undefined
      ? {}
      : { brightness: 1 + clamp(brightness, -40, 60) / 100 }),
    ...(contrast === undefined
      ? {}
      : { contrast: 1 + clamp(contrast, -40, 60) / 100 }),
    ...(warmth === undefined
      ? {}
      : { warmth: clamp(warmth, 0, 60) / 100 }),
  }

  return widgetSpecSchema.parse({
    ...widget,
    props: { settings },
  })
}

export function parseGenieContent(
  content: string,
  instruction = '',
): GenieChatResult {
  const match = content.match(/<widget>\s*([\s\S]*?)\s*<\/widget>/i)
  if (!match) return { text: content.trim() }

  const text = content.replace(match[0], '').trim()
  try {
    const parsedWidget = widgetSpecSchema.safeParse(JSON.parse(match[1]))
    return parsedWidget.success
      ? {
          text,
          widget: normalizeExplicitVisualSettings(parsedWidget.data, instruction),
        }
      : { text }
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

    return parseGenieContent(text, options.instruction)
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

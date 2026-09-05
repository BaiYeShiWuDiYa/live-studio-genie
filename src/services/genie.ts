import { widgetSpecSchema, type WidgetSpec } from '../agent/widgets/widgetSpec'

export type GenieChatResult = {
  text: string
  widget?: WidgetSpec
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

export async function askGenie(prompt: string): Promise<GenieChatResult> {
  const response = await fetch('/api/genie/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const payload = await response.json() as ModelResponse
  const text = extractText(payload)

  if (!response.ok || !text) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
    throw new Error(message || 'Genie 暂时无法生成建议。')
  }

  return parseGenieContent(text)
}

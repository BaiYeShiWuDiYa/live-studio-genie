export type GenieChatResult = {
  text: string
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

  return { text }
}

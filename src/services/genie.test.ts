import { afterEach, describe, expect, it, vi } from 'vitest'
import { askGenie, parseGenieContent } from './genie'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('parseGenieContent', () => {
  it('extracts a validated widget from assistant text', () => {
    const result = parseGenieContent(`建议先提高补光。
<widget>
{"version":"1.0","type":"visual-adjustment","title":"调整画面","detail":"提高主体亮度","actionLabel":"预览调整","props":{"settings":{"brightness":1.2,"contrast":1.05,"warmth":0.1}}}
</widget>`)

    expect(result.text).toBe('建议先提高补光。')
    expect(result.widget?.type).toBe('visual-adjustment')
  })

  it('drops invalid widgets without losing the assistant response', () => {
    const result = parseGenieContent('保持节奏。<widget>{"type":"raw-html"}</widget>')

    expect(result.text).toBe('保持节奏。')
    expect(result.widget).toBeUndefined()
  })

  it('supports plain text responses', () => {
    expect(parseGenieContent('当前状态稳定。')).toEqual({ text: '当前状态稳定。' })
  })

  it('normalizes explicit visual percentages from the user instruction', () => {
    const result = parseGenieContent(`已生成画面调节组件。
<widget>
{"version":"1.0","type":"visual-adjustment","title":"调整画面","detail":"提高主体质感","actionLabel":"预览调整","props":{"settings":{"brightness":1,"contrast":1,"warmth":0.3}}}
</widget>`, '亮度 10，对比度 5，暖色 3')

    expect(result.widget).toMatchObject({
      props: {
        settings: {
          brightness: 1.1,
          contrast: 1.05,
          warmth: 0.03,
        },
      },
    })
  })

  it('only overrides explicit visual fields and clamps them to valid ranges', () => {
    const result = parseGenieContent(`保持当前对比度。
<widget>
{"version":"1.0","type":"visual-adjustment","title":"调整画面","detail":"提高主体质感","actionLabel":"预览调整","props":{"settings":{"brightness":1.2,"contrast":1.08,"warmth":0.1}}}
</widget>`, '补光设置为 80%，暖肤 -5')

    expect(result.widget).toMatchObject({
      props: {
        settings: {
          brightness: 1.6,
          contrast: 1.08,
          warmth: 0,
        },
      },
    })
  })
})

describe('askGenie', () => {
  it('aborts a request after its timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))

    const request = askGenie('检查直播状态', { timeoutMs: 100 })
    const rejection = expect(request).rejects.toMatchObject({
      code: 'timeout',
      message: 'Genie 响应超时，请重试。',
    })
    await vi.advanceTimersByTimeAsync(100)

    await rejection
  })

  it('supports cancellation from the caller', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))

    const request = askGenie('检查直播状态', { signal: controller.signal })
    const rejection = expect(request).rejects.toMatchObject({
      code: 'cancelled',
      message: '已取消本次生成。',
    })
    controller.abort()

    await rejection
  })
})

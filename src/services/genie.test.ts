import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyCameraEffectPreset,
  defaultCameraEffects,
} from '../capabilities/video/cameraEffects'
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

  it('removes malformed protocols and technical parameters from visible copy', () => {
    const result = parseGenieContent(
      '建议先提亮画面，曝光 +4、对比度 3。<widget>{\\"type\\":\\"visual-adjustment\\"}',
    )

    expect(result.text).toBe('建议先提亮画面，画面亮度适度调整、画面层次适度调整。')
    expect(result.text).not.toMatch(/widget|visual-adjustment|[{}]/i)
  })

  it('drops technical identifier lines from plain responses', () => {
    const result = parseGenieContent(
      '我已经整理好画面建议。\nsettings: brightness=1.2\n请先预览整体效果。',
    )

    expect(result.text).toBe('我已经整理好画面建议。 请先预览整体效果。')
  })

  it('rewrites technical adjustment wording as natural language', () => {
    expect(parseGenieContent('建议把曝光微提，再观察画面。').text)
      .toBe('建议适当提亮画面，再观察画面。')
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

  it('merges a generated prop with the current camera settings', () => {
    const current = applyCameraEffectPreset('sweet')
    const result = parseGenieContent(`已生成科技感道具。
<widget>
{"version":"1.0","type":"camera-effects","title":"科技眼镜","detail":"添加人脸跟踪眼镜","actionLabel":"预览道具","props":{"settings":{"faceEffect":"sparkles"}}}
</widget>`, '给我生成科技眼镜道具', current, current)

    expect(result.widget).toMatchObject({
      type: 'camera-effects',
      props: {
        settings: {
          faceEffect: 'glasses',
          smoothness: current.smoothness,
          lipstickColor: current.lipstickColor,
          backgroundMode: current.backgroundMode,
        },
      },
    })
  })

  it('creates a trusted camera widget when the model omits one', () => {
    const recommendation = {
      ...defaultCameraEffects,
      smoothness: 18,
      exposure: 15,
      warmth: 5,
      lipstickIntensity: 34,
    }
    const result = parseGenieContent(
      '建议适度提亮并增加自然妆感。',
      '根据当前人脸效果调整美颜和美妆',
      defaultCameraEffects,
      recommendation,
    )

    expect(result.widget).toMatchObject({
      type: 'camera-effects',
      props: {
        settings: {
          smoothness: 18,
          exposure: 15,
          warmth: 5,
          lipstickIntensity: 34,
          faceEffect: 'none',
        },
      },
    })
  })

  it('normalizes explicit makeup values and a generated prop', () => {
    const result = parseGenieContent(
      '已生成方案。',
      '柔肤 24，美白 30，红润 15，清晰 20，提亮 8，口红 35，腮红 20，眼影 18，加闪电贴纸',
      defaultCameraEffects,
      defaultCameraEffects,
    )

    expect(result.widget).toMatchObject({
      type: 'camera-effects',
      props: {
        settings: {
          smoothness: 24,
          whitening: 30,
          rosiness: 15,
          clarity: 20,
          exposure: 8,
          lipstickIntensity: 35,
          blushIntensity: 20,
          eyeshadowIntensity: 18,
          faceEffect: 'lightning-sticker',
        },
      },
    })
  })

  it('maps new face prop instructions to trusted effect ids', () => {
    const result = parseGenieContent(
      '已生成蝴蝶贴纸。',
      '给我加一个蝴蝶贴纸',
      defaultCameraEffects,
      defaultCameraEffects,
    )

    expect(result.widget).toMatchObject({
      type: 'camera-effects',
      props: {
        settings: {
          faceEffect: 'butterfly-sticker',
        },
      },
    })
  })

  it('maps black sunglasses to the dedicated trusted prop', () => {
    const result = parseGenieContent(
      '已生成黑色墨镜。',
      '给我戴一副黑色墨镜',
      defaultCameraEffects,
      defaultCameraEffects,
    )

    expect(result.widget).toMatchObject({
      type: 'camera-effects',
      props: {
        settings: {
          faceEffect: 'sunglasses',
        },
      },
    })
  })
})

describe('askGenie', () => {
  it('sends the current preview frame with the prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '画面分析完成。' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await askGenie('分析当前画面', {
      imageDataUrl: 'data:image/jpeg;base64,ZmFrZS1mcmFtZQ==',
    })

    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      prompt: '分析当前画面',
      imageDataUrl: 'data:image/jpeg;base64,ZmFrZS1mcmFtZQ==',
    })
  })

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

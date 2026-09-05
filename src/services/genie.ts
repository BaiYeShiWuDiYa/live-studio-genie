import { widgetSpecSchema, type WidgetSpec } from '../agent/widgets/widgetSpec'
import {
  cameraEffectsSchema,
  type CameraEffects,
  type FaceEffect,
} from '../capabilities/video/cameraEffects'

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
  cameraEffects?: CameraEffects
  recommendedCameraEffects?: CameraEffects
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRequestedFaceEffect(instruction: string): FaceEffect | undefined {
  if (/(?:关闭|移除|去掉|取消|不要).{0,6}(?:道具|特效|眼镜|星环|光环|星光)/.test(instruction)) {
    return 'none'
  }
  if (/(?:科技)?眼镜/.test(instruction)) return 'glasses'
  if (/星环|光环/.test(instruction)) return 'halo'
  if (/星光|闪光/.test(instruction)) return 'sparkles'
  return undefined
}

function getExplicitCameraPatch(instruction: string): Partial<CameraEffects> {
  const numericFields: Array<{
    key: keyof Pick<
      CameraEffects,
      | 'smoothness'
      | 'exposure'
      | 'warmth'
      | 'lipstickIntensity'
      | 'blushIntensity'
      | 'eyeshadowIntensity'
    >
    labels: string
    min: number
    max: number
  }> = [
    { key: 'smoothness', labels: '柔肤|磨皮', min: 0, max: 100 },
    { key: 'exposure', labels: '提亮|曝光', min: -20, max: 30 },
    { key: 'warmth', labels: '暖肤', min: 0, max: 40 },
    { key: 'lipstickIntensity', labels: '口红', min: 0, max: 100 },
    { key: 'blushIntensity', labels: '腮红', min: 0, max: 100 },
    { key: 'eyeshadowIntensity', labels: '眼影', min: 0, max: 100 },
  ]
  const patch: Partial<CameraEffects> = {}

  numericFields.forEach(({ key, labels, min, max }) => {
    const value = readExplicitPercentage(instruction, labels)
    if (value !== undefined) {
      patch[key] = Math.round(Math.min(max, Math.max(min, value)))
    }
  })

  const faceEffect = getRequestedFaceEffect(instruction)
  return faceEffect ? { ...patch, faceEffect } : patch
}

function isCameraEffectsInstruction(instruction: string): boolean {
  return /美颜|美妆|妆容|道具|特效|人脸效果|上镜|柔肤|磨皮|提亮|曝光|暖肤|口红|腮红|眼影|眼镜|星环|光环|星光/.test(instruction)
}

function hydrateCameraEffectsWidget(
  candidate: unknown,
  currentSettings: CameraEffects | undefined,
  instruction: string,
): unknown {
  if (!currentSettings || !isRecord(candidate) || candidate.type !== 'camera-effects') {
    return candidate
  }

  const props = isRecord(candidate.props) ? candidate.props : {}
  const incomingSettings = isRecord(props.settings) ? props.settings : {}
  return {
    ...candidate,
    props: {
      ...props,
      settings: cameraEffectsSchema.parse({
        ...currentSettings,
        ...incomingSettings,
        ...getExplicitCameraPatch(instruction),
      }),
    },
  }
}

function createCameraEffectsFallback(
  instruction: string,
  currentSettings: CameraEffects | undefined,
  recommendedSettings: CameraEffects | undefined,
): WidgetSpec | undefined {
  if (!currentSettings || !isCameraEffectsInstruction(instruction)) return undefined

  const recommendation = recommendedSettings ?? currentSettings
  const explicitPatch = getExplicitCameraPatch(instruction)
  const beautyRequested = /美颜|上镜|柔肤|磨皮|提亮|曝光|暖肤/.test(instruction)
  const makeupRequested = /美妆|妆容|上镜|口红|腮红|眼影/.test(instruction)
  const propRequested = /道具|特效|眼镜|星环|光环|星光/.test(instruction)
  const settings = cameraEffectsSchema.parse({
    ...currentSettings,
    ...(beautyRequested
      ? {
          smoothness: recommendation.smoothness,
          exposure: recommendation.exposure,
          warmth: recommendation.warmth,
        }
      : {}),
    ...(makeupRequested
      ? {
          lipstickIntensity: recommendation.lipstickIntensity,
          lipstickColor: recommendation.lipstickColor,
          blushIntensity: recommendation.blushIntensity,
          blushColor: recommendation.blushColor,
          eyeshadowIntensity: recommendation.eyeshadowIntensity,
          eyeshadowColor: recommendation.eyeshadowColor,
        }
      : {}),
    ...(propRequested && getRequestedFaceEffect(instruction) === undefined
      ? { faceEffect: 'sparkles' }
      : {}),
    ...explicitPatch,
  })

  return widgetSpecSchema.parse({
    version: '1.0',
    type: 'camera-effects',
    title: 'AI 人像效果方案',
    detail: '已结合当前画面指标和已启用效果生成可预览方案。',
    actionLabel: '应用人像方案',
    props: { settings },
  })
}

export function parseGenieContent(
  content: string,
  instruction = '',
  cameraEffects?: CameraEffects,
  recommendedCameraEffects?: CameraEffects,
): GenieChatResult {
  const match = content.match(/<widget>\s*([\s\S]*?)\s*<\/widget>/i)
  if (!match) {
    return {
      text: content.trim(),
      widget: createCameraEffectsFallback(
        instruction,
        cameraEffects,
        recommendedCameraEffects,
      ),
    }
  }

  const text = content.replace(match[0], '').trim()
  try {
    const hydratedWidget = hydrateCameraEffectsWidget(
      JSON.parse(match[1]),
      cameraEffects,
      instruction,
    )
    const parsedWidget = widgetSpecSchema.safeParse(hydratedWidget)
    if (parsedWidget.success) {
      const cameraFallback = parsedWidget.data.type === 'camera-effects'
        ? undefined
        : createCameraEffectsFallback(
          instruction,
          cameraEffects,
          recommendedCameraEffects,
        )
      const widget = cameraFallback ??
        normalizeExplicitVisualSettings(parsedWidget.data, instruction)
      return { text, ...(widget ? { widget } : {}) }
    }
  } catch {
    // Fall through to the trusted local camera-effects fallback.
  }

  const widget = createCameraEffectsFallback(
    instruction,
    cameraEffects,
    recommendedCameraEffects,
  )
  return { text, ...(widget ? { widget } : {}) }
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

    return parseGenieContent(
      text,
      options.instruction,
      options.cameraEffects,
      options.recommendedCameraEffects,
    )
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

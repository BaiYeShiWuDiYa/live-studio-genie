import { z } from 'zod'

export const backgroundModeSchema = z.enum(['none', 'blur', 'color', 'image'])
export type BackgroundMode = z.infer<typeof backgroundModeSchema>
export const faceEffectSchema = z.enum(['none', 'halo', 'sparkles', 'glasses'])
export type FaceEffect = z.infer<typeof faceEffectSchema>

export const cameraEffectsSchema = z.object({
  smoothness: z.number().int().min(0).max(100),
  exposure: z.number().int().min(-20).max(30),
  warmth: z.number().int().min(0).max(40),
  backgroundMode: backgroundModeSchema,
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  backgroundImageUrl: z.string().max(2048).startsWith('blob:').nullable(),
  faceEffect: faceEffectSchema,
  lipstickIntensity: z.number().int().min(0).max(100),
  lipstickColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  blushIntensity: z.number().int().min(0).max(100),
  blushColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  eyeshadowIntensity: z.number().int().min(0).max(100),
  eyeshadowColor: z.string().regex(/^#[0-9a-f]{6}$/i),
})

export type CameraEffects = z.infer<typeof cameraEffectsSchema>

export const defaultCameraEffects: CameraEffects = {
  smoothness: 0,
  exposure: 0,
  warmth: 0,
  backgroundMode: 'none',
  backgroundColor: '#163d38',
  backgroundImageUrl: null,
  faceEffect: 'none',
  lipstickIntensity: 0,
  lipstickColor: '#c2476e',
  blushIntensity: 0,
  blushColor: '#e8889a',
  eyeshadowIntensity: 0,
  eyeshadowColor: '#8d63b8',
}

export type CameraEffectPresetId = 'natural' | 'sweet' | 'stage' | 'cyber'

export interface CameraEffectPreset {
  id: CameraEffectPresetId
  label: string
  detail: string
  swatches: readonly [string, string, string]
  settings: CameraEffects
}

export const cameraEffectPresets: readonly CameraEffectPreset[] = [
  {
    id: 'natural',
    label: '清透日常',
    detail: '轻柔肤与自然唇色',
    swatches: ['#c26478', '#e69aa8', '#a98fbf'],
    settings: {
      ...defaultCameraEffects,
      smoothness: 18,
      exposure: 5,
      warmth: 5,
      lipstickIntensity: 18,
      blushIntensity: 10,
      eyeshadowIntensity: 5,
    },
  },
  {
    id: 'sweet',
    label: '甜美直播',
    detail: '暖调粉妆与星光',
    swatches: ['#d9577d', '#f08ca5', '#cf91c7'],
    settings: {
      ...defaultCameraEffects,
      smoothness: 28,
      exposure: 9,
      warmth: 14,
      backgroundMode: 'blur',
      faceEffect: 'sparkles',
      lipstickIntensity: 38,
      lipstickColor: '#d9577d',
      blushIntensity: 28,
      blushColor: '#f08ca5',
      eyeshadowIntensity: 18,
      eyeshadowColor: '#cf91c7',
    },
  },
  {
    id: 'stage',
    label: '舞台高光',
    detail: '高对比紫调舞台妆',
    swatches: ['#b72f58', '#e2758b', '#7652a8'],
    settings: {
      ...defaultCameraEffects,
      smoothness: 24,
      exposure: 7,
      warmth: 8,
      backgroundMode: 'blur',
      faceEffect: 'halo',
      lipstickIntensity: 55,
      lipstickColor: '#b72f58',
      blushIntensity: 24,
      blushColor: '#e2758b',
      eyeshadowIntensity: 42,
      eyeshadowColor: '#7652a8',
    },
  },
  {
    id: 'cyber',
    label: '未来科技',
    detail: '冷调妆容与科技眼镜',
    swatches: ['#a64ab3', '#c26da8', '#526fd1'],
    settings: {
      ...defaultCameraEffects,
      smoothness: 14,
      exposure: 5,
      backgroundMode: 'color',
      backgroundColor: '#101b2d',
      faceEffect: 'glasses',
      lipstickIntensity: 34,
      lipstickColor: '#a64ab3',
      blushIntensity: 12,
      blushColor: '#c26da8',
      eyeshadowIntensity: 55,
      eyeshadowColor: '#526fd1',
    },
  },
]

export const recommendedCameraEffects: CameraEffects = {
  ...cameraEffectPresets[1].settings,
}

const presetSettingsKeys = Object.keys(defaultCameraEffects) as Array<keyof CameraEffects>

export function applyCameraEffectPreset(
  presetId: CameraEffectPresetId,
): CameraEffects {
  const preset = cameraEffectPresets.find(({ id }) => id === presetId)
  return { ...(preset?.settings ?? defaultCameraEffects) }
}

export function getMatchingCameraEffectPresetId(
  settings: CameraEffects,
): CameraEffectPresetId | null {
  return cameraEffectPresets.find((preset) => (
    presetSettingsKeys.every((key) => preset.settings[key] === settings[key])
  ))?.id ?? null
}

export function isCameraEffectActive(settings: CameraEffects): boolean {
  return (
    settings.smoothness > 0 ||
    settings.exposure !== 0 ||
    settings.warmth > 0 ||
    settings.backgroundMode !== 'none' ||
    settings.faceEffect !== 'none' ||
    hasMakeupEnabled(settings)
  )
}

export function hasMakeupEnabled(settings: CameraEffects): boolean {
  return (
    settings.lipstickIntensity > 0 ||
    settings.blushIntensity > 0 ||
    settings.eyeshadowIntensity > 0
  )
}

export function getEnabledMakeupCount(settings: CameraEffects): number {
  return [
    settings.lipstickIntensity,
    settings.blushIntensity,
    settings.eyeshadowIntensity,
  ].filter((intensity) => intensity > 0).length
}

export function createAlphaMask(
  confidenceMask: Float32Array,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(confidenceMask.length * 4)
  confidenceMask.forEach((confidence, index) => {
    const offset = index * 4
    pixels[offset] = 255
    pixels[offset + 1] = 255
    pixels[offset + 2] = 255
    pixels[offset + 3] = Math.round(Math.max(0, Math.min(1, confidence)) * 255)
  })
  return pixels
}

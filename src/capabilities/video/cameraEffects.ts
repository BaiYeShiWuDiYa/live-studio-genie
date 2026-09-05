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

export type CameraBeautyPresetId = 'off' | 'natural' | 'soft' | 'bright'
export type CameraMakeupPresetId = 'off' | 'nude' | 'sweet' | 'stage' | 'cyber'

interface CameraBeautyPreset {
  id: CameraBeautyPresetId
  label: string
  settings: Pick<CameraEffects, 'smoothness' | 'exposure' | 'warmth'>
}

interface CameraMakeupPreset {
  id: CameraMakeupPresetId
  label: string
  swatches: readonly [string, string, string]
  settings: Pick<
    CameraEffects,
    | 'lipstickIntensity'
    | 'lipstickColor'
    | 'blushIntensity'
    | 'blushColor'
    | 'eyeshadowIntensity'
    | 'eyeshadowColor'
  >
}

export const cameraBeautyPresets: readonly CameraBeautyPreset[] = [
  {
    id: 'off',
    label: '原生',
    settings: { smoothness: 0, exposure: 0, warmth: 0 },
  },
  {
    id: 'natural',
    label: '自然',
    settings: { smoothness: 12, exposure: 4, warmth: 4 },
  },
  {
    id: 'soft',
    label: '柔焦',
    settings: { smoothness: 32, exposure: 5, warmth: 8 },
  },
  {
    id: 'bright',
    label: '亮颜',
    settings: { smoothness: 18, exposure: 15, warmth: 5 },
  },
]

export const cameraMakeupPresets: readonly CameraMakeupPreset[] = [
  {
    id: 'off',
    label: '无妆',
    swatches: ['#424752', '#59606c', '#737b88'],
    settings: {
      lipstickIntensity: 0,
      lipstickColor: '#c2476e',
      blushIntensity: 0,
      blushColor: '#e8889a',
      eyeshadowIntensity: 0,
      eyeshadowColor: '#8d63b8',
    },
  },
  {
    id: 'nude',
    label: '裸妆',
    swatches: ['#b65f69', '#dd9a91', '#ad8e8d'],
    settings: {
      lipstickIntensity: 18,
      lipstickColor: '#b65f69',
      blushIntensity: 10,
      blushColor: '#dd9a91',
      eyeshadowIntensity: 5,
      eyeshadowColor: '#ad8e8d',
    },
  },
  {
    id: 'sweet',
    label: '甜美',
    swatches: ['#d9577d', '#f08ca5', '#cf91c7'],
    settings: {
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
    label: '舞台',
    swatches: ['#b72f58', '#e2758b', '#7652a8'],
    settings: {
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
    label: '冷感',
    swatches: ['#a64ab3', '#c26da8', '#526fd1'],
    settings: {
      lipstickIntensity: 34,
      lipstickColor: '#a64ab3',
      blushIntensity: 12,
      blushColor: '#c26da8',
      eyeshadowIntensity: 55,
      eyeshadowColor: '#526fd1',
    },
  },
]

export const cameraEffectPresets: readonly CameraEffectPreset[] = [
  {
    id: 'natural',
    label: '清透日常',
    detail: '轻柔肤与自然唇色',
    swatches: ['#b65f69', '#dd9a91', '#ad8e8d'],
    settings: {
      ...defaultCameraEffects,
      ...cameraBeautyPresets[1].settings,
      ...cameraMakeupPresets[1].settings,
    },
  },
  {
    id: 'sweet',
    label: '甜美直播',
    detail: '暖调粉妆与星光',
    swatches: ['#d9577d', '#f08ca5', '#cf91c7'],
    settings: {
      ...defaultCameraEffects,
      ...cameraBeautyPresets[2].settings,
      ...cameraMakeupPresets[2].settings,
      backgroundMode: 'blur',
      faceEffect: 'sparkles',
    },
  },
  {
    id: 'stage',
    label: '舞台高光',
    detail: '高对比紫调舞台妆',
    swatches: ['#b72f58', '#e2758b', '#7652a8'],
    settings: {
      ...defaultCameraEffects,
      ...cameraBeautyPresets[2].settings,
      ...cameraMakeupPresets[3].settings,
      backgroundMode: 'blur',
      faceEffect: 'halo',
    },
  },
  {
    id: 'cyber',
    label: '未来科技',
    detail: '冷调妆容与科技眼镜',
    swatches: ['#a64ab3', '#c26da8', '#526fd1'],
    settings: {
      ...defaultCameraEffects,
      ...cameraBeautyPresets[1].settings,
      ...cameraMakeupPresets[4].settings,
      backgroundMode: 'color',
      backgroundColor: '#101b2d',
      faceEffect: 'glasses',
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

export function applyCameraBeautyPreset(
  settings: CameraEffects,
  presetId: CameraBeautyPresetId,
): CameraEffects {
  const preset = cameraBeautyPresets.find(({ id }) => id === presetId)
  return { ...settings, ...(preset?.settings ?? {}) }
}

export function getMatchingCameraBeautyPresetId(
  settings: CameraEffects,
): CameraBeautyPresetId | null {
  return cameraBeautyPresets.find((preset) => (
    preset.settings.smoothness === settings.smoothness &&
    preset.settings.exposure === settings.exposure &&
    preset.settings.warmth === settings.warmth
  ))?.id ?? null
}

export function applyCameraMakeupPreset(
  settings: CameraEffects,
  presetId: CameraMakeupPresetId,
): CameraEffects {
  const preset = cameraMakeupPresets.find(({ id }) => id === presetId)
  return { ...settings, ...(preset?.settings ?? {}) }
}

export function getMatchingCameraMakeupPresetId(
  settings: CameraEffects,
): CameraMakeupPresetId | null {
  return cameraMakeupPresets.find((preset) => (
    preset.settings.lipstickIntensity === settings.lipstickIntensity &&
    preset.settings.lipstickColor === settings.lipstickColor &&
    preset.settings.blushIntensity === settings.blushIntensity &&
    preset.settings.blushColor === settings.blushColor &&
    preset.settings.eyeshadowIntensity === settings.eyeshadowIntensity &&
    preset.settings.eyeshadowColor === settings.eyeshadowColor
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

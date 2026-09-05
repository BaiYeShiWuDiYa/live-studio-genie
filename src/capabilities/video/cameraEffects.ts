import { z } from 'zod'

export const backgroundModeSchema = z.enum(['none', 'blur', 'color', 'image'])
export type BackgroundMode = z.infer<typeof backgroundModeSchema>
export const faceEffectSchema = z.enum(['none', 'halo', 'sparkles'])
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

export const recommendedCameraEffects: CameraEffects = {
  smoothness: 24,
  exposure: 8,
  warmth: 12,
  backgroundMode: 'blur',
  backgroundColor: '#163d38',
  backgroundImageUrl: null,
  faceEffect: 'halo',
  lipstickIntensity: 32,
  lipstickColor: '#c2476e',
  blushIntensity: 20,
  blushColor: '#e8889a',
  eyeshadowIntensity: 14,
  eyeshadowColor: '#8d63b8',
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

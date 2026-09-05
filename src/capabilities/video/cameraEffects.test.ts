import { describe, expect, it } from 'vitest'
import {
  applyCameraBeautyPreset,
  applyCameraEffectPreset,
  applyCameraMakeupPreset,
  cameraEffectPresets,
  cameraEffectsSchema,
  cameraBeautyPresets,
  cameraMakeupPresets,
  createAlphaMask,
  defaultCameraEffects,
  getEnabledMakeupCount,
  getMatchingCameraBeautyPresetId,
  getMatchingCameraEffectPresetId,
  getMatchingCameraMakeupPresetId,
  isCameraEffectActive,
  recommendCameraEffects,
  recommendedCameraEffects,
  virtualBackgrounds,
} from './cameraEffects'

describe('camera effects', () => {
  it('validates supported settings', () => {
    expect(cameraEffectsSchema.parse(recommendedCameraEffects))
      .toEqual(recommendedCameraEffects)
    expect(() => cameraEffectsSchema.parse({
      ...recommendedCameraEffects,
      smoothness: 120,
    })).toThrow()
    expect(() => cameraEffectsSchema.parse({
      ...recommendedCameraEffects,
      backgroundImageUrl: 'https://example.com/untrusted.jpg',
    })).toThrow()
    virtualBackgrounds.forEach(({ id }) => {
      expect(cameraEffectsSchema.parse({
        ...recommendedCameraEffects,
        backgroundMode: 'image',
        backgroundPreset: id,
      }).backgroundPreset).toBe(id)
    })
  })

  it('detects whether processing is required', () => {
    expect(isCameraEffectActive(defaultCameraEffects)).toBe(false)
    expect(isCameraEffectActive(recommendedCameraEffects)).toBe(true)
    expect(isCameraEffectActive({
      ...defaultCameraEffects,
      lipstickIntensity: 20,
    })).toBe(true)
    expect(getEnabledMakeupCount(defaultCameraEffects)).toBe(0)
    expect(getEnabledMakeupCount(recommendedCameraEffects)).toBe(5)
  })

  it('provides four valid and distinguishable style presets', () => {
    expect(cameraEffectPresets.map(({ id }) => id))
      .toEqual(['natural', 'sweet', 'stage', 'cyber'])
    cameraEffectPresets.forEach(({ id, settings }) => {
      expect(cameraEffectsSchema.parse(settings)).toEqual(settings)
      expect(getMatchingCameraEffectPresetId(applyCameraEffectPreset(id))).toBe(id)
    })
    expect(applyCameraEffectPreset('cyber').faceEffect).toBe('glasses')
  })

  it('switches beauty, makeup, and props independently', () => {
    const cyber = applyCameraEffectPreset('cyber')
    const bright = applyCameraBeautyPreset(cyber, 'bright')
    expect(getMatchingCameraBeautyPresetId(bright)).toBe('bright')
    expect(bright.faceEffect).toBe('glasses')
    expect(bright.lipstickColor).toBe(cyber.lipstickColor)

    const nude = applyCameraMakeupPreset(bright, 'nude')
    expect(getMatchingCameraMakeupPresetId(nude)).toBe('nude')
    expect(nude.smoothness).toBe(bright.smoothness)
    expect(nude.backgroundMode).toBe('color')
    expect(cameraBeautyPresets).toHaveLength(4)
    expect(cameraMakeupPresets).toHaveLength(5)
  })

  it('recommends beauty and makeup that match the current prop and lighting', () => {
    const recommendation = recommendCameraEffects({
      ...defaultCameraEffects,
      faceEffect: 'glasses',
      backgroundMode: 'blur',
    }, 32)

    expect(recommendation).toMatchObject({
      faceEffect: 'glasses',
      backgroundMode: 'blur',
      smoothness: 18,
      exposure: 15,
      lipstickColor: '#a64ab3',
      eyeshadowIntensity: 55,
    })
  })

  it('converts confidence values into alpha pixels', () => {
    expect([...createAlphaMask(new Float32Array([-1, 0.5, 2]))])
      .toEqual([
        255, 255, 255, 0,
        255, 255, 255, 128,
        255, 255, 255, 255,
      ])
  })
})

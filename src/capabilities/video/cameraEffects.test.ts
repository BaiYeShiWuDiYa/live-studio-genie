import { describe, expect, it } from 'vitest'
import {
  applyCameraEffectPreset,
  cameraEffectPresets,
  cameraEffectsSchema,
  createAlphaMask,
  defaultCameraEffects,
  getEnabledMakeupCount,
  getMatchingCameraEffectPresetId,
  isCameraEffectActive,
  recommendedCameraEffects,
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
  })

  it('detects whether processing is required', () => {
    expect(isCameraEffectActive(defaultCameraEffects)).toBe(false)
    expect(isCameraEffectActive(recommendedCameraEffects)).toBe(true)
    expect(isCameraEffectActive({
      ...defaultCameraEffects,
      lipstickIntensity: 20,
    })).toBe(true)
    expect(getEnabledMakeupCount(defaultCameraEffects)).toBe(0)
    expect(getEnabledMakeupCount(recommendedCameraEffects)).toBe(3)
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

  it('converts confidence values into alpha pixels', () => {
    expect([...createAlphaMask(new Float32Array([-1, 0.5, 2]))])
      .toEqual([
        255, 255, 255, 0,
        255, 255, 255, 128,
        255, 255, 255, 255,
      ])
  })
})

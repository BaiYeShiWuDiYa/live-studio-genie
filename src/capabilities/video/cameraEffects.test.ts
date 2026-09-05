import { describe, expect, it } from 'vitest'
import {
  cameraEffectsSchema,
  createAlphaMask,
  defaultCameraEffects,
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

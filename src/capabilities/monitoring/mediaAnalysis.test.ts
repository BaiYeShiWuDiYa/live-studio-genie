import { describe, expect, it } from 'vitest'
import {
  calculateAudioDecibels,
  calculateBrightness,
  createAudioMetric,
  createBrightnessMetric,
} from './mediaAnalysis'

describe('media analysis', () => {
  it('maps black and white frames to the brightness range', () => {
    expect(calculateBrightness(new Uint8ClampedArray([0, 0, 0, 255]))).toBe(0)
    expect(calculateBrightness(new Uint8ClampedArray([255, 255, 255, 255]))).toBe(100)
  })

  it('converts waveform RMS to decibels', () => {
    expect(calculateAudioDecibels(new Float32Array(32))).toBe(-60)
    expect(calculateAudioDecibels(new Float32Array(32).fill(0.1))).toBeCloseTo(-20, 4)
  })

  it('classifies brightness and microphone thresholds', () => {
    expect(createBrightnessMetric(24).tone).toBe('bad')
    expect(createBrightnessMetric(42).tone).toBe('warn')
    expect(createBrightnessMetric(68).tone).toBe('good')
    expect(createAudioMetric(-60, true).value).toBe('已静音')
  })
})

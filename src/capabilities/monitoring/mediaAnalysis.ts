import type { MediaMetric } from './types'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export function calculateBrightness(data: Uint8ClampedArray): number {
  if (data.length < 4) return 0

  let luminance = 0
  let samples = 0
  for (let index = 0; index < data.length; index += 16) {
    luminance += data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
    samples += 1
  }

  return clamp(Math.round((luminance / samples / 255) * 100), 0, 100)
}

export function calculateAudioDecibels(samples: Float32Array): number {
  if (samples.length === 0) return -60

  let squareSum = 0
  for (const sample of samples) squareSum += sample * sample
  const rms = Math.sqrt(squareSum / samples.length)
  return clamp(20 * Math.log10(Math.max(rms, 0.001)), -60, 0)
}

export function createBrightnessMetric(score: number): MediaMetric {
  const normalizedScore = clamp(Math.round(score), 0, 100)
  return {
    score: normalizedScore,
    value: `${normalizedScore} / 100`,
    tone: normalizedScore < 35 ? 'bad' : normalizedScore < 50 ? 'warn' : 'good',
    status: 'ready',
    updatedAt: Date.now(),
  }
}

export function createAudioMetric(decibels: number, muted: boolean): MediaMetric {
  if (muted) {
    return {
      score: 0,
      value: '已静音',
      tone: 'warn',
      status: 'ready',
      updatedAt: Date.now(),
    }
  }

  const score = clamp(Math.round(((decibels + 60) / 60) * 100), 0, 100)
  return {
    score,
    value: `${Math.round(decibels)} dB`,
    tone: score < 20 ? 'bad' : score < 38 ? 'warn' : 'good',
    status: 'ready',
    updatedAt: Date.now(),
  }
}

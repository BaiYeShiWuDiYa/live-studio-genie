import type { MediaMetric } from './types'

export interface NormalizedPoint {
  x: number
  y: number
}

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

export function createFramingMetric(
  landmarks: NormalizedPoint[] | null,
): MediaMetric {
  if (!landmarks || landmarks.length === 0) {
    return {
      score: 0,
      value: '未检测到人脸',
      tone: 'bad',
      status: 'ready',
      updatedAt: Date.now(),
    }
  }

  const xs = landmarks.map(({ x }) => x)
  const ys = landmarks.map(({ y }) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const faceHeight = maxY - minY
  const coverage = clamp(Math.round(faceHeight * 100), 0, 100)
  const sizeScore = clamp(100 - Math.abs(faceHeight - 0.34) * 260, 0, 100)
  const centerDistance = Math.hypot(
    (centerX - 0.5) * 1.35,
    centerY - 0.42,
  )
  const centerScore = clamp(100 - centerDistance * 240, 0, 100)
  const score = Math.round(sizeScore * 0.55 + centerScore * 0.45)

  let position = '居中'
  if (faceHeight < 0.2) position = '偏远'
  else if (faceHeight > 0.5) position = '偏近'
  else if (centerX < 0.4) position = '偏左'
  else if (centerX > 0.6) position = '偏右'
  else if (centerY < 0.28) position = '偏高'
  else if (centerY > 0.56) position = '偏低'

  return {
    score,
    value: `人脸 ${coverage}% · ${position}`,
    tone: score >= 72 ? 'good' : score >= 45 ? 'warn' : 'bad',
    status: 'ready',
    updatedAt: Date.now(),
  }
}

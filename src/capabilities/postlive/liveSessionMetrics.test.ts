import { describe, expect, it } from 'vitest'
import type {
  MediaMetric,
  MediaMetricKind,
} from '../monitoring/types'
import {
  createLiveSessionMetricsAccumulator,
  recordLiveSessionMetrics,
  summarizeLiveSessionMetrics,
} from './liveSessionMetrics'

const metric = (
  score: number,
  value: string,
  updatedAt: number,
  tone: MediaMetric['tone'] = 'good',
): MediaMetric => ({
  score,
  value,
  updatedAt,
  tone,
  status: 'ready',
})

const metrics = (
  updatedAt: number,
): Record<MediaMetricKind, MediaMetric> => ({
  brightness: metric(72, '72 / 100', updatedAt),
  microphone: metric(60, '-18 dB', updatedAt),
  framing: metric(80, '人脸 31% · 居中', updatedAt),
})

describe('live session metrics', () => {
  it('records each metric update only once', () => {
    const initial = createLiveSessionMetricsAccumulator()
    const first = recordLiveSessionMetrics(initial, metrics(100))
    const duplicate = recordLiveSessionMetrics(first, metrics(100))

    expect(summarizeLiveSessionMetrics(duplicate).brightness.sampleCount)
      .toBe(1)
    expect(summarizeLiveSessionMetrics(duplicate).microphone.sampleCount)
      .toBe(1)
  })

  it('calculates averages, ranges and issue rates across the session', () => {
    const first = recordLiveSessionMetrics(
      createLiveSessionMetricsAccumulator(),
      metrics(100),
    )
    const second = recordLiveSessionMetrics(first, {
      brightness: metric(32, '32 / 100', 200, 'bad'),
      microphone: metric(30, '-42 dB', 200, 'warn'),
      framing: metric(50, '人脸 18% · 偏远', 200, 'warn'),
    })
    const summary = summarizeLiveSessionMetrics(second)

    expect(summary.brightness).toMatchObject({
      sampleCount: 2,
      averageScore: 52,
      minimumScore: 32,
      maximumScore: 72,
      issueSampleCount: 1,
      issueRate: 50,
      averageValue: 52,
    })
    expect(summary.microphone.averageValue).toBe(-30)
    expect(summary.framing.averageValue).toBe(25)
  })

  it('can start after current pre-live samples without counting them', () => {
    const current = metrics(100)
    const accumulator = createLiveSessionMetricsAccumulator(current)
    const unchanged = recordLiveSessionMetrics(accumulator, current)
    const summary = summarizeLiveSessionMetrics(unchanged)

    expect(summary.brightness.available).toBe(false)
    expect(summary.microphone.sampleCount).toBe(0)
    expect(summary.framing.latestValue).toBe('暂无样本')
  })

  it('ignores non-ready metrics', () => {
    const current = metrics(100)
    current.brightness = {
      ...current.brightness,
      status: 'measuring',
    }
    const summary = summarizeLiveSessionMetrics(
      recordLiveSessionMetrics(
        createLiveSessionMetricsAccumulator(),
        current,
      ),
    )

    expect(summary.brightness.available).toBe(false)
    expect(summary.microphone.available).toBe(true)
  })
})

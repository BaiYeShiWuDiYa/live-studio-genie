import type {
  MediaMetric,
  MediaMetricKind,
} from '../monitoring/types'

export interface LiveMetricSummary {
  available: boolean
  sampleCount: number
  averageScore: number
  minimumScore: number
  maximumScore: number
  issueSampleCount: number
  issueRate: number
  averageValue: number | null
  unit: '/ 100' | 'dB' | '%'
  latestValue: string
}

export type LiveSessionMonitoringSummary = Record<
  MediaMetricKind,
  LiveMetricSummary
>

interface MetricAccumulator {
  sampleCount: number
  scoreSum: number
  minimumScore: number
  maximumScore: number
  issueSampleCount: number
  valueSum: number
  valueSampleCount: number
  latestValue: string
  lastUpdatedAt: number
}

export interface LiveSessionMetricsAccumulator {
  brightness: MetricAccumulator
  microphone: MetricAccumulator
  framing: MetricAccumulator
}

const metricKinds: MediaMetricKind[] = [
  'brightness',
  'microphone',
  'framing',
]

const metricUnits: Record<MediaMetricKind, LiveMetricSummary['unit']> = {
  brightness: '/ 100',
  microphone: 'dB',
  framing: '%',
}

const createMetricAccumulator = (lastUpdatedAt = 0): MetricAccumulator => ({
  sampleCount: 0,
  scoreSum: 0,
  minimumScore: 100,
  maximumScore: 0,
  issueSampleCount: 0,
  valueSum: 0,
  valueSampleCount: 0,
  latestValue: '暂无样本',
  lastUpdatedAt,
})

export function createLiveSessionMetricsAccumulator(
  currentMetrics?: Record<MediaMetricKind, MediaMetric>,
): LiveSessionMetricsAccumulator {
  return {
    brightness: createMetricAccumulator(
      currentMetrics?.brightness.updatedAt,
    ),
    microphone: createMetricAccumulator(
      currentMetrics?.microphone.updatedAt,
    ),
    framing: createMetricAccumulator(
      currentMetrics?.framing.updatedAt,
    ),
  }
}

export function recordLiveSessionMetrics(
  accumulator: LiveSessionMetricsAccumulator,
  metrics: Record<MediaMetricKind, MediaMetric>,
): LiveSessionMetricsAccumulator {
  const next = { ...accumulator }

  metricKinds.forEach((kind) => {
    const metric = metrics[kind]
    const current = accumulator[kind]
    if (
      metric.status !== 'ready' ||
      metric.updatedAt <= current.lastUpdatedAt
    ) {
      return
    }

    const value = readMetricValue(kind, metric.value)
    next[kind] = {
      sampleCount: current.sampleCount + 1,
      scoreSum: current.scoreSum + metric.score,
      minimumScore: Math.min(current.minimumScore, metric.score),
      maximumScore: Math.max(current.maximumScore, metric.score),
      issueSampleCount:
        current.issueSampleCount + (metric.tone === 'good' ? 0 : 1),
      valueSum: current.valueSum + (value ?? 0),
      valueSampleCount: current.valueSampleCount + (value === null ? 0 : 1),
      latestValue: metric.value,
      lastUpdatedAt: metric.updatedAt,
    }
  })

  return next
}

export function summarizeLiveSessionMetrics(
  accumulator: LiveSessionMetricsAccumulator,
): LiveSessionMonitoringSummary {
  return {
    brightness: summarizeMetric('brightness', accumulator.brightness),
    microphone: summarizeMetric('microphone', accumulator.microphone),
    framing: summarizeMetric('framing', accumulator.framing),
  }
}

function summarizeMetric(
  kind: MediaMetricKind,
  accumulator: MetricAccumulator,
): LiveMetricSummary {
  if (accumulator.sampleCount === 0) {
    return {
      available: false,
      sampleCount: 0,
      averageScore: 0,
      minimumScore: 0,
      maximumScore: 0,
      issueSampleCount: 0,
      issueRate: 0,
      averageValue: null,
      unit: metricUnits[kind],
      latestValue: '暂无样本',
    }
  }

  return {
    available: true,
    sampleCount: accumulator.sampleCount,
    averageScore: Math.round(
      accumulator.scoreSum / accumulator.sampleCount,
    ),
    minimumScore: accumulator.minimumScore,
    maximumScore: accumulator.maximumScore,
    issueSampleCount: accumulator.issueSampleCount,
    issueRate: Math.round(
      accumulator.issueSampleCount / accumulator.sampleCount * 100,
    ),
    averageValue: accumulator.valueSampleCount > 0
      ? Math.round(accumulator.valueSum / accumulator.valueSampleCount)
      : null,
    unit: metricUnits[kind],
    latestValue: accumulator.latestValue,
  }
}

function readMetricValue(
  kind: MediaMetricKind,
  value: string,
): number | null {
  const pattern = kind === 'framing'
    ? /人脸\s*(\d+(?:\.\d+)?)%/
    : /-?\d+(?:\.\d+)?/
  const match = value.match(pattern)
  if (!match) return null
  const parsed = Number(kind === 'framing' ? match[1] : match[0])
  return Number.isFinite(parsed) ? parsed : null
}

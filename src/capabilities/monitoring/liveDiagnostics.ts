import type { StudioScene, WidgetSpec } from '../../agent/widgets/widgetSpec'
import {
  getAudienceStrategy,
  type AudienceStrategyId,
} from '../../config/audienceComments'
import type { AudienceSnapshot } from '../audience/audienceEvents'
import type { MediaMetric, MediaMetricKind } from './types'

export type DiagnosticScene = StudioScene
export type LiveSignalId =
  | 'exposure'
  | 'contrast'
  | 'framing'
  | 'fps'
  | 'microphone'
  | 'comments'
  | 'entrants'
  | 'retention'
  | 'gifts'

export interface LiveSignal {
  id: LiveSignalId
  label: string
  value: string
  score: number
  trend: number
  trendLabel: string
  tone: 'good' | 'warn' | 'bad'
  direction: 'up' | 'down'
  audio?: boolean
}

export interface LiveSuggestion {
  signalId: LiveSignalId
  scene: DiagnosticScene
  severity: number
  tone: 'good' | 'warn' | 'bad'
  action: string
  metric: string
  widget: WidgetSpec
}

export interface LiveDiagnostics {
  signals: LiveSignal[]
  goodSignals: LiveSignal[]
  improvements: LiveSignal[]
  suggestions: LiveSuggestion[]
  primaryScene: DiagnosticScene
  healthyCount: number
  issueCount: number
}

interface BuildLiveDiagnosticsOptions {
  mediaMetrics: Record<MediaMetricKind, MediaMetric>
  audience: AudienceSnapshot
  strategy?: AudienceStrategyId
  resolvedScene?: DiagnosticScene | null
  brightnessCompensation?: number
  microphoneGainDb?: number
}

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, Math.round(value)))

const toneForTrend = (trend: number): LiveSignal['tone'] =>
  trend <= -12 ? 'bad' : trend < 0 ? 'warn' : 'good'

const signed = (value: number, suffix = '%') =>
  `${value >= 0 ? '+' : ''}${Math.round(value)}${suffix}`

export function buildLiveDiagnostics({
  mediaMetrics,
  audience,
  strategy = 'normal',
  resolvedScene = null,
  brightnessCompensation = 0,
  microphoneGainDb = 0,
}: BuildLiveDiagnosticsOptions): LiveDiagnostics {
  const strategyConfig = getAudienceStrategy(strategy)
  const rawBrightness = mediaMetrics.brightness.status === 'ready'
    ? mediaMetrics.brightness.score
    : 72
  const brightness = strategyConfig.diagnostics.brightnessCeiling
    ?? clamp(rawBrightness + brightnessCompensation)
  const framing = mediaMetrics.framing.status === 'ready'
    ? mediaMetrics.framing.score
    : 78
  const rawMicrophoneScore = mediaMetrics.microphone.status === 'ready'
    ? mediaMetrics.microphone.score
    : 58
  const microphoneScore = strategyConfig.diagnostics.microphoneCeiling
    ?? clamp(rawMicrophoneScore + microphoneGainDb * 2)
  const microphoneValue = mediaMetrics.microphone.status === 'ready'
    ? mediaMetrics.microphone.value
    : strategy === 'low-audio' ? '-32 dB' : '-12 dB'
  const contrast = clamp(72 + brightness * 0.3)
  const fps = strategyConfig.diagnostics.fps ?? 30
  const giftCount = audience.gifts.reduce((total, gift) => total + gift.count, 0)
  const audioFeedback = audience.insight.category === 'audio' ? audience.insight.count : 0
  const microphoneTrend = microphoneScore - 40 - audioFeedback * 10

  const createSignal = (
    signal: Omit<LiveSignal, 'tone' | 'direction'>,
  ): LiveSignal => ({
    ...signal,
    tone: toneForTrend(signal.trend),
    direction: signal.trend >= 0 ? 'up' : 'down',
  })

  const signals: LiveSignal[] = [
    createSignal({
      id: 'exposure',
      label: '面部曝光',
      value: `${brightness} / 100`,
      score: brightness,
      trend: brightness - 65,
      trendLabel: signed(brightness - 65),
    }),
    createSignal({
      id: 'contrast',
      label: '对比度',
      value: `${contrast}`,
      score: contrast,
      trend: contrast - 80,
      trendLabel: signed(contrast - 80),
    }),
    createSignal({
      id: 'framing',
      label: '人脸构图',
      value: mediaMetrics.framing.status === 'ready'
        ? mediaMetrics.framing.value
        : `${framing} / 100`,
      score: framing,
      trend: framing - 55,
      trendLabel: signed(framing - 55),
    }),
    createSignal({
      id: 'fps',
      label: '帧率',
      value: `${fps} fps`,
      score: clamp((fps / 30) * 100),
      trend: fps - 28,
      trendLabel: signed(fps - 28, ' fps'),
    }),
    createSignal({
      id: 'microphone',
      label: '麦克风',
      value: microphoneValue,
      score: microphoneScore,
      trend: microphoneTrend,
      trendLabel: signed(microphoneTrend),
      audio: true,
    }),
    createSignal({
      id: 'comments',
      label: '评论区密度',
      value: `${audience.commentsPerMinute} / min`,
      score: clamp(audience.commentsPerMinute * 2),
      trend: audience.commentsPerMinute - 30,
      trendLabel: signed(audience.commentsPerMinute - 30),
    }),
    createSignal({
      id: 'entrants',
      label: '近一分钟进房',
      value: `+${audience.entrantsLastMinute}`,
      score: clamp(audience.entrantsLastMinute * 2),
      trend: audience.entrantsLastMinute - 30,
      trendLabel: signed(audience.entrantsLastMinute - 30),
    }),
    createSignal({
      id: 'retention',
      label: '新观众10秒留存',
      value: `${audience.newViewerRetention}%`,
      score: audience.newViewerRetention,
      trend: audience.newViewerRetention - 45,
      trendLabel: signed(audience.newViewerRetention - 45),
    }),
    createSignal({
      id: 'gifts',
      label: '礼物赠送量',
      value: `${giftCount}`,
      score: clamp(giftCount * 5),
      trend: giftCount - 16,
      trendLabel: signed(giftCount - 16),
    }),
  ]

  const goodSignals = [...signals]
    .sort((left, right) => right.trend - left.trend || right.score - left.score)
    .slice(0, 2)
  const improvements = [...signals]
    .sort((left, right) => left.trend - right.trend || left.score - right.score)
    .slice(0, 2)
  const suggestions = improvements
    .map((signal) => createSuggestion(signal, audience, resolvedScene))
    .sort((left, right) => right.severity - left.severity)

  return {
    signals,
    goodSignals,
    improvements,
    suggestions,
    primaryScene: suggestions[0].scene,
    healthyCount: signals.filter((signal) => signal.trend >= 0).length,
    issueCount: improvements.filter((signal) => signal.trend < 0).length,
  }
}

function createSuggestion(
  signal: LiveSignal,
  audience: AudienceSnapshot,
  resolvedScene: DiagnosticScene | null,
): LiveSuggestion {
  const severity = resolvedScene === sceneForSignal(signal.id)
    ? 8
    : clamp(60 + Math.max(0, -signal.trend))
  const base = {
    signalId: signal.id,
    scene: sceneForSignal(signal.id),
    severity,
    tone: signal.tone,
    metric: `${signal.label} ${signal.trendLabel}`,
  }

  switch (signal.id) {
    case 'comments':
      return {
        ...base,
        action: '设置一个观众心愿互动环节，提升评论参与率。',
        widget: createPollWidget(
          '观众心愿互动',
          `评论区密度较基准下降 ${Math.abs(signal.trend)}%，建议用低门槛投票恢复互动。`,
        ),
      }
    case 'entrants':
      return {
        ...base,
        action: '发起新观众欢迎投票，承接当前进房流量。',
        widget: createPollWidget(
          '新观众欢迎互动',
          `近一分钟进房人数较基准减少 ${Math.abs(signal.trend)} 人，建议立即欢迎并提问。`,
        ),
      }
    case 'retention':
      return {
        ...base,
        action: '在新观众进房后的 10 秒内发布点歌选择题。',
        widget: createPollWidget(
          '新观众留存互动',
          `新观众 10 秒留存较基准下降 ${Math.abs(signal.trend)}%，建议用点歌选择题快速承接。`,
        ),
      }
    case 'gifts':
      return {
        ...base,
        scene: 'pk',
        action: '设置一个阶段礼物目标并展示实时进度。',
        widget: {
          version: '1.0',
          type: 'live-goal',
          title: '阶段礼物目标',
          detail: `礼物赠送量较基准下降 ${Math.abs(signal.trend)}，建议用可视化目标促进观众助力。`,
          actionLabel: '发布目标',
          props: {
            label: '本轮礼物目标',
            current: audience.gifts.reduce((total, gift) => total + gift.count * 100, 0),
            target: 3000,
            supporters: audience.gifts.length,
          },
        },
      }
    case 'microphone':
      return {
        ...base,
        action: '提升麦克风增益并将背景音乐降低 3 dB。',
        widget: {
          version: '1.0',
          type: 'audio-adjustment',
          title: '麦克风增益',
          detail: `麦克风表现较基准下降 ${Math.abs(signal.trend)}%，建议突出人声并压低背景音乐。`,
          actionLabel: '应用',
          props: {
            microphoneGain: signal.score < 25 ? 10 : 6,
            backgroundMusicGain: -3,
          },
        },
      }
    case 'framing':
      return {
        ...base,
        action: '调整镜头位置，让人脸居中并保持约 30% 的画面占比。',
        widget: createVisualWidget('人像构图优化', signal, 1.05, 1.02, 0.08),
      }
    case 'fps':
      return {
        ...base,
        action: '关闭高负载特效并将输出帧率稳定在 30 fps。',
        widget: createVisualWidget('画面流畅度优化', signal, 1, 1, 0),
      }
    case 'contrast':
      return {
        ...base,
        action: '提高画面对比度，让人物与背景层次更清晰。',
        widget: createVisualWidget('对比度优化', signal, 1.05, 1.12, 0.05),
      }
    case 'exposure':
    default:
      return {
        ...base,
        action: `将补光提升 ${Math.max(8, Math.abs(signal.trend))}%，并适当降低背景对比度。`,
        widget: createVisualWidget(
          '曝光与背景',
          signal,
          Math.min(1.6, 1 + Math.max(8, Math.abs(signal.trend)) / 100),
          0.92,
          0.18,
        ),
      }
  }
}

function sceneForSignal(signalId: LiveSignalId): DiagnosticScene {
  if (signalId === 'microphone') return 'troubleshoot'
  if (signalId === 'comments' || signalId === 'entrants' || signalId === 'retention') {
    return 'interaction'
  }
  if (signalId === 'gifts') return 'pk'
  return 'quality'
}

function createPollWidget(title: string, detail: string): WidgetSpec {
  return {
    version: '1.0',
    type: 'audience-poll',
    title,
    detail,
    actionLabel: '发布互动',
    props: {
      question: '下一首唱什么？',
      options: ['甜歌', '炸场'],
      durationSeconds: 45,
    },
  }
}

function createVisualWidget(
  title: string,
  signal: LiveSignal,
  brightness: number,
  contrast: number,
  warmth: number,
): WidgetSpec {
  return {
    version: '1.0',
    type: 'visual-adjustment',
    title,
    detail: `${signal.label}较基准下降 ${Math.abs(signal.trend)}%，建议立即调整画面参数。`,
    actionLabel: '确认应用',
    props: {
      settings: { brightness, contrast, warmth },
    },
  }
}

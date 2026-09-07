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
  | 'color-accuracy'
  | 'background-cleanliness'
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
  thresholdValue?: number
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
  const measuredFraming = mediaMetrics.framing.status === 'ready'
    ? mediaMetrics.framing.score
    : 78
  const framing = measuredFraming
  const rawMicrophoneScore = mediaMetrics.microphone.status === 'ready'
    ? mediaMetrics.microphone.score
    : 58
  const microphoneScore = strategyConfig.diagnostics.microphoneCeiling
    ?? clamp(rawMicrophoneScore + microphoneGainDb * 2)
  const microphoneValue = mediaMetrics.microphone.status === 'ready'
    ? mediaMetrics.microphone.value
    : strategy === 'low-audio' ? '-32 dB' : '-12 dB'
  const contrast = clamp(72 + brightness * 0.3)
  const colorAccuracy =
    strategyConfig.diagnostics.colorAccuracyCeiling ?? 86
  const backgroundCleanliness =
    strategyConfig.diagnostics.backgroundCleanlinessCeiling ?? 86
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
      thresholdValue: brightness,
      trend: brightness - 65,
      trendLabel: signed(brightness - 65),
    }),
    createSignal({
      id: 'contrast',
      label: '对比度',
      value: `${contrast}`,
      score: contrast,
      thresholdValue: contrast,
      trend: contrast - 80,
      trendLabel: signed(contrast - 80),
    }),
    createSignal({
      id: 'color-accuracy',
      label: '色彩还原度',
      value: `${colorAccuracy} / 100`,
      score: colorAccuracy,
      thresholdValue: colorAccuracy,
      trend: colorAccuracy - 70,
      trendLabel: signed(colorAccuracy - 70),
    }),
    createSignal({
      id: 'background-cleanliness',
      label: '背景整洁度',
      value: `${backgroundCleanliness} / 100`,
      score: backgroundCleanliness,
      thresholdValue: backgroundCleanliness,
      trend: backgroundCleanliness - 65,
      trendLabel: signed(backgroundCleanliness - 65),
    }),
    createSignal({
      id: 'framing',
      label: '人脸构图',
      value: mediaMetrics.framing.status === 'ready'
        ? mediaMetrics.framing.value
        : `${framing} / 100`,
      score: framing,
      thresholdValue: framing,
      trend: framing - 55,
      trendLabel: signed(framing - 55),
    }),
    createSignal({
      id: 'fps',
      label: '帧率',
      value: `${fps} fps`,
      score: clamp((fps / 30) * 100),
      thresholdValue: fps,
      trend: fps - 28,
      trendLabel: signed(fps - 28, ' fps'),
    }),
    createSignal({
      id: 'microphone',
      label: '麦克风',
      value: microphoneValue,
      score: microphoneScore,
      thresholdValue: microphoneScore,
      trend: microphoneTrend,
      trendLabel: signed(microphoneTrend),
      audio: true,
    }),
    createSignal({
      id: 'comments',
      label: '评论区密度',
      value: `${audience.commentsPerMinute} / min`,
      score: clamp(audience.commentsPerMinute * 2),
      thresholdValue: audience.commentsPerMinute,
      trend: audience.commentsPerMinute - 30,
      trendLabel: signed(audience.commentsPerMinute - 30),
    }),
    createSignal({
      id: 'entrants',
      label: '近一分钟进房',
      value: `+${audience.entrantsLastMinute}`,
      score: clamp(audience.entrantsLastMinute * 2),
      thresholdValue: audience.entrantsLastMinute,
      trend: audience.entrantsLastMinute - 30,
      trendLabel: signed(audience.entrantsLastMinute - 30),
    }),
    createSignal({
      id: 'retention',
      label: '新观众10秒留存',
      value: `${audience.newViewerRetention}%`,
      score: audience.newViewerRetention,
      thresholdValue: audience.newViewerRetention,
      trend: audience.newViewerRetention - 45,
      trendLabel: signed(audience.newViewerRetention - 45),
    }),
    createSignal({
      id: 'gifts',
      label: '礼物赠送量',
      value: `${giftCount}`,
      score: clamp(giftCount * 5),
      thresholdValue: giftCount,
      trend: giftCount - 16,
      trendLabel: signed(giftCount - 16),
    }),
  ]

  const goodSignals = [...signals]
    .sort((left, right) => right.trend - left.trend || right.score - left.score)
    .slice(0, 2)
  const rankedImprovements = [...signals]
    .sort((left, right) => left.trend - right.trend || left.score - right.score)
  const primarySignal = signals.find(
    (signal) => signal.id === strategyConfig.primarySignal,
  )
  const thresholdTriggeredSignal = strategy !== 'normal' &&
    (primarySignal?.thresholdValue ?? primarySignal?.score ?? 100) <
      strategyConfig.monitoring.warningBelow
    ? primarySignal
    : undefined
  const improvements = [
    ...(thresholdTriggeredSignal ? [thresholdTriggeredSignal] : []),
    ...rankedImprovements.filter(
      (signal) => signal.id !== thresholdTriggeredSignal?.id,
    ),
  ].slice(0, 2)
  const suggestions = improvements
    .map((signal) => createSuggestion(
      signal,
      audience,
      resolvedScene,
      strategy,
    ))
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
  strategy: AudienceStrategyId,
): LiveSuggestion {
  const strategyConfig = getAudienceStrategy(strategy)
  const isPrimaryScenarioSignal =
    strategy !== 'normal' && signal.id === strategyConfig.primarySignal
  const thresholdSeverity = (signal.thresholdValue ?? signal.score) <
    strategyConfig.monitoring.criticalBelow
    ? 96
    : 82
  const severity = resolvedScene === sceneForSignal(signal.id)
    ? 8
    : isPrimaryScenarioSignal
      ? thresholdSeverity
      : clamp(60 + Math.max(0, -signal.trend))
  const base = {
    signalId: signal.id,
    scene: sceneForSignal(signal.id),
    severity,
    tone: signal.tone,
    metric: `${signal.label} ${signal.trendLabel}`,
  }
  const scenarioAction = isPrimaryScenarioSignal
    ? strategyConfig.recommendation
    : null

  switch (signal.id) {
    case 'comments':
      return {
        ...base,
        action: scenarioAction
          ?? '评论节奏有些放缓，可以用一个轻量互动重新邀请大家参与。',
        widget: createPollWidget(
          '观众心愿',
          `评论区密度较基准下降 ${Math.abs(signal.trend)}%，可以先收集点歌或内容愿望，让观众更容易开口。`,
        ),
      }
    case 'entrants':
      return {
        ...base,
        action: scenarioAction
          ?? '新观众进入速度有所放缓，可以先优化首屏氛围和欢迎信息。',
        widget: createPollWidget(
          '新观众欢迎',
          `近一分钟进房人数较基准减少 ${Math.abs(signal.trend)} 人，可以通过整体装修和人物效果提升第一眼吸引力。`,
        ),
      }
    case 'retention':
      return {
        ...base,
        action: '新观众停留时间有些缩短，可以在进房后的 10 秒内给出清晰的内容预告和参与入口。',
        widget: createPollWidget(
          '新观众留存互动',
          `新观众 10 秒留存较基准下降 ${Math.abs(signal.trend)}%，建议用点歌选择题快速承接。`,
        ),
      }
    case 'gifts':
      return {
        ...base,
        scene: 'pk',
        action: scenarioAction
          ?? '本轮礼物互动有所放缓，可以设置一个清晰、轻量的阶段目标。',
        widget: {
          version: '1.0',
          type: 'live-goal',
          title: '阶段礼物目标',
          detail: `礼物赠送量较基准下降 ${Math.abs(signal.trend)}，可以用可视化目标帮助观众了解进度。`,
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
        action: scenarioAction
          ?? '人声有些偏小，可以适当提高麦克风增益并降低背景音乐。',
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
    case 'color-accuracy':
      return {
        ...base,
        action: scenarioAction
          ?? '画面颜色有些失真，可以校准白平衡并降低偏色强度。',
        widget: createVisualWidget('色彩调节', signal, 1.02, 1.04, 0),
      }
    case 'background-cleanliness':
      return {
        ...base,
        action: scenarioAction
          ?? '背景元素有些拥挤，可以换用干净的虚拟背景突出主播。',
        widget: createVisualWidget(
          '虚拟背景',
          signal,
          1.02,
          1.05,
          0.04,
        ),
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
        action: scenarioAction
          ?? `画面亮度有些偏低，可以先将补光提升 ${Math.max(8, Math.abs(signal.trend))}% 并观察肤色变化。`,
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

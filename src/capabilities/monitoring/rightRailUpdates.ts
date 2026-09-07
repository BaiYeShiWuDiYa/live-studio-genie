import type {
  AudienceComment,
  AudienceSnapshot,
  CommentInsight,
} from '../audience/audienceEvents'
import { studioRuntimeConfig } from '../../config/studioRuntime'
import {
  getAudienceStrategy,
  type AudienceStrategyId,
} from '../../config/audienceComments'
import type {
  LiveDiagnostics,
  LiveSuggestion,
} from './liveDiagnostics'
import type { MediaMetric, MediaMetricKind } from './types'

export const rightRailUpdateConfig = {
  normalDetectionIntervalMs:
    studioRuntimeConfig.suggestion.normalDetectionIntervalMs,
  metricTrendDeltaThreshold:
    studioRuntimeConfig.suggestion.metricTrendDeltaThreshold,
  metricUpdateCooldownMs:
    studioRuntimeConfig.suggestion.metricUpdateCooldownMs,
  commentAnalysisDelayMs:
    studioRuntimeConfig.suggestion.commentAnalysisDelayMs,
  commentCategoryCooldownMs:
    studioRuntimeConfig.suggestion.commentCategoryCooldownMs,
} as const

export interface NormalModeDetectionSnapshot {
  monitoringFingerprint: string
  latestMonitoringUpdateAt: number
  latestCommentId: string | null
  visualFingerprint: string
}

export interface NormalModeUpdateSources {
  monitoring: boolean
  comments: boolean
  visual: boolean
  hasUpdates: boolean
}

export function createNormalModeDetectionSnapshot(
  diagnostics: LiveDiagnostics,
  comments: readonly Pick<AudienceComment, 'id'>[],
  mediaMetrics: Record<MediaMetricKind, MediaMetric>,
): NormalModeDetectionSnapshot {
  return {
    monitoringFingerprint: diagnostics.signals
      .map(({ id, score, tone, trend, value }) =>
        `${id}:${score}:${tone}:${trend}:${value}`,
      )
      .join('|'),
    latestMonitoringUpdateAt: Math.max(
      ...Object.values(mediaMetrics).map((metric) => metric.updatedAt),
    ),
    latestCommentId: comments.at(-1)?.id ?? null,
    visualFingerprint: [
      mediaMetrics.brightness.status,
      mediaMetrics.brightness.score,
      mediaMetrics.brightness.value,
      mediaMetrics.framing.status,
      mediaMetrics.framing.score,
      mediaMetrics.framing.value,
    ].join(':'),
  }
}

export function detectNormalModeUpdates(
  previous: NormalModeDetectionSnapshot,
  current: NormalModeDetectionSnapshot,
): NormalModeUpdateSources {
  const monitoring =
    current.monitoringFingerprint !== previous.monitoringFingerprint ||
    current.latestMonitoringUpdateAt > previous.latestMonitoringUpdateAt
  const comments = current.latestCommentId !== previous.latestCommentId
  const visual = current.visualFingerprint !== previous.visualFingerprint

  return {
    monitoring,
    comments,
    visual,
    hasUpdates: monitoring || comments || visual,
  }
}

export function createNormalAiAnalysisPrompt(
  diagnostics: LiveDiagnostics,
  audience: AudienceSnapshot,
  updates: NormalModeUpdateSources,
  candidates: readonly LiveSuggestion[],
): string {
  const updateSources = [
    updates.monitoring ? '监控指标' : null,
    updates.comments ? '评论区' : null,
    updates.visual ? '直播画面' : null,
  ].filter(Boolean).join('、')
  const signalSummary = diagnostics.signals
    .map((signal) =>
      `${signal.label}: ${signal.value}, 趋势 ${signal.trendLabel}, 状态 ${signal.tone}`,
    )
    .join('\n')
  const recentComments = audience.comments
    .slice(-5)
    .map((comment) => comment.text)
    .join('；') || '暂无新评论'
  const candidateSummary = candidates
    .map((candidate) => `${candidate.metric}: ${candidate.action}`)
    .join('\n')

  return [
    '你是 LIVE Studio Genie 的实时分析模块。',
    `本轮检测到变化来源：${updateSources || '无'}。`,
    '请结合当前直播画面（如请求附带画面帧）、实时指标和最新评论，判断是否需要给主播新增一条建议。',
    '不要复述固定模板，不要仅凭单一波动下结论；优先解释画面、数据和评论之间的关联。',
    '如果没有明确且可执行的新问题，只回复 NO_ACTION。',
    '如果需要建议，用 80 个汉字以内给出自然、具体、可执行的中文建议，并按协议返回一个最相关组件。',
    '返回的组件必须直接执行这条建议，不得返回与建议内容无关的组件。',
    `当前在线：${audience.viewerCount}，近一分钟进房：${audience.entrantsLastMinute}，10 秒留存：${audience.newViewerRetention}%，评论密度：${audience.commentsPerMinute}/min。`,
    `实时指标：\n${signalSummary}`,
    `最新评论：${recentComments}`,
    `本地诊断候选仅作事实参考，不得照抄：\n${candidateSummary || '无'}`,
  ].join('\n')
}

export function createAiAnalyzedSuggestion(
  base: LiveSuggestion,
  analysisText: string,
  widget?: LiveSuggestion['widget'],
): LiveSuggestion | null {
  const action = analysisText.trim()
  if (!action || /^NO_ACTION[。.!！]?$/i.test(action)) return null

  return {
    ...base,
    action: truncate(action, 180),
    widget: widget ?? base.widget,
    analysisSource: 'ai',
  }
}

export function selectThresholdChangedSuggestions(
  previous: LiveDiagnostics | null,
  current: LiveDiagnostics,
  threshold = rightRailUpdateConfig.metricTrendDeltaThreshold,
): LiveSuggestion[] {
  if (!previous) return current.suggestions

  const previousSignals = new Map(
    previous.signals.map((signal) => [signal.id, signal]),
  )

  return current.suggestions.filter((suggestion) => {
    const currentSignal = current.signals.find(
      (signal) => signal.id === suggestion.signalId,
    )
    const previousSignal = previousSignals.get(suggestion.signalId)
    if (!currentSignal || currentSignal.trend >= 0) return false
    if (!previousSignal) return true

    const worsenedToBad =
      currentSignal.tone === 'bad' && previousSignal.tone !== 'bad'
    const trendDelta = Math.abs(currentSignal.trend - previousSignal.trend)
    return worsenedToBad || trendDelta >= threshold
  })
}

export function selectSuggestionsForStrategy(
  suggestions: readonly LiveSuggestion[],
  strategyId: AudienceStrategyId,
): LiveSuggestion[] {
  if (strategyId === 'normal') return [...suggestions]

  const primarySignal = getAudienceStrategy(strategyId).primarySignal
  return suggestions
    .filter((suggestion) => suggestion.signalId === primarySignal)
    .slice(0, 1)
}

export function createCommentInsightSuggestion(
  insight: CommentInsight,
  comments: Pick<AudienceComment, 'text'>[],
): LiveSuggestion | null {
  if (
    insight.count === 0 ||
    insight.category === 'none' ||
    insight.category === 'positive'
  ) {
    return null
  }

  const metric = `评论热点 · ${insight.label} ${insight.count} 条`

  if (insight.category === 'audio') {
    return {
      signalId: 'microphone',
      scene: 'troubleshoot',
      severity: 88,
      tone: 'bad',
      metric,
      action: '观众集中反馈声音问题，建议立即提升人声并降低背景音乐。',
      widget: {
        version: '1.0',
        type: 'audio-adjustment',
        title: '评论反馈音频优化',
        detail: '根据最新声音反馈，提高麦克风增益并适当降低背景音乐。',
        actionLabel: '应用音频优化',
        props: {
          microphoneGain: 8,
          backgroundMusicGain: -4,
        },
      },
    }
  }

  if (insight.category === 'visual') {
    return {
      signalId: 'exposure',
      scene: 'quality',
      severity: 84,
      tone: 'warn',
      metric,
      action: '观众集中反馈画面问题，建议优化亮度与对比度。',
      widget: {
        version: '1.0',
        type: 'visual-adjustment',
        title: '评论反馈画面优化',
        detail: '根据最新画面反馈，提高人物亮度并增强主体层次。',
        actionLabel: '应用画面优化',
        props: {
          settings: {
            brightness: 1.16,
            contrast: 1.06,
            warmth: 0.1,
          },
        },
      },
    }
  }

  if (insight.category === 'network') {
    return {
      signalId: 'fps',
      scene: 'quality',
      severity: 92,
      tone: 'bad',
      metric,
      action: '观众集中反馈卡顿，建议降低画面负载并稳定输出帧率。',
      widget: {
        version: '1.0',
        type: 'visual-adjustment',
        title: '直播流畅度优化',
        detail: '根据最新卡顿反馈，降低高负载画面参数以稳定直播。',
        actionLabel: '应用流畅度优化',
        props: {
          settings: {
            brightness: 1,
            contrast: 1,
            warmth: 0,
          },
        },
      },
    }
  }

  const latestRequest = comments
    .map((comment) => comment.text.trim())
    .filter(Boolean)
    .at(-1)

  return {
    signalId: 'comments',
    scene: 'interaction',
    severity: 80,
    tone: 'warn',
    metric,
    action: latestRequest
      ? `观众正在讨论“${truncate(latestRequest, 18)}”，建议发起快速选择互动。`
      : '观众点播需求集中，建议发起快速选择互动。',
    widget: {
      version: '1.0',
      type: 'audience-poll',
      title: '评论热点互动',
      detail: '根据最新点播和内容诉求生成低门槛互动，快速承接评论热度。',
      actionLabel: '发布互动',
      props: {
        question: '接下来想看什么？',
        options: ['继续当前内容', '换个主题'],
        durationSeconds: 45,
      },
    },
  }
}

function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength)}…`
}

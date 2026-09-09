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

export function advanceFixedRateDeadline(
  previousDeadline: number,
  now: number,
  intervalMs: number,
): number {
  let nextDeadline = previousDeadline + intervalMs
  while (nextDeadline <= now) nextDeadline += intervalMs
  return nextDeadline
}

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
  audience: AudienceSnapshot,
  candidates: readonly LiveSuggestion[],
): string {
  const recentComments = audience.comments
    .slice(-5)
    .map((comment) => comment.text)
    .join('；') || '暂无新评论'
  const candidateSummary = candidates
    .map((candidate) => `${candidate.metric}: ${candidate.action}`)
    .join('\n')
  const categoryConstraint = {
    audio: '本轮只能讨论麦克风、人声或背景音乐音量。',
    visual: '本轮只能讨论画面亮度、曝光、光线或背景可见度。',
    network: '本轮只能讨论卡顿、延迟或直播流畅度。',
    request: '本轮只能讨论点播诉求与观众心愿，不得建议投票。',
    interaction: '本轮只能讨论评论互动与口播引导。',
    engagement: '本轮只能讨论礼物互动与助力目标。',
    positive: '',
    none: '',
  }[audience.insight.category]

  return [
    '你是 LIVE Studio Genie 的实时分析模块。',
    '只根据直播间实际出现的最新评论判断是否需要给主播新增一条建议。',
    '不要复述固定模板，不要仅凭单条评论下结论；只有多条评论形成明确共识时才建议。',
    '内容点播或心愿类反馈应建议展示观众心愿，不要建议发起投票；互动冷场反馈应给出可直接使用的口播建议。',
    `${categoryConstraint} 严禁夹带当前评论中不存在的其他问题或调整项。`,
    `本地候选非空表示最近评论中至少有 ${studioRuntimeConfig.suggestion.minimumCommentInsightCount} 条同类反馈，必须给出对应建议和组件；候选为空时才回复 NO_ACTION。`,
    '如果需要建议，用 80 个汉字以内给出自然、具体、可执行的中文建议，并按协议返回一个最相关组件。',
    '返回的组件必须直接执行这条建议，不得返回与建议内容无关的组件。',
    `评论洞察：${audience.insight.label}，优先级 ${audience.insight.priority}，置信度 ${Math.round(audience.insight.confidence * 100)}%，建议触发 ${audience.insight.shouldTrigger ? '是' : '否'}。`,
    `最新评论：${recentComments}`,
    `已确认的评论建议候选：\n${candidateSummary || '无'}`,
  ].join('\n')
}

export function isAiAnalysisRelevant(
  analysisText: string,
  category: CommentInsight['category'],
): boolean {
  const text = analysisText.trim()
  if (!text || /^NO_ACTION[。.!！]?$/i.test(text)) return false

  const audio = /麦克风|音量|人声|背景音乐|伴奏|听清|听见/
  const visual = /画面|亮度|曝光|光线|补光|看清|背景可见/
  const constraints: Record<CommentInsight['category'], RegExp | null> = {
    audio,
    visual,
    network: /卡顿|延迟|流畅|帧率|掉线/,
    request: /心愿|点播|想听|想看|诉求/,
    interaction: /评论|互动|口播|话题|参与|公屏/,
    engagement: /礼物|助力|目标|进度|贡献/,
    positive: null,
    none: null,
  }
  const required = constraints[category]
  if (!required?.test(text)) return false
  if (
    (category === 'interaction' || category === 'request') &&
    (audio.test(text) || visual.test(text))
  ) {
    return false
  }
  return true
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
    insight.count < studioRuntimeConfig.suggestion.minimumCommentInsightCount ||
    insight.category === 'none' ||
    insight.category === 'positive' ||
    !insight.shouldTrigger
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

  if (insight.category === 'engagement') {
    return {
      signalId: 'gifts',
      scene: 'pk',
      severity: 82,
      tone: 'warn',
      metric,
      action: '观众正在讨论礼物和助力进度，建议设置清晰的阶段目标承接互动。',
      widget: {
        version: '1.0',
        type: 'live-goal',
        title: '评论热点助力目标',
        detail: '根据最新礼物互动反馈，展示一个容易理解和参与的阶段目标。',
        actionLabel: '发布目标',
        props: {
          label: '本轮互动助力',
          current: 860,
          target: 3000,
          supporters: 12,
        },
      },
    }
  }

  if (insight.category === 'interaction') {
    return {
      signalId: 'comments',
      scene: 'interaction',
      severity: 80,
      tone: 'warn',
      metric,
      action: '评论区持续反馈互动不足，建议用一句低门槛口播重新带动参与。',
      widget: {
        version: '1.0',
        type: 'audience-poll',
        title: '评论互动引导',
        detail: '根据最新评论生成容易回应的互动话题。',
        actionLabel: '生成互动口播',
        props: {
          question: '今晚最想聊哪个话题？',
          options: ['最近的趣事', '接下来的安排'],
          durationSeconds: 45,
        },
      },
    }
  }

  const latestRequest = insight.sampleTexts.at(-1)
    ?? comments.map((comment) => comment.text.trim()).filter(Boolean).at(-1)

  return {
    signalId: 'comments',
    scene: 'interaction',
    severity: 80,
    tone: 'warn',
    metric,
    action: latestRequest
      ? `观众正在集中提出“${truncate(latestRequest, 18)}”等诉求，建议整理并展示观众心愿。`
      : '观众点播需求集中，建议整理并展示观众心愿。',
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

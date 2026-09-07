import type {
  AudienceComment,
  CommentInsight,
} from '../audience/audienceEvents'
import { studioRuntimeConfig } from '../../config/studioRuntime'
import type {
  LiveDiagnostics,
  LiveSuggestion,
} from './liveDiagnostics'

export const rightRailUpdateConfig = {
  metricTrendDeltaThreshold:
    studioRuntimeConfig.suggestion.metricTrendDeltaThreshold,
  metricUpdateCooldownMs:
    studioRuntimeConfig.suggestion.metricUpdateCooldownMs,
  commentAnalysisDelayMs:
    studioRuntimeConfig.suggestion.commentAnalysisDelayMs,
  commentCategoryCooldownMs:
    studioRuntimeConfig.suggestion.commentCategoryCooldownMs,
} as const

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

import { z } from 'zod'
import type { StudioScene } from '../../agent/widgets/widgetSpec'
import {
  audienceCommentsByStrategy,
  audienceRecoveryCommentsByStrategy,
  audienceUserNames,
  getAudienceStrategy,
  type AudienceStrategyId,
} from '../../config/audienceComments'
import { studioRuntimeConfig } from '../../config/studioRuntime'

const audienceEventBaseSchema = z.object({
  id: z.string().min(1),
  userName: z.string().min(1),
  occurredAt: z.number().int().nonnegative(),
})

export const audienceEventSchema = z.discriminatedUnion('type', [
  audienceEventBaseSchema.extend({
    type: z.literal('comment'),
    text: z.string().min(1).max(120),
  }),
  audienceEventBaseSchema.extend({
    type: z.literal('gift'),
    giftName: z.string().min(1),
    count: z.number().int().positive(),
    icon: z.string().min(1),
  }),
  audienceEventBaseSchema.extend({
    type: z.literal('enter'),
  }),
])

export type AudienceEvent = z.infer<typeof audienceEventSchema>
export type AudienceComment = Extract<AudienceEvent, { type: 'comment' }>
export type AudienceGift = Extract<AudienceEvent, { type: 'gift' }>
export type AudienceCommentPhase = 'issue' | 'recovery'

export interface CommentInsight {
  category: 'audio' | 'visual' | 'network' | 'request' | 'positive' | 'none'
  label: string
  count: number
}

export interface AudienceSnapshot {
  comments: AudienceComment[]
  gifts: AudienceGift[]
  viewerCount: number
  entrantsLastMinute: number
  commentsPerMinute: number
  newViewerRetention: number
  insight: CommentInsight
}

export interface AudienceEventAdapter {
  getSnapshot: (
    scene: StudioScene,
    applied: boolean,
    tick: number,
    startedAt?: number,
  ) => AudienceSnapshot
  getStrategySnapshot: (
    strategy: AudienceStrategyId,
    applied: boolean,
    tick: number,
    phase?: AudienceCommentPhase,
    startedAt?: number,
  ) => AudienceSnapshot
}

const strategyByScene: Record<StudioScene, AudienceStrategyId> = {
  quality: 'dim-light',
  interaction: 'cold-interaction',
  troubleshoot: 'low-audio',
  pk: 'pk-push',
}

const keywordGroups: Array<{
  category: CommentInsight['category']
  label: string
  words: string[]
}> = [
  { category: 'audio', label: '声音反馈', words: ['声音', '听不清', '音量', '麦克风'] },
  { category: 'visual', label: '画面反馈', words: ['画面', '背景', '亮', '暗'] },
  { category: 'network', label: '卡顿反馈', words: ['卡', '延迟', '掉线'] },
  { category: 'request', label: '内容点播', words: ['唱', '歌', '点播', '想听'] },
  {
    category: 'positive',
    label: '正向反馈',
    words: [
      '好看',
      '舒服',
      '喜欢',
      '加油',
      '好了',
      '好多了',
      '刚刚好',
      '清楚',
      '正常',
      '流畅',
      '可以了',
    ],
  },
]

export function analyzeCommentKeywords(
  comments: Pick<AudienceComment, 'text'>[],
): CommentInsight {
  const ranked = keywordGroups
    .map((group) => ({
      category: group.category,
      label: group.label,
      count: comments.reduce((total, comment) => (
        total + (group.words.some((word) => comment.text.includes(word)) ? 1 : 0)
      ), 0),
    }))
    .sort((left, right) => right.count - left.count)

  return ranked[0]?.count
    ? ranked[0]
    : { category: 'none', label: '暂无集中反馈', count: 0 }
}

export function resolveAudienceStrategy(
  selectedStrategy: AudienceStrategyId,
  liveElapsedMs: number,
): AudienceStrategyId {
  return liveElapsedMs < studioRuntimeConfig.audience.strategyWarmupDurationMs
    ? 'normal'
    : selectedStrategy
}

function buildSnapshot(
  strategyId: AudienceStrategyId,
  applied: boolean,
  tick: number,
  phase: AudienceCommentPhase = 'issue',
  startedAt = 0,
): AudienceSnapshot {
  const config = studioRuntimeConfig.audience
  const strategy = getAudienceStrategy(strategyId)
  const metricsStrategy = phase === 'recovery'
    ? getAudienceStrategy('normal')
    : strategy
  const sourceComments = phase === 'recovery'
    ? audienceRecoveryCommentsByStrategy[strategyId] ?? audienceCommentsByStrategy.normal
    : audienceCommentsByStrategy[strategyId]
  const currentEventTime = startedAt + tick * config.refreshIntervalMs
  const comments = Array.from({ length: config.visibleCommentCount }, (_, index): AudienceComment => {
    const eventTick = tick - (config.visibleCommentCount - 1 - index)
    const sourceIndex = (
      (eventTick % sourceComments.length) + sourceComments.length
    ) % sourceComments.length
    const userIndex = (
      (eventTick % audienceUserNames.length) + audienceUserNames.length
    ) % audienceUserNames.length
    return {
      id: `comment-${strategyId}-${phase}-${eventTick}`,
      type: 'comment',
      userName: audienceUserNames[userIndex],
      text: phase === 'issue' && applied && strategyId === 'cold-interaction' && index === config.visibleCommentCount - 1
        ? '选 2，来首炸场的'
        : sourceComments[sourceIndex],
      occurredAt: Math.max(
        0,
        currentEventTime -
          (config.visibleCommentCount - 1 - index) * config.refreshIntervalMs,
      ),
    }
  })

  const gifts: AudienceGift[] = [
    {
      id: `gift-rose-${tick}`,
      type: 'gift',
      userName: 'Luna',
      giftName: 'Rose',
      count:
        config.recentGiftBaseCount +
        tick % config.recentGiftVariationRange,
      icon: '🌹',
      occurredAt: currentEventTime,
    },
    {
      id: `gift-heart-${tick}`,
      type: 'gift',
      userName: 'Mie',
      giftName: 'Heart',
      count: config.previousGiftCount,
      icon: '💗',
      occurredAt: Math.max(
        0,
        currentEventTime - config.previousGiftOffsetMs,
      ),
    },
  ]

  return {
    comments,
    gifts,
    viewerCount: config.initialViewerCount + tick * config.viewerGrowthPerTick,
    entrantsLastMinute: metricsStrategy.audienceMetrics.entrantsLastMinute,
    commentsPerMinute: metricsStrategy.audienceMetrics.commentsPerMinute,
    newViewerRetention: metricsStrategy.audienceMetrics.newViewerRetention,
    insight: phase === 'recovery'
      ? { category: 'positive', label: '正向反馈', count: comments.length }
      : analyzeCommentKeywords(comments),
  }
}

export const mockAudienceEventAdapter: AudienceEventAdapter = {
  getSnapshot(scene, applied, tick, startedAt) {
    return buildSnapshot(strategyByScene[scene], applied, tick, 'issue', startedAt)
  },
  getStrategySnapshot: buildSnapshot,
}

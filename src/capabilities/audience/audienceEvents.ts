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
  interaction: 'cold-comments',
  troubleshoot: 'low-audio',
  pk: 'gift-drop',
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
      text: phase === 'issue' && applied && strategyId === 'cold-comments' && index === config.visibleCommentCount - 1
        ? '选 2，来首炸场的'
        : sourceComments[sourceIndex],
      occurredAt: Math.max(
        0,
        currentEventTime -
          (config.visibleCommentCount - 1 - index) * config.refreshIntervalMs,
      ),
    }
  })

  const normalGifts: AudienceGift[] = [{
    id: `gift-rose-${tick}`,
    type: 'gift',
    userName: audienceUserNames[(tick + 2) % audienceUserNames.length],
    giftName: 'Rose',
    count: 2 + (tick * 3) % 7,
    icon: '🌹',
    occurredAt: currentEventTime,
  }]
  if (tick % 4 !== 1) {
    normalGifts.push({
      id: `gift-heart-${tick}`,
      type: 'gift',
      userName: audienceUserNames[(tick + 5) % audienceUserNames.length],
      giftName: 'Heart',
      count: 6 + (tick * 5) % 9,
      icon: '💗',
      occurredAt: Math.max(
        0,
        currentEventTime - config.previousGiftOffsetMs,
      ),
    })
  }
  if (tick > 0 && tick % 9 === 0) {
    normalGifts.push({
      id: `gift-galaxy-${tick}`,
      type: 'gift',
      userName: audienceUserNames[(tick + 8) % audienceUserNames.length],
      giftName: 'Galaxy',
      count: 1,
      icon: '🌌',
      occurredAt: Math.max(
        0,
        currentEventTime - Math.round(config.previousGiftOffsetMs / 2),
      ),
    })
  }
  const gifts = metricsStrategy.audienceMetrics.giftLevel === 'reduced'
    ? [{
        ...normalGifts[0],
        id: `gift-low-${tick}`,
        count: 1,
        occurredAt: Math.max(
          0,
          currentEventTime - config.previousGiftOffsetMs * 2,
        ),
      }]
    : normalGifts
  const viewerCount = strategyId === 'entrant-drop' && phase === 'issue'
    ? Math.max(820, config.initialViewerCount - tick * 3)
    : config.initialViewerCount + tick * config.viewerGrowthPerTick
  const normalCommentVariation = [0, 3, -2, 5, -1, 2, -4][tick % 7]
  const normalEntrantVariation = [0, 2, -3, 4, -1, 3, -2][tick % 7]
  const normalRetentionVariation = [0, 1, -2, 2, -1, 3, -1][tick % 7]
  const useNormalVariation = strategyId === 'normal' && phase === 'issue'

  return {
    comments,
    gifts,
    viewerCount,
    entrantsLastMinute:
      metricsStrategy.audienceMetrics.entrantsLastMinute +
      (useNormalVariation ? normalEntrantVariation : 0),
    commentsPerMinute:
      metricsStrategy.audienceMetrics.commentsPerMinute +
      (useNormalVariation ? normalCommentVariation : 0),
    newViewerRetention:
      metricsStrategy.audienceMetrics.newViewerRetention +
      (useNormalVariation ? normalRetentionVariation : 0),
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

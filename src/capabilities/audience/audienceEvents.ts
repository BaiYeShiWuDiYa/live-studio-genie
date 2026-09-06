import { z } from 'zod'
import type { StudioScene } from '../../agent/widgets/widgetSpec'
import {
  audienceCommentsByStrategy,
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
  ) => AudienceSnapshot
  getStrategySnapshot: (
    strategy: AudienceStrategyId,
    applied: boolean,
    tick: number,
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
  { category: 'positive', label: '正向反馈', words: ['好看', '舒服', '喜欢', '加油'] },
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
): AudienceSnapshot {
  const config = studioRuntimeConfig.audience
  const strategy = getAudienceStrategy(strategyId)
  const sourceComments = audienceCommentsByStrategy[strategyId]
  const comments = Array.from({ length: config.visibleCommentCount }, (_, index): AudienceComment => {
    const sourceIndex = (tick + index) % sourceComments.length
    return {
      id: `comment-${strategyId}-${tick}-${index}`,
      type: 'comment',
      userName: audienceUserNames[(tick + index) % audienceUserNames.length],
      text: applied && strategyId === 'cold-interaction' && index === 0
        ? '选 2，来首炸场的'
        : sourceComments[sourceIndex],
      occurredAt: Math.max(
        0,
        tick * config.refreshIntervalMs - index * config.commentHistorySpacingMs,
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
      occurredAt: tick * config.refreshIntervalMs,
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
        tick * config.refreshIntervalMs - config.previousGiftOffsetMs,
      ),
    },
  ]

  return {
    comments,
    gifts,
    viewerCount: config.initialViewerCount + tick * config.viewerGrowthPerTick,
    entrantsLastMinute: strategy.audienceMetrics.entrantsLastMinute,
    commentsPerMinute: strategy.audienceMetrics.commentsPerMinute,
    newViewerRetention: strategy.audienceMetrics.newViewerRetention,
    insight: analyzeCommentKeywords(comments),
  }
}

export const mockAudienceEventAdapter: AudienceEventAdapter = {
  getSnapshot(scene, applied, tick) {
    return buildSnapshot(strategyByScene[scene], applied, tick)
  },
  getStrategySnapshot: buildSnapshot,
}

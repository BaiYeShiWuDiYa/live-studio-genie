import { z } from 'zod'
import type { StudioScene } from '../../agent/widgets/widgetSpec'
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
  getRealtimeSnapshot: (applied: boolean, tick: number) => AudienceSnapshot
}

const commentsByScene: Record<StudioScene, string[]> = {
  quality: [
    '背景有点暗诶',
    '今天的氛围好舒服',
    '主播好，刚进来',
    '画面亮一点会更好',
    '求一首歌单',
  ],
  interaction: [
    '今天唱哪首歌？',
    '新来的报到',
    '好想听甜歌',
    '可以开个投票吗',
    '主播看看评论',
  ],
  troubleshoot: [
    '声音有点小',
    '听不清诶',
    '现在卡不卡？',
    '音量再大一点',
    '画面正常了',
  ],
  pk: [
    '加油马上追上了',
    '目标还差一点',
    '送礼物冲一冲',
    '今天唱哪首歌？',
    '新来的报到',
  ],
}

const userNames = ['甜甜圈', '小满同学', '阿福', '星河入梦', '柚子茶']

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

function buildSnapshot(scene: StudioScene, applied: boolean, tick: number): AudienceSnapshot {
  const config = studioRuntimeConfig.audience
  const sourceComments = commentsByScene[scene]
  const comments = Array.from({ length: config.visibleCommentCount }, (_, index): AudienceComment => {
    const sourceIndex = (tick + index) % sourceComments.length
    return {
      id: `comment-${scene}-${tick}-${index}`,
      type: 'comment',
      userName: userNames[(tick + index) % userNames.length],
      text: applied && scene === 'interaction' && index === 0
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
      count: 5 + tick % 3,
      icon: '🌹',
      occurredAt: tick * config.refreshIntervalMs,
    },
    {
      id: `gift-heart-${tick}`,
      type: 'gift',
      userName: 'Mie',
      giftName: 'Heart',
      count: 10,
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
    entrantsLastMinute:
      config.entrantCountBase +
      (tick * config.entrantCountStep) % config.entrantCountRange,
    commentsPerMinute:
      config.commentRateBase +
      (tick * config.commentRateStep) % config.commentRateRange,
    newViewerRetention:
      config.retentionBase +
      (tick * config.retentionStep) % config.retentionRange,
    insight: analyzeCommentKeywords(comments),
  }
}

export const mockAudienceEventAdapter: AudienceEventAdapter = {
  getSnapshot: buildSnapshot,
  getRealtimeSnapshot(applied, tick) {
    const phase = Math.floor(
      tick / studioRuntimeConfig.audience.realtimePhaseDurationTicks,
    ) % 3
    const scene: StudioScene = ['quality', 'interaction', 'troubleshoot'][phase] as StudioScene
    const snapshot = buildSnapshot(scene, applied, tick)
    const phaseMetrics = [
      { commentsPerMinute: 42, entrantsLastMinute: 38, newViewerRetention: 48 },
      { commentsPerMinute: 16, entrantsLastMinute: 19, newViewerRetention: 22 },
      { commentsPerMinute: 31, entrantsLastMinute: 29, newViewerRetention: 43 },
    ][phase]

    return {
      ...snapshot,
      ...phaseMetrics,
    }
  },
}

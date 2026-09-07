import type { AudienceSnapshot } from '../audience/audienceEvents'
import type { AudienceStrategyId } from '../../config/audienceComments'

export type PostLiveStreamType = 'music' | 'chat' | 'game' | 'show'

export interface PostLiveReport {
  topic: string
  streamType: PostLiveStreamType
  strategyId: AudienceStrategyId
  strategyLabel: string
  durationSeconds: number
  totalViews: number
  peakViewers: number
  newFollowers: number
  commentCount: number
  giftCount: number
  diamondCount: number
  retention: number
  appliedSuggestionCount: number
  performanceScore: number
}

export interface PostLiveRecommendation {
  id: string
  label: string
  title: string
  detail: string
  impact: string
}

interface CreatePostLiveReportInput {
  topic: string
  streamType: PostLiveStreamType
  strategyId: AudienceStrategyId
  strategyLabel: string
  durationSeconds: number
  audience: AudienceSnapshot
  appliedSuggestionCount: number
}

const strategyRecommendations: Record<
  AudienceStrategyId,
  Omit<PostLiveRecommendation, 'id'>
> = {
  normal: {
    label: '内容节奏',
    title: '把高互动话题前置到开场',
    detail: '本场基础指标稳定，下一场可在前 3 分钟加入明确提问，让新观众更快参与。',
    impact: '预计评论率 +12%',
  },
  'dim-light': {
    label: '画面资产',
    title: '保存本场补光参数为开播预设',
    detail: '观众对亮度调整给出正向反馈，建议下场开播前直接复用已确认的曝光方案。',
    impact: '减少画面流失',
  },
  'low-audio': {
    label: '音频质量',
    title: '沿用本场人声增益组合',
    detail: '麦克风调整后声音反馈明显改善，建议保存人声与 BGM 的增益差作为默认值。',
    impact: '提升听感稳定性',
  },
  'cold-interaction': {
    label: '互动经营',
    title: '在冷场前主动发布点歌投票',
    detail: '投票有效带动了评论恢复，下一场建议在互动下滑前 30 秒提前触发。',
    impact: '预计留存 +8%',
  },
  'network-lag': {
    label: '推流质量',
    title: '为高负载场景准备轻量配置',
    detail: '本场出现卡顿反馈，建议下一场降低高负载特效并优先保证稳定帧率。',
    impact: '降低卡顿反馈',
  },
  'pk-push': {
    label: 'PK 转化',
    title: '在冲刺阶段强化目标进度',
    detail: '阶段目标让助力路径更清晰，建议在 PK 倒计时前置展示剩余差值。',
    impact: '预计助力率 +10%',
  },
}

export function createPostLiveReport(
  input: CreatePostLiveReportInput,
): PostLiveReport {
  const durationMinutes = Math.max(input.durationSeconds / 60, 1)
  const giftCount = input.audience.gifts.reduce(
    (total, gift) => total + gift.count,
    0,
  )
  const totalViews = Math.max(
    input.audience.viewerCount,
    Math.round(
      input.audience.viewerCount +
      input.audience.entrantsLastMinute * durationMinutes,
    ),
  )
  const commentCount = Math.max(
    input.audience.comments.length,
    Math.round(input.audience.commentsPerMinute * durationMinutes),
  )
  const newFollowers = Math.max(
    1,
    Math.round(input.audience.entrantsLastMinute * durationMinutes * 0.22),
  )
  const performanceScore = Math.min(
    96,
    Math.max(
      60,
      Math.round(
        54 +
        input.audience.newViewerRetention * 0.42 +
        Math.min(12, input.appliedSuggestionCount * 4),
      ),
    ),
  )

  return {
    topic: input.topic,
    streamType: input.streamType,
    strategyId: input.strategyId,
    strategyLabel: input.strategyLabel,
    durationSeconds: Math.max(1, Math.round(input.durationSeconds)),
    totalViews,
    peakViewers: input.audience.viewerCount,
    newFollowers,
    commentCount,
    giftCount,
    diamondCount: giftCount * 12,
    retention: input.audience.newViewerRetention,
    appliedSuggestionCount: input.appliedSuggestionCount,
    performanceScore,
  }
}

export function getPostLiveRecommendations(
  report: PostLiveReport,
): PostLiveRecommendation[] {
  return [
    {
      id: 'strategy',
      ...strategyRecommendations[report.strategyId],
    },
    {
      id: 'retention',
      label: '观众承接',
      title: report.retention >= 45
        ? '复用本场新观众承接节奏'
        : '优化新观众进入后的前 10 秒',
      detail: report.retention >= 45
        ? `本场新观众留存达到 ${report.retention}%，建议保留开场介绍与内容预告。`
        : `本场新观众留存为 ${report.retention}%，建议开场更早说明主题并给出互动入口。`,
      impact: report.retention >= 45 ? '稳定留存表现' : '预计留存 +6%',
    },
    {
      id: 'ai-actions',
      label: 'Genie 协作',
      title: '把有效调整沉淀为下场任务',
      detail: report.appliedSuggestionCount > 0
        ? `本场已采纳 ${report.appliedSuggestionCount} 项建议，下一场可在播前自动复用并提前检查。`
        : '本场尚未采纳实时建议，下一场可让 Genie 在开播前完成画面、声音和互动检查。',
      impact: '缩短准备时间',
    },
  ]
}

export function buildPostLiveAiPrompt(
  report: PostLiveReport,
  question: string,
): string {
  return [
    '你是 LIVE Studio Genie 的播后经营顾问。',
    '请只使用中文，以专业、直接、可执行的方式回答，不使用 Markdown 表格。',
    '结合本场数据判断亮点、问题和下一场动作；不要虚构未提供的真实平台数据。',
    `直播主题：${report.topic}`,
    `直播类型：${report.streamType}`,
    `演示策略：${report.strategyLabel}`,
    `直播时长：${formatDuration(report.durationSeconds)}`,
    `总观看：${report.totalViews}`,
    `峰值在线：${report.peakViewers}`,
    `新增粉丝：${report.newFollowers}`,
    `评论数：${report.commentCount}`,
    `礼物数：${report.giftCount}`,
    `新观众留存：${report.retention}%`,
    `已采纳 Genie 建议：${report.appliedSuggestionCount} 项`,
    '回答控制在 180 个汉字以内，优先给出 3 个下一场可执行动作。',
    `主播问题：${question}`,
  ].join('\n')
}

export function createLocalPostLiveSummary(report: PostLiveReport): string {
  const strategyAdvice = strategyRecommendations[report.strategyId]
  return `本场直播表现指数 ${report.performanceScore}，新观众留存 ${report.retention}%。${strategyAdvice.detail} 下一场优先执行“${strategyAdvice.title}”，并在开播前让 Genie 完成一次设备与互动方案检查。`
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

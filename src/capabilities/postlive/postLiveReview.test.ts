import { describe, expect, it } from 'vitest'
import type { AudienceSnapshot } from '../audience/audienceEvents'
import {
  buildPostLiveAiPrompt,
  createPostLiveReport,
  formatDuration,
  getPostLiveRecommendations,
} from './postLiveReview'

const audience: AudienceSnapshot = {
  comments: Array.from({ length: 7 }, (_, index) => ({
    id: `comment-${index}`,
    type: 'comment',
    userName: `viewer-${index}`,
    text: '直播很好看',
    occurredAt: index,
  })),
  gifts: [{
    id: 'gift',
    type: 'gift',
    userName: 'viewer',
    giftName: 'Rose',
    count: 18,
    icon: 'rose',
    occurredAt: 1,
  }],
  viewerCount: 1286,
  entrantsLastMinute: 19,
  commentsPerMinute: 14,
  newViewerRetention: 22,
  insight: { category: 'positive', label: '正向反馈', count: 7 },
}

describe('post-live review', () => {
  it('creates a stable report from the final audience snapshot', () => {
    const report = createPostLiveReport({
      topic: '晚间唱歌聊天',
      streamType: 'music',
      strategyId: 'cold-interaction',
      strategyLabel: '互动转冷',
      durationSeconds: 120,
      audience,
      appliedSuggestionCount: 2,
    })

    expect(report.totalViews).toBe(1324)
    expect(report.commentCount).toBe(28)
    expect(report.newFollowers).toBe(8)
    expect(report.diamondCount).toBe(216)
    expect(report.performanceScore).toBe(71)
  })

  it('returns strategy-aware recommendations', () => {
    const report = createPostLiveReport({
      topic: 'PK 冲刺',
      streamType: 'chat',
      strategyId: 'pk-push',
      strategyLabel: 'PK 冲刺',
      durationSeconds: 60,
      audience,
      appliedSuggestionCount: 1,
    })

    const recommendations = getPostLiveRecommendations(report)

    expect(recommendations).toHaveLength(3)
    expect(recommendations[0].title).toContain('目标进度')
    expect(recommendations[2].detail).toContain('1 项建议')
  })

  it('builds an AI prompt containing the report and user reflection', () => {
    const report = createPostLiveReport({
      topic: '游戏直播',
      streamType: 'game',
      strategyId: 'network-lag',
      strategyLabel: '网络卡顿',
      durationSeconds: 90,
      audience,
      appliedSuggestionCount: 0,
    })
    const prompt = buildPostLiveAiPrompt(report, '下一场怎么减少卡顿？')

    expect(prompt).toContain('演示策略：网络卡顿')
    expect(prompt).toContain('下一场怎么减少卡顿？')
    expect(prompt).toContain('不要虚构未提供的真实平台数据')
  })

  it('formats duration as a stable clock value', () => {
    expect(formatDuration(3723)).toBe('01:02:03')
    expect(formatDuration(-1)).toBe('00:00:00')
  })
})

import { describe, expect, it } from 'vitest'
import {
  analyzeAudienceComment,
  analyzeCommentKeywords,
  audienceEventSchema,
  getAudienceCommentIntervalMs,
  mockAudienceEventAdapter,
  resolveAudienceStrategy,
} from './audienceEvents'
import {
  audienceSceneOptions,
  audienceStrategies,
  audienceCommentsByStrategy,
  audienceRecoveryCommentsByStrategy,
  doesSuggestionResolveStrategy,
  audienceUserNames,
} from '../../config/audienceComments'
import { studioRuntimeConfig } from '../../config/studioRuntime'

describe('audience events', () => {
  it('classifies the dominant keyword group in a comment window', () => {
    expect(analyzeCommentKeywords([
      { text: '声音有点小' },
      { text: '麦克风音量再大一点' },
      { text: '画面正常' },
    ])).toMatchObject({
      category: 'audio',
      label: '声音反馈',
      count: 2,
      shouldTrigger: true,
    })
  })

  it('marks urgent viewer feedback for immediate AI analysis', () => {
    const analysis = analyzeAudienceComment('一直听不清，麦克风声音太小')

    expect(analysis).toMatchObject({
      category: 'audio',
      sentiment: 'negative',
      actionable: true,
      triggerMode: 'immediate',
    })
    expect(analysis.confidence).toBeGreaterThan(0.7)
  })

  it('does not treat host messages as AI suggestion signals', () => {
    const analysis = analyzeAudienceComment('声音太小了', 'host')

    expect(analysis).toMatchObject({
      category: 'none',
      actionable: false,
      triggerMode: 'none',
    })
  })

  it('requires aggregation for ordinary feedback but not urgent feedback', () => {
    const ordinary = analyzeCommentKeywords([{ text: '可以点歌吗' }])
    const urgent = analyzeCommentKeywords([{ text: '一直听不清声音' }])

    expect(ordinary).toMatchObject({
      category: 'request',
      count: 1,
      shouldTrigger: false,
    })
    expect(urgent).toMatchObject({
      category: 'audio',
      count: 1,
      priority: 'high',
      shouldTrigger: true,
    })
  })

  it('returns a validated deterministic mock snapshot', () => {
    const first = mockAudienceEventAdapter.getSnapshot('interaction', false, 3)
    const second = mockAudienceEventAdapter.getSnapshot('interaction', false, 3)

    expect(first).toEqual(second)
    expect(first.comments).toHaveLength(
      studioRuntimeConfig.audience.visibleCommentCount,
    )
    expect(first.gifts).toHaveLength(2)
    expect(first.comments.every((event) => audienceEventSchema.safeParse(event).success))
      .toBe(true)
    expect(first.comments.every((event) =>
      event.source === 'viewer' &&
      typeof event.analysis.confidence === 'number',
    )).toBe(true)
    expect(first.gifts.every((event) => audienceEventSchema.safeParse(event).success))
      .toBe(true)
  })

  it('uses the shared timing configuration for generated events', () => {
    const tick = Math.ceil(
      studioRuntimeConfig.audience.previousGiftOffsetMs /
      studioRuntimeConfig.audience.refreshIntervalMs,
    ) + 2
    const startedAt = 1_700_000_000_000
    const snapshot = mockAudienceEventAdapter.getSnapshot(
      'quality',
      false,
      tick,
      startedAt,
    )
    const now = startedAt + tick * studioRuntimeConfig.audience.refreshIntervalMs
    const latestCommentIndex = snapshot.comments.length - 1

    expect(snapshot.comments[latestCommentIndex].occurredAt).toBe(now)
    expect(snapshot.comments[latestCommentIndex - 1].occurredAt).toBe(
      now - Math.round(60_000 / snapshot.commentsPerMinute),
    )
    expect(snapshot.gifts[1].occurredAt).toBe(
      now - studioRuntimeConfig.audience.previousGiftOffsetMs,
    )
  })

  it('derives visibly different comment intervals from scene density', () => {
    const coldInterval = getAudienceCommentIntervalMs(14, 0)
    const normalInterval = getAudienceCommentIntervalMs(42, 0)
    const activeInterval = getAudienceCommentIntervalMs(82, 0)

    expect(coldInterval).toBeGreaterThan(normalInterval)
    expect(normalInterval).toBeGreaterThan(activeInterval)
    expect(activeInterval).toBeGreaterThanOrEqual(
      studioRuntimeConfig.audience.minimumCommentIntervalMs,
    )
    expect(coldInterval).toBeLessThanOrEqual(
      studioRuntimeConfig.audience.maximumCommentIntervalMs,
    )
  })

  it('keeps audience metrics tied to elapsed time instead of comment count', () => {
    const startedAt = 1_700_000_000_000
    const latestCommentAt = startedAt + 58_000
    const snapshot = mockAudienceEventAdapter.getStrategySnapshot(
      'active-comments',
      false,
      5,
      'issue',
      startedAt,
      60,
      latestCommentAt,
    )

    expect(snapshot.viewerCount).toBe(
      studioRuntimeConfig.audience.initialViewerCount +
      60 * studioRuntimeConfig.audience.viewerGrowthPerTick,
    )
    expect(snapshot.comments.at(-1)?.occurredAt).toBe(latestCommentAt)
  })

  it('keeps existing comments and appends the newest comment at the bottom', () => {
    const before = mockAudienceEventAdapter.getStrategySnapshot(
      'dim-light',
      false,
      20,
    )
    const after = mockAudienceEventAdapter.getStrategySnapshot(
      'dim-light',
      false,
      21,
    )

    expect(after.comments.slice(0, -1).map(({ id }) => id)).toEqual(
      before.comments.slice(1).map(({ id }) => id),
    )
    expect(after.comments.at(-1)!.occurredAt).toBeGreaterThan(
      before.comments.at(-1)!.occurredAt,
    )
  })

  it('changes the viewer count over time', () => {
    const before = mockAudienceEventAdapter.getSnapshot('quality', false, 1)
    const after = mockAudienceEventAdapter.getSnapshot('quality', false, 2)

    expect(after.viewerCount).toBeGreaterThan(before.viewerCount)
  })

  it('keeps normal comments during warmup and then activates the selected strategy', () => {
    const warmupDuration = studioRuntimeConfig.audience.strategyWarmupDurationMs

    expect(resolveAudienceStrategy('dim-light', warmupDuration - 1)).toBe('normal')
    expect(resolveAudienceStrategy('dim-light', warmupDuration)).toBe('dim-light')
  })

  it('uses the configured comment pool for each explicit strategy', () => {
    const snapshot = mockAudienceEventAdapter.getStrategySnapshot(
      'color-cast',
      false,
      2,
    )

    expect(audienceCommentsByStrategy['color-cast']).toContain(
      snapshot.comments[0].text,
    )
    expect(audienceCommentsByStrategy.normal.length).toBeGreaterThan(10)
  })

  it('provides realistic issue and recovery chat samples for all scenarios', () => {
    audienceStrategies.forEach((scenario) => {
      const issueComments = audienceCommentsByStrategy[scenario.id]
      const recoveryComments =
        audienceRecoveryCommentsByStrategy[scenario.id] ?? []
      const snapshot = mockAudienceEventAdapter.getStrategySnapshot(
        scenario.id,
        false,
        20,
      )

      expect(issueComments.length).toBeGreaterThanOrEqual(10)
      expect(recoveryComments.length).toBeGreaterThanOrEqual(8)
      expect(snapshot.comments.every((comment) =>
        issueComments.includes(comment.text),
      )).toBe(true)
    })
  })

  it('exposes exactly the seven requested typical scenarios', () => {
    expect(audienceStrategies.map(({ label }) => label)).toEqual([
      '画面转暗',
      '画面偏色',
      '背景杂乱',
      '声音偏小',
      '评论区转冷',
      '送礼减少',
      '进房人数减少',
    ])
    expect(audienceStrategies.every((scenario) =>
      scenario.description.length >= 24 &&
      scenario.componentPriority.length > 0 &&
      scenario.intent.userUtterances.length >= 3 &&
      scenario.intent.standardResponse.length > 20,
    )).toBe(true)
  })

  it('keeps normal mode before the four requested live demo scenes', () => {
    expect(audienceSceneOptions.map(({ label }) => label)).toEqual([
      '正常场景',
      '画面转暗',
      '声音偏小',
      '评论区转冷',
      '评论区活跃',
    ])
  })

  it('simulates a high comment rate for the active comment scene', () => {
    const snapshot = mockAudienceEventAdapter.getStrategySnapshot(
      'active-comments',
      false,
      20,
    )

    expect(snapshot.commentsPerMinute).toBe(82)
    expect(snapshot.comments).toHaveLength(studioRuntimeConfig.audience.visibleCommentCount)
    expect(snapshot.comments.every((comment) =>
      audienceCommentsByStrategy['active-comments'].includes(comment.text),
    )).toBe(true)
  })

  it('varies normal gifts and engagement metrics over time', () => {
    const quietMoment = mockAudienceEventAdapter.getStrategySnapshot(
      'normal',
      false,
      1,
    )
    const activeMoment = mockAudienceEventAdapter.getStrategySnapshot(
      'normal',
      false,
      18,
    )

    expect(quietMoment.gifts).toHaveLength(1)
    expect(activeMoment.gifts).toHaveLength(3)
    expect(activeMoment.commentsPerMinute)
      .not.toBe(quietMoment.commentsPerMinute)
    expect(activeMoment.entrantsLastMinute)
      .not.toBe(quietMoment.entrantsLastMinute)
    expect(activeMoment.gifts.every((gift) =>
      audienceUserNames.some((userName) => userName === gift.userName),
    )).toBe(true)
  })

  it('cycles normal comments through distinct actionable themes', () => {
    const categories = [11, 23, 35, 47, 59, 71].map((tick) =>
      mockAudienceEventAdapter.getStrategySnapshot(
        'normal',
        false,
        tick,
      ).insight.category,
    )

    expect(categories).toEqual([
      'audio',
      'visual',
      'network',
      'request',
      'engagement',
      'positive',
    ])
  })

  it('simulates reduced gifts and entrants with scenario-specific data', () => {
    const giftDrop = mockAudienceEventAdapter.getStrategySnapshot(
      'gift-drop',
      false,
      20,
    )
    const entrantDrop = mockAudienceEventAdapter.getStrategySnapshot(
      'entrant-drop',
      false,
      20,
    )

    expect(giftDrop.gifts).toHaveLength(1)
    expect(giftDrop.gifts[0].count).toBe(1)
    expect(entrantDrop.entrantsLastMinute).toBe(8)
    expect(entrantDrop.viewerCount).toBeLessThan(
      studioRuntimeConfig.audience.initialViewerCount,
    )
  })

  it('switches to positive recovery comments after a strategy suggestion is accepted', () => {
    const snapshot = mockAudienceEventAdapter.getStrategySnapshot(
      'dim-light',
      true,
      20,
      'recovery',
    )

    expect(snapshot.comments.every((comment) =>
      audienceRecoveryCommentsByStrategy['dim-light']?.includes(comment.text),
    )).toBe(true)
    expect(snapshot.insight.category).toBe('positive')
    expect(snapshot.commentsPerMinute).toBe(42)
  })

  it('matches AI suggestion signals to their owning strategy', () => {
    expect(doesSuggestionResolveStrategy('dim-light', 'exposure')).toBe(true)
    expect(doesSuggestionResolveStrategy('low-audio', 'microphone')).toBe(true)
    expect(doesSuggestionResolveStrategy('color-cast', 'retention')).toBe(false)
  })
})

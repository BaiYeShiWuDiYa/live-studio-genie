import { describe, expect, it } from 'vitest'
import {
  analyzeCommentKeywords,
  audienceEventSchema,
  mockAudienceEventAdapter,
  resolveAudienceStrategy,
} from './audienceEvents'
import { audienceCommentsByStrategy } from '../../config/audienceComments'
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
    expect(first.gifts.every((event) => audienceEventSchema.safeParse(event).success))
      .toBe(true)
  })

  it('uses the shared timing configuration for generated events', () => {
    const tick = Math.ceil(
      studioRuntimeConfig.audience.previousGiftOffsetMs /
      studioRuntimeConfig.audience.refreshIntervalMs,
    ) + 2
    const snapshot = mockAudienceEventAdapter.getSnapshot('quality', false, tick)
    const now = tick * studioRuntimeConfig.audience.refreshIntervalMs

    expect(snapshot.comments[0].occurredAt).toBe(now)
    expect(snapshot.comments[1].occurredAt).toBe(
      now - studioRuntimeConfig.audience.commentHistorySpacingMs,
    )
    expect(snapshot.gifts[1].occurredAt).toBe(
      now - studioRuntimeConfig.audience.previousGiftOffsetMs,
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
      'network-lag',
      false,
      2,
    )

    expect(audienceCommentsByStrategy['network-lag']).toContain(
      snapshot.comments[0].text,
    )
    expect(audienceCommentsByStrategy.normal.length).toBeGreaterThan(10)
  })
})

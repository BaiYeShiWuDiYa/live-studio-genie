import { describe, expect, it } from 'vitest'
import {
  analyzeCommentKeywords,
  audienceEventSchema,
  mockAudienceEventAdapter,
} from './audienceEvents'

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
    expect(first.comments).toHaveLength(7)
    expect(first.gifts).toHaveLength(2)
    expect(first.comments.every((event) => audienceEventSchema.safeParse(event).success))
      .toBe(true)
    expect(first.gifts.every((event) => audienceEventSchema.safeParse(event).success))
      .toBe(true)
  })

  it('changes live counters over time', () => {
    const before = mockAudienceEventAdapter.getSnapshot('quality', false, 1)
    const after = mockAudienceEventAdapter.getSnapshot('quality', false, 2)

    expect(after.viewerCount).toBeGreaterThan(before.viewerCount)
    expect(after.entrantsLastMinute).not.toBe(before.entrantsLastMinute)
  })
})

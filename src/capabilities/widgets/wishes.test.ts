import { describe, expect, it } from 'vitest'
import {
  audienceWishesConfigSchema,
  hiddenAudienceWishesState,
} from './wishes'

describe('audience wishes', () => {
  it('validates editable wish content', () => {
    expect(audienceWishesConfigSchema.parse({
      title: '观众心愿',
      items: ['唱一首轻快的歌', '分享今天的妆容'],
    }).items).toHaveLength(2)
  })

  it('rejects empty and oversized wish lists', () => {
    expect(() => audienceWishesConfigSchema.parse({
      title: '观众心愿',
      items: [],
    })).toThrow()
    expect(() => audienceWishesConfigSchema.parse({
      title: '观众心愿',
      items: ['1', '2', '3', '4', '5', '6'],
    })).toThrow()
  })

  it('starts hidden', () => {
    expect(hiddenAudienceWishesState).toEqual({
      config: null,
      status: 'hidden',
    })
  })
})

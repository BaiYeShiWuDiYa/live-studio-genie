import { describe, expect, it } from 'vitest'
import { classifyCustomWidgetIntent } from './customWidgetIntent'

describe('classifyCustomWidgetIntent', () => {
  it('prioritizes leaderboard requests', () => {
    expect(classifyCustomWidgetIntent('生成一个点赞排行榜贴纸')).toEqual({
      intent: 'leaderboard',
      leaderboardType: 'likes',
    })
    expect(classifyCustomWidgetIntent('add a top gifters image')).toEqual({
      intent: 'leaderboard',
      leaderboardType: 'gifts',
    })
  })

  it('recognizes sticker, image, and text requests', () => {
    expect(classifyCustomWidgetIntent('I want a rocket sticker')).toEqual({
      intent: 'sticker',
      sticker: 'rocket',
    })
    expect(classifyCustomWidgetIntent('添加一张直播海报图片')).toEqual({
      intent: 'image',
    })
    expect(classifyCustomWidgetIntent('显示欢迎文字源')).toEqual({
      intent: 'text',
    })
  })

  it('uses text as the predictable fallback', () => {
    expect(classifyCustomWidgetIntent('今晚一起聊天')).toEqual({
      intent: 'text',
    })
  })
})

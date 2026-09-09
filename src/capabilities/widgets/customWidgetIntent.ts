export type CustomWidgetIntent = 'text' | 'sticker' | 'leaderboard' | 'image'
export type LeaderboardIntent = 'likes' | 'gifts'
export type VectorStickerId = 'rocket' | 'heart' | 'gift' | 'sparkle'

export interface CustomWidgetClassification {
  intent: CustomWidgetIntent
  leaderboardType?: LeaderboardIntent
  sticker?: VectorStickerId
}

const leaderboardLikesPattern = /点赞(?:榜|榜单|排行(?:榜)?|排名)?|赞榜|like(?:\s*(?:榜|排行|ranking))?|top\s*likes?/i
const leaderboardGiftsPattern = /送礼(?:榜|榜单|排行(?:榜)?|排名)?|礼物(?:榜|榜单|排行(?:榜)?|排名)?|gift(?:\s*(?:榜|排行|ranking))?|top\s*gifters?/i
const stickerPattern = /贴纸|表情|emoji|sticker|火箭|rocket|爱心|heart|礼物动画|gift\s*animation/i
const imagePattern = /图片|图像|照片|相片|image|photo|picture|poster|海报/i
const textPattern = /文字源|文字|文案|标题|标语|text|caption|slogan/i

function getSticker(prompt: string): VectorStickerId {
  if (/火箭|rocket/i.test(prompt)) return 'rocket'
  if (/爱心|heart/i.test(prompt)) return 'heart'
  if (/礼物|gift/i.test(prompt)) return 'gift'
  return 'sparkle'
}

export function classifyCustomWidgetIntent(prompt: string): CustomWidgetClassification {
  const normalized = prompt.trim()

  if (leaderboardLikesPattern.test(normalized)) {
    return { intent: 'leaderboard', leaderboardType: 'likes' }
  }
  if (leaderboardGiftsPattern.test(normalized)) {
    return { intent: 'leaderboard', leaderboardType: 'gifts' }
  }
  if (stickerPattern.test(normalized)) {
    return { intent: 'sticker', sticker: getSticker(normalized) }
  }
  if (imagePattern.test(normalized)) {
    return { intent: 'image' }
  }
  if (textPattern.test(normalized)) {
    return { intent: 'text' }
  }

  // Unqualified requests are treated as copy, avoiding an unexpected visual asset.
  return { intent: 'text' }
}

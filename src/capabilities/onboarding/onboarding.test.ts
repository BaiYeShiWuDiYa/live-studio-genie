import { describe, expect, it } from 'vitest'
import {
  LAST_LIVE_STORAGE_KEY,
  STREAM_THEMES,
  formatLastLiveTime,
  loadLastLiveConfig,
  recognizeStreamTheme,
  saveLastLiveConfig,
  type LastLiveConfig,
} from './onboarding'

describe('stream theme recognition', () => {
  it('maps chat companionship descriptions to chat', () => {
    expect(recognizeStreamTheme('今天想和大家聊天，分享最近的生活')).toBe('chat')
    expect(recognizeStreamTheme('晚上陪大家唠唠嗑，说说最近的心情')).toBe('chat')
    expect(recognizeStreamTheme('开播谈心，做你的树洞')).toBe('chat')
  })

  it('maps music descriptions to music', () => {
    expect(recognizeStreamTheme('今天唱歌给大家听')).toBe('music')
    expect(recognizeStreamTheme('今晚弹吉他，欢迎点歌')).toBe('music')
    expect(recognizeStreamTheme('来听我翻唱几首新歌')).toBe('music')
  })

  it('maps game descriptions to game', () => {
    expect(recognizeStreamTheme('今天玩游戏，和观众一起互动')).toBe('game')
    expect(recognizeStreamTheme('晚上开黑排位，冲一波段位')).toBe('game')
    expect(recognizeStreamTheme('直播通关新出的单机大作')).toBe('game')
  })

  it('falls back to chat when nothing matches', () => {
    expect(recognizeStreamTheme('随便播点什么吧')).toBe('chat')
    expect(recognizeStreamTheme('   ')).toBe('chat')
    expect(recognizeStreamTheme('')).toBe('chat')
  })

  it('only exposes the three preset themes', () => {
    expect(STREAM_THEMES.map((theme) => theme.id)).toEqual(['chat', 'music', 'game'])
  })
})

describe('last live config persistence', () => {
  function createMemoryStorage(): Storage {
    const store = new Map<string, string>()
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      length: store.size,
    }
  }

  const sampleConfig: LastLiveConfig = {
    theme: 'chat',
    themeName: '聊天陪伴',
    lastLiveTime: '2026-09-06T12:00:00.000Z',
    savedConfig: {
      topic: '轻松聊天陪伴',
      isChatCompanion: true,
      layout: 'portrait',
      chatTextEnabled: true,
      chatTextValue: 'Good things will happen today ❤️',
      chatGoalEnabled: false,
      completedTaskIds: ['layout', 'visual', 'content', 'interaction'],
    },
  }

  it('round-trips a saved config through storage', () => {
    const storage = createMemoryStorage()
    saveLastLiveConfig(sampleConfig, storage)
    expect(loadLastLiveConfig(storage)).toEqual(sampleConfig)
  })

  it('returns null when no history exists', () => {
    expect(loadLastLiveConfig(createMemoryStorage())).toBeNull()
  })

  it('returns null for corrupted payloads', () => {
    const storage = createMemoryStorage()
    storage.setItem(LAST_LIVE_STORAGE_KEY, '{broken json')
    expect(loadLastLiveConfig(storage)).toBeNull()
  })

  it('repairs legacy payloads with missing fields', () => {
    const storage = createMemoryStorage()
    storage.setItem(LAST_LIVE_STORAGE_KEY, JSON.stringify({
      theme: 'music',
      savedConfig: { topic: '晚间音乐现场' },
    }))
    const loaded = loadLastLiveConfig(storage)
    expect(loaded?.theme).toBe('music')
    expect(loaded?.themeName).toBe('音乐现场')
    expect(loaded?.savedConfig.layout).toBe('portrait')
    expect(loaded?.savedConfig.completedTaskIds).toEqual([])
  })

  it('rejects unknown themes', () => {
    const storage = createMemoryStorage()
    storage.setItem(LAST_LIVE_STORAGE_KEY, JSON.stringify({
      theme: 'other',
      savedConfig: { topic: 'x' },
    }))
    expect(loadLastLiveConfig(storage)).toBeNull()
  })

  it('formats the last live time for display', () => {
    expect(formatLastLiveTime('2026-09-06T12:30:00.000Z')).toMatch(/9月6日|9月7日/)
    expect(formatLastLiveTime('not-a-date')).toBe('')
  })
})

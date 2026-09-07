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

  it('maps variety stage descriptions to show', () => {
    expect(recognizeStreamTheme('今晚秀场才艺表演，欢迎来看')).toBe('show')
    expect(recognizeStreamTheme('开场跳一支舞，舞台效果拉满')).toBe('show')
    expect(recognizeStreamTheme('今晚唱跳综艺秀')).toBe('show')
  })

  it('falls back to chat when nothing matches', () => {
    expect(recognizeStreamTheme('随便播点什么吧')).toBe('chat')
    expect(recognizeStreamTheme('   ')).toBe('chat')
    expect(recognizeStreamTheme('')).toBe('chat')
  })

  it('exposes the four preset themes', () => {
    expect(STREAM_THEMES.map((theme) => theme.id)).toEqual(['chat', 'music', 'game', 'show'])
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

  it('persists canvas widget config including goal target, text style and offsets', () => {
    const storage = createMemoryStorage()
    const config: LastLiveConfig = {
      theme: 'show',
      themeName: '秀场',
      lastLiveTime: '2026-09-07T12:00:00.000Z',
      savedConfig: {
        topic: '今晚才艺秀场',
        isChatCompanion: false,
        layout: 'stage',
        chatTextEnabled: true,
        chatTextValue: '今晚演出加油',
        chatGoalEnabled: true,
        chatGoalKind: 'like',
        chatGoalTitle: '今日互动目标',
        chatGoalTarget: 88000,
        chatTextStyle: { size: 18, color: '#ffd166', bold: true, align: 'center', decoration: 'pill' },
        chatTextOffset: { x: 12, y: -8 },
        chatGoalOffset: { x: -4, y: 20 },
        completedTaskIds: ['layout'],
      },
    }
    saveLastLiveConfig(config, storage)
    expect(loadLastLiveConfig(storage)).toEqual(config)
  })

  it('persists game layout and floating camera position', () => {
    const storage = createMemoryStorage()
    const config: LastLiveConfig = {
      theme: 'game',
      themeName: '游戏直播',
      lastLiveTime: '2026-09-08T12:00:00.000Z',
      savedConfig: {
        topic: '今晚游戏挑战',
        isChatCompanion: false,
        layout: 'game-landscape',
        chatTextEnabled: false,
        chatTextValue: '',
        chatGoalEnabled: true,
        chatGoalTitle: '本场互动目标',
        chatGoalTarget: 60000,
        chatGoalOffset: { x: 18, y: -10 },
        gameCameraOffset: { x: 24, y: -16 },
        completedTaskIds: ['layout'],
      },
    }
    saveLastLiveConfig(config, storage)
    expect(loadLastLiveConfig(storage)).toEqual(config)
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

import { describe, expect, it } from 'vitest'
import {
  clearGenieChatSession,
  GENIE_CHAT_SESSION_STORAGE_KEY,
  loadGenieChatSession,
  saveGenieChatSession,
  type GenieChatSession,
} from './genieChatSession'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
  }
}

const session: GenieChatSession = {
  messages: [
    { role: 'user', text: '创建一个投票' },
    {
      role: 'assistant',
      text: '已生成投票组件。',
      atomicComponentIds: ['audience-wishes'],
      widgets: [{
        version: '1.0',
        type: 'audience-poll',
        title: '观众投票',
        detail: '选择今晚的开场曲',
        actionLabel: '发起投票',
        props: {
          question: '今晚先唱哪首歌？',
          options: ['晴天', '后来'],
          durationSeconds: 60,
        },
      }],
    },
  ],
  atomicComponentIds: ['audience-wishes'],
  widgets: [{
    version: '1.0',
    type: 'audience-poll',
    title: '观众投票',
    detail: '选择今晚的开场曲',
    actionLabel: '发起投票',
    props: {
      question: '今晚先唱哪首歌？',
      options: ['晴天', '后来'],
      durationSeconds: 60,
    },
  }],
}

describe('Genie chat session persistence', () => {
  it('restores messages and recalled components', () => {
    const storage = createMemoryStorage()
    saveGenieChatSession(session, storage)
    expect(loadGenieChatSession(storage)).toEqual(session)
  })

  it('ignores malformed or unsupported stored data', () => {
    const storage = createMemoryStorage()
    storage.setItem(GENIE_CHAT_SESSION_STORAGE_KEY, '{"version":3}')
    expect(loadGenieChatSession(storage)).toEqual({
      messages: [],
      atomicComponentIds: [],
      widgets: [],
    })
  })

  it('removes the persisted session when history is cleared', () => {
    const storage = createMemoryStorage()
    saveGenieChatSession(session, storage)
    clearGenieChatSession(storage)
    expect(storage.getItem(GENIE_CHAT_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('sanitizes technical protocol text from restored assistant messages', () => {
    const storage = createMemoryStorage()
    saveGenieChatSession({
      ...session,
      messages: [{
        role: 'assistant',
        text: '建议先提升画面。<widget>{"type":"live-goal"}</widget>',
      }],
    }, storage)

    expect(loadGenieChatSession(storage).messages[0].text)
      .toBe('建议先提升画面。')
  })

  it('keeps components attached to their originating assistant message', () => {
    const storage = createMemoryStorage()
    const messages: GenieChatSession['messages'] = [
      { role: 'user', text: '创建一个投票' },
      {
        role: 'assistant',
        text: '已生成投票。',
        widgets: [session.widgets[0]],
      },
      { role: 'user', text: '再创建一个心愿组件' },
      {
        role: 'assistant',
        text: '已生成观众心愿。',
        atomicComponentIds: ['audience-wishes'],
      },
    ]

    saveGenieChatSession({
      messages,
      atomicComponentIds: ['audience-wishes'],
      widgets: session.widgets,
    }, storage)

    expect(loadGenieChatSession(storage).messages).toEqual(messages)
  })

  it('attaches legacy unbound components to the latest assistant message', () => {
    const storage = createMemoryStorage()
    storage.setItem(GENIE_CHAT_SESSION_STORAGE_KEY, JSON.stringify({
      version: 1,
      messages: [
        { role: 'user', text: '第一轮' },
        { role: 'assistant', text: '第一轮回复' },
        { role: 'user', text: '第二轮' },
        { role: 'assistant', text: '第二轮回复' },
      ],
      atomicComponentIds: ['audience-wishes'],
      widgets: session.widgets,
    }))

    const restored = loadGenieChatSession(storage)
    expect(restored.messages[1].widgets).toBeUndefined()
    expect(restored.messages[3]).toMatchObject({
      atomicComponentIds: ['audience-wishes'],
      widgets: session.widgets,
    })
  })
})

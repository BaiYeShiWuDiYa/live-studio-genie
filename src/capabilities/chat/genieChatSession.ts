import { z } from 'zod'
import {
  widgetSpecSchema,
  type WidgetSpec,
} from '../../agent/widgets/widgetSpec'
import type { AtomicComponentId } from '../../components/atomic/types'
import { sanitizeUserFacingText } from './userFacingText'

export const GENIE_CHAT_SESSION_STORAGE_KEY =
  'live-studio-genie:chat-session'

const atomicComponentIdSchema = z.enum([
  'lighting',
  'color-adjustment',
  'microphone',
  'beauty',
  'makeup',
  'background',
  'effects',
  'audience-poll',
  'live-goal',
  'audience-wishes',
  'like-ranking',
  'gift-ranking',
  'studio-template',
])

const legacyChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

const chatMessageSchema = legacyChatMessageSchema.extend({
  atomicComponentIds: z.array(atomicComponentIdSchema).max(20).optional(),
  widgets: z.array(widgetSpecSchema).max(20).optional(),
})

const legacyGenieChatSessionSchema = z.object({
  version: z.literal(1),
  messages: z.array(legacyChatMessageSchema).max(80),
  atomicComponentIds: z.array(atomicComponentIdSchema).max(20),
  widgets: z.array(widgetSpecSchema).max(20),
})

const genieChatSessionSchema = z.object({
  version: z.literal(2),
  messages: z.array(chatMessageSchema).max(80),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

export type GenieChatSession = {
  messages: ChatMessage[]
  atomicComponentIds: AtomicComponentId[]
  widgets: WidgetSpec[]
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const emptySession: GenieChatSession = {
  messages: [],
  atomicComponentIds: [],
  widgets: [],
}

function getDefaultStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadGenieChatSession(
  storage: StorageLike | null = getDefaultStorage(),
): GenieChatSession {
  if (!storage) return emptySession

  try {
    const serialized = storage.getItem(GENIE_CHAT_SESSION_STORAGE_KEY)
    if (!serialized) return emptySession
    const data = JSON.parse(serialized)
    const result = genieChatSessionSchema.safeParse(data)
    if (!result.success) {
      const legacyResult = legacyGenieChatSessionSchema.safeParse(data)
      if (!legacyResult.success) return emptySession
      return migrateLegacySession(legacyResult.data)
    }
    const messages = sanitizeMessages(result.data.messages)
    return {
      messages,
      atomicComponentIds: Array.from(new Set(
        messages.flatMap((message) => message.atomicComponentIds ?? []),
      )),
      widgets: messages.flatMap((message) => message.widgets ?? []),
    }
  } catch {
    return emptySession
  }
}

export function saveGenieChatSession(
  session: GenieChatSession,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return

  try {
    storage.setItem(
      GENIE_CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        messages: session.messages.slice(-80),
      }),
    )
  } catch {
    // Storage can be unavailable or full; the in-memory chat remains usable.
  }
}

export function clearGenieChatSession(
  storage: StorageLike | null = getDefaultStorage(),
): void {
  try {
    storage?.removeItem(GENIE_CHAT_SESSION_STORAGE_KEY)
  } catch {
    // Clearing in-memory state remains sufficient when storage is unavailable.
  }
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    text: message.role === 'assistant'
      ? sanitizeUserFacingText(message.text)
      : message.text,
  }))
}

function migrateLegacySession(
  legacySession: z.infer<typeof legacyGenieChatSessionSchema>,
): GenieChatSession {
  const messages: ChatMessage[] = sanitizeMessages(legacySession.messages)
  const assistantIndex = messages.findLastIndex(
    (message) => message.role === 'assistant',
  )
  if (assistantIndex >= 0) {
    messages[assistantIndex] = {
      ...messages[assistantIndex],
      atomicComponentIds: legacySession.atomicComponentIds,
      widgets: legacySession.widgets,
    }
  }
  return {
    messages,
    atomicComponentIds: legacySession.atomicComponentIds,
    widgets: legacySession.widgets,
  }
}

import { z } from 'zod'
import {
  widgetSpecSchema,
  type WidgetSpec,
} from '../../agent/widgets/widgetSpec'
import type { AtomicComponentId } from '../../components/atomic/types'
import { sanitizeUserFacingText } from './userFacingText'

export const GENIE_CHAT_SESSION_STORAGE_KEY =
  'live-studio-genie:chat-session'

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

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

const genieChatSessionSchema = z.object({
  version: z.literal(1),
  messages: z.array(chatMessageSchema).max(80),
  atomicComponentIds: z.array(atomicComponentIdSchema).max(20),
  widgets: z.array(widgetSpecSchema).max(20),
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
    const result = genieChatSessionSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return emptySession
    return {
      messages: result.data.messages.map((message) => ({
        ...message,
        text: message.role === 'assistant'
          ? sanitizeUserFacingText(message.text)
          : message.text,
      })),
      atomicComponentIds: result.data.atomicComponentIds,
      widgets: result.data.widgets,
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
        version: 1,
        messages: session.messages.slice(-80),
        atomicComponentIds: session.atomicComponentIds.slice(-20),
        widgets: session.widgets.slice(-20),
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

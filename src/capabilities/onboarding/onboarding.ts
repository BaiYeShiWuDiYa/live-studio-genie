export type StreamThemeId = 'chat' | 'music' | 'game' | 'show'

export type StreamLayout = 'portrait' | 'three-quarter' | 'stage'

export type StreamGoalKind = 'like' | 'follower' | 'gift'

export type StreamTheme = {
  id: StreamThemeId
  name: string
  defaultTopic: string
}

export const STREAM_THEMES: StreamTheme[] = [
  { id: 'chat', name: '聊天陪伴', defaultTopic: '轻松聊天陪伴' },
  { id: 'music', name: '音乐现场', defaultTopic: '晚间音乐现场' },
  { id: 'game', name: '游戏直播', defaultTopic: '今晚游戏挑战' },
  { id: 'show', name: '秀场', defaultTopic: '今晚才艺秀场' },
]

export function getStreamTheme(id: StreamThemeId): StreamTheme {
  return STREAM_THEMES.find((theme) => theme.id === id) ?? STREAM_THEMES[0]
}

const THEME_KEYWORD_PATTERNS: Record<StreamThemeId, RegExp[]> = {
  chat: [
    /聊天|聊一聊|聊聊|唠嗑|谈心|情感|连麦|陪伴|陪你?|陪大家|分享|日常|心情|故事|哄睡|树洞|吐槽|八卦|说说话|倾诉|聊聊近况/,
  ],
  music: [
    /唱歌|唱一|唱给|唱首|欢唱|演唱|弹唱|音乐|吉他|钢琴|演奏|乐器|点歌|翻唱|说唱|乐队|旋律|歌曲|听歌|歌单|歌词|卡拉OK|K歌/i,
  ],
  game: [
    /游戏|开黑|排位|通关|电竞|带飞|副本|打怪|闯关|升级|组队|联机|主机|Steam|吃鸡|王者|对战|玩游戏|直播游戏/i,
  ],
  show: [
    /秀场|才艺|舞台|跳舞|舞蹈|唱跳|走秀|演出|表演|综艺|才艺展示/,
  ],
}

export function recognizeStreamTheme(input: string): StreamThemeId {
  const text = input.trim()
  if (!text) return 'chat'

  const scores = (Object.keys(THEME_KEYWORD_PATTERNS) as StreamThemeId[]).map((id) => {
    const score = THEME_KEYWORD_PATTERNS[id].reduce(
      (total, pattern) => total + (pattern.test(text) ? 1 : 0),
      0,
    )
    return { id, score }
  })

  const best = scores.reduce((top, current) => (current.score > top.score ? current : top))
  return best.score > 0 ? best.id : 'chat'
}

export type SavedWidgetOffset = { x: number; y: number }

export type SavedTextStyle = {
  size: number
  color: string
  bold: boolean
  align: 'left' | 'center' | 'right'
  decoration: 'none' | 'stroke' | 'pill'
}

export type SavedLiveConfig = {
  topic: string
  isChatCompanion: boolean
  layout: StreamLayout
  chatTextEnabled: boolean
  chatTextValue: string
  chatGoalEnabled: boolean
  chatGoalKind?: StreamGoalKind
  chatGoalTitle?: string
  chatGoalTarget?: number
  chatTextStyle?: SavedTextStyle
  chatTextOffset?: SavedWidgetOffset
  chatGoalOffset?: SavedWidgetOffset
  musicBackgroundId?: string
  completedTaskIds: string[]
}

export type LastLiveConfig = {
  theme: StreamThemeId
  themeName: string
  lastLiveTime: string
  savedConfig: SavedLiveConfig
}

export const LAST_LIVE_STORAGE_KEY = 'live-studio-genie:last-live'

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function getDefaultStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isStreamThemeId(value: unknown): value is StreamThemeId {
  return value === 'chat' || value === 'music' || value === 'game' || value === 'show'
}

function normalizeOffset(value: unknown): SavedWidgetOffset | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.x !== 'number' || typeof record.y !== 'number') return undefined
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) return undefined
  return { x: record.x, y: record.y }
}

function normalizeTextStyle(value: unknown): SavedTextStyle | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (
    typeof record.size !== 'number'
    || typeof record.color !== 'string'
    || typeof record.bold !== 'boolean'
  ) {
    return undefined
  }
  const align = record.align === 'center' || record.align === 'right' ? record.align : 'left'
  const decoration = record.decoration === 'stroke' || record.decoration === 'pill'
    ? record.decoration
    : 'none'
  return {
    size: Math.min(28, Math.max(12, record.size)),
    color: record.color,
    bold: record.bold,
    align,
    decoration,
  }
}

function normalizeConfig(raw: unknown): LastLiveConfig | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const saved = record.savedConfig
  if (!isStreamThemeId(record.theme) || typeof saved !== 'object' || saved === null) return null
  const savedRecord = saved as Record<string, unknown>
  if (typeof savedRecord.topic !== 'string') return null

  return {
    theme: record.theme,
    themeName: typeof record.themeName === 'string' ? record.themeName : getStreamTheme(record.theme).name,
    lastLiveTime: typeof record.lastLiveTime === 'string' ? record.lastLiveTime : '',
    savedConfig: {
      topic: savedRecord.topic,
      isChatCompanion: savedRecord.isChatCompanion === true,
      layout: savedRecord.layout === 'stage'
        ? 'stage'
        : savedRecord.layout === 'three-quarter'
          ? 'three-quarter'
          : 'portrait',
      chatTextEnabled: savedRecord.chatTextEnabled === true,
      chatTextValue: typeof savedRecord.chatTextValue === 'string' ? savedRecord.chatTextValue : '',
      chatGoalEnabled: savedRecord.chatGoalEnabled === true,
      chatGoalKind: savedRecord.chatGoalKind === 'like'
        || savedRecord.chatGoalKind === 'follower'
        || savedRecord.chatGoalKind === 'gift'
        ? savedRecord.chatGoalKind
        : undefined,
      chatGoalTitle: typeof savedRecord.chatGoalTitle === 'string'
        ? savedRecord.chatGoalTitle
        : undefined,
      musicBackgroundId: typeof savedRecord.musicBackgroundId === 'string'
        ? savedRecord.musicBackgroundId
        : undefined,
      chatGoalTarget: typeof savedRecord.chatGoalTarget === 'number'
        && Number.isFinite(savedRecord.chatGoalTarget)
        && savedRecord.chatGoalTarget > 0
        ? Math.round(savedRecord.chatGoalTarget)
        : undefined,
      chatTextStyle: normalizeTextStyle(savedRecord.chatTextStyle),
      chatTextOffset: normalizeOffset(savedRecord.chatTextOffset),
      chatGoalOffset: normalizeOffset(savedRecord.chatGoalOffset),
      completedTaskIds: Array.isArray(savedRecord.completedTaskIds)
        ? savedRecord.completedTaskIds.filter((id): id is string => typeof id === 'string')
        : [],
    },
  }
}

export function loadLastLiveConfig(
  storage: StorageLike | null = getDefaultStorage(),
): LastLiveConfig | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LAST_LIVE_STORAGE_KEY)
    if (!raw) return null
    return normalizeConfig(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveLastLiveConfig(
  config: LastLiveConfig,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(LAST_LIVE_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Storage may be unavailable (private mode); the demo keeps working in-memory.
  }
}

export function formatLastLiveTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

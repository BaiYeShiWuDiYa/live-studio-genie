import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ButtonV4 as Button } from '@byted/creator-ui'
import {
  Activity,
  ArrowLeft,
  AudioLines,
  Bell,
  Bold,
  Camera,
  Check,
  ChevronDown,
  CircleStop,
  Eye,
  EyeOff,
  Gamepad2,
  Gift,
  History,
  LayoutTemplate,
  Link2,
  Lightbulb,
  LoaderCircle,
  Mic,
  Minus,
  MessageCircle,
  MonitorUp,
  Music2,
  Palette,
  PanelsTopLeft,
  Play,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Spotlight,
  Target,
  Trash2,
  Type,
  Upload,
  UserMinus,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import './App.css'
import './features.css'
import { studioToolRegistry, type StudioToolContext } from './agent/tools/studioTools'
import {
  getAlternativeWidgetSpec,
  getCameraEffectsWidgetSpec,
  getSceneWidgetSpec,
} from './agent/widgets/sceneWidgets'
import type { StudioScene, WidgetSpec } from './agent/widgets/widgetSpec'
import { createAudioProcessor, type AudioProcessor } from './capabilities/audio/audioProcessor'
import {
  createBackgroundMusicPlayer,
  type BackgroundMusicPlayer,
} from './capabilities/audio/backgroundMusic'
import type { AudioSettings } from './capabilities/audio/types'
import {
  analyzeAudienceComment,
  analyzeCommentKeywords,
  getAudienceCommentIntervalMs,
  mockAudienceEventAdapter,
  resolveAudienceStrategy,
  type AudienceComment,
  type AudienceCommentPhase,
  type AudienceSnapshot,
} from './capabilities/audience/audienceEvents'
import { requestCameraStream, requestDisplayStream, stopMediaStream } from './capabilities/media/browserMedia'
import { useMediaMonitoring } from './capabilities/monitoring/useMediaMonitoring'
import {
  buildLiveDiagnostics,
  type LiveDiagnostics,
  type LiveSuggestion,
} from './capabilities/monitoring/liveDiagnostics'
import {
  advanceFixedRateDeadline,
  createAiAnalyzedSuggestion,
  createNormalAiAnalysisPrompt,
  createNormalModeDetectionSnapshot,
  createCommentInsightSuggestion,
  detectNormalModeUpdates,
  rightRailUpdateConfig,
  selectSuggestionsForStrategy,
  selectThresholdChangedSuggestions,
  type NormalModeDetectionSnapshot,
} from './capabilities/monitoring/rightRailUpdates'
import {
  buildPostLiveAiPrompt,
  createLocalPostLiveSummary,
  createPostLiveReport,
  formatDuration,
  type PostLiveReport,
} from './capabilities/postlive/postLiveReview'
import {
  createLiveSessionMetricsAccumulator,
  recordLiveSessionMetrics,
  summarizeLiveSessionMetrics,
} from './capabilities/postlive/liveSessionMetrics'
import {
  appendNewSuggestions,
  appendTriggeredSuggestion,
  getWidgetUiType,
  keepLatestUniqueBy,
  removeSuggestionWidget,
  type QueuedSuggestion,
} from './capabilities/monitoring/suggestionQueue'
import type { VisualSettings } from './capabilities/visual/types'
import {
  clearGenieChatSession,
  loadGenieChatSession,
  saveGenieChatSession,
  type ChatMessage,
} from './capabilities/chat/genieChatSession'
import {
  applyCameraEffectPreset,
  recommendCameraEffects,
  type CameraEffects,
} from './capabilities/video/cameraEffects'
import {
  STREAM_THEMES,
  formatLastLiveTime,
  getStreamTheme,
  loadLastLiveConfig,
  recognizeStreamTheme,
  saveLastLiveConfig,
  type LastLiveConfig,
  type StreamGoalKind,
  type StreamThemeId,
} from './capabilities/onboarding/onboarding'
import { CameraEffectsWidget, WidgetRenderer } from './components/genie/WidgetRenderer'
import { CameraEffectsCanvas } from './components/studio/CameraEffectsCanvas'
import { EditableCameraLayer } from './components/studio/EditableCameraLayer'
import { LiveGoal } from './components/studio/LiveGoal'
import { LiveCanvasWidget } from './components/studio/LiveCanvasWidget'
import { LivePoll } from './components/studio/LivePoll'
import { PostLiveReview } from './components/studio/PostLiveReview'
import { LiveWishes } from './components/studio/LiveWishes'
import { CanvasCustomWidget, CanvasGoalRing, CanvasTextSource } from './components/studio/PreliveCanvasWidgets'
import {
  defaultCanvasTextStyle,
  type CanvasTextStyle,
  type WidgetOffset,
} from './capabilities/widgets/canvasWidgets'
import { LiveChatPanel } from './components/studio/LiveChatPanel'
import { AtomicRecallCard } from './components/atomic/AtomicRecallCard'
import { recallAtomicComponents } from './components/atomic/intentRecall'
import { atomicComponentRegistry } from './components/atomic/registry'
import type { AtomicComponentId } from './components/atomic/types'
import {
  audienceSceneOptions,
  doesSuggestionResolveStrategy,
  getAudienceStrategy,
  type AudienceStrategyId,
} from './config/audienceComments'
import { studioRuntimeConfig } from './config/studioRuntime'
import { askGenie, GenieRequestError } from './services/genie'
import { useStudioStore } from './store/studioStore'

type AppView = 'onboarding' | 'prelive' | 'live' | 'postlive'
type Scene = StudioScene
type StreamKind = 'music' | 'chat' | 'game' | 'show'
type PreliveTask = 'layout' | 'widgets' | 'visual' | 'content'
type PreliveLayout = 'portrait' | 'three-quarter' | 'stage' | 'game-vertical' | 'game-landscape'
type GoalKind = StreamGoalKind

const stageBackgrounds = [
  { id: 'warm-stage', name: '暖光舞台', url: '/stage-backgrounds/warm-stage.svg' },
  { id: 'neon-live', name: '霓虹现场', url: '/stage-backgrounds/neon-live.svg' },
  { id: 'retro-vinyl', name: '复古唱片', url: '/stage-backgrounds/retro-vinyl.svg' },
  { id: 'dream-stars', name: '梦幻星光', url: '/stage-backgrounds/dream-stars.svg' },
] as const

const goalKindOptions: ReadonlyArray<{ id: GoalKind; label: string; defaultTitle: string; target: number }> = [
  { id: 'like', label: '点赞', defaultTitle: 'like goal', target: 50000 },
  { id: 'follower', label: '粉丝', defaultTitle: 'follower goal', target: 60000 },
  { id: 'gift', label: '礼物', defaultTitle: 'gift goal', target: 2000 },
]

type PreviewMode = 'mobile' | 'studio'
type LiveStageMode = 'preview' | 'clean'
type GenieRequestStatus = 'idle' | 'loading' | 'cancelled' | 'timeout' | 'error'
type StrategyCommentState = 'issue' | 'recovery' | 'normal'
type NormalAiActivity = 'idle' | 'queued' | 'analyzing' | 'updated' | 'no-action'

type LiveAdjustment = {
  name: string
  detail: string
}

const sceneCopy: Record<Scene, { title: string; detail: string; action: string }> = {
  quality: {
    title: '画面偏暗，氛围可以更有记忆点',
    detail: '检测到亮度低于建议区间，背景层次不足。',
    action: '应用柔光方案',
  },
  interaction: {
    title: '互动节奏正在放缓',
    detail: '评论密度连续 57 秒低于平均值，建议发起轻互动。',
    action: '发布互动挂件',
  },
  troubleshoot: {
    title: '“声音小”反馈正在增加',
    detail: '6 条评论提到音量问题，麦克风峰值低于建议区间。',
    action: '确认音频调整',
  },
  pk: {
    title: 'PK 进入关键拉票阶段',
    detail: '距离对手 1,260 分，建议用目标挂件聚焦观众行动。',
    action: '发起冲刺目标',
  },
}

const sceneNoticeNames: Record<Scene, string> = {
  quality: '画面优化场景',
  interaction: '互动场景',
  troubleshoot: '问题排查场景',
  pk: 'PK 对战场景',
}

const preliveTasks: Array<{ id: PreliveTask; title: string; detail: string; action: string; priority: string }> = [
  { id: 'layout', title: '选择直播间布局', detail: '根据直播类型确认画面布局，并检查画面源。', action: '确认布局方案', priority: '必须完成' },
  { id: 'widgets', title: '添加画布小组件', detail: '画布中小组件建议不能超过3个', action: '保存小组件设置', priority: '建议优化' },
  { id: 'visual', title: '人像美化', detail: '默认应用「清透日常」预设，可在美颜、美妆分类中微调，所有处理均在本地完成。', action: '应用美化方案', priority: '必须完成' },
  { id: 'content', title: '直播信息与内容', detail: '选择聊天主题，并完善开播前 15 分钟的内容脚本。', action: '保存内容方案', priority: '建议优化' },
]

function getCustomTopicRecommendation(topic: string): { label: string; detail: string; script: string } | null {
  const normalizedTopic = topic.trim()
  if (!normalizedTopic) return null

  const isEmotionalTopic = /情绪|治愈|焦虑|压力|关系|陪伴|心情/.test(normalizedTopic)
  const isInteractiveTopic = /游戏|挑战|测试|投票|问答|二选一|互动/.test(normalizedTopic)
  const isHobbyTopic = /穿搭|美妆|旅行|读书|电影|美食|健身|摄影|手作/.test(normalizedTopic)
  const focus = isEmotionalTopic
    ? '用开放式问题承接情绪，并以温和回应建立安全感'
    : isInteractiveTopic
      ? '用低门槛问题和即时回应持续带动评论区参与'
      : isHobbyTopic
        ? '从个人经历切入，邀请观众分享各自的体验和建议'
        : '从日常经历切入，用具体提问引导观众分享观点'

  return {
    label: `围绕「${normalizedTopic}」的聊天脚本`,
    detail: `已识别主题方向，建议${focus}。`,
    script: `0-3 分钟：欢迎新进直播间的朋友，介绍今天想聊的「${normalizedTopic}」，邀请大家在评论区分享第一反应。\n\n3-7 分钟：从一个具体经历切入，抛出与「${normalizedTopic}」相关的开放式问题，读 2-3 条评论回应。\n\n7-11 分钟：围绕评论区高频观点继续展开，分享自己的看法，并追问观众的经验或建议。\n\n11-15 分钟：总结本段讨论的关键词，感谢积极互动的观众，预告下一段会继续深入的话题。`,
  }
}

function getLiveTitleRecommendations(streamType: StreamKind, topic: string): string[] {
  const subject = (topic.trim() || getStreamTheme(streamType).defaultTopic).slice(0, 14)

  if (streamType === 'music') {
    return [
      `${subject}｜今晚音乐现场`,
      `正在热唱：${subject}`,
      `点歌时间｜${subject}`,
    ]
  }
  if (streamType === 'game') {
    return [
      `${subject}｜今晚开战`,
      `一起挑战${subject}`,
      `实时对战｜${subject}`,
    ]
  }
  if (streamType === 'show') {
    return [
      `${subject}｜今晚舞台见`,
      `高能才艺现场｜${subject}`,
      `一起解锁${subject}`,
    ]
  }
  return [
    `${subject}｜今晚一起聊聊`,
    `正在热聊：${subject}`,
    `评论区见｜${subject}`,
  ]
}

const chatLayoutTaskTitle = '选择直播间布局'
const showLayoutTaskTitle = '直播布局调整'
const chatLayoutTaskDetail = '已为你默认全屏摄像头画布（单人竖屏 · 9:16），确认后可继续添加画布小组件'
const musicLayoutTaskDetail = '根据你的表演形式，选择适合的画面布局'
const defaultChatText = 'Good things will happen today ❤️'
const defaultGoalTitle = 'follower goal'
const defaultGameGoalTitle = '本场互动目标'
const fallbackGoalTitle = '今日互动目标'
const textSizeBounds = { min: 12, max: 28 }
const textColorOptions = [
  { id: 'gradient', label: '渐变', value: 'gradient' },
  { id: 'white', label: '白色', value: '#ffffff' },
  { id: 'gold', label: '金色', value: '#ffd166' },
  { id: 'pink', label: '粉色', value: '#ff7aa8' },
  { id: 'teal', label: '青色', value: '#7ee7d5' },
  { id: 'purple', label: '紫色', value: '#c9a6ff' },
] as const
type CanvasWidgetKind = 'text' | 'goal' | 'custom'
type CustomWidgetSize = 'compact' | 'regular' | 'large'
type LeaderboardType = 'likes' | 'gifts'
type LeaderboardEntry = {
  id: string
  name: string
  value: number
  avatarTone: string
}
type CustomCanvasWidget = {
  prompt: string
  title: string
  detail: string
  color: string
  size: CustomWidgetSize
  kind: 'banner' | 'leaderboard'
  leaderboardType?: LeaderboardType
  entries?: LeaderboardEntry[]
}

function createCustomCanvasWidget(prompt: string): CustomCanvasWidget | null {
  const normalized = prompt.trim()
  if (!normalized) return null
  const createLeaderboard = (type: LeaderboardType): CustomCanvasWidget => ({
    prompt: normalized,
    title: type === 'likes' ? 'Top likers' : 'Top gifters',
    detail: type === 'likes' ? '点赞榜' : '送礼榜',
    color: type === 'likes' ? '#ff5c82' : '#f4b95f',
    size: 'large',
    kind: 'leaderboard',
    leaderboardType: type,
    entries: type === 'likes'
      ? [
          { id: 'like-1', name: 'Margaret', value: 200, avatarTone: '#c26b58' },
          { id: 'like-2', name: 'kiiikko', value: 197, avatarTone: '#b29e86' },
          { id: 'like-3', name: 'LunaDeam', value: 168, avatarTone: '#926d5c' },
        ]
      : [
          { id: 'gift-1', name: 'Margaret', value: 520, avatarTone: '#c26b58' },
          { id: 'gift-2', name: 'kiiikko', value: 300, avatarTone: '#b29e86' },
          { id: 'gift-3', name: 'LunaDeam', value: 168, avatarTone: '#926d5c' },
        ],
  })

  if (/点赞(?:榜|榜单|排行(?:榜)?|排名)|赞榜|like(?:\s*(?:榜|排行|ranking))?|top\s*likes?/i.test(normalized)) {
    return createLeaderboard('likes')
  }
  if (/送礼(?:榜|榜单|排行(?:榜)?|排名)|礼物(?:榜|榜单|排行(?:榜)?|排名)|gift(?:\s*(?:榜|排行|ranking))?|top\s*gifters?/i.test(normalized)) {
    return createLeaderboard('gifts')
  }

  if (/关注|点赞|订阅|助力/.test(normalized)) {
    return { prompt: normalized, title: '点个关注，一起聊聊', detail: '你的关注是今天的直播动力', color: '#ff5c82', size: 'regular', kind: 'banner' }
  }
  if (/福利|抽奖|限时|倒计时/.test(normalized)) {
    return { prompt: normalized, title: '限时互动福利', detail: '参与评论互动，解锁本场惊喜', color: '#f4b95f', size: 'regular', kind: 'banner' }
  }
  if (/提问|问答|话题|聊天/.test(normalized)) {
    return { prompt: normalized, title: '评论区聊聊', detail: normalized.slice(0, 28), color: '#6edbc0', size: 'regular', kind: 'banner' }
  }
  return { prompt: normalized, title: normalized.slice(0, 16), detail: '点击评论区，一起参与互动', color: '#78aaff', size: 'regular', kind: 'banner' }
}
type LiveCanvasComponentId = Extract<
  AtomicComponentId,
  'live-goal' | 'audience-poll' | 'audience-wishes'
>
const liveComponentLabels: Record<LiveCanvasComponentId, string> = {
  'live-goal': 'LIVE goal',
  'audience-poll': '观众投票',
  'audience-wishes': '观众心愿',
}
const defaultLiveComponentOffsets: Record<
  LiveCanvasComponentId,
  WidgetOffset
> = {
  'live-goal': { x: 0, y: 0 },
  'audience-poll': { x: 0, y: 0 },
  'audience-wishes': { x: 0, y: 0 },
}

function getAtomicUiType(componentId: AtomicComponentId): string {
  if (
    componentId === 'audience-poll' ||
    componentId === 'live-goal' ||
    componentId === 'microphone'
  ) {
    return componentId
  }
  return `atomic:${componentId}`
}

function getActiveWidgetCooldownTypes(
  cooldowns: Map<string, number>,
  now = Date.now(),
): Set<string> {
  const activeTypes = new Set<string>()
  cooldowns.forEach((expiresAt, widgetType) => {
    if (expiresAt > now) {
      activeTypes.add(widgetType)
    } else {
      cooldowns.delete(widgetType)
    }
  })
  return activeTypes
}

function startWidgetSuggestionCooldown(
  cooldowns: Map<string, number>,
  widgetType: string,
): void {
  cooldowns.set(
    widgetType,
    Date.now() + studioRuntimeConfig.suggestion.appliedWidgetCooldownMs,
  )
}

function getPreviewModeForLayout(layout: PreliveLayout): PreviewMode {
  return layout === 'stage' || layout === 'game-landscape' ? 'studio' : 'mobile'
}

const emptyAudienceSnapshot: AudienceSnapshot = {
  comments: [],
  gifts: [],
  viewerCount: 0,
  entrantsLastMinute: 0,
  commentsPerMinute: 0,
  newViewerRetention: 0,
  insight: {
    category: 'none',
    label: '暂无观众数据',
    count: 0,
    confidence: 0,
    priority: 'low',
    shouldTrigger: false,
    latestCommentId: null,
    sampleTexts: [],
  },
}

const widgetProtocol = [
  '如果建议适合用控件执行，请在正文末尾追加 <widget>JSON</widget>，不要使用 Markdown 代码块。',
  'JSON 公共字段：version 固定为 "1.0"，并包含 type、title、detail、actionLabel、props。',
  '允许类型：',
  'visual-adjustment，props.settings 包含 brightness(0.6-1.6)、contrast(0.6-1.6)、warmth(0-0.6)。',
  'audience-poll，props 包含 question、options(2-4项)、durationSeconds(15-180)。',
  'audio-adjustment，props 包含 microphoneGain(-20到20)、backgroundMusicGain(-20到20)。',
  'camera-effects，props.settings 可只返回要修改的字段：smoothness(0-100)、exposure(-20到30)、warmth(0-40)、contrast(-20到40)、saturation(-30到50)、whitening/rosiness/clarity(0-100)、backgroundMode(none/blur/color/image)、backgroundBlur(0-100)、backgroundPreset(neon-studio/music-room/cyber-arena/creator-loft)、backgroundColor、faceEffect(none/sparkles/glasses/heart-sticker)，以及 lipstick/blush/eyeshadow 的 Intensity(0-100) 和 Color、eyelinerIntensity(0-100)、highlightIntensity(0-100)。',
  'live-goal，props 包含 label、current、target、supporters。',
].join('\n')

type GenieRequest = {
  question: string
  prompt: string
  imageDataUrl?: string
}

function captureStudioFrame(
  videoRef: React.RefObject<HTMLVideoElement>,
): string | undefined {
  const effectsCanvas = document.querySelector<HTMLCanvasElement>(
    '.camera-effects-canvas',
  )
  const video = videoRef.current
  const source = effectsCanvas?.width && effectsCanvas.height
    ? effectsCanvas
    : video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ? video
      : null
  if (!source) return undefined

  const sourceWidth = source instanceof HTMLVideoElement
    ? source.videoWidth
    : source.width
  const sourceHeight = source instanceof HTMLVideoElement
    ? source.videoHeight
    : source.height
  if (!sourceWidth || !sourceHeight) return undefined

  const maximumWidth = 480
  const scale = Math.min(1, maximumWidth / sourceWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return undefined

  try {
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.68)
  } catch {
    return undefined
  }
}

function App() {
  const [view, setView] = useState<AppView>('onboarding')
  const [isEditingLiveSettings, setIsEditingLiveSettings] = useState(false)
  const [streamType, setStreamType] = useState<StreamKind>('music')
  const [streamTopic, setStreamTopic] = useState('晚间唱歌聊天')
  const [onboardingInput, setOnboardingInput] = useState('')
  const [lastLiveConfig, setLastLiveConfig] = useState<LastLiveConfig | null>(() =>
    loadLastLiveConfig(),
  )
  const [scene, setScene] = useState<Scene>('quality')
  const [demoStrategy, setDemoStrategy] = useState<AudienceStrategyId>('normal')
  const [strategyRevision, setStrategyRevision] = useState(0)
  const [strategyMenuOpen, setStrategyMenuOpen] = useState(false)
  const [isPk, setIsPk] = useState(false)
  const [applied, setApplied] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [preliveTaskIndex, setPreliveTaskIndex] = useState(0)
  const [completedPreliveTasks, setCompletedPreliveTasks] = useState<PreliveTask[]>([])
  const [exitingPreliveTask, setExitingPreliveTask] = useState<PreliveTask | null>(null)
  const [showGoliveReadyDialog, setShowGoliveReadyDialog] = useState(false)
  const [preliveLayout, setPreliveLayout] = useState<PreliveLayout>('portrait')
  const [preliveScript, setPreliveScript] = useState('')
  const [preliveHostBio, setPreliveHostBio] = useState('音乐聊天主播，用轻松歌单陪大家结束一天。')
  const [customChatTopic, setCustomChatTopic] = useState('')
  const [titleRecommendationContext, setTitleRecommendationContext] = useState('晚间唱歌聊天')
  const [preliveCoverApplied, setPreliveCoverApplied] = useState(false)
  const [isChatCompanion, setIsChatCompanion] = useState(false)
  const [chatTextEnabled, setChatTextEnabled] = useState(true)
  const [chatTextDraft, setChatTextDraft] = useState(defaultChatText)
  const [chatTextValue, setChatTextValue] = useState(defaultChatText)
  const [chatGoalEnabled, setChatGoalEnabled] = useState(true)
  const [chatGoalKind, setChatGoalKind] = useState<GoalKind>('follower')
  const [chatGoalTitle, setChatGoalTitle] = useState(defaultGoalTitle)
  const [chatGoalTarget, setChatGoalTarget] = useState(
    goalKindOptions.find((option) => option.id === 'follower')?.target ?? 60000,
  )
  const [chatTextStyle, setChatTextStyle] = useState<CanvasTextStyle>(defaultCanvasTextStyle)
  const [musicBackgroundId, setMusicBackgroundId] = useState<string>(stageBackgrounds[0].id)
  const [customStageBackground, setCustomStageBackground] = useState<string | null>(null)
  const [stageBackgroundUploadError, setStageBackgroundUploadError] = useState('')
  const [selectedCanvasWidget, setSelectedCanvasWidget] = useState<CanvasWidgetKind | null>(null)
  const [selectedLiveComponent, setSelectedLiveComponent] =
    useState<LiveCanvasComponentId | null>(null)
  const [liveComponentOffsets, setLiveComponentOffsets] = useState<
    Record<LiveCanvasComponentId, WidgetOffset>
  >(defaultLiveComponentOffsets)
  const [chatTextOffset, setChatTextOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [chatGoalOffset, setChatGoalOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [customWidgetPrompt, setCustomWidgetPrompt] = useState('')
  const [customCanvasWidget, setCustomCanvasWidget] = useState<CustomCanvasWidget | null>(null)
  const [customWidgetOffset, setCustomWidgetOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [gameCameraOffset, setGameCameraOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [hostComments, setHostComments] = useState<AudienceComment[]>([])
  const [audienceCommentHistory, setAudienceCommentHistory] = useState<
    AudienceComment[]
  >([])
  const titleRecommendations = useMemo(
    () => getLiveTitleRecommendations(streamType, customChatTopic || titleRecommendationContext),
    [customChatTopic, streamType, titleRecommendationContext],
  )
  const readyScore = Math.round(20 + completedPreliveTasks.length * (80 / preliveTasks.length))
  const [restoredChatSession] = useState(loadGenieChatSession)
  const [genieInput, setGenieInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    restoredChatSession.messages,
  )
  const { chatWidgetSpecs, inputAtomicComponents } = useMemo(() => ({
    chatWidgetSpecs: chatMessages.flatMap(
      (message) => message.widgets ?? [],
    ),
    inputAtomicComponents: Array.from(new Set(
      chatMessages.flatMap((message) => message.atomicComponentIds ?? []),
    )),
  }), [chatMessages])
  const [agentWidgetSpec, setAgentWidgetSpec] = useState<WidgetSpec | null>(
    restoredChatSession.widgets.at(-1) ?? null,
  )
  const [beautyToolSpec, setBeautyToolSpec] = useState<WidgetSpec | null>(null)
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false)
  const [genieError, setGenieError] = useState('')
  const [genieRequestStatus, setGenieRequestStatus] = useState<GenieRequestStatus>('idle')
  const [showEndLiveConfirm, setShowEndLiveConfirm] = useState(false)
  const [postLiveReport, setPostLiveReport] = useState<PostLiveReport | null>(null)
  const [postLiveAiSummary, setPostLiveAiSummary] = useState('')
  const [postLiveMessages, setPostLiveMessages] = useState<ChatMessage[]>([])
  const [postLiveInput, setPostLiveInput] = useState('')
  const [postLiveError, setPostLiveError] = useState('')
  const [postLiveRequestStatus, setPostLiveRequestStatus] =
    useState<GenieRequestStatus>('idle')
  const [liveTick, setLiveTick] = useState(0)
  const [audienceTick, setAudienceTick] = useState(0)
  const [liveStartedAt, setLiveStartedAt] = useState(0)
  const [latestAudienceCommentAt, setLatestAudienceCommentAt] = useState(0)
  const [strategyWarmupComplete, setStrategyWarmupComplete] = useState(false)
  const [strategyCommentState, setStrategyCommentState] =
    useState<StrategyCommentState>('issue')
  const [liveAdjustment, setLiveAdjustment] = useState<LiveAdjustment | null>(null)
  const [canvasNotice, setCanvasNotice] = useState<LiveAdjustment | null>(null)
  const [isSuggestionPreview, setIsSuggestionPreview] = useState(false)
  const [previewingWidgetKey, setPreviewingWidgetKey] = useState<string | null>(null)
  const [appliedWidgetKeys, setAppliedWidgetKeys] = useState<Set<string>>(
    new Set(),
  )
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isBackgroundMusicPlaying, setIsBackgroundMusicPlaying] = useState(false)
  const [backgroundMusicError, setBackgroundMusicError] = useState('')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mobile')
  const [liveStageMode, setLiveStageMode] = useState<LiveStageMode>('preview')
  const [isGenieChatOpen, setIsGenieChatOpen] = useState(false)
  const [displayDiagnostics, setDisplayDiagnostics] =
    useState<LiveDiagnostics | null>(null)
  const [normalAiActivity, setNormalAiActivity] =
    useState<NormalAiActivity>('idle')
  const [dismissedAtomicComponents, setDismissedAtomicComponents] =
    useState<Set<string>>(() => new Set())
  const [removingAtomicComponents, setRemovingAtomicComponents] =
    useState<Set<string>>(() => new Set())
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [processedAudioStream, setProcessedAudioStream] = useState<MediaStream | null>(null)
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null)
  const [displayError, setDisplayError] = useState('')
  const [isLayoutEditing, setIsLayoutEditing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const preliveTaskCardRef = useRef<HTMLDivElement>(null)
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const backgroundMusicRef = useRef<BackgroundMusicPlayer | null>(null)
  const cameraAttemptedRef = useRef(false)
  const strategySelectorRef = useRef<HTMLDivElement>(null)
  const genieComposerRef = useRef<HTMLFormElement>(null)
  const genieChatMessageEndRef = useRef<HTMLDivElement>(null)
  const strategyRecoveryTimeoutRef = useRef<number | null>(null)
  const previewingWidgetSpecRef = useRef<WidgetSpec | null>(null)
  const preliveVisualSettingsRef = useRef<VisualSettings | null>(null)
  const preliveAudioSettingsRef = useRef<AudioSettings | null>(null)
  const preliveSceneRef = useRef<Scene>('quality')
  const genieAbortRef = useRef<AbortController | null>(null)
  const lastGenieRequestRef = useRef<GenieRequest | null>(null)
  const normalAiAnalysisAbortRef = useRef<AbortController | null>(null)
  const latestNormalAiSuggestionRef = useRef<LiveSuggestion | null>(null)
  const lastNormalAiTriggerRef = useRef<{
    key: string
    at: number
  } | null>(null)
  const postLiveAbortRef = useRef<AbortController | null>(null)
  const lastPostLiveRequestRef = useRef<{
    report: PostLiveReport
    question: string
    mode: 'summary' | 'conversation'
  } | null>(null)
  const liveSessionMetricsRef = useRef(
    createLiveSessionMetricsAccumulator(),
  )
  const resetCameraLayerLayout = useStudioStore((state) => state.resetCameraLayerLayout)
  const previewVisualSettings = useStudioStore((state) => state.previewVisualSettings)
  const applyVisualSettings = useStudioStore((state) => state.applyVisualSettings)
  const resetVisualPreview = useStudioStore((state) => state.resetVisualPreview)
  const undoVisualSettings = useStudioStore((state) => state.undoVisualSettings)
  const previewCameraEffects = useStudioStore((state) => state.previewCameraEffects)
  const applyCameraEffects = useStudioStore((state) => state.applyCameraEffects)
  const resetCameraEffectsPreview = useStudioStore((state) => state.resetCameraEffectsPreview)
  const undoCameraEffects = useStudioStore((state) => state.undoCameraEffects)
  const previewAudioSettings = useStudioStore((state) => state.previewAudioSettings)
  const applyAudioSettings = useStudioStore((state) => state.applyAudioSettings)
  const resetAudioPreview = useStudioStore((state) => state.resetAudioPreview)
  const undoAudioSettings = useStudioStore((state) => state.undoAudioSettings)
  const pollStatus = useStudioStore((state) => state.pollState.status)
  const previewPoll = useStudioStore((state) => state.previewPoll)
  const publishPoll = useStudioStore((state) => state.publishPoll)
  const resetPollPreview = useStudioStore((state) => state.resetPollPreview)
  const undoPoll = useStudioStore((state) => state.undoPoll)
  const hidePoll = useStudioStore((state) => state.hidePoll)
  const previewLiveGoal = useStudioStore((state) => state.previewLiveGoal)
  const publishLiveGoal = useStudioStore((state) => state.publishLiveGoal)
  const resetLiveGoalPreview = useStudioStore((state) => state.resetLiveGoalPreview)
  const undoLiveGoal = useStudioStore((state) => state.undoLiveGoal)
  const hideLiveGoal = useStudioStore((state) => state.hideLiveGoal)
  const completeLiveGoal = useStudioStore((state) => state.completeLiveGoal)
  const hideAudienceWishes = useStudioStore(
    (state) => state.hideAudienceWishes,
  )
  const liveGoalState = useStudioStore((state) => state.liveGoalState)
  const microphoneGainDb = useStudioStore((state) => state.audioSettings.microphoneGainDb)
  const backgroundMusicGainDb = useStudioStore((state) => state.audioSettings.backgroundMusicGainDb)
  const committedMicrophoneGainDb = useStudioStore((state) => state.committedAudioSettings.microphoneGainDb)
  const committedBrightness = useStudioStore((state) => state.committedVisualSettings.brightness)
  const mediaMetrics = useStudioStore((state) => state.mediaMetrics)
  const studioToolContext: StudioToolContext = {
    previewAudioSettings,
    applyAudioSettings,
    resetAudioPreview,
    undoAudioSettings,
    previewPoll,
    publishPoll,
    resetPollPreview,
    undoPoll,
    previewLiveGoal,
    publishLiveGoal,
    resetLiveGoalPreview,
    undoLiveGoal,
    previewVisualSettings,
    applyVisualSettings,
    resetVisualPreview,
    undoVisualSettings,
    previewCameraEffects,
    applyCameraEffects,
    resetCameraEffectsPreview,
    undoCameraEffects,
  }
  const strategyWarmupActive = view === 'live' && !strategyWarmupComplete
  const isLiveSettingsWorkspace = view === 'live' && isEditingLiveSettings
  const isPreliveWorkspace = view === 'prelive' || isLiveSettingsWorkspace
  const isLiveWorkspace = view === 'live' && !isEditingLiveSettings
  const activeAudienceStrategy = view === 'live' && strategyCommentState !== 'normal'
    ? resolveAudienceStrategy(
        demoStrategy,
        strategyWarmupComplete
          ? studioRuntimeConfig.audience.strategyWarmupDurationMs
          : 0,
      )
    : demoStrategy
  const commentStrategy = strategyCommentState === 'normal'
    ? 'normal'
    : activeAudienceStrategy
  const commentPhase = strategyCommentState === 'recovery'
    ? 'recovery'
    : 'issue'
  const diagnosticStrategy = strategyCommentState === 'issue'
    ? activeAudienceStrategy
    : 'normal'
  const selectedStrategy = getAudienceStrategy(demoStrategy)
  const commentCadencePerMinute = getAudienceStrategy(
    commentPhase === 'recovery' ? 'normal' : commentStrategy,
  ).audienceMetrics.commentsPerMinute
  const audienceCommentContextRef = useRef<{
    strategy: AudienceStrategyId
    applied: boolean
    phase: AudienceCommentPhase
    startedAt: number
    elapsedSeconds: number
  }>({
    strategy: commentStrategy,
    applied,
    phase: commentPhase,
    startedAt: liveStartedAt,
    elapsedSeconds: liveTick,
  })
  useEffect(() => {
    audienceCommentContextRef.current = {
      strategy: commentStrategy,
      applied,
      phase: commentPhase,
      startedAt: liveStartedAt,
      elapsedSeconds: liveTick,
    }
  }, [applied, commentPhase, commentStrategy, liveStartedAt, liveTick])
  const appendAudienceComments = useCallback((snapshot: AudienceSnapshot) => {
    const latestComment = snapshot.comments.at(-1)
    if (!latestComment) return
    setAudienceCommentHistory((history) => {
      if (history.length === 0) return snapshot.comments
      if (history.some((comment) => comment.id === latestComment.id)) {
        return history
      }
      return [...history, latestComment]
        .sort((left, right) => left.occurredAt - right.occurredAt)
        .slice(-studioRuntimeConfig.audience.visibleCommentCount)
    })
  }, [])
  const generatedAudienceSnapshot = useMemo(
    () => view === 'live'
      ? mockAudienceEventAdapter.getStrategySnapshot(
          commentStrategy,
          applied,
          audienceTick,
          commentPhase,
          liveStartedAt,
          liveTick,
          latestAudienceCommentAt,
        )
      : emptyAudienceSnapshot,
    [
      applied,
      audienceTick,
      commentPhase,
      commentStrategy,
      latestAudienceCommentAt,
      liveStartedAt,
      liveTick,
      view,
    ],
  )
  const audienceSnapshot = useMemo(
    () => view === 'live' && audienceCommentHistory.length > 0
      ? {
          ...generatedAudienceSnapshot,
          comments: audienceCommentHistory,
        }
      : generatedAudienceSnapshot,
    [audienceCommentHistory, generatedAudienceSnapshot, view],
  )
  const analysisAudienceSnapshot = useMemo(() => {
    if (hostComments.length === 0) return audienceSnapshot

    const comments = [...audienceSnapshot.comments, ...hostComments]
      .sort((left, right) => left.occurredAt - right.occurredAt)
    return {
      ...audienceSnapshot,
      comments,
      insight: analyzeCommentKeywords(hostComments.slice(-1)),
    }
  }, [audienceSnapshot, hostComments])
  const diagnostics = useMemo(() => buildLiveDiagnostics({
    mediaMetrics,
    audience: audienceSnapshot,
    strategy: diagnosticStrategy,
    resolvedScene: applied ? scene : null,
    brightnessCompensation: (committedBrightness - 1) * 100,
    microphoneGainDb: committedMicrophoneGainDb,
  }), [
    applied,
    audienceSnapshot,
    diagnosticStrategy,
    committedBrightness,
    committedMicrophoneGainDb,
    mediaMetrics,
    scene,
  ])
  const [suggestionQueue, setSuggestionQueue] = useState<QueuedSuggestion[]>([])
  const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState<Set<string>>(
    new Set(),
  )
  const suggestionQueueRef = useRef(suggestionQueue)
  const latestDiagnosticsRef = useRef(diagnostics)
  const previousDiagnosticsRef = useRef<LiveDiagnostics | null>(null)
  const latestAudienceRef = useRef(audienceSnapshot)
  const lastMetricUpdateAtRef = useRef(0)
  const normalModeDetectionRef =
    useRef<NormalModeDetectionSnapshot | null>(null)
  const strategyActivatedRef = useRef(false)
  const dismissedSignalIdsRef = useRef(new Set<LiveSuggestion['signalId']>())
  const widgetSuggestionCooldownsRef = useRef(new Map<string, number>())
  const removalTimeoutsRef = useRef(new Map<string, number>())
  const beautyToolCardRef = useRef<HTMLDivElement>(null)
  const suggestionComponents = keepLatestUniqueBy(
    suggestionQueue.flatMap((suggestion) =>
      suggestion.widgets.map((widgetSpec, widgetIndex) => ({
        componentId: `${suggestion.queueId}-${widgetIndex}`,
        suggestion,
        widgetIndex,
        widgetSpec,
      })),
    ),
    (component) => getWidgetUiType(component.widgetSpec.type),
  )
  const aiSuggestionComponents = suggestionComponents.filter(
    (component) => component.suggestion.analysisSource === 'ai',
  )
  const chatWidgetComponents = keepLatestUniqueBy(
    chatWidgetSpecs.map((widgetSpec, widgetIndex) => ({
      widgetIndex,
      widgetSpec,
    })),
    (component) => getWidgetUiType(component.widgetSpec.type),
  )
  const visibleSuggestionQueue = suggestionQueue.filter(
    (suggestion) => !hiddenSuggestionIds.has(suggestion.queueId),
  )
  const recalledComponents = [
    ...(agentWidgetSpec
      ? [{
          componentId: `agent-${agentWidgetSpec.type}-${agentWidgetSpec.title}`,
          suggestion: null,
          widgetIndex: -1,
          widgetSpec: agentWidgetSpec,
        }]
      : []),
    ...suggestionComponents,
  ]
  const inputRecalledComponents = inputAtomicComponents
    .map((componentId) => ({
      key: `input-${componentId}`,
      componentId,
      metric: 'Genie 输入意图',
      source: '输入框识别',
      suggestionNumber: null,
      suggestionId: null,
    }))
  const triggeredRecalledComponents = keepLatestUniqueBy(
    suggestionQueue
      .flatMap((suggestion, suggestionIndex) =>
        suggestion.analysisSource === 'ai'
          ? []
          :
        recallAtomicComponents({
          source: suggestion.source,
          text: `${suggestion.metric} ${suggestion.action}`,
          signalIds: [suggestion.signalId],
          strategyId: demoStrategy,
        }).componentIds.map((componentId) => ({
          key: `${suggestion.queueId}-${componentId}`,
          componentId,
          metric: suggestion.metric,
          source: suggestion.source === 'comment'
            ? '评论实时分析'
            : '监控指标触发',
          suggestionNumber: suggestionIndex + 1,
          suggestionId: suggestion.queueId,
        })),
      )
      .filter((candidate) => !dismissedAtomicComponents.has(candidate.key)),
    (component) => getAtomicUiType(component.componentId),
  )
  const atomicComponentCountsBySuggestion = triggeredRecalledComponents.reduce(
    (counts, component) => {
      if (component.suggestionId) {
        counts.set(
          component.suggestionId,
          (counts.get(component.suggestionId) ?? 0) + 1,
        )
      }
      return counts
    },
    new Map<string, number>(),
  )
  const activeWidgetSpec = agentWidgetSpec
    ?? recalledComponents[0]?.widgetSpec
    ?? getSceneWidgetSpec(scene)
  const liveRightRailMode = selectedCanvasWidget || selectedLiveComponent
    ? 'canvas-config'
    : isGenieChatOpen
      ? 'chat'
      : 'overview'
  const visibleWidgetUiTypes = new Set(
    (liveRightRailMode === 'overview'
      ? aiSuggestionComponents.map((component) => component.widgetSpec)
      : chatWidgetComponents.map((component) => component.widgetSpec)
    ).map((widgetSpec) => getWidgetUiType(widgetSpec.type)),
  )
  const atomicRecalledComponents = (liveRightRailMode === 'overview'
    ? triggeredRecalledComponents
    : inputRecalledComponents
  ).filter(
    (component) => !visibleWidgetUiTypes.has(
      getAtomicUiType(component.componentId),
    ),
  )
  const liveComponentCount = atomicRecalledComponents.length +
    (liveRightRailMode === 'chat' ? chatWidgetComponents.length : 0) +
    (liveRightRailMode === 'overview' ? aiSuggestionComponents.length : 0)

  useEffect(() => {
    if (
      chatMessages.length === 0 &&
      inputAtomicComponents.length === 0 &&
      chatWidgetSpecs.length === 0
    ) {
      clearGenieChatSession()
      return
    }
    saveGenieChatSession({
      messages: chatMessages,
      atomicComponentIds: inputAtomicComponents,
      widgets: chatWidgetSpecs,
    })
  }, [chatMessages, chatWidgetSpecs, inputAtomicComponents])

  useEffect(() => {
    suggestionQueueRef.current = suggestionQueue
  }, [suggestionQueue])

  useEffect(() => {
    latestDiagnosticsRef.current = diagnostics
    latestAudienceRef.current = analysisAudienceSnapshot
  }, [analysisAudienceSnapshot, diagnostics])

  useEffect(() => {
    if (view !== 'live') return
    const intervalId = window.setInterval(
      () => setDisplayDiagnostics(latestDiagnosticsRef.current),
      studioRuntimeConfig.monitoringDisplay.refreshIntervalMs,
    )
    return () => window.clearInterval(intervalId)
  }, [view])

  useEffect(() => {
    if (!isGenieChatOpen) return
    const frameId = window.requestAnimationFrame(() => {
      genieChatMessageEndRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [
    agentWidgetSpec,
    chatMessages,
    genieRequestStatus,
    inputAtomicComponents,
    isGenieChatOpen,
  ])

  useEffect(() => {
    const previous = previousDiagnosticsRef.current
    previousDiagnosticsRef.current = diagnostics
    if (
      view !== 'live' ||
      demoStrategy === 'normal' ||
      strategyWarmupActive ||
      !previous
    ) {
      return
    }

    const now = Date.now()
    if (
      now - lastMetricUpdateAtRef.current <
      rightRailUpdateConfig.metricUpdateCooldownMs
    ) {
      return
    }

    const changedSuggestions = selectSuggestionsForStrategy(
      selectThresholdChangedSuggestions(
        previous,
        diagnostics,
        rightRailUpdateConfig.metricTrendDeltaThreshold,
      ),
      demoStrategy,
    )
    if (changedSuggestions.length === 0) return

    const currentQueue = suggestionQueueRef.current
    const nextQueue = appendNewSuggestions(
      currentQueue,
      changedSuggestions,
      dismissedSignalIdsRef.current,
      now,
      getActiveWidgetCooldownTypes(widgetSuggestionCooldownsRef.current, now),
    )
    if (nextQueue === currentQueue) return

    suggestionQueueRef.current = nextQueue
    setSelectedCanvasWidget(null)
    setSuggestionQueue(nextQueue)
    lastMetricUpdateAtRef.current = now
  }, [demoStrategy, diagnostics, strategyWarmupActive, view])

  useEffect(() => {
    if (view !== 'live' || demoStrategy !== 'normal') {
      normalModeDetectionRef.current = null
      latestNormalAiSuggestionRef.current = null
      lastNormalAiTriggerRef.current = null
      normalAiAnalysisAbortRef.current?.abort()
      return
    }

    normalModeDetectionRef.current = createNormalModeDetectionSnapshot(
      latestDiagnosticsRef.current,
      latestAudienceRef.current.comments,
      useStudioStore.getState().mediaMetrics,
    )

    const detectUpdates = async () => {
      if (normalAiAnalysisAbortRef.current) return
      const audience = latestAudienceRef.current
      const currentDiagnostics = latestDiagnosticsRef.current
      const current = createNormalModeDetectionSnapshot(
        currentDiagnostics,
        audience.comments,
        useStudioStore.getState().mediaMetrics,
      )
      const previous = normalModeDetectionRef.current
      normalModeDetectionRef.current = current
      if (!previous) return

      const updates = detectNormalModeUpdates(previous, current)
      if (!updates.hasUpdates) return
      const candidates: Array<{
        suggestion: LiveSuggestion
        source: 'monitor' | 'comment'
        triggerKey: string
      }> = []
      if (updates.monitoring || updates.visual) {
        currentDiagnostics.suggestions
          .filter((suggestion) => suggestion.tone !== 'good')
          .forEach((suggestion) => candidates.push({
            suggestion,
            source: 'monitor',
            triggerKey: `monitor:${suggestion.signalId}`,
          }))
      }

      if (updates.comments) {
        const commentSuggestion = createCommentInsightSuggestion(
          audience.insight,
          audience.comments,
        )
        if (commentSuggestion) {
          candidates.push({
            suggestion: commentSuggestion,
            source: 'comment',
            triggerKey: audience.insight.category,
          })
        }
      }

      const availableCandidates = candidates.filter((candidate) => {
        if (
          getActiveWidgetCooldownTypes(widgetSuggestionCooldownsRef.current)
            .has(getWidgetUiType(candidate.suggestion.widget.type))
        ) {
          return false
        }
        if (
          dismissedSignalIdsRef.current.has(candidate.suggestion.signalId)
        ) {
          return false
        }
        const lastTrigger = lastNormalAiTriggerRef.current
        const cooldown = candidate.source === 'comment'
          ? rightRailUpdateConfig.commentCategoryCooldownMs
          : rightRailUpdateConfig.metricUpdateCooldownMs
        return !lastTrigger ||
          lastTrigger.key !== candidate.triggerKey ||
          Date.now() - lastTrigger.at >= cooldown
      })
      const selected = [...availableCandidates].sort(
        (left, right) =>
          right.suggestion.severity - left.suggestion.severity,
      )[0]
      if (!selected) {
        setNormalAiActivity((activity) =>
          activity === 'queued' ? 'no-action' : activity,
        )
        return
      }

      setNormalAiActivity('analyzing')
      const controller = new AbortController()
      normalAiAnalysisAbortRef.current = controller
      try {
        const studioState = useStudioStore.getState()
        const result = await askGenie([
          createNormalAiAnalysisPrompt(
            currentDiagnostics,
            audience,
            updates,
            availableCandidates.map((candidate) => candidate.suggestion),
          ),
          widgetProtocol,
        ].join('\n'), {
          signal: controller.signal,
          instruction: '',
          imageDataUrl: captureStudioFrame(videoRef),
          cameraEffects: studioState.cameraEffects,
          recommendedCameraEffects: recommendCameraEffects(
            studioState.cameraEffects,
            studioState.mediaMetrics.brightness.score,
          ),
        })
        const analyzedSuggestion = createAiAnalyzedSuggestion(
          selected.suggestion,
          result.text,
          result.widget,
        )
        if (analyzedSuggestion) {
          latestNormalAiSuggestionRef.current = analyzedSuggestion
          lastNormalAiTriggerRef.current = {
            key: selected.triggerKey,
            at: Date.now(),
          }
          const currentQueue = suggestionQueueRef.current
          const nextQueue = appendTriggeredSuggestion(
            currentQueue,
            analyzedSuggestion,
            selected.source,
            selected.triggerKey,
            Date.now(),
            getActiveWidgetCooldownTypes(widgetSuggestionCooldownsRef.current),
          )
          if (nextQueue !== currentQueue) {
            suggestionQueueRef.current = nextQueue
            setSuggestionQueue(nextQueue)
          }
          setNormalAiActivity('updated')
        } else {
          setNormalAiActivity('no-action')
        }
      } catch (error) {
        if (
          !(error instanceof GenieRequestError) ||
          error.code !== 'cancelled'
        ) {
          latestNormalAiSuggestionRef.current = {
            ...selected.suggestion,
            analysisSource: 'rules',
          }
          lastNormalAiTriggerRef.current = {
            key: selected.triggerKey,
            at: Date.now(),
          }
          const currentQueue = suggestionQueueRef.current
          const nextQueue = appendTriggeredSuggestion(
            currentQueue,
            latestNormalAiSuggestionRef.current,
            selected.source,
            selected.triggerKey,
            Date.now(),
            getActiveWidgetCooldownTypes(widgetSuggestionCooldownsRef.current),
          )
          if (nextQueue !== currentQueue) {
            suggestionQueueRef.current = nextQueue
            setSuggestionQueue(nextQueue)
          }
          setNormalAiActivity('updated')
        }
      } finally {
        if (normalAiAnalysisAbortRef.current === controller) {
          normalAiAnalysisAbortRef.current = null
        }
      }
    }

    const intervalMs = rightRailUpdateConfig.normalDetectionIntervalMs
    let nextRunAt = Date.now() + intervalMs
    let timeoutId = 0
    const runOnSchedule = async () => {
      await detectUpdates()
      nextRunAt = advanceFixedRateDeadline(
        nextRunAt,
        Date.now(),
        intervalMs,
      )
      timeoutId = window.setTimeout(
        () => void runOnSchedule(),
        Math.max(0, nextRunAt - Date.now()),
      )
    }
    timeoutId = window.setTimeout(
      () => void runOnSchedule(),
      Math.max(0, nextRunAt - Date.now()),
    )
    return () => {
      window.clearTimeout(timeoutId)
      normalAiAnalysisAbortRef.current?.abort()
    }
  }, [demoStrategy, view])

  useEffect(() => {
    if (view !== 'live') return
    liveSessionMetricsRef.current = recordLiveSessionMetrics(
      liveSessionMetricsRef.current,
      mediaMetrics,
    )
  }, [mediaMetrics, view])

  useEffect(() => {
    if (!canvasNotice) return
    const timeoutId = window.setTimeout(() => setCanvasNotice(null), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [canvasNotice])

  useEffect(() => {
    if (
      view !== 'prelive'
      || exitingPreliveTask
      || completedPreliveTasks.length === preliveTasks.length
    ) return

    const frameId = window.requestAnimationFrame(() => {
      preliveTaskCardRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [completedPreliveTasks.length, exitingPreliveTask, preliveTaskIndex, view])

  useEffect(() => {
    if (!strategyMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!strategySelectorRef.current?.contains(event.target as Node)) {
        setStrategyMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [strategyMenuOpen])

  useEffect(() => {
    if (view !== 'live') {
      strategyActivatedRef.current = false
      return
    }
    if (demoStrategy === 'normal') {
      strategyActivatedRef.current = true
      return
    }
    if (strategyWarmupActive || strategyActivatedRef.current) return

    const currentQueue = suggestionQueueRef.current
    const strategySuggestions = selectSuggestionsForStrategy(
      latestDiagnosticsRef.current.suggestions,
      demoStrategy,
    )
    const nextQueue = appendNewSuggestions(
      currentQueue,
      strategySuggestions,
      dismissedSignalIdsRef.current,
      Date.now(),
      getActiveWidgetCooldownTypes(widgetSuggestionCooldownsRef.current),
    )
    if (nextQueue !== currentQueue) {
      suggestionQueueRef.current = nextQueue
      setSelectedCanvasWidget(null)
      setSuggestionQueue(nextQueue)
    }
    strategyActivatedRef.current = true
  }, [
    activeAudienceStrategy,
    demoStrategy,
    strategyRevision,
    strategyWarmupActive,
    view,
  ])

  useEffect(() => {
    if (view !== 'live' || demoStrategy === 'normal') return

    let nextSyncAt = Date.now() + studioRuntimeConfig.suggestion.syncIntervalMs
    let timeoutId = 0
    const synchronizeSuggestions = () => {
      const incoming = selectSuggestionsForStrategy(
        latestDiagnosticsRef.current.suggestions,
        demoStrategy,
      )
      const activeSignalIds = new Set(incoming.map((suggestion) => suggestion.signalId))
      dismissedSignalIdsRef.current.forEach((signalId) => {
        if (!activeSignalIds.has(signalId)) {
          dismissedSignalIdsRef.current.delete(signalId)
        }
      })
      setSuggestionQueue((queue) =>
        appendNewSuggestions(
          queue,
          incoming,
          dismissedSignalIdsRef.current,
          Date.now(),
          getActiveWidgetCooldownTypes(widgetSuggestionCooldownsRef.current),
        ),
      )

      do {
        nextSyncAt += studioRuntimeConfig.suggestion.syncIntervalMs
      } while (nextSyncAt <= Date.now())
      timeoutId = window.setTimeout(
        synchronizeSuggestions,
        Math.max(0, nextSyncAt - Date.now()),
      )
    }

    timeoutId = window.setTimeout(
      synchronizeSuggestions,
      Math.max(0, nextSyncAt - Date.now()),
    )
    return () => window.clearTimeout(timeoutId)
  }, [demoStrategy, view])

  useEffect(() => {
    return () => stopMediaStream(mediaStream)
  }, [mediaStream])

  useEffect(() => {
    return () => {
      audioProcessorRef.current?.close()
      backgroundMusicRef.current?.close()
    }
  }, [])

  useEffect(() => {
    const removalTimeouts = removalTimeoutsRef.current
    return () => {
      genieAbortRef.current?.abort()
      postLiveAbortRef.current?.abort()
      const backgroundImageUrl = useStudioStore.getState().cameraEffects.backgroundImageUrl
      if (backgroundImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(backgroundImageUrl)
      }
      removalTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
      removalTimeouts.clear()
      if (strategyRecoveryTimeoutRef.current !== null) {
        window.clearTimeout(strategyRecoveryTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    audioProcessorRef.current?.setGainDb(microphoneGainDb)
  }, [microphoneGainDb])

  useEffect(() => {
    backgroundMusicRef.current?.setGainDb(backgroundMusicGainDb)
  }, [backgroundMusicGainDb])

  useEffect(() => {
    const video = videoRef.current
    if (cameraEnabled && video && mediaStream) {
      video.srcObject = mediaStream
    }
  }, [cameraEnabled, displayStream, mediaStream, view])

  useEffect(() => {
    return () => stopMediaStream(displayStream)
  }, [displayStream])

  useEffect(() => {
    mediaStream?.getAudioTracks().forEach((track) => {
      track.enabled = !isMicMuted
    })
  }, [isMicMuted, mediaStream])

  useMediaMonitoring({
    videoRef,
    stream: processedAudioStream ?? mediaStream,
    cameraEnabled,
    microphoneMuted: isMicMuted,
  })

  const enableCamera = useCallback(async () => {
    try {
      const stream = await requestCameraStream()
      const audioProcessor = createAudioProcessor(stream)
      audioProcessor?.setGainDb(useStudioStore.getState().audioSettings.microphoneGainDb)
      audioProcessorRef.current?.close()
      audioProcessorRef.current = audioProcessor
      setProcessedAudioStream(audioProcessor?.stream ?? null)
      setMediaStream((currentStream) => {
        stopMediaStream(currentStream)
        return stream
      })
      setCameraEnabled(true)
      setCameraError('')
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : '未获取到摄像头权限，已使用演示画面。')
    }
  }, [])

  const stopScreenShare = useCallback(() => {
    setDisplayStream((currentStream) => {
      stopMediaStream(currentStream)
      return null
    })
    setDisplayError('')
    setIsLayoutEditing(false)
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (displayStream) {
      stopScreenShare()
      return
    }

    try {
      const stream = await requestDisplayStream()
      stream.getVideoTracks()[0]?.addEventListener('ended', stopScreenShare, { once: true })
      setDisplayStream(stream)
      setDisplayError('')
      setPreviewMode('studio')
      setIsLayoutEditing(true)
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'NotAllowedError'
      setDisplayError(cancelled ? '已取消屏幕投放。' : error instanceof Error ? error.message : '屏幕投放启动失败。')
    }
  }, [displayStream, stopScreenShare])

  useEffect(() => {
    if (view === 'onboarding' || cameraEnabled || cameraAttemptedRef.current) return
    cameraAttemptedRef.current = true
    void enableCamera()
  }, [cameraEnabled, enableCamera, view])

  useEffect(() => {
    if (view !== 'live') return
    const timeout = window.setTimeout(
      () => setStrategyWarmupComplete(true),
      studioRuntimeConfig.audience.strategyWarmupDurationMs,
    )
    return () => window.clearTimeout(timeout)
  }, [view])

  useEffect(() => {
    if (view !== 'live') return
    const interval = window.setInterval(
      () => setLiveTick((tick) => tick + 1),
      studioRuntimeConfig.audience.refreshIntervalMs,
    )
    return () => window.clearInterval(interval)
  }, [view])

  useEffect(() => {
    if (view !== 'live') return
    const timeout = window.setTimeout(
      () => {
        const nextTick = audienceTick + 1
        const occurredAt = Date.now()
        const context = audienceCommentContextRef.current
        const snapshot = mockAudienceEventAdapter.getStrategySnapshot(
          context.strategy,
          context.applied,
          nextTick,
          context.phase,
          context.startedAt,
          context.elapsedSeconds,
          occurredAt,
        )
        setAudienceTick(nextTick)
        setLatestAudienceCommentAt(occurredAt)
        appendAudienceComments(snapshot)
      },
      getAudienceCommentIntervalMs(commentCadencePerMinute, audienceTick),
    )
    return () => window.clearTimeout(timeout)
  }, [
    appendAudienceComments,
    audienceTick,
    commentCadencePerMinute,
    view,
  ])

  const changeScene = (nextScene: Scene) => {
    studioToolRegistry.execute('studio.reset_visual_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_audio_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_poll_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_live_goal_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_camera_effects_preview', {}, studioToolContext)
    setAgentWidgetSpec(null)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setScene(nextScene)
    setApplied(false)
    setIsSuggestionPreview(false)
    setPreviewingWidgetKey(null)
    setAppliedWidgetKeys(new Set())
    previewingWidgetSpecRef.current = null
    setLiveAdjustment(null)
    setIsPk(nextScene === 'pk')
    setCanvasNotice({
      name: `已切换至${sceneNoticeNames[nextScene]}`,
      detail: '场景配置已同步到直播画面。',
    })
  }

  const selectDemoStrategy = (
    strategyId: AudienceStrategyId,
    occurredAt: number,
  ) => {
    if (view !== 'live') return
    const strategy = getAudienceStrategy(strategyId)
    const nextAudienceTick = audienceTick + 1
    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
      strategyRecoveryTimeoutRef.current = null
    }
    setDemoStrategy(strategyId)
    setAudienceTick(nextAudienceTick)
    setLatestAudienceCommentAt(occurredAt)
    appendAudienceComments(
      mockAudienceEventAdapter.getStrategySnapshot(
        strategyId,
        applied,
        nextAudienceTick,
        'issue',
        liveStartedAt,
        liveTick,
        occurredAt,
      ),
    )
    setStrategyRevision((revision) => revision + 1)
    setStrategyCommentState('issue')
    setStrategyWarmupComplete(true)
    setNormalAiActivity('idle')
    setStrategyMenuOpen(false)
    setScene(strategy.scene)
    setDisplayDiagnostics(buildLiveDiagnostics({
      mediaMetrics,
      audience: audienceSnapshot,
      strategy: strategyId,
      resolvedScene: null,
      brightnessCompensation: (committedBrightness - 1) * 100,
      microphoneGainDb: committedMicrophoneGainDb,
    }))
    setIsPk(view === 'live' && strategy.scene === 'pk')
    setApplied(false)
    setPreviewingWidgetKey(null)
    setAppliedWidgetKeys(new Set())
    previewingWidgetSpecRef.current = null
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setSuggestionQueue([])
    setHiddenSuggestionIds(new Set())
    setDismissedAtomicComponents(new Set())
    setRemovingAtomicComponents(new Set())
    removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current.clear()
    dismissedSignalIdsRef.current.clear()
    widgetSuggestionCooldownsRef.current.clear()
    lastMetricUpdateAtRef.current = 0
    previousDiagnosticsRef.current = null
    strategyActivatedRef.current = false
    applyVisualSettings(strategy.visualSettings)
    applyAudioSettings(strategy.audioSettings)
    setCanvasNotice({
      name: `已切换为${strategy.label}`,
      detail: strategy.description,
    })
  }

  const beginPrelive = (theme: StreamThemeId, topic?: string) => {
    const finalTopic = topic?.trim() || getStreamTheme(theme).defaultTopic
    setStreamType(theme)
    setStreamTopic(finalTopic)
    setTitleRecommendationContext(finalTopic)
    const chatCompanion = theme === 'chat'
    setIsChatCompanion(chatCompanion)
    const initialLayout: PreliveLayout = theme === 'show'
      ? 'stage'
      : theme === 'game'
        ? 'game-landscape'
        : 'portrait'
    setPreliveLayout(initialLayout)
    setPreviewMode(getPreviewModeForLayout(initialLayout))
    setCompletedPreliveTasks([])
    setExitingPreliveTask(null)
    setShowGoliveReadyDialog(false)
    setIsEditingLiveSettings(false)
    setPreliveTaskIndex(0)
    setCustomChatTopic('')
    setPreliveScript('')
    setChatTextEnabled(true)
    setChatTextDraft(defaultChatText)
    setChatTextValue(defaultChatText)
    setChatTextStyle(defaultCanvasTextStyle)
    setChatGoalEnabled(true)
    setChatGoalKind('follower')
    setChatGoalTitle(theme === 'game' ? defaultGameGoalTitle : defaultGoalTitle)
    setChatGoalTarget(goalKindOptions.find((option) => option.id === 'follower')?.target ?? 60000)
    setMusicBackgroundId(stageBackgrounds[0].id)
    setCustomStageBackground(null)
    setStageBackgroundUploadError('')
    setSelectedCanvasWidget(null)
    setChatTextOffset({ x: 0, y: 0 })
    setChatGoalOffset({ x: 0, y: 0 })
    setCustomWidgetPrompt('')
    setCustomCanvasWidget(null)
    setCustomWidgetOffset({ x: 0, y: 0 })
    setGameCameraOffset({ x: 0, y: 0 })
    applyCameraEffects(applyCameraEffectPreset('natural'))
    setIsGenieChatOpen(false)
    setView('prelive')
  }

  const submitOnboardingInput = () => {
    const description = onboardingInput.trim()
    if (!description) return
    const theme = recognizeStreamTheme(description)
    beginPrelive(theme, description)
  }

  const restoreLastLiveConfig = () => {
    if (!lastLiveConfig) return
    const { theme, savedConfig } = lastLiveConfig
    setStreamType(theme)
    setStreamTopic(savedConfig.topic)
    setTitleRecommendationContext(savedConfig.topic)
    setIsChatCompanion(savedConfig.isChatCompanion)
    const restoredLayout: PreliveLayout = theme === 'game'
      && savedConfig.layout !== 'game-vertical'
      && savedConfig.layout !== 'game-landscape'
      ? 'game-landscape'
      : savedConfig.layout
    setPreliveLayout(restoredLayout)
    setPreviewMode(getPreviewModeForLayout(restoredLayout))
    setChatTextEnabled(savedConfig.chatTextEnabled)
    setChatTextValue(savedConfig.chatTextValue || defaultChatText)
    setChatTextDraft(savedConfig.chatTextValue || defaultChatText)
    setChatGoalEnabled(savedConfig.chatGoalEnabled)
    setChatGoalKind(savedConfig.chatGoalKind ?? 'follower')
    setChatGoalTitle(savedConfig.chatGoalTitle || (theme === 'game' ? defaultGameGoalTitle : defaultGoalTitle))
    const restoredGoalKind = savedConfig.chatGoalKind ?? 'follower'
    setChatGoalTarget(
      savedConfig.chatGoalTarget
        ?? goalKindOptions.find((option) => option.id === restoredGoalKind)?.target
        ?? 60000,
    )
    setChatTextStyle({ ...defaultCanvasTextStyle, ...savedConfig.chatTextStyle })
    setChatTextOffset(savedConfig.chatTextOffset ?? { x: 0, y: 0 })
    setChatGoalOffset(savedConfig.chatGoalOffset ?? { x: 0, y: 0 })
    setGameCameraOffset(savedConfig.gameCameraOffset ?? { x: 0, y: 0 })
    setCustomStageBackground(null)
    setMusicBackgroundId(savedConfig.musicBackgroundId || stageBackgrounds[0].id)
    setStageBackgroundUploadError('')
    setSelectedCanvasWidget(null)
    applyCameraEffects(applyCameraEffectPreset('natural'))
    setCompletedPreliveTasks(preliveTasks.map((task) => task.id))
    setExitingPreliveTask(null)
    setShowGoliveReadyDialog(true)
    setIsEditingLiveSettings(false)
    setPreliveTaskIndex(0)
    setIsGenieChatOpen(false)
    setView('prelive')
  }

  const selectChatGoalKind = (kind: GoalKind) => {
    const option = goalKindOptions.find((item) => item.id === kind)
    setChatGoalKind(kind)
    if (option) {
      setChatGoalTitle(option.defaultTitle)
      setChatGoalTarget(option.target)
    }
  }

  const selectStageBackground = (backgroundId: string) => {
    setMusicBackgroundId(backgroundId)
    setCustomStageBackground(null)
    setStageBackgroundUploadError('')
  }

  const uploadStageBackground = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStageBackgroundUploadError('仅支持图片文件，请重新选择')
      return
    }
    setCustomStageBackground(URL.createObjectURL(file))
    setStageBackgroundUploadError('')
  }

  const stageBackgroundUrl = customStageBackground
    ?? stageBackgrounds.find((background) => background.id === musicBackgroundId)?.url
    ?? null
  const canvasWidgetsAvailable = streamType === 'chat'
    || streamType === 'music'
    || streamType === 'game'
    || streamType === 'show'
  const bandLayoutActive = (streamType === 'music' && preliveLayout === 'three-quarter')
    || (streamType === 'show' && preliveLayout === 'stage')
  const gameLayout = streamType === 'game'
    ? preliveLayout === 'game-vertical'
      ? 'vertical'
      : 'landscape'
    : null

  const selectCanvasWidget = (widget: CanvasWidgetKind | null) => {
    setSelectedCanvasWidget(widget)
    if (widget) setSelectedLiveComponent(null)
  }

  const deleteCanvasWidget = (widget: CanvasWidgetKind) => {
    if (widget === 'text') setChatTextEnabled(false)
    if (widget === 'goal') setChatGoalEnabled(false)
    if (widget === 'custom') setCustomCanvasWidget(null)
    setSelectedCanvasWidget((current) => current === widget ? null : current)
    setCanvasNotice({
      name: `已删除${widget === 'text' ? '文字源' : widget === 'goal' ? '目标源' : '自定义组件'}`,
      detail: '组件已从当前直播画面移除。',
    })
  }

  const selectLiveComponent = (component: LiveCanvasComponentId | null) => {
    setSelectedLiveComponent(component)
    if (component) {
      setSelectedCanvasWidget(null)
      setIsGenieChatOpen(false)
    }
  }

  const deleteLiveComponent = (component: LiveCanvasComponentId) => {
    if (component === 'live-goal') hideLiveGoal()
    if (component === 'audience-poll') hidePoll()
    if (component === 'audience-wishes') hideAudienceWishes()
    setSelectedLiveComponent((current) =>
      current === component ? null : current,
    )
    setIsSuggestionPreview(false)
    setLiveAdjustment(null)
    setCanvasNotice({
      name: `已删除${liveComponentLabels[component]}`,
      detail: '组件已从当前直播画面移除。',
    })
  }

  const renderCanvasWidgetPanel = (selectedWidget: CanvasWidgetKind | null) => (
    <CanvasWidgetPanel
      selectedWidget={selectedWidget}
      onSelectWidget={setSelectedCanvasWidget}
      textEnabled={chatTextEnabled}
      onTextEnabledChange={setChatTextEnabled}
      textDraft={chatTextDraft}
      onTextDraftChange={setChatTextDraft}
      onTextApply={() => setChatTextValue(chatTextDraft)}
      textStyle={chatTextStyle}
      onTextStyleChange={setChatTextStyle}
      goalEnabled={chatGoalEnabled}
      onGoalEnabledChange={setChatGoalEnabled}
      goalKind={chatGoalKind}
      onGoalKindChange={selectChatGoalKind}
      goalTitle={chatGoalTitle}
      onGoalTitleChange={setChatGoalTitle}
      goalTarget={chatGoalTarget}
      onGoalTargetChange={setChatGoalTarget}
      customWidgetPrompt={customWidgetPrompt}
      onCustomWidgetPromptChange={setCustomWidgetPrompt}
      customWidget={customCanvasWidget}
      onCustomWidgetChange={setCustomCanvasWidget}
      onDeleteCustomWidget={() => deleteCanvasWidget('custom')}
      onGenerateCustomWidget={() => {
        const widget = createCustomCanvasWidget(customWidgetPrompt)
        if (!widget) return
        setCustomCanvasWidget(widget)
        setSelectedCanvasWidget('custom')
      }}
    />
  )

  const previewSuggestion = (widgetSpec: WidgetSpec = activeWidgetSpec) => {
    if (widgetSpec.type === 'camera-effects') {
      const result = studioToolRegistry.execute('studio.adjust_camera_effects', {
        mode: 'preview',
        settings: widgetSpec.props.settings,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (widgetSpec.type === 'visual-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_visual', {
        mode: 'preview',
        settings: widgetSpec.props.settings,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (widgetSpec.type === 'audio-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_audio', {
        mode: 'preview',
        settings: {
          microphoneGainDb: widgetSpec.props.microphoneGain,
          backgroundMusicGainDb: widgetSpec.props.backgroundMusicGain,
        },
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (widgetSpec.type === 'audience-poll') {
      const result = studioToolRegistry.execute('studio.configure_poll', {
        mode: 'preview',
        config: widgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (widgetSpec.type === 'live-goal') {
      const result = studioToolRegistry.execute('studio.configure_live_goal', {
        mode: 'preview',
        config: widgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    setLiveAdjustment(getWidgetAdjustment(widgetSpec, 'preview'))
    setIsSuggestionPreview(true)
  }

  const scheduleComponentRemoval = (
    componentId: string | undefined,
    suggestion: QueuedSuggestion | null,
    widgetIndex: number,
  ) => {
    if (!componentId) return

    if (suggestion?.source === 'monitor' && suggestion.widgets.length === 1) {
      dismissedSignalIdsRef.current.add(suggestion.signalId)
    }
    if (suggestion) {
      setHiddenSuggestionIds((current) =>
        new Set(current).add(suggestion.queueId),
      )
    }
    const existingTimeout = removalTimeoutsRef.current.get(componentId)
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout)
    }
    const timeoutId = window.setTimeout(() => {
      if (suggestion) {
        setSuggestionQueue((queue) =>
          removeSuggestionWidget(queue, suggestion.queueId, widgetIndex),
        )
      } else {
        setAgentWidgetSpec(null)
      }
      setApplied(false)
      setIsSuggestionPreview(false)
      removalTimeoutsRef.current.delete(componentId)
    }, 320)
    removalTimeoutsRef.current.set(componentId, timeoutId)
  }

  const resetSuggestionPreview = (widgetSpec: WidgetSpec) => {
    const resetTool = {
      'camera-effects': 'studio.reset_camera_effects_preview',
      'visual-adjustment': 'studio.reset_visual_preview',
      'audience-poll': 'studio.reset_poll_preview',
      'audio-adjustment': 'studio.reset_audio_preview',
      'live-goal': 'studio.reset_live_goal_preview',
    }[widgetSpec.type] as Parameters<typeof studioToolRegistry.execute>[0]
    studioToolRegistry.execute(resetTool, {}, studioToolContext)
    setApplied(false)
    setIsSuggestionPreview(false)
    setLiveAdjustment(null)
  }

  const updateChatWidget = (
    messageIndex: number,
    widgetIndex: number,
    nextWidget: WidgetSpec,
  ) => {
    setChatMessages((messages) =>
      messages.map((message, index) => index === messageIndex
        ? {
            ...message,
            widgets: (message.widgets ?? []).map((widget, currentIndex) =>
              currentIndex === widgetIndex ? nextWidget : widget,
            ),
          }
        : message,
      ),
    )
    setAgentWidgetSpec(nextWidget)
  }

  const updateSuggestionWidget = (
    suggestionId: string,
    widgetIndex: number,
    nextWidget: WidgetSpec,
  ) => {
    setSuggestionQueue((queue) => {
      const nextQueue = queue.map((suggestion) =>
        suggestion.queueId === suggestionId
          ? {
              ...suggestion,
              widgets: suggestion.widgets.map((widget, index) =>
                index === widgetIndex ? nextWidget : widget,
              ),
            }
          : suggestion,
      )
      suggestionQueueRef.current = nextQueue
      return nextQueue
    })
  }

  const refreshChatWidget = (
    messageIndex: number,
    widgetIndex: number,
    widgetSpec: WidgetSpec,
  ) => {
    resetSuggestionPreview(widgetSpec)
    updateChatWidget(
      messageIndex,
      widgetIndex,
      getAlternativeWidgetSpec(widgetSpec),
    )
  }

  const refreshSuggestionWidget = (
    suggestionId: string,
    widgetIndex: number,
    widgetSpec: WidgetSpec,
  ) => {
    resetSuggestionPreview(widgetSpec)
    updateSuggestionWidget(
      suggestionId,
      widgetIndex,
      getAlternativeWidgetSpec(widgetSpec),
    )
  }

  const scheduleAtomicRemoval = (
    componentKey: string,
    suggestionId: string | null = null,
  ) => {
    if (suggestionId) {
      setHiddenSuggestionIds((current) => new Set(current).add(suggestionId))
    }
    setRemovingAtomicComponents((current) => new Set(current).add(componentKey))
    window.setTimeout(() => {
      setDismissedAtomicComponents((current) => new Set(current).add(componentKey))
      setRemovingAtomicComponents((current) => {
        const next = new Set(current)
        next.delete(componentKey)
        return next
      })
    }, 320)
  }

  const beginStrategyRecovery = (
    suggestion: QueuedSuggestion | null,
  ): boolean => {
    if (
      view !== 'live' ||
      strategyWarmupActive ||
      strategyCommentState !== 'issue' ||
      demoStrategy === 'normal' ||
      !suggestion ||
      !doesSuggestionResolveStrategy(demoStrategy, suggestion.signalId)
    ) {
      return false
    }

    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
    }
    setStrategyCommentState('recovery')
    strategyRecoveryTimeoutRef.current = window.setTimeout(() => {
      setStrategyCommentState('normal')
      strategyRecoveryTimeoutRef.current = null
    }, studioRuntimeConfig.audience.strategyRecoveryDurationMs)
    return true
  }

  const applySuggestion = (
    widgetSpec: WidgetSpec = activeWidgetSpec,
    suggestion: QueuedSuggestion | null = null,
    componentId?: string,
    widgetIndex = -1,
  ) => {
    startWidgetSuggestionCooldown(
      widgetSuggestionCooldownsRef.current,
      getWidgetUiType(widgetSpec.type),
    )
    beginStrategyRecovery(suggestion)
    setApplied(true)
    const finishApplication = () => {
      setIsSuggestionPreview(false)
      scheduleComponentRemoval(componentId, suggestion, widgetIndex)
    }
    if (widgetSpec.type === 'camera-effects') {
      const result = studioToolRegistry.execute('studio.adjust_camera_effects', {
        mode: 'apply',
        settings: useStudioStore.getState().cameraEffects,
      }, studioToolContext)
      setLiveAdjustment(result)
      finishApplication()
      return
    }

    if (widgetSpec.type === 'visual-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_visual', {
        mode: 'apply',
        settings: useStudioStore.getState().visualSettings,
      }, studioToolContext)
      setLiveAdjustment(result)
      finishApplication()
      return
    }

    if (widgetSpec.type === 'audio-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_audio', {
        mode: 'apply',
        settings: useStudioStore.getState().audioSettings,
      }, studioToolContext)
      setLiveAdjustment(result)
      finishApplication()
      return
    }

    if (widgetSpec.type === 'audience-poll') {
      const result = studioToolRegistry.execute('studio.configure_poll', {
        mode: 'apply',
        config: widgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      finishApplication()
      return
    }

    if (widgetSpec.type === 'live-goal') {
      const result = studioToolRegistry.execute('studio.configure_live_goal', {
        mode: 'apply',
        config: widgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      finishApplication()
      return
    }

    setLiveAdjustment(getWidgetAdjustment(widgetSpec, 'apply'))
    finishApplication()
  }

  const completePreliveTask = () => {
    if (exitingPreliveTask) return

    const task = preliveTasks[preliveTaskIndex]
    if (task.id === 'layout') {
      setPreviewMode(preliveLayout === 'stage' ? 'studio' : 'mobile')
    } else if (task.id === 'visual') {
      studioToolRegistry.execute('studio.adjust_visual', {
        mode: 'apply',
        settings: useStudioStore.getState().visualSettings,
      }, studioToolContext)
      studioToolRegistry.execute('studio.adjust_audio', {
        mode: 'apply',
        settings: useStudioStore.getState().audioSettings,
      }, studioToolContext)
    }

    const completed = new Set(completedPreliveTasks)
    completed.add(task.id)
    setCompletedPreliveTasks(Array.from(completed))
    setApplied(true)
    setCanvasNotice({
      name: `${task.title}已保存`,
      detail: '配置已同步到本场直播方案。',
    })

    setExitingPreliveTask(task.id)
    window.setTimeout(() => {
      const nextIndex = preliveTasks.findIndex(
        (candidate) => !completed.has(candidate.id),
      )
      if (nextIndex >= 0) setPreliveTaskIndex(nextIndex)
      if (completed.size === preliveTasks.length && !isEditingLiveSettings) {
        setShowGoliveReadyDialog(true)
      }
      setExitingPreliveTask(null)
    }, 220)
  }

  const skipPreliveTask = () => {
    const nextIndex = Array.from(
      { length: preliveTasks.length - 1 },
      (_, offset) => (preliveTaskIndex + offset + 1) % preliveTasks.length,
    ).find((index) => !completedPreliveTasks.includes(preliveTasks[index].id))
    if (nextIndex !== undefined) setPreliveTaskIndex(nextIndex)
  }

  const sendHostComment = (text: string) => {
    const occurredAt = Date.now()
    setHostComments((prev) => [
      ...prev,
      {
        id: `viewer-comment-${occurredAt}-${prev.length}`,
        type: 'comment',
        userName: '模拟观众',
        text,
        source: 'viewer',
        analysis: analyzeAudienceComment(text),
        occurredAt,
      },
    ])
    setNormalAiActivity('queued')
  }

  const startLiveFromPrelive = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const lastConfig: LastLiveConfig = {
      theme: streamType,
      themeName: getStreamTheme(streamType).name,
      lastLiveTime: new Date().toISOString(),
      savedConfig: {
        topic: streamTopic,
        isChatCompanion,
        layout: preliveLayout,
        chatTextEnabled,
        chatTextValue: chatTextValue,
        chatGoalEnabled,
        chatGoalKind,
        chatGoalTitle,
        chatGoalTarget,
        chatTextStyle,
        chatTextOffset,
        chatGoalOffset,
        gameCameraOffset,
        musicBackgroundId,
        completedTaskIds: completedPreliveTasks,
      },
    }
    saveLastLiveConfig(lastConfig)
    setLastLiveConfig(lastConfig)
    preliveVisualSettingsRef.current =
      useStudioStore.getState().committedVisualSettings
    preliveAudioSettingsRef.current =
      useStudioStore.getState().committedAudioSettings
    preliveSceneRef.current = scene
    setShowGoliveReadyDialog(false)
    setIsEditingLiveSettings(false)
    setLiveTick(0)
    setAudienceTick(0)
    const startedAt = Math.round(performance.timeOrigin + event.timeStamp)
    setLiveStartedAt(startedAt)
    setLatestAudienceCommentAt(startedAt)
    liveSessionMetricsRef.current =
      createLiveSessionMetricsAccumulator(mediaMetrics)
    setStrategyWarmupComplete(false)
    setDemoStrategy('normal')
    setStrategyCommentState('normal')
    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
      strategyRecoveryTimeoutRef.current = null
    }
    setScene(selectedStrategy.scene)
    setIsPk(selectedStrategy.scene === 'pk')
    setSuggestionQueue([])
    setHostComments([])
    setAudienceCommentHistory(
      mockAudienceEventAdapter.getStrategySnapshot(
        'normal',
        applied,
        0,
        'issue',
        startedAt,
        0,
        startedAt,
      ).comments,
    )
    setNormalAiActivity('idle')
    setHiddenSuggestionIds(new Set())
    setIsGenieChatOpen(false)
    setDismissedAtomicComponents(new Set())
    setRemovingAtomicComponents(new Set())
    removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current.clear()
    dismissedSignalIdsRef.current.clear()
    widgetSuggestionCooldownsRef.current.clear()
    lastMetricUpdateAtRef.current = 0
    previousDiagnosticsRef.current = null
    strategyActivatedRef.current = false
    setApplied(false)
    setPreviewingWidgetKey(null)
    setAppliedWidgetKeys(new Set())
    previewingWidgetSpecRef.current = null
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setLiveComponentOffsets(defaultLiveComponentOffsets)
    setLiveStageMode('preview')
    setDisplayDiagnostics(diagnostics)
    setView('live')
  }

  const openLiveSettings = () => {
    setStrategyMenuOpen(false)
    setShowGoliveReadyDialog(false)
    setShowEndLiveConfirm(false)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setIsGenieChatOpen(false)
    setIsEditingLiveSettings(true)
  }

  const closeLiveSettings = () => {
    setShowGoliveReadyDialog(false)
    setIsEditingLiveSettings(false)
  }

  const undoSuggestion = (widgetSpec: WidgetSpec = activeWidgetSpec) => {
    if (widgetSpec.type === 'camera-effects') {
      const result = studioToolRegistry.execute('studio.undo_camera_effects', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (widgetSpec.type === 'visual-adjustment') {
      const result = studioToolRegistry.execute('studio.undo_visual', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (widgetSpec.type === 'audio-adjustment') {
      const result = studioToolRegistry.execute('studio.undo_audio', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (widgetSpec.type === 'audience-poll') {
      const result = studioToolRegistry.execute('studio.undo_poll', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (widgetSpec.type === 'live-goal') {
      const result = studioToolRegistry.execute('studio.undo_live_goal', {}, studioToolContext)
      setLiveAdjustment(result)
    } else {
      setLiveAdjustment(null)
    }
    setApplied(false)
    setIsSuggestionPreview(false)
  }

  const previewWidget = (widgetKey: string, widgetSpec: WidgetSpec) => {
    const activePreview = previewingWidgetSpecRef.current
    if (activePreview && previewingWidgetKey !== widgetKey) {
      resetSuggestionPreview(activePreview)
    }
    previewingWidgetSpecRef.current = widgetSpec
    setPreviewingWidgetKey(widgetKey)
    setAppliedWidgetKeys((current) => {
      const next = new Set(current)
      next.delete(widgetKey)
      return next
    })
    previewSuggestion(widgetSpec)
  }

  const applyWidget = (
    widgetKey: string,
    widgetSpec: WidgetSpec,
    suggestion: QueuedSuggestion | null = null,
    componentId?: string,
    widgetIndex = -1,
  ) => {
    applySuggestion(widgetSpec, suggestion, componentId, widgetIndex)
    setAppliedWidgetKeys((current) => new Set(current).add(widgetKey))
    setPreviewingWidgetKey(null)
    previewingWidgetSpecRef.current = null
  }

  const undoWidget = (widgetKey: string, widgetSpec: WidgetSpec) => {
    undoSuggestion(widgetSpec)
    setAppliedWidgetKeys((current) => {
      const next = new Set(current)
      next.delete(widgetKey)
      return next
    })
    if (previewingWidgetKey === widgetKey) {
      setPreviewingWidgetKey(null)
      previewingWidgetSpecRef.current = null
    }
  }

  const editWidget = (
    widgetKey: string,
    currentWidget: WidgetSpec,
    nextWidget: WidgetSpec,
    update: (widget: WidgetSpec) => void,
  ) => {
    if (previewingWidgetKey === widgetKey) {
      resetSuggestionPreview(currentWidget)
      setPreviewingWidgetKey(null)
      previewingWidgetSpecRef.current = null
    }
    update(nextWidget)
  }

  const resetWidgetInteraction = (widgetKey: string) => {
    setAppliedWidgetKeys((current) => {
      if (!current.has(widgetKey)) return current
      const next = new Set(current)
      next.delete(widgetKey)
      return next
    })
    if (previewingWidgetKey === widgetKey) {
      setPreviewingWidgetKey(null)
      previewingWidgetSpecRef.current = null
    }
  }

  const updateVisualPreview = (property: keyof VisualSettings, percentage: number) => {
    const currentSettings = useStudioStore.getState().visualSettings
    const value = property === 'warmth' ? percentage / 100 : 1 + percentage / 100
    const result = studioToolRegistry.execute('studio.adjust_visual', {
      mode: 'preview',
      settings: {
        ...currentSettings,
        [property]: value,
      },
    }, studioToolContext)
    setLiveAdjustment(result)
    setIsSuggestionPreview(true)
  }

  const updateAudioPreview = (property: keyof AudioSettings, value: number) => {
    const currentSettings = useStudioStore.getState().audioSettings
    const result = studioToolRegistry.execute('studio.adjust_audio', {
      mode: 'preview',
      settings: {
        ...currentSettings,
        [property]: value,
      },
    }, studioToolContext)
    setLiveAdjustment(result)
    setIsSuggestionPreview(true)
  }

  const updateCameraEffectsPreview = (settings: CameraEffects) => {
    const result = studioToolRegistry.execute('studio.adjust_camera_effects', {
      mode: 'preview',
      settings,
    }, studioToolContext)
    setLiveAdjustment(result)
    setIsSuggestionPreview(true)
  }

  const updateWidgetPreview = (
    widgetKey: string,
    widgetSpec: WidgetSpec,
    update: () => void,
  ) => {
    if (
      previewingWidgetKey !== widgetKey &&
      previewingWidgetSpecRef.current !== widgetSpec
    ) {
      previewWidget(widgetKey, widgetSpec)
    }
    update()
  }

  const openCameraEffects = () => {
    studioToolRegistry.execute('studio.reset_camera_effects_preview', {}, studioToolContext)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setIsGenieChatOpen(false)
    setBeautyToolSpec(getCameraEffectsWidgetSpec())
    setApplied(false)
    setIsSuggestionPreview(false)
    setLiveAdjustment(null)
    window.setTimeout(() => {
      beautyToolCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, 0)
  }

  const togglePollWidget = () => {
    if (pollStatus !== 'hidden') {
      hidePoll()
      return
    }
    const spec = getSceneWidgetSpec('interaction')
    if (spec.type !== 'audience-poll') return
    studioToolRegistry.execute('studio.configure_poll', {
      mode: 'preview',
      config: spec.props,
    }, studioToolContext)
  }

  const toggleBackgroundMusic = () => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.close()
      backgroundMusicRef.current = null
      setIsBackgroundMusicPlaying(false)
      return
    }

    try {
      backgroundMusicRef.current = createBackgroundMusicPlayer(backgroundMusicGainDb)
      setBackgroundMusicError('')
      setIsBackgroundMusicPlaying(true)
    } catch {
      setBackgroundMusicError('浏览器无法启动背景音乐，请检查音频输出设备。')
    }
  }

  const runGenieRequest = async (
    request: GenieRequest,
    appendQuestion: boolean,
  ) => {
    const controller = new AbortController()
    genieAbortRef.current = controller
    lastGenieRequestRef.current = request
    if (appendQuestion) {
      setChatMessages((messages) => [...messages, { role: 'user', text: request.question }])
      setGenieInput('')
    }
    setGenieError('')
    setGenieRequestStatus('loading')

    try {
      const studioState = useStudioStore.getState()
      const result = await askGenie(request.prompt, {
        signal: controller.signal,
        instruction: request.question,
        imageDataUrl: request.imageDataUrl,
        cameraEffects: studioState.cameraEffects,
        recommendedCameraEffects: recommendCameraEffects(
          studioState.cameraEffects,
          studioState.mediaMetrics.brightness.score,
        ),
      })
      if (genieAbortRef.current !== controller) return
      const broadRequest = /优化|检查|看看|建议|问题|调整一下/.test(
        request.question,
      )
      const analyzedComponents = result.widget
        ? []
        : recallAtomicComponents({
          source: 'input',
          text: `${request.question}\n${result.text}`,
          signalIds: broadRequest
            ? latestDiagnosticsRef.current.improvements
              .filter((signal) => signal.tone !== 'good')
              .map((signal) => signal.id)
            : undefined,
        }).componentIds
      const generatedWidgets = view !== 'onboarding' && result.widget
        ? [result.widget]
        : []
      setChatMessages((messages) => [
        ...messages,
        {
          role: 'assistant',
          text: result.text || '已生成可操作方案。',
          atomicComponentIds: analyzedComponents,
          widgets: generatedWidgets,
        },
      ])
      setDismissedAtomicComponents((current) => {
        const next = new Set(current)
        analyzedComponents.forEach((id) => next.delete(`input-${id}`))
        return next
      })
      if (view !== 'onboarding' && result.widget) {
        setAgentWidgetSpec(result.widget)
        setApplied(false)
        setIsSuggestionPreview(false)
        setLiveAdjustment(null)
      }
      setGenieRequestStatus('idle')
    } catch (error) {
      if (genieAbortRef.current !== controller) return
      if (!(error instanceof GenieRequestError && error.code === 'cancelled')) {
        const fallbackComponents = recallAtomicComponents({
          source: 'input',
          text: request.question,
          signalIds: latestDiagnosticsRef.current.improvements
            .filter((signal) => signal.tone !== 'good')
            .map((signal) => signal.id),
        }).componentIds
        const componentNames = fallbackComponents
          .slice(0, 3)
          .map((componentId) => atomicComponentRegistry[componentId].name)
        const fallbackText = componentNames.length > 0
          ? `我已根据你的需求召回${componentNames.join('、')}组件。可以先预览整体变化，确认效果后再应用到直播画面。`
          : '我已记录你的需求。当前没有必须调整的项目，建议继续观察画面、声音和互动数据。'
        setChatMessages((messages) => [
          ...messages,
          {
            role: 'assistant',
            text: fallbackText,
            atomicComponentIds: fallbackComponents,
          },
        ])
        setGenieError('')
        setGenieRequestStatus('idle')
        return
      }
      setGenieError(error instanceof Error ? error.message : 'Genie 暂时无法响应。')
      setGenieRequestStatus(
        error instanceof GenieRequestError
          ? error.code
          : 'error',
      )
    } finally {
      if (genieAbortRef.current === controller) {
        genieAbortRef.current = null
      }
    }
  }

  const handleGenieSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = genieInput.trim()
    if (!question || genieRequestStatus === 'loading') return
    setShowClearChatConfirm(false)
    setIsGenieChatOpen(true)
    setApplied(false)

    const context = view === 'prelive'
      ? '当前处于开播准备阶段，直播主题是晚间唱歌聊天。'
      : `当前处于直播中，诊断场景是${sceneCopy[scene].title}。`
    const studioState = useStudioStore.getState()
    const imageDataUrl = captureStudioFrame(videoRef)
    const conversationContext = chatMessages
      .slice(-8)
      .map((message) =>
        `${message.role === 'user' ? '主播' : 'Genie'}：${message.text}`,
      )
      .join('\n')
    const cameraContext = [
      `当前画面亮度：${studioState.mediaMetrics.brightness.value}，评分 ${studioState.mediaMetrics.brightness.score}/100。`,
      `当前人脸构图：${studioState.mediaMetrics.framing.value}，评分 ${studioState.mediaMetrics.framing.score}/100。`,
      `当前人像效果参数：${JSON.stringify({
        ...studioState.cameraEffects,
        backgroundImageUrl: studioState.cameraEffects.backgroundImageUrl ? 'local-image' : null,
      })}`,
      imageDataUrl
        ? '已附加当前直播画面帧，请将画面观察作为组件召回依据。'
        : '当前无法采集画面帧，请依据实时画面指标判断，不要假设未提供的视觉信息。',
      '涉及美颜、美妆或道具时必须返回 camera-effects 组件。settings 只需返回要修改的字段，未提及字段保持当前值。',
      '可用道具仅限 none、sparkles、glasses、heart-sticker；不要生成图片 URL 或未注册的效果。',
    ].join('\n')
    const prompt = [
      '你是 LIVE Studio Genie，一名专业、简洁的中文直播间助手。',
      context,
      cameraContext,
      '请同时分析随请求附带的当前直播画面，再结合实时指标回答主播的问题。',
      '只召回与主播问题和当前画面确实相关的组件；不要仅凭关键词生成无关组件。',
      '正文只使用自然、完整的中文表达，不得展示参数名、变量名、JSON、协议标签或系统内部标识。',
      latestNormalAiSuggestionRef.current
        ? `最近一次后台分析参考：${latestNormalAiSuggestionRef.current.action}`
        : '当前没有额外的后台分析结论。',
      conversationContext
        ? `最近对话记录：\n${conversationContext}`
        : '当前是本轮对话的第一条消息。',
      '给出可直接执行的建议，保持在 120 个汉字以内。',
      widgetProtocol,
      `主播问题：${question}`,
    ].join('\n')

    void runGenieRequest({
      question,
      prompt,
      imageDataUrl,
    }, true)
  }

  const cancelGenieRequest = () => {
    genieAbortRef.current?.abort()
  }

  const retryGenieRequest = () => {
    if (!lastGenieRequestRef.current || genieRequestStatus === 'loading') return
    void runGenieRequest(lastGenieRequestRef.current, false)
  }

  const runPostLiveRequest = async (
    report: PostLiveReport,
    question: string,
    mode: 'summary' | 'conversation',
    appendQuestion: boolean,
  ) => {
    postLiveAbortRef.current?.abort()
    const controller = new AbortController()
    postLiveAbortRef.current = controller
    lastPostLiveRequestRef.current = { report, question, mode }
    if (appendQuestion) {
      setPostLiveMessages((messages) => [...messages, { role: 'user', text: question }])
      setPostLiveInput('')
    }
    setPostLiveError('')
    setPostLiveRequestStatus('loading')

    try {
      const result = await askGenie(
        buildPostLiveAiPrompt(report, question),
        { signal: controller.signal, instruction: question },
      )
      if (postLiveAbortRef.current !== controller) return
      const response = result.text || createLocalPostLiveSummary(report)
      if (mode === 'summary') {
        setPostLiveAiSummary(response)
      } else {
        setPostLiveMessages((messages) => [
          ...messages,
          { role: 'assistant', text: response },
        ])
      }
      setPostLiveRequestStatus('idle')
    } catch (error) {
      if (postLiveAbortRef.current !== controller) return
      setPostLiveError(
        error instanceof GenieRequestError
          ? error.message
          : 'AI 深度复盘暂不可用，已保留本地数据建议。',
      )
      setPostLiveRequestStatus(
        error instanceof GenieRequestError ? error.code : 'error',
      )
    } finally {
      if (postLiveAbortRef.current === controller) {
        postLiveAbortRef.current = null
      }
    }
  }

  const confirmEndLive = (event: ReactMouseEvent<HTMLButtonElement>) => {
    completeLiveGoal()
    const endedAt = Math.round(performance.timeOrigin + event.timeStamp)
    const elapsedSeconds = liveStartedAt > 0
      ? Math.round((endedAt - liveStartedAt) / 1000)
      : liveTick
    const report = createPostLiveReport({
      topic: streamTopic,
      streamType,
      strategyId: demoStrategy,
      strategyLabel: selectedStrategy.label,
      durationSeconds: Math.max(liveTick, elapsedSeconds),
      audience: audienceSnapshot,
      appliedSuggestionCount: suggestionQueue.filter(
        (suggestion) => suggestion.widgets.length === 0,
      ).length,
      monitoring: summarizeLiveSessionMetrics(
        liveSessionMetricsRef.current,
      ),
    })

    setPostLiveReport(report)
    setPostLiveAiSummary(createLocalPostLiveSummary(report))
    setPostLiveMessages([])
    setPostLiveInput('')
    setShowEndLiveConfirm(false)
    setIsEditingLiveSettings(false)
    setIsPk(false)
    stopScreenShare()
    hidePoll()
    backgroundMusicRef.current?.close()
    backgroundMusicRef.current = null
    setIsBackgroundMusicPlaying(false)
    audioProcessorRef.current?.close()
    audioProcessorRef.current = null
    setProcessedAudioStream(null)
    setMediaStream((currentStream) => {
      stopMediaStream(currentStream)
      return null
    })
    setCameraEnabled(false)
    cameraAttemptedRef.current = false
    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
      strategyRecoveryTimeoutRef.current = null
    }
    setView('postlive')
    void runPostLiveRequest(
      report,
      '请总结本场直播表现，并给出下一场最值得执行的三个优化动作。',
      'summary',
      false,
    )
  }

  const handlePostLiveSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = postLiveInput.trim()
    if (!postLiveReport || !question || postLiveRequestStatus === 'loading') return
    void runPostLiveRequest(postLiveReport, question, 'conversation', true)
  }

  const cancelPostLiveRequest = () => {
    postLiveAbortRef.current?.abort()
  }

  const retryPostLiveRequest = () => {
    const request = lastPostLiveRequestRef.current
    if (!request || postLiveRequestStatus === 'loading') return
    void runPostLiveRequest(request.report, request.question, request.mode, false)
  }

  const leavePostLive = (nextView: 'onboarding' | 'prelive') => {
    postLiveAbortRef.current?.abort()
    setPostLiveRequestStatus('idle')
    setPostLiveError('')
    setPostLiveReport(null)
    setPostLiveMessages([])
    setPostLiveInput('')
    setShowGoliveReadyDialog(false)
    setIsEditingLiveSettings(false)
    setIsGenieChatOpen(false)
    cameraAttemptedRef.current = false
    setView(nextView)
  }

  const clearGenieHistory = () => {
    genieAbortRef.current?.abort()
    genieAbortRef.current = null
    lastGenieRequestRef.current = null
    clearGenieChatSession()
    setChatMessages([])
    setAgentWidgetSpec(null)
    setGenieInput('')
    setGenieError('')
    setGenieRequestStatus('idle')
    setApplied(false)
    setIsSuggestionPreview(false)
    setPreviewingWidgetKey(null)
    setAppliedWidgetKeys(new Set())
    previewingWidgetSpecRef.current = null
    setShowClearChatConfirm(false)
  }

  const renderGenieChatPanel = () => (
    <>
      <div className="live-genie-heading">
        <span><i />GENIE · CHAT</span>
        <div className="genie-chat-heading-actions">
          {(chatMessages.length > 0 ||
            inputAtomicComponents.length > 0 ||
            chatWidgetSpecs.length > 0) && (
            <button
              type="button"
              className="genie-chat-clear"
              aria-label="清空历史记录"
              title="清空历史记录"
              onClick={() => setShowClearChatConfirm(true)}
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            type="button"
            className="genie-chat-back"
            aria-label="返回当前工作台"
            title="返回当前工作台"
            onClick={() => {
              setShowClearChatConfirm(false)
              setIsGenieChatOpen(false)
            }}
          >
            <ArrowLeft size={13} />
            返回
          </button>
        </div>
      </div>
      <div className="live-right-rail-view mode-chat">
        {showClearChatConfirm && (
          <div
            className="genie-chat-clear-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-chat-title"
          >
            <div>
              <Trash2 size={17} />
              <b id="clear-chat-title">清空当前对话？</b>
              <p>所有历史消息和已召回组件都会被移除。</p>
            </div>
            <footer>
              <button
                type="button"
                onClick={() => setShowClearChatConfirm(false)}
              >
                取消
              </button>
              <button type="button" onClick={clearGenieHistory}>
                确认清空
              </button>
            </footer>
          </div>
        )}
        <section className="genie-chat-shell" aria-label="Genie 聊天">
          <div className="genie-chat-body">
            <div className="genie-chat-thread" aria-live="polite">
              {chatMessages.length === 0 && (
                <div className="genie-chat-intro">
                  <MessageCircle size={18} />
                  <b>描述你想调整的直播效果</b>
                  <small>发送后，Genie 会结合 Prompt 和当前直播画面召回组件。</small>
                </div>
              )}
              {chatMessages.map((message, messageIndex) => {
                const atomicComponents = message.atomicComponentIds ?? []
                const widgets = message.widgets ?? []
                const componentCount = atomicComponents.length + widgets.length
                return (
                  <article
                    key={`${message.role}-${messageIndex}`}
                    className={[
                      'chat-message',
                      message.role,
                      componentCount > 0
                        ? 'genie-chat-component-message'
                        : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="chat-message-meta">
                      <span>{message.role === 'assistant' ? 'Genie' : '你'}</span>
                      <small>{message.role === 'assistant' ? '直播助手' : '刚刚'}</small>
                    </div>
                    <p>{message.text}</p>
                    {componentCount > 0 && (
                      <div
                        className="genie-chat-turn-components"
                        aria-label={`本轮生成的可操作组件，共 ${componentCount} 个`}
                      >
                        <small>本轮可操作组件 · {componentCount}</small>
                        <div className="recalled-component-list">
                          {atomicComponents.map((componentId, componentIndex) => (
                            <div
                              className="recalled-component-item"
                              key={`${messageIndex}-${componentId}-${componentIndex}`}
                            >
                              <AtomicRecallCard
                                componentId={componentId}
                                audience={audienceSnapshot}
                                onApplied={() => setApplied(true)}
                              />
                            </div>
                          ))}
                          {widgets.map((widgetSpec, widgetIndex) => {
                            const widgetKey =
                              `chat-${messageIndex}-${widgetIndex}`
                            return (
                              <div
                                className="recalled-component-item agent-recalled-component"
                                key={`${messageIndex}-${widgetSpec.type}-${widgetSpec.title}-${widgetIndex}`}
                              >
                                <WidgetRenderer
                                  spec={widgetSpec}
                                  applied={appliedWidgetKeys.has(widgetKey)}
                                  isPreviewing={previewingWidgetKey === widgetKey}
                                  onPreview={() => previewWidget(widgetKey, widgetSpec)}
                                  onApply={() => applyWidget(widgetKey, widgetSpec)}
                                  onUndo={() => undoWidget(widgetKey, widgetSpec)}
                                  onRefresh={() => {
                                    refreshChatWidget(
                                      messageIndex,
                                      widgetIndex,
                                      widgetSpec,
                                    )
                                    resetWidgetInteraction(widgetKey)
                                  }}
                                  onSpecChange={(nextWidget) =>
                                    editWidget(
                                      widgetKey,
                                      widgetSpec,
                                      nextWidget,
                                      (updatedWidget) => updateChatWidget(
                                        messageIndex,
                                        widgetIndex,
                                        updatedWidget,
                                      ),
                                    )}
                                  onAudioChange={(property, value) =>
                                    updateWidgetPreview(
                                      widgetKey,
                                      widgetSpec,
                                      () => updateAudioPreview(property, value),
                                    )}
                                  onVisualChange={(property, value) =>
                                    updateWidgetPreview(
                                      widgetKey,
                                      widgetSpec,
                                      () => updateVisualPreview(property, value),
                                    )}
                                  onCameraEffectsChange={(settings) =>
                                    updateWidgetPreview(
                                      widgetKey,
                                      widgetSpec,
                                      () => updateCameraEffectsPreview(settings),
                                    )}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
              {genieRequestStatus === 'loading' && (
                <div className="genie-request-state is-loading" role="status">
                  <LoaderCircle size={14} className="loading-icon" />
                  <span>
                    {view === 'prelive'
                      ? 'Genie 正在分析开播准备…'
                      : 'Genie 正在分析直播状态…'}
                  </span>
                  <button type="button" onClick={cancelGenieRequest}>
                    <CircleStop size={13} />取消
                  </button>
                </div>
              )}
              {genieError && genieRequestStatus !== 'loading' && (
                <div className="genie-request-state is-error" role="alert">
                  <span>{genieError}</span>
                  <button type="button" onClick={retryGenieRequest}>
                    <RotateCcw size={13} />重试
                  </button>
                </div>
              )}
              <div ref={genieChatMessageEndRef} aria-hidden="true" />
            </div>
          </div>
        </section>
      </div>
    </>
  )

  if (view === 'onboarding') {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-aurora" />
        <div className="onboarding-stars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <header className="onboarding-header">
          <div className="onboarding-brand"><span><Music2 size={15} /></span><strong>TikTok LIVE Studio</strong></div>
          <div className="onboarding-status"><i />Genie · 灵感伙伴 <em>Beta</em></div>
        </header>
        <section className="welcome-card">
          <div className="genie-beacon" aria-hidden="true"><div><Sparkles size={26} fill="currentColor" /></div></div>
          <div className="welcome-title-row">
            <span className="eyebrow"><i />LIVE STUDIO GENIE</span>
            <h1>陪伴你的<span>直播旅程</span></h1>
          </div>
          <p className="onboarding-primary-prompt">今天想播什么？</p>
          <p className="onboarding-supporting-copy">告诉我，我来帮你准备。</p>
          <div className="recommended-theme-tags" role="list" aria-label="推荐直播方案">
            {STREAM_THEMES.filter((theme) => theme.id !== 'show').map((theme) => (
              <button
                type="button"
                key={theme.id}
                className="recommended-theme-tag"
                onClick={() => beginPrelive(theme.id)}
              >
                {themeIcon(theme.id)}{theme.name}
              </button>
            ))}
          </div>
          <form className="theme-input" onSubmit={(event) => { event.preventDefault(); submitOnboardingInput() }}>
            <WandSparkles size={17} />
            <input value={onboardingInput} onChange={(event) => setOnboardingInput(event.target.value)} placeholder="用一句话描述你今天的直播..." aria-label="本场主题" autoFocus />
            <button type="submit" aria-label="识别主题并开始准备" disabled={!onboardingInput.trim()}>开始准备 <ArrowLeft size={16} className="arrow-forward" /></button>
          </form>
          {lastLiveConfig && (
            <button type="button" className="history-restore-link" onClick={restoreLastLiveConfig}>
              <History size={13} />
              <span>沿用上次直播设置</span>
              <small>{lastLiveConfig.themeName}{lastLiveConfig.lastLiveTime ? ` · ${formatLastLiveTime(lastLiveConfig.lastLiveTime)}` : ''}</small>
            </button>
          )}
        </section>
      </main>
    )
  }

  if (view === 'postlive') {
    if (!postLiveReport) return null
    return (
      <PostLiveReview
        report={postLiveReport}
        aiSummary={postLiveAiSummary}
        messages={postLiveMessages}
        input={postLiveInput}
        requestStatus={postLiveRequestStatus}
        error={postLiveError}
        onInputChange={(value) => setPostLiveInput(value.slice(0, 500))}
        onSubmit={handlePostLiveSubmit}
        onCancel={cancelPostLiveRequest}
        onRetry={retryPostLiveRequest}
        onStartNext={() => leavePostLive('prelive')}
        onBackHome={() => leavePostLive('onboarding')}
      />
    )
  }

  return (
    <main className={`app-shell live-app ${isPreliveWorkspace ? 'prelive-live-mode' : ''}`}>
      {view === 'prelive' && showGoliveReadyDialog && (
        <section className="golive-overlay" aria-label="开播准备完成">
          <div
            className="golive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="golive-ready-title"
          >
            <button
              className="golive-dialog-close"
              type="button"
              aria-label="关闭开播提示"
              title="关闭"
              onClick={() => setShowGoliveReadyDialog(false)}
            >
              <X size={16} />
            </button>
            <Check className="golive-mark" size={48} strokeWidth={3} aria-hidden="true" />
            <strong id="golive-ready-title">准备进度100%</strong>
            <button
              className="golive-button"
              type="button"
              aria-label="开始直播"
              onClick={startLiveFromPrelive}
            >
              GO LIVE
            </button>
          </div>
        </section>
      )}
      <header className="topbar">
        <div className="live-brand">
          {isLiveWorkspace ? (
            <div className="strategy-selector" ref={strategySelectorRef}>
              <button
                className={`live-brand-mark strategy-trigger ${strategyMenuOpen ? 'active' : ''}`}
                type="button"
                aria-label={`典型场景：${selectedStrategy.label}`}
                aria-expanded={strategyMenuOpen}
                aria-haspopup="menu"
                title={`典型场景：${selectedStrategy.label}`}
                onClick={() => setStrategyMenuOpen((open) => !open)}
              >
                <Music2 size={17} />
                <i />
              </button>
              {strategyMenuOpen && (
                <div className="strategy-menu" role="menu" aria-label="选择典型场景">
                  <div className="strategy-menu-heading">
                    <span>典型场景</span>
                    <small>选择后同步模拟画面、指标、聊天、建议与组件</small>
                  </div>
                  {audienceSceneOptions.map((strategy) => (
                    <button
                      className={demoStrategy === strategy.id ? 'selected' : ''}
                      type="button"
                      role="menuitemradio"
                      aria-checked={demoStrategy === strategy.id}
                      key={strategy.id}
                      onClick={(event) => selectDemoStrategy(
                        strategy.id,
                        Math.round(performance.timeOrigin + event.timeStamp),
                      )}
                    >
                      <StrategyIcon strategyId={strategy.id} />
                      <span>
                        <b>{strategy.label}</b>
                        <small>{strategy.description}</small>
                      </span>
                      {demoStrategy === strategy.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="live-brand-mark" aria-hidden="true">
              <Music2 size={17} />
            </span>
          )}
          <strong>TikTok LIVE Studio</strong>
          <span className="live-brand-divider">/</span>
          <b>
            {isLiveSettingsWorkspace
              ? '直播中 · 设置'
              : view === 'prelive'
                ? '今日开播准备工作台'
                : '直播中'}
          </b>
          <span className="live-session-pill">
            <i />
            {view === 'prelive'
              ? `${getStreamTheme(streamType).name} · ${streamTopic}`
              : `直播中 · ${formatDuration(liveTick)}`}
          </span>
        </div>
        <div className="live-status-actions">
          {view === 'live' && (
            <button
              className="prelive-entry-button"
              type="button"
              onClick={isEditingLiveSettings
                ? closeLiveSettings
                : openLiveSettings}
            >
              <ArrowLeft size={14} />
              {isEditingLiveSettings ? '返回直播' : '直播前设置'}
            </button>
          )}
          <span className={`network-pill ${view === 'prelive' ? 'prelive-network' : ''}`}><i />{view === 'prelive' ? '预览已连接 · 延迟 42ms' : '推流稳定 · 延迟 42ms'}</span>
          <button className="notification-button" type="button" aria-label="通知">
            <Bell size={17} />
            {view === 'live' && <b>9</b>}
          </button>
        </div>
      </header>
      <section className="workspace">
        <aside className="monitor-panel panel">
          <LiveChatPanel
            isLive={view === 'live'}
            cameraEnabled={cameraEnabled}
            isMicMuted={isMicMuted}
            audience={audienceSnapshot}
            diagnostics={
              view === 'live'
                ? displayDiagnostics ?? diagnostics
                : undefined
            }
            hostComments={hostComments}
            onSendComment={sendHostComment}
          />
        </aside>

        <section className="stage-column">
          <div className="stage-toolbar">
            <div>
              <span className="stage-breadcrumb">
                {isLiveSettingsWorkspace
                  ? '直播中 · 设置'
                  : view === 'prelive'
                    ? '今日开播准备'
                    : isPk
                      ? '直播中 · PK 对战'
                      : '直播中'}
              </span>
              <h1>{isPreliveWorkspace ? streamTopic : '林小满的直播间'}</h1>
            </div>
            {isPreliveWorkspace ? (
              <button className="secondary-button" type="button" onClick={enableCamera}><Camera size={16} />连接设备</button>
            ) : (
              <div className="live-clock"><span /> LIVE&nbsp; {formatDuration(liveTick)}</div>
            )}
          </div>
          {isLiveWorkspace ? (
            <div className="live-stage-mode-switch" role="tablist" aria-label="直播画面模式">
              <button
                type="button"
                role="tab"
                aria-selected={liveStageMode === 'preview'}
                className={liveStageMode === 'preview' ? 'selected' : ''}
                onClick={() => {
                  setSelectedCanvasWidget(null)
                  setSelectedLiveComponent(null)
                  setLiveStageMode('preview')
                }}
              >
                <Eye size={14} />预览
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={liveStageMode === 'clean'}
                className={liveStageMode === 'clean' ? 'selected' : ''}
                onClick={() => setLiveStageMode('clean')}
              >
                <EyeOff size={14} />清屏
              </button>
            </div>
          ) : (
            <div className="preview-mode-switch" role="tablist" aria-label="预览模式">
              <button type="button" className={previewMode === 'mobile' ? 'selected' : ''} onClick={() => setPreviewMode('mobile')}>移动端预览</button>
              <button type="button" className={previewMode === 'studio' ? 'selected' : ''} onClick={() => setPreviewMode('studio')}>Studio 视图</button>
            </div>
          )}
          {canvasNotice && (
            <div className="task-save-notice" role="status">
              <Check size={15} />
              <div>
                <b>{canvasNotice.name}</b>
                <span>{canvasNotice.detail}</span>
              </div>
            </div>
          )}
          <LivePreview videoRef={videoRef} cameraEnabled={cameraEnabled} displayStream={displayStream} layoutEditing={isLayoutEditing && previewMode === 'studio'} isPk={isPk} applied={applied} scene={scene} strategy={view === 'live' && strategyCommentState === 'issue' ? demoStrategy : 'normal'} liveAdjustment={liveAdjustment} previewMode={previewMode} liveStageMode={liveStageMode} isPreviewing={isSuggestionPreview} audience={audienceSnapshot} isLive={isLiveWorkspace} preliveTitle={streamTopic} preliveLayout={preliveLayout} stageBackgroundUrl={stageBackgroundUrl} bandLayout={bandLayoutActive} gameLayout={gameLayout} gameCameraOffset={gameCameraOffset} onGameCameraOffsetChange={setGameCameraOffset} selectedLiveComponent={selectedLiveComponent} liveComponentOffsets={liveComponentOffsets} onLiveComponentOffsetChange={(component, offset) => setLiveComponentOffsets((current) => ({ ...current, [component]: offset }))} onSelectLiveComponent={selectLiveComponent} onDeleteLiveComponent={deleteLiveComponent} chatWidgets={canvasWidgetsAvailable ? {
            text: chatTextEnabled ? chatTextValue : '',
            goalVisible: chatGoalEnabled,
            goal: {
              label: liveGoalState.config?.label ?? chatGoalTitle,
              current: isLiveWorkspace ? liveGoalState.config?.current ?? 0 : 0,
              target: liveGoalState.config?.target ?? chatGoalTarget,
            },
            textStyle: chatTextStyle,
            selectedWidget: selectedCanvasWidget,
            onSelectWidget: selectCanvasWidget,
            textOffset: chatTextOffset,
            goalOffset: chatGoalOffset,
            onTextOffsetChange: setChatTextOffset,
            onGoalOffsetChange: setChatGoalOffset,
            onDeleteText: () => deleteCanvasWidget('text'),
            onDeleteGoal: () => deleteCanvasWidget('goal'),
            customWidget: customCanvasWidget,
            customWidgetOffset,
            onCustomWidgetOffsetChange: setCustomWidgetOffset,
            onDeleteCustomWidget: () => deleteCanvasWidget('custom'),
          } : null} />
          {(cameraError || displayError || backgroundMusicError) && <p className="camera-warning">{displayError || cameraError || backgroundMusicError}</p>}
          <div className="stage-controls">
            <button type="button" className="control-button" onClick={enableCamera}><Camera size={18} /><span>{cameraEnabled ? '摄像头已连接' : '开启摄像头'}</span></button>
            <button type="button" className={`control-button ${isMicMuted ? 'active-control' : ''}`} onClick={() => setIsMicMuted((muted) => !muted)}><Mic size={18} /><span>{isMicMuted ? '麦克风已静音' : '麦克风'}</span></button>
            <button type="button" className={`control-button ${isBackgroundMusicPlaying ? 'active-control' : ''}`} onClick={toggleBackgroundMusic}><Music2 size={18} /><span>{isBackgroundMusicPlaying ? '停止 BGM' : '播放 BGM'}</span></button>
            <button type="button" className={`control-button ${beautyToolSpec ? 'active-control' : ''}`} onClick={openCameraEffects}><WandSparkles size={18} /><span>美化工具</span></button>
            <button type="button" className={`control-button ${displayStream ? 'active-control' : ''}`} onClick={toggleScreenShare}><MonitorUp size={18} /><span>{displayStream ? '停止投屏' : '游戏投屏'}</span></button>
            <button type="button" className={`control-button ${isLayoutEditing ? 'active-control' : ''}`} disabled={!displayStream} onClick={() => setIsLayoutEditing((editing) => !editing)}><LayoutTemplate size={18} /><span>{isLayoutEditing ? '锁定布局' : '编辑布局'}</span></button>
            {displayStream && isLayoutEditing && <button type="button" className="control-button" onClick={resetCameraLayerLayout}><RotateCcw size={18} /><span>重置布局</span></button>}
            <button type="button" className={`control-button ${pollStatus !== 'hidden' ? 'active-control' : ''}`} onClick={togglePollWidget}><LayoutTemplate size={18} /><span>{pollStatus !== 'hidden' ? '隐藏组件' : '互动组件'}</span></button>
            {isLiveWorkspace && <button type="button" className={`pk-launch ${isPk ? 'active' : ''}`} onClick={() => changeScene(isPk ? 'quality' : 'pk')}><Users size={17} />{isPk ? '结束 PK' : '发起 PK'}</button>}
          </div>
          {(view === 'prelive' || view === 'live') && (
            <div className={`prelive-go-live-bar ${view === 'live' ? 'is-live-session' : ''}`}>
              <div>
                <b>
                  {view === 'live'
                    ? `直播进行中 · ${formatDuration(liveTick)}`
                    : `直播准备度 ${readyScore}%`}
                </b>
                <span>
                  {view === 'live'
                    ? isLiveSettingsWorkspace
                      ? '设置修改会同步到当前直播'
                      : '推流、监控和观众互动保持运行'
                    : readyScore === 100
                      ? '全部设置已就绪'
                      : `${completedPreliveTasks.length} / ${preliveTasks.length} 项已完成，可继续调整后开播`}
                </span>
              </div>
              <div className="score-track">
                <i style={{ width: `${view === 'live' ? 100 : readyScore}%` }} />
              </div>
              {view === 'live' ? (
                <Button
                  className="prelive-go-live-button end-live-bottom-button"
                  color="primary"
                  onClick={() => setShowEndLiveConfirm(true)}
                >
                  <CircleStop size={16} />结束直播
                </Button>
              ) : (
                <Button className="prelive-go-live-button" color="primary" onClick={startLiveFromPrelive}><Play size={16} fill="currentColor" />GO LIVE</Button>
              )}
            </div>
          )}
        </section>

        <aside className={`genie-panel panel mode-${liveRightRailMode}`}>
          {isGenieChatOpen ? (
            renderGenieChatPanel()
          ) : isLiveWorkspace ? (
            <>
              <div className="live-genie-heading">
                <span><i />GENIE · READY TO ASSIST</span>
                <div className="live-follow-status">
                  <b>
                    {liveRightRailMode === 'canvas-config'
                      ? '组件配置'
                      : `${visibleSuggestionQueue.length} 条建议`}
                  </b>
                  <span className="suggestion-sync-status">
                    <i />
                    {liveRightRailMode === 'canvas-config'
                      ? '上下文已同步'
                      : demoStrategy === 'normal'
                        ? {
                            idle: 'AI 每 5 秒后台分析',
                            queued: '新评论待分析',
                            analyzing: 'AI 正在分析评论',
                            updated: 'AI 已生成新建议',
                            'no-action': '评论已分析 · 暂无新建议',
                          }[normalAiActivity]
                        : '场景实时监测'}
                  </span>
                </div>
              </div>
              <div
                className={`live-right-rail-view mode-${liveRightRailMode}`}
                key={liveRightRailMode}
              >
              {liveRightRailMode === 'canvas-config' ? (
                <section className="live-canvas-widget-shell is-focused" aria-label="当前画布组件配置">
                  <div className="component-recall-heading">
                    <span><Target size={13} />当前画布组件</span>
                    <b>配置与画布选择已同步</b>
                    <button
                      type="button"
                      className="right-rail-back-button"
                      onClick={() => {
                        setSelectedCanvasWidget(null)
                        setSelectedLiveComponent(null)
                      }}
                    >
                      <ArrowLeft size={12} />
                      返回实时建议
                    </button>
                  </div>
                  {selectedLiveComponent ? (
                    <>
                      <AtomicRecallCard
                        componentId={selectedLiveComponent}
                        audience={audienceSnapshot}
                        onApplied={() => setApplied(true)}
                      />
                      <button
                        type="button"
                        className="live-component-delete-button"
                        onClick={() =>
                          deleteLiveComponent(selectedLiveComponent)}
                      >
                        <Trash2 size={13} />
                        从画面删除
                      </button>
                    </>
                  ) : renderCanvasWidgetPanel(selectedCanvasWidget)}
                </section>
              ) : (
                <>
              {liveRightRailMode === 'overview' && (
                <section className="generated-suggestions" aria-label="实时生成建议">
                <div className="generated-suggestions-title">
                  <div>
                    <span>改进建议</span>
                    <small>
                      {demoStrategy === 'normal'
                        ? 'AI 综合画面 · 指标 · 评论'
                        : '典型场景规则'}
                    </small>
                  </div>
                  {chatMessages.length > 0 && (
                    <button
                      type="button"
                      className="suggestion-history-button"
                      aria-label={`查看历史对话，共 ${chatMessages.length} 条消息`}
                      title="查看历史对话"
                      onClick={() => setIsGenieChatOpen(true)}
                    >
                      <History size={12} />
                      <span>历史对话</span>
                      <b>{chatMessages.length}</b>
                    </button>
                  )}
                </div>
                <div className="generated-suggestion-list" role="list">
                  {[...visibleSuggestionQueue].reverse().map((suggestion) => {
                    const presentation = getSuggestionPresentation(suggestion)
                    return (
                    <article
                      aria-label={`${suggestion.metric}，建议：${suggestion.action}`}
                      className={[
                        'generated-suggestion',
                        `tone-${suggestion.tone}`,
                        suggestion.isNew ? 'is-new' : '',
                        (atomicComponentCountsBySuggestion.get(suggestion.queueId) ?? 0) === 0
                          ? 'is-resolved'
                          : '',
                      ].filter(Boolean).join(' ')}
                      key={suggestion.queueId}
                      role="listitem"
                    >
                      <div className="suggestion-card-heading">
                        <b className="suggestion-action-title">{presentation.title}</b>
                        {suggestion.analysisSource === 'ai' && (
                          <span className="suggestion-ai-badge">AI 分析</span>
                        )}
                      </div>
                      <small className="suggestion-item-description">
                        {presentation.reason}
                      </small>
                    </article>
                    )
                  })}
                  {visibleSuggestionQueue.length === 0 && (
                    <div className="suggestion-empty-state" role="status">
                      <Check size={15} />
                      <span>暂无待处理建议</span>
                    </div>
                  )}
                </div>
              </section>
              )}
              {liveRightRailMode === 'overview' && <div className="live-section-divider" />}
              <section
                className="live-recommendations"
                aria-label="建议对应组件"
              >
                <div className="component-recall-heading">
                  <span><Zap size={13} />对应组件</span>
                  <b>全部建议的可操作组件</b>
                  <small>{liveComponentCount} 个待应用</small>
                </div>
                <div className="recalled-component-list">
                  {atomicRecalledComponents.map((component) => (
                    <div
                      className={`recalled-component-item ${removingAtomicComponents.has(component.key) ? 'is-removing' : ''}`}
                      key={component.key}
                    >
                      <AtomicRecallCard
                        componentId={component.componentId}
                        audience={audienceSnapshot}
                        onApplied={() => {
                          const suggestion = component.suggestionId
                            ? suggestionQueue.find(
                                (item) => item.queueId === component.suggestionId,
                              ) ?? null
                            : null
                          beginStrategyRecovery(suggestion)
                          setApplied(true)
                          scheduleAtomicRemoval(
                            component.key,
                            component.suggestionId,
                          )
                        }}
                      />
                    </div>
                  ))}
                  {liveRightRailMode === 'overview' &&
                    aiSuggestionComponents.map((component) => (
                      <div
                        className="recalled-component-item agent-recalled-component"
                        key={component.componentId}
                      >
                        <WidgetRenderer
                          spec={component.widgetSpec}
                          applied={appliedWidgetKeys.has(component.componentId)}
                          isPreviewing={
                            previewingWidgetKey === component.componentId
                          }
                          onPreview={() => previewWidget(
                            component.componentId,
                            component.widgetSpec,
                          )}
                          onApply={() => applyWidget(
                            component.componentId,
                            component.widgetSpec,
                            component.suggestion,
                            component.componentId,
                            component.widgetIndex,
                          )}
                          onUndo={() => undoWidget(
                            component.componentId,
                            component.widgetSpec,
                          )}
                          onRefresh={() => {
                            refreshSuggestionWidget(
                              component.suggestion.queueId,
                              component.widgetIndex,
                              component.widgetSpec,
                            )
                            resetWidgetInteraction(component.componentId)
                          }}
                          onSpecChange={(nextWidget) =>
                            editWidget(
                              component.componentId,
                              component.widgetSpec,
                              nextWidget,
                              (updatedWidget) => updateSuggestionWidget(
                                component.suggestion.queueId,
                                component.widgetIndex,
                                updatedWidget,
                              ),
                            )}
                          onAudioChange={(property, value) =>
                            updateWidgetPreview(
                              component.componentId,
                              component.widgetSpec,
                              () => updateAudioPreview(property, value),
                            )}
                          onVisualChange={(property, value) =>
                            updateWidgetPreview(
                              component.componentId,
                              component.widgetSpec,
                              () => updateVisualPreview(property, value),
                            )}
                          onCameraEffectsChange={(settings) =>
                            updateWidgetPreview(
                              component.componentId,
                              component.widgetSpec,
                              () => updateCameraEffectsPreview(settings),
                            )}
                        />
                      </div>
                    ))}
                  {liveRightRailMode === 'overview' && beautyToolSpec && (
                    <div
                      ref={beautyToolCardRef}
                      className="recalled-component-item agent-recalled-component"
                    >
                      <WidgetRenderer
                        spec={beautyToolSpec}
                        applied={false}
                        isPreviewing={isSuggestionPreview}
                        onPreview={() => previewSuggestion(beautyToolSpec)}
                        onApply={() => applySuggestion(beautyToolSpec)}
                        onUndo={() => undoSuggestion(beautyToolSpec)}
                        onRefresh={() => setBeautyToolSpec(getCameraEffectsWidgetSpec())}
                        onSpecChange={setBeautyToolSpec}
                        onAudioChange={updateAudioPreview}
                        onVisualChange={updateVisualPreview}
                        onCameraEffectsChange={updateCameraEffectsPreview}
                      />
                    </div>
                  )}
                  {liveComponentCount === 0 && (
                    <div className="component-empty-state">
                      <LayoutTemplate size={18} />
                      <span>暂无待应用组件</span>
                    </div>
                  )}
                </div>
              </section>
                </>
              )}
              </div>
            </>
          ) : (
            <>
              <div className="live-genie-heading">
                <span><i />GENIE · READY TO ASSIST</span>
                <b>{completedPreliveTasks.length} / {preliveTasks.length} 已就绪</b>
              </div>
              <section className="prelive-control-shell" aria-label="直播前准备任务">
                <div className="prelive-intent-summary">
                  <span>已根据直播主题生成准备方案</span>
                  <b>{streamTopic}</b>
                </div>
                <PreliveChecklist
                  compact
                  score={readyScore}
                  currentTask={preliveTasks[preliveTaskIndex].id}
                  completedTasks={completedPreliveTasks}
                  onSelect={setPreliveTaskIndex}
                />
                <div className="prelive-control-task">
                  {canvasWidgetsAvailable && selectedCanvasWidget && (
                    renderCanvasWidgetPanel(selectedCanvasWidget)
                  )}
                  {completedPreliveTasks.length === preliveTasks.length && !exitingPreliveTask ? (
                    <div className="prelive-tasks-complete" role="status">
                      <Check size={20} />
                      <b>全部准备任务已完成</b>
                      <span>所有配置已同步到本场直播方案</span>
                    </div>
                  ) : (
                    <div
                      ref={preliveTaskCardRef}
                      key={preliveTasks[preliveTaskIndex].id}
                      tabIndex={-1}
                      className={`prelive-task-transition ${exitingPreliveTask ? 'is-exiting' : 'is-entering'}`}
                    >
                      <PreliveTaskCard
                      task={preliveTasks[preliveTaskIndex]}
                      completed={false}
                      layout={preliveLayout}
                      streamType={streamType}
                      title={streamTopic}
                      titleRecommendations={titleRecommendations}
                      script={preliveScript}
                      hostBio={preliveHostBio}
                      customChatTopic={customChatTopic}
                      isChatCompanion={isChatCompanion}
                      canvasWidgetPanel={
                        canvasWidgetsAvailable && preliveTasks[preliveTaskIndex].id === 'widgets'
                          ? renderCanvasWidgetPanel(null)
                          : null
                      }
                      musicBackgroundId={musicBackgroundId}
                      customStageBackgroundUrl={customStageBackground}
                      stageBackgroundUploadError={stageBackgroundUploadError}
                      onSelectStageBackground={selectStageBackground}
                      onUploadStageBackground={uploadStageBackground}
                      onLayoutChange={(layout) => {
                        setPreliveLayout(layout)
                        setPreviewMode(getPreviewModeForLayout(layout))
                      }}
                      onCameraEffectsChange={applyCameraEffects}
                      onTitleChange={setStreamTopic}
                      onScriptChange={setPreliveScript}
                      onHostBioChange={setPreliveHostBio}
                      onCustomChatTopicChange={(topic) => {
                        setCustomChatTopic(topic)
                        setPreliveScript('')
                      }}
                      onGenerateCustomChatTopic={(topic) => {
                        const recommendation = getCustomTopicRecommendation(topic)
                        if (!recommendation) return
                        setPreliveScript(recommendation.script)
                        setStreamTopic(getLiveTitleRecommendations(streamType, topic || titleRecommendationContext)[0])
                      }}
                      coverApplied={preliveCoverApplied}
                      onCoverAppliedChange={setPreliveCoverApplied}
                      onVisualChange={updateVisualPreview}
                      onAudioChange={updateAudioPreview}
                      onApply={completePreliveTask}
                      onSkip={skipPreliveTask}
                      />
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          <form
            className="genie-composer"
            ref={genieComposerRef}
            onSubmit={handleGenieSubmit}
          >
            <div className="composer-field">
              <input
                value={genieInput}
                onChange={(event) => setGenieInput(event.target.value)}
                placeholder="问 Genie：帮我调整一下…"
                aria-label="向 Genie 提问"
              />
              <span>{genieRequestStatus === 'loading' ? '正在生成建议' : 'Enter 发送'}</span>
            </div>
            <button type="submit" disabled={!genieInput.trim() || genieRequestStatus === 'loading'} aria-label="发送消息">
              {genieRequestStatus === 'loading' ? <LoaderCircle size={16} className="loading-icon" /> : <Send size={16} />}
            </button>
          </form>
        </aside>
      </section>
      {showEndLiveConfirm && createPortal(
        <div className="end-live-overlay" role="presentation">
          <section
            className="end-live-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-live-title"
          >
            <button
              type="button"
              className="end-live-close"
              aria-label="关闭"
              onClick={() => setShowEndLiveConfirm(false)}
            >
              <X size={17} />
            </button>
            <span className="end-live-mark"><CircleStop size={21} /></span>
            <small>END LIVE</small>
            <h2 id="end-live-title">确认结束本场直播？</h2>
            <p>结束后将停止设备采集，并由 Genie 根据本场数据生成直播复盘和下一场经营建议。</p>
            <div className="end-live-summary">
              <span>直播时长<b>{formatDuration(liveTick)}</b></span>
              <span>当前观看<b>{audienceSnapshot.viewerCount.toLocaleString()}</b></span>
              <span>已采纳建议<b>{suggestionQueue.filter((suggestion) => suggestion.widgets.length === 0).length}</b></span>
            </div>
            <div className="end-live-dialog-actions">
              <button type="button" onClick={() => setShowEndLiveConfirm(false)}>继续直播</button>
              <button type="button" onClick={confirmEndLive}>结束并生成复盘</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </main>
  )
}

function themeIcon(theme: StreamThemeId) {
  if (theme === 'music') return <Music2 />
  if (theme === 'game') return <Gamepad2 />
  if (theme === 'show') return <Spotlight />
  return <MessageCircle />
}

function StrategyIcon({ strategyId }: { strategyId: AudienceStrategyId }) {
  if (strategyId === 'dim-light') return <Lightbulb size={15} />
  if (strategyId === 'color-cast') return <Palette size={15} />
  if (strategyId === 'cluttered-background') return <PanelsTopLeft size={15} />
  if (strategyId === 'low-audio') return <Mic size={15} />
  if (strategyId === 'cold-comments') return <MessageCircle size={15} />
  if (strategyId === 'active-comments') return <Users size={15} />
  if (strategyId === 'gift-drop') return <Gift size={15} />
  if (strategyId === 'entrant-drop') return <UserMinus size={15} />
  return <Activity size={15} />
}

function getWidgetAdjustment(spec: WidgetSpec, mode: 'preview' | 'apply'): LiveAdjustment {
  if (spec.type === 'audience-poll') {
    return mode === 'preview'
      ? { name: '正在预览互动挂件', detail: '确认后才会在观众侧上屏' }
      : { name: '互动挂件已上屏', detail: `将在 ${spec.props.durationSeconds} 秒后自动收起` }
  }

  if (spec.type === 'audio-adjustment') {
    return mode === 'preview'
      ? { name: '正在试听音频调整', detail: '试听完成后可确认应用' }
      : { name: '音频调整已应用', detail: `麦克风 ${withSign(spec.props.microphoneGain)}%，BGM ${withSign(spec.props.backgroundMusicGain)}%` }
  }

  if (spec.type === 'live-goal') {
    return mode === 'preview'
      ? { name: '正在预览冲刺目标', detail: '确认后向观众展示目标组件' }
      : { name: '冲刺目标已上屏', detail: `目标 ${spec.props.target.toLocaleString()}，正在召集观众助力` }
  }

  return mode === 'preview'
    ? { name: '正在预览画面调整', detail: '确认后才会应用到正式配置' }
    : { name: '画面调整已应用', detail: '新的画面参数已经生效' }
}

function withSign(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

function PreliveChecklist({
  compact = false,
  score,
  currentTask,
  completedTasks,
  onSelect,
}: {
  compact?: boolean
  score: number
  currentTask: PreliveTask
  completedTasks: PreliveTask[]
  onSelect: (index: number) => void
}) {
  const remaining = preliveTasks.length - completedTasks.length

  return <div className={`checklist ${compact ? 'is-compact' : ''}`}>
    {!compact && <div className="readiness-card">
      <span>当前准备度</span>
      <strong>{score}<small>/ 100</small></strong>
      <p>{remaining === 0 ? '所有设置已就绪' : `还有 ${remaining} 项待确认`}</p>
      <div className="circle-progress"><i style={{ transform: `rotate(${score * 3.6}deg)` }} /></div>
    </div>}
    <div className="prelive-check-list">
      {preliveTasks.map((task, index) => {
        const completed = completedTasks.includes(task.id)
        const unlocked = index === 0 || completedTasks.includes(preliveTasks[index - 1].id)
        if (completed || !unlocked) return null
        return (
          <button
            className={`check-item ${currentTask === task.id ? 'active' : ''}`}
            type="button"
            key={task.id}
            onClick={() => onSelect(index)}
          >
            <span>{index + 1}</span>
            <div><b>{task.title}</b><small>{task.priority} · {currentTask === task.id ? '正在设置' : '待确认'}</small></div>
            <ChevronDown size={14} />
          </button>
        )
      })}
    </div>
  </div>
}

type ChatCanvasWidgets = {
  text: string
  goalVisible: boolean
  goal: { label: string; current: number; target: number }
  textStyle: CanvasTextStyle
  selectedWidget: CanvasWidgetKind | null
  onSelectWidget: (widget: CanvasWidgetKind | null) => void
  textOffset: WidgetOffset
  goalOffset: WidgetOffset
  onTextOffsetChange: (offset: WidgetOffset) => void
  onGoalOffsetChange: (offset: WidgetOffset) => void
  onDeleteText: () => void
  onDeleteGoal: () => void
  customWidget: CustomCanvasWidget | null
  customWidgetOffset: WidgetOffset
  onCustomWidgetOffsetChange: (offset: WidgetOffset) => void
  onDeleteCustomWidget: () => void
}

function LivePreview({ videoRef, cameraEnabled, displayStream, layoutEditing, isPk, applied, scene, strategy, liveAdjustment, previewMode, liveStageMode, isPreviewing, audience, isLive, preliveTitle, preliveLayout, stageBackgroundUrl, bandLayout, gameLayout, gameCameraOffset, onGameCameraOffsetChange, selectedLiveComponent, liveComponentOffsets, onLiveComponentOffsetChange, onSelectLiveComponent, onDeleteLiveComponent, chatWidgets }: { videoRef: React.RefObject<HTMLVideoElement>; cameraEnabled: boolean; displayStream: MediaStream | null; layoutEditing: boolean; isPk: boolean; applied: boolean; scene: Scene; strategy: AudienceStrategyId; liveAdjustment: LiveAdjustment | null; previewMode: PreviewMode; liveStageMode: LiveStageMode; isPreviewing: boolean; audience: AudienceSnapshot; isLive: boolean; preliveTitle: string; preliveLayout: PreliveLayout; stageBackgroundUrl: string | null; bandLayout: boolean; gameLayout: 'vertical' | 'landscape' | null; gameCameraOffset: WidgetOffset; onGameCameraOffsetChange: (offset: WidgetOffset) => void; selectedLiveComponent: LiveCanvasComponentId | null; liveComponentOffsets: Record<LiveCanvasComponentId, WidgetOffset>; onLiveComponentOffsetChange: (component: LiveCanvasComponentId, offset: WidgetOffset) => void; onSelectLiveComponent: (component: LiveCanvasComponentId | null) => void; onDeleteLiveComponent: (component: LiveCanvasComponentId) => void; chatWidgets: ChatCanvasWidgets | null }) {
  const displayVideoRef = useRef<HTMLVideoElement>(null)
  const visualSettings = useStudioStore((state) => state.visualSettings)
  const cameraEffects = useStudioStore((state) => state.cameraEffects)
  const pollVisible = useStudioStore(
    (state) => state.pollState.status !== 'hidden',
  )
  const liveGoalVisible = useStudioStore(
    (state) => state.liveGoalState.status !== 'hidden',
  )
  const wishesVisible = useStudioStore(
    (state) => state.audienceWishesState.status !== 'hidden',
  )
  const showAudiencePreview = isLive && liveStageMode === 'preview' && !isPk
  const previewStyle = {
    '--studio-video-filter': [
      `brightness(${visualSettings.brightness})`,
      `contrast(${visualSettings.contrast})`,
      `sepia(${visualSettings.warmth})`,
      `saturate(${1 + visualSettings.warmth * 0.35})`,
    ].join(' '),
  } as CSSProperties

  useEffect(() => {
    if (displayVideoRef.current && displayStream) {
      displayVideoRef.current.srcObject = displayStream
    }
  }, [displayStream])

  const renderCameraContent = () => cameraEnabled
    ? <>
        <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
        <CameraEffectsCanvas videoRef={videoRef} />
      </>
    : <DemoHost />
  const renderGameScreen = () => displayStream
    ? <video ref={displayVideoRef} autoPlay muted playsInline className="screen-feed" />
    : <DemoGameScreen />

  return <div style={previewStyle} className={`live-stage ${applied ? 'applied' : ''} ${isPreviewing ? 'previewing' : ''} ${isPk ? 'pk-stage' : ''} scene-${scene} strategy-${strategy} ${previewMode === 'studio' ? 'studio-preview' : 'mobile-preview'} ${bandLayout ? 'stage-band-layout' : ''} ${bandLayout && preliveLayout === 'stage' ? 'band-layout-wide' : ''} ${gameLayout ? `game-layout game-${gameLayout}-layout` : ''} ${!isLive ? `prelive-${preliveLayout}` : ''} ${showAudiencePreview ? 'audience-preview-mode' : 'clean-screen-mode'}`}>
    <div className="stage-glow" />
    <div className="scan-lines" />
    <div
      className={`host-stage ${displayStream ? 'screen-sharing' : ''}`}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (
          target.closest('.canvas-widget') ||
          target.closest('.live-canvas-widget') ||
          target.closest('.moveable-control-box')
        ) return
        chatWidgets?.onSelectWidget(null)
        onSelectLiveComponent(null)
      }}
    >
      {!cameraEnabled && cameraEffects.backgroundMode !== 'none' && (
        <div
          className={[
            'demo-effect-background',
            `mode-${cameraEffects.backgroundMode}`,
            cameraEffects.backgroundPreset ?? '',
          ].filter(Boolean).join(' ')}
          style={{
            backgroundColor: cameraEffects.backgroundMode === 'color'
              ? cameraEffects.backgroundColor
              : undefined,
            backgroundImage: cameraEffects.backgroundImageUrl
              ? `url("${cameraEffects.backgroundImageUrl}")`
              : undefined,
            '--demo-background-blur': `${4 + cameraEffects.backgroundBlur * 0.22}px`,
          } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {bandLayout && stageBackgroundUrl && (
        <div
          className="stage-background-layer"
          style={{ backgroundImage: `url("${stageBackgroundUrl}")` }}
          aria-hidden="true"
        />
      )}
      {gameLayout === 'vertical'
        ? <>
            <div className="game-camera-source">{renderCameraContent()}</div>
            <div className="game-screen-source">{renderGameScreen()}</div>
          </>
        : gameLayout === 'landscape'
          ? <>
              <div className="game-screen-source">{renderGameScreen()}</div>
              <EditableCameraLayer
                videoRef={videoRef}
                editing={false}
                draggable
                position={gameCameraOffset}
                onPositionChange={onGameCameraOffsetChange}
                className="game-camera-overlay"
              >
                {renderCameraContent()}
              </EditableCameraLayer>
            </>
        : displayStream
        ? <>
            <video ref={displayVideoRef} autoPlay muted playsInline className="screen-feed" />
            {cameraEnabled && <EditableCameraLayer videoRef={videoRef} editing={layoutEditing} />}
          </>
        : cameraEnabled
          ? <div className="camera-source">{renderCameraContent()}</div>
          : <DemoHost />}
      {strategy === 'cluttered-background' && (
        <div className="scenario-clutter" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
      )}
      {previewMode === 'studio' && <div className="studio-guides"><i /><i /><i /></div>}
      {!showAudiencePreview && <div className="stage-label"><span />{isLive ? 'LIVE' : '林小满'}</div>}
      {!isPk && isLive && !showAudiencePreview && <><div className="viewer-bubble"><Users size={14} />{audience.viewerCount.toLocaleString()}</div><div className="stage-duration">00:42:18</div></>}
      {showAudiencePreview && <AudiencePreviewOverlay audience={audience} />}
      {!isLive && <div className="prelive-stage-summary"><span>开播预览</span><b>{preliveTitle || '未填写直播标题'}</b><small>{preliveLayout === 'portrait' ? '全屏摄像头 · 单人竖屏 9:16' : preliveLayout === 'three-quarter' ? '3/5 摄像头 · 舞台背景' : preliveLayout === 'game-vertical' ? '竖屏摄像头 · 游戏投屏' : preliveLayout === 'game-landscape' ? '横屏投屏 · 悬浮摄像头' : '秀场舞台 · 中央 3/5 摄像头'}</small></div>}
      {applied && <div className="applied-badge"><Check size={13} />方案已应用</div>}
      {liveAdjustment && <div className="adjustment-toast"><Zap size={14} /><div><b>{liveAdjustment.name}</b><span>{liveAdjustment.detail}</span></div></div>}
      {isLive && pollVisible && <LiveCanvasWidget
        kind="audience-poll"
        label={liveComponentLabels['audience-poll']}
        selected={selectedLiveComponent === 'audience-poll'}
        offset={liveComponentOffsets['audience-poll']}
        onSelect={() => onSelectLiveComponent('audience-poll')}
        onOffsetChange={(offset) =>
          onLiveComponentOffsetChange('audience-poll', offset)}
        onDelete={() => onDeleteLiveComponent('audience-poll')}
      >
        <LivePoll />
      </LiveCanvasWidget>}
      {isLive && liveGoalVisible && <LiveCanvasWidget
        kind="live-goal"
        label={liveComponentLabels['live-goal']}
        selected={selectedLiveComponent === 'live-goal'}
        offset={liveComponentOffsets['live-goal']}
        onSelect={() => onSelectLiveComponent('live-goal')}
        onOffsetChange={(offset) =>
          onLiveComponentOffsetChange('live-goal', offset)}
        onDelete={() => onDeleteLiveComponent('live-goal')}
      >
        <LiveGoal />
      </LiveCanvasWidget>}
      {isLive && wishesVisible && <LiveCanvasWidget
        kind="audience-wishes"
        label={liveComponentLabels['audience-wishes']}
        selected={selectedLiveComponent === 'audience-wishes'}
        offset={liveComponentOffsets['audience-wishes']}
        onSelect={() => onSelectLiveComponent('audience-wishes')}
        onOffsetChange={(offset) =>
          onLiveComponentOffsetChange('audience-wishes', offset)}
        onDelete={() => onDeleteLiveComponent('audience-wishes')}
      >
        <LiveWishes />
      </LiveCanvasWidget>}
      {chatWidgets && (
        <>
          <CanvasTextSource
            text={chatWidgets.text}
            textStyle={chatWidgets.textStyle}
            selected={chatWidgets.selectedWidget === 'text'}
            onSelect={() => chatWidgets.onSelectWidget('text')}
            offset={chatWidgets.textOffset}
            onOffsetChange={chatWidgets.onTextOffsetChange}
            onDelete={chatWidgets.onDeleteText}
            editable={!showAudiencePreview || isLive}
          />
          {chatWidgets.goalVisible && (
            <CanvasGoalRing
              label={chatWidgets.goal.label.trim() || (gameLayout ? defaultGameGoalTitle : fallbackGoalTitle)}
              current={chatWidgets.goal.current}
              target={chatWidgets.goal.target}
              variant={gameLayout ? 'progress-bar' : 'ring'}
              selected={chatWidgets.selectedWidget === 'goal'}
              onSelect={() => chatWidgets.onSelectWidget('goal')}
              offset={chatWidgets.goalOffset}
              onOffsetChange={chatWidgets.onGoalOffsetChange}
              onDelete={chatWidgets.onDeleteGoal}
              editable={!showAudiencePreview || isLive}
            />
          )}
          {chatWidgets.customWidget && (
            <CanvasCustomWidget
              widget={chatWidgets.customWidget}
              selected={chatWidgets.selectedWidget === 'custom'}
              onSelect={() => chatWidgets.onSelectWidget('custom')}
              offset={chatWidgets.customWidgetOffset}
              onOffsetChange={chatWidgets.onCustomWidgetOffsetChange}
              onDelete={chatWidgets.onDeleteCustomWidget}
              editable={!showAudiencePreview || isLive}
            />
          )}
        </>
      )}
    </div>
    {strategy === 'dim-light' && <div className="stage-hint"><Lightbulb size={14} />亮度 26/100</div>}
    {strategy === 'color-cast' && <div className="stage-hint"><Palette size={14} />暖色偏移 +58</div>}
    {strategy === 'cluttered-background' && <div className="stage-hint"><PanelsTopLeft size={14} />背景干扰 72%</div>}
    {strategy === 'low-audio' && <div className="audio-meter"><AudioLines size={15} /><span>音频峰值偏低</span><i /><i /><i /><i /></div>}
    {strategy === 'cold-comments' && <div className="stage-hint"><MessageCircle size={14} />评论 14/min</div>}
    {strategy === 'active-comments' && <div className="stage-hint"><Users size={14} />评论 82/min</div>}
    {strategy === 'gift-drop' && <div className="stage-hint"><Gift size={14} />礼物 -81%</div>}
    {strategy === 'entrant-drop' && <div className="stage-hint"><UserMinus size={14} />进房 8/min</div>}
    {isPk && <><div className="pk-versus">VS</div><div className="opponent-stage"><DemoOpponent /><div className="stage-label opponent"><span />陈妍</div></div><div className="pk-scorebar"><div><b>8,740</b><span>林小满</span></div><strong>01:18</strong><div><b>10,000</b><span>陈妍</span></div></div></>}
    {isLive && !showAudiencePreview && <div className="floating-comments">
      {audience.comments.slice(0, 2).map((comment) => <span key={comment.id}>{comment.text}</span>)}
    </div>}
  </div>
}

function AudiencePreviewOverlay({ audience }: { audience: AudienceSnapshot }) {
  const recentGift = audience.gifts[0]
  const recentComments = audience.comments.slice(-4)

  return (
    <div className="audience-preview-overlay" aria-label="观众端直播预览">
      <header className="audience-preview-header">
        <span className="audience-host-avatar">林</span>
        <span className="audience-host-copy">
          <b>林小满</b>
          <small>♥ 99.9K</small>
        </span>
        <span className="audience-preview-count"><Users size={11} />{audience.viewerCount.toLocaleString()}</span>
      </header>
      <div className="audience-preview-badges">
        <span>🔥 Daily ranking</span>
        <span>🪙 157 / 299</span>
        <span>LIVE Fest</span>
      </div>
      <div className="audience-preview-feed">
        {recentGift && (
          <div className="audience-preview-gift">
            <i>{recentGift.icon}</i>
            <span><b>{recentGift.userName}</b><small> sent {recentGift.giftName}</small></span>
            <strong>×{recentGift.count}</strong>
          </div>
        )}
        {recentComments.map((comment, index) => (
          <div className="audience-preview-comment" key={comment.id}>
            <i className={`avatar avatar-${(index % 4) + 1}`}>{comment.userName.slice(0, 1)}</i>
            <span><b>{comment.userName}</b>{comment.text}</span>
          </div>
        ))}
        <div className="audience-preview-entry">
          <span>👋</span>
          <small>{recentComments.at(-1)?.userName ?? '新观众'} joined</small>
        </div>
      </div>
      <div className="audience-preview-actions" aria-hidden="true">
        <span><Link2 size={14} /></span>
        <span><Users size={14} /></span>
        <span className="share-action"><Share2 size={14} /></span>
      </div>
    </div>
  )
}

function DemoHost() {
  return <div className="demo-host"><div className="light-rays" /><div className="host-hair" /><div className="host-face"><i /><i /><b /></div><div className="host-body" /><div className="host-necklace" /></div>
}

function DemoGameScreen() {
  return (
    <div className="game-demo-screen" aria-label="游戏投屏预览">
      <div className="game-demo-hud"><i /><span>LIVE MATCH</span><b>02:46</b></div>
      <div className="game-demo-terrain" />
      <div className="game-demo-player" />
      <div className="game-demo-map"><i /><i /><i /></div>
      <div className="game-demo-controls"><i /><i /><i /></div>
    </div>
  )
}

function DemoOpponent() {
  return <div className="demo-opponent"><div className="opponent-hair" /><div className="opponent-face" /><div className="opponent-body" /></div>
}

function CanvasWidgetPanel({
  selectedWidget,
  onSelectWidget,
  textEnabled,
  onTextEnabledChange,
  textDraft,
  onTextDraftChange,
  onTextApply,
  textStyle,
  onTextStyleChange,
  goalEnabled,
  onGoalEnabledChange,
  goalKind,
  onGoalKindChange,
  goalTitle,
  onGoalTitleChange,
  goalTarget,
  onGoalTargetChange,
  customWidgetPrompt,
  onCustomWidgetPromptChange,
  customWidget,
  onCustomWidgetChange,
  onDeleteCustomWidget,
  onGenerateCustomWidget,
}: {
  selectedWidget: CanvasWidgetKind | null
  onSelectWidget: (widget: CanvasWidgetKind | null) => void
  textEnabled: boolean
  onTextEnabledChange: (enabled: boolean) => void
  textDraft: string
  onTextDraftChange: (draft: string) => void
  onTextApply: () => void
  textStyle: CanvasTextStyle
  onTextStyleChange: (style: CanvasTextStyle) => void
  goalEnabled: boolean
  onGoalEnabledChange: (enabled: boolean) => void
  goalKind: GoalKind
  onGoalKindChange: (kind: GoalKind) => void
  goalTitle: string
  onGoalTitleChange: (title: string) => void
  goalTarget: number
  onGoalTargetChange: (target: number) => void
  customWidgetPrompt: string
  onCustomWidgetPromptChange: (prompt: string) => void
  customWidget: CustomCanvasWidget | null
  onCustomWidgetChange: (widget: CustomCanvasWidget | null) => void
  onDeleteCustomWidget: () => void
  onGenerateCustomWidget: () => void
}) {
  if (selectedWidget === 'text') {
    const stepFontSize = (delta: number) => {
      const next = Math.round((textStyle.size + delta) * 2) / 2
      onTextStyleChange({
        ...textStyle,
        size: Math.min(textSizeBounds.max, Math.max(textSizeBounds.min, next)),
      })
    }
    return (
      <div className="recommendation-card canvas-widget-card">
        <div className="prelive-task-meta">
          <span className="card-kicker">画布组件</span>
          <button type="button" className="canvas-widget-back" onClick={() => onSelectWidget(null)}>返回组件列表</button>
        </div>
        <h2>文字源设置</h2>
        <p>编辑展示在画面中的文字内容和样式</p>
        <div className="chat-text-config">
          <input
            value={textDraft}
            maxLength={40}
            placeholder="输入画布上展示的文字"
            aria-label="文字源内容"
            onChange={(event) => onTextDraftChange(event.target.value)}
          />
          <button type="button" onClick={onTextApply}>更新</button>
        </div>
        <div className="widget-style-panel">
          <div className="widget-style-row">
            <span className="widget-style-label">字号</span>
            <div className="widget-stepper" role="group" aria-label="字号调节">
              <button type="button" aria-label="减小字号" disabled={textStyle.size <= textSizeBounds.min} onClick={() => stepFontSize(-1)}><Minus size={13} /></button>
              <b>{textStyle.size}</b>
              <button type="button" aria-label="增大字号" disabled={textStyle.size >= textSizeBounds.max} onClick={() => stepFontSize(1)}><Plus size={13} /></button>
            </div>
          </div>
          <div className="widget-style-row">
            <span className="widget-style-label">颜色</span>
            <div className="widget-swatch-row" role="group" aria-label="文字颜色">
              {textColorOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`widget-swatch ${textStyle.color === option.value ? 'selected' : ''}`}
                  aria-pressed={textStyle.color === option.value}
                  aria-label={option.label}
                  title={option.label}
                  style={option.value === 'gradient'
                    ? { backgroundImage: 'linear-gradient(120deg, #d06bff 0%, #9a7bff 48%, #5fb6ff 100%)' }
                    : { backgroundColor: option.value }}
                  onClick={() => onTextStyleChange({ ...textStyle, color: option.value })}
                />
              ))}
            </div>
          </div>
          <div className="widget-style-row">
            <span className="widget-style-label">字重</span>
            <div className="widget-segmented" role="group" aria-label="字重设置">
              <button
                type="button"
                className={textStyle.bold ? 'selected' : ''}
                aria-pressed={textStyle.bold}
                onClick={() => onTextStyleChange({ ...textStyle, bold: !textStyle.bold })}
              >
                <Bold size={13} />加粗
              </button>
            </div>
          </div>
          <div className="widget-style-row">
            <span className="widget-style-label">对齐</span>
            <div className="widget-segmented" role="group" aria-label="对齐方式">
              {([['left', '左对齐'], ['center', '居中'], ['right', '右对齐']] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={textStyle.align === value ? 'selected' : ''}
                  aria-pressed={textStyle.align === value}
                  onClick={() => onTextStyleChange({ ...textStyle, align: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="widget-style-row">
            <span className="widget-style-label">装饰</span>
            <div className="widget-segmented" role="group" aria-label="背景与描边">
              {([['none', '无'], ['stroke', '描边'], ['pill', '底色']] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={textStyle.decoration === value ? 'selected' : ''}
                  aria-pressed={textStyle.decoration === value}
                  onClick={() => onTextStyleChange({ ...textStyle, decoration: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <small className="chat-widget-tip">样式修改实时同步到画布，也可以直接在画布中拖动文字源调整位置</small>
        <button
          type="button"
          className="live-component-delete-button"
          onClick={() => {
            onTextEnabledChange(false)
            onSelectWidget(null)
          }}
        >
          <Trash2 size={13} />
          从画面删除
        </button>
      </div>
    )
  }

  if (selectedWidget === 'custom' && customWidget) {
    return (
      <div className="recommendation-card canvas-widget-card">
        <div className="prelive-task-meta">
          <span className="card-kicker">自定义画布组件</span>
          <button type="button" className="canvas-widget-back" onClick={() => onSelectWidget(null)}>返回组件列表</button>
        </div>
        <h2>组件参数设置</h2>
        <label className="widget-editor-field">
          <span>主文案</span>
          <input value={customWidget.title} maxLength={24} onChange={(event) => onCustomWidgetChange({ ...customWidget, title: event.target.value })} />
        </label>
        <label className="widget-editor-field">
          <span>辅助文案</span>
          <input value={customWidget.detail} maxLength={40} onChange={(event) => onCustomWidgetChange({ ...customWidget, detail: event.target.value })} />
        </label>
        <div className="widget-style-row">
          <span className="widget-style-label">强调色</span>
          <div className="widget-swatch-row" role="group" aria-label="组件强调色">
            {['#ff5c82', '#f4b95f', '#6edbc0', '#78aaff'].map((color) => (
              <button type="button" key={color} className={`widget-swatch ${customWidget.color === color ? 'selected' : ''}`} aria-pressed={customWidget.color === color} style={{ backgroundColor: color }} onClick={() => onCustomWidgetChange({ ...customWidget, color })} />
            ))}
          </div>
        </div>
        <div className="widget-style-row">
          <span className="widget-style-label">尺寸</span>
          <div className="widget-segmented" role="group" aria-label="组件尺寸">
            {([['compact', '小'], ['regular', '中'], ['large', '大']] as const).map(([size, label]) => (
              <button type="button" key={size} className={customWidget.size === size ? 'selected' : ''} aria-pressed={customWidget.size === size} onClick={() => onCustomWidgetChange({ ...customWidget, size })}>{label}</button>
            ))}
          </div>
        </div>
        <small className="chat-widget-tip">参数调整会实时同步到画布，也可在画布中拖动组件调整位置</small>
        <button
          type="button"
          className="live-component-delete-button"
          onClick={onDeleteCustomWidget}
        >
          <Trash2 size={13} />
          从画面删除
        </button>
      </div>
    )
  }

  if (selectedWidget === 'goal') {
    const clampTarget = (value: number) => Math.min(999000, Math.max(1000, Math.round(value / 1000) * 1000))
    return (
      <div className="recommendation-card canvas-widget-card">
        <div className="prelive-task-meta">
          <span className="card-kicker">画布组件</span>
          <button type="button" className="canvas-widget-back" onClick={() => onSelectWidget(null)}>返回组件列表</button>
        </div>
        <h2>目标源设置</h2>
        <p>设置直播目标，并展示在画面中</p>
        <div className="goal-kind-select" role="group" aria-label="目标类型">
          {goalKindOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              className={goalKind === option.id ? 'selected' : ''}
              aria-pressed={goalKind === option.id}
              onClick={() => onGoalKindChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="widget-editor-field">
          <span>目标数值</span>
          <div className="widget-stepper widget-stepper-wide" role="group" aria-label="目标数值调节">
            <button type="button" aria-label="减少目标数值" onClick={() => onGoalTargetChange(clampTarget(goalTarget - 1000))}><Minus size={13} /></button>
            <b>{goalTarget.toLocaleString()}</b>
            <button type="button" aria-label="增加目标数值" onClick={() => onGoalTargetChange(clampTarget(goalTarget + 1000))}><Plus size={13} /></button>
          </div>
        </label>
        <label className="widget-editor-field">
          <span>目标文案</span>
          <input
            value={goalTitle}
            maxLength={30}
            placeholder={fallbackGoalTitle}
            aria-label="目标文案"
            onChange={(event) => onGoalTitleChange(event.target.value)}
          />
        </label>
        <small className="chat-widget-tip">数值与文案实时同步到画布，也可以直接在画布中拖动目标源调整位置</small>
        <button
          type="button"
          className="live-component-delete-button"
          onClick={() => {
            onGoalEnabledChange(false)
            onSelectWidget(null)
          }}
        >
          <Trash2 size={13} />
          从画面删除
        </button>
      </div>
    )
  }

  const renderWidgetRow = (
    kind: CanvasWidgetKind,
    icon: ReactNode,
    name: string,
    detail: string,
    enabled: boolean,
    onEnabledChange: (enabled: boolean) => void,
  ) => (
    <div
      role="button"
      tabIndex={0}
      className={`prelive-toggle-row canvas-widget-row ${enabled ? 'is-enabled' : ''}`}
      onClick={() => {
        if (!enabled) onEnabledChange(true)
        onSelectWidget(kind)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (!enabled) onEnabledChange(true)
          onSelectWidget(kind)
        }
      }}
    >
      <span>{icon}{name}<small>{detail}</small></span>
      <input
        type="checkbox"
        checked={enabled}
        aria-label={`展示${name}`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onEnabledChange(event.target.checked)
          if (!event.target.checked) onSelectWidget(null)
        }}
      />
    </div>
  )

  return (
    <div className="recommendation-card canvas-widget-card canvas-widget-list-card prelive-interaction-widget-panel">
      <h2>画布小组件</h2>
      {renderWidgetRow('text', <Type size={15} />, '文字源', '画面中的装饰文字，可编辑内容与样式', textEnabled, onTextEnabledChange)}
      {renderWidgetRow('goal', <Target size={15} />, '目标源', '展示直播目标进度，鼓励观众互动', goalEnabled, onGoalEnabledChange)}
      <div className="custom-widget-generator">
        <label>
          <span>自定义组件</span>
          <input value={customWidgetPrompt} maxLength={60} placeholder="例如：生成一个限时福利提醒组件" onChange={(event) => onCustomWidgetPromptChange(event.target.value)} />
        </label>
        <button type="button" disabled={!customWidgetPrompt.trim()} onClick={onGenerateCustomWidget}>生成组件</button>
      </div>
      <small className="chat-widget-tip">勾选后在画布中展示；点击列表项或画布中的组件即可编辑，拖动可调整位置</small>
    </div>
  )
}

function PreliveTaskCard({
  task,
  completed,
  layout,
  streamType,
  title,
  titleRecommendations,
  script,
  hostBio,
  customChatTopic,
  coverApplied,
  isChatCompanion,
  canvasWidgetPanel,
  musicBackgroundId,
  customStageBackgroundUrl,
  stageBackgroundUploadError,
  onSelectStageBackground,
  onUploadStageBackground,
  onLayoutChange,
  onCameraEffectsChange,
  onTitleChange,
  onScriptChange,
  onHostBioChange,
  onCustomChatTopicChange,
  onGenerateCustomChatTopic,
  onCoverAppliedChange,
  onVisualChange,
  onAudioChange,
  onApply,
  onSkip,
}: {
  task: typeof preliveTasks[number]
  completed: boolean
  layout: PreliveLayout
  streamType: StreamKind
  title: string
  titleRecommendations: string[]
  script: string
  hostBio: string
  customChatTopic: string
  coverApplied: boolean
  isChatCompanion: boolean
  canvasWidgetPanel: ReactNode
  musicBackgroundId: string
  customStageBackgroundUrl: string | null
  stageBackgroundUploadError: string
  onSelectStageBackground: (backgroundId: string) => void
  onUploadStageBackground: (file: File | undefined) => void
  onLayoutChange: (layout: PreliveLayout) => void
  onCameraEffectsChange: (settings: CameraEffects) => void
  onTitleChange: (title: string) => void
  onScriptChange: (script: string) => void
  onHostBioChange: (bio: string) => void
  onCustomChatTopicChange: (topic: string) => void
  onGenerateCustomChatTopic: (topic: string) => void
  onCoverAppliedChange: (applied: boolean) => void
  onVisualChange: (property: keyof VisualSettings, percentage: number) => void
  onAudioChange: (property: keyof AudioSettings, value: number) => void
  onApply: () => void
  onSkip: () => void
}) {
  const scriptGenerationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [generatedTopic, setGeneratedTopic] = useState('')
  const isChatLayout = isChatCompanion && task.id === 'layout'
  const isMusicLayout = streamType === 'music' && task.id === 'layout'
  const isGameLayout = streamType === 'game' && task.id === 'layout'
  const isShowLayout = streamType === 'show' && task.id === 'layout'
  const cardTitle = isChatLayout
    ? chatLayoutTaskTitle
    : isShowLayout
      ? showLayoutTaskTitle
      : task.title
  const cardDetail = isChatLayout
    ? chatLayoutTaskDetail
    : isGameLayout
      ? '根据你的游戏内容和互动方式，选择适合的画面布局'
    : isMusicLayout || isShowLayout
      ? musicLayoutTaskDetail
      : task.detail
  const scriptRecommendation = getCustomTopicRecommendation(generatedTopic)
  const canApply = task.id !== 'content'
    ? true
    : [
        hostBio,
        title,
        script,
      ].every((value) => value.trim().length > 0)

  useEffect(() => () => {
    if (scriptGenerationTimeoutRef.current !== null) {
      clearTimeout(scriptGenerationTimeoutRef.current)
    }
  }, [])

  const requestScriptGeneration = () => {
    const topic = customChatTopic.trim()
    if (!topic) return

    if (scriptGenerationTimeoutRef.current !== null) {
      clearTimeout(scriptGenerationTimeoutRef.current)
    }
    setIsGeneratingScript(true)
    scriptGenerationTimeoutRef.current = setTimeout(() => {
      onGenerateCustomChatTopic(topic)
      setGeneratedTopic(topic)
      setIsGeneratingScript(false)
      scriptGenerationTimeoutRef.current = null
    }, 450)
  }

  const updateCustomChatTopic = (topic: string) => {
    if (scriptGenerationTimeoutRef.current !== null) {
      clearTimeout(scriptGenerationTimeoutRef.current)
      scriptGenerationTimeoutRef.current = null
    }
    setIsGeneratingScript(false)
    setGeneratedTopic('')
    onCustomChatTopicChange(topic)
  }

  const renderStageBackgroundPicker = (detailText: string) => (
    <div className="stage-background-picker">
      <b className="stage-background-title">选择舞台背景</b>
      <small className="stage-background-detail">{detailText}</small>
      <div className="stage-background-grid" role="group" aria-label="舞台背景">
        {stageBackgrounds.map((background) => (
          <button
            type="button"
            key={background.id}
            className={`stage-background-option ${!customStageBackgroundUrl && musicBackgroundId === background.id ? 'selected' : ''}`}
            aria-pressed={!customStageBackgroundUrl && musicBackgroundId === background.id}
            onClick={() => onSelectStageBackground(background.id)}
          >
            <img src={background.url} alt={background.name} />
            <span>{background.name}</span>
          </button>
        ))}
        {customStageBackgroundUrl && (
          <button type="button" className="stage-background-option selected" aria-pressed="true">
            <img src={customStageBackgroundUrl} alt="自定义背景" />
            <span>自定义背景</span>
          </button>
        )}
      </div>
      <label className="stage-background-upload">
        <Upload size={14} />上传背景图
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            onUploadStageBackground(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>
      {stageBackgroundUploadError && <small className="stage-background-error" role="alert">{stageBackgroundUploadError}</small>}
    </div>
  )

  return <div className="recommendation-card prelive-task-card">
    <div className="prelive-task-meta">
      {completed && <em><Check size={11} />已完成</em>}
    </div>
    <h2>{cardTitle}</h2>
    <p>{cardDetail}</p>
    {task.id === 'layout' && (
      isChatLayout ? (
        <div className="chat-widget-picker">
          <div className="chat-layout-recommend">
            <Sparkles size={14} />
            <span><b>已推荐全屏摄像头布局</b><small>单人竖屏 · 9:16，最适合聊天陪伴</small></span>
          </div>
          <small className="chat-widget-tip">确认布局后，可在下一步添加画布小组件并调整位置</small>
        </div>
      ) : isMusicLayout ? (
        <div className="music-layout-picker">
          <div className="task-choice-row">
            <button type="button" className={`task-choice ${layout === 'portrait' ? 'selected' : ''}`} onClick={() => onLayoutChange('portrait')}><Camera size={15} /><span><b>全屏摄像头布局</b><small>摄像头铺满整个画布</small></span></button>
            <button type="button" className={`task-choice ${layout === 'three-quarter' ? 'selected' : ''}`} onClick={() => onLayoutChange('three-quarter')}><LayoutTemplate size={15} /><span><b>3/5 摄像头布局</b><small>中央摄像头约占 3/5，上下露出舞台氛围背景</small></span></button>
          </div>
          {layout === 'three-quarter' && renderStageBackgroundPicker('背景图铺满整体画布，上下露出区域展示舞台氛围')}
        </div>
      ) : isGameLayout ? (
        <div className="game-layout-picker">
          <div className="task-choice-row">
            <button type="button" className={`task-choice ${layout === 'game-vertical' ? 'selected' : ''}`} onClick={() => onLayoutChange('game-vertical')}>
              <Camera size={15} />
              <span><b>竖屏摄像头 + 游戏投屏</b><small>上方突出主播，下方完整展示游戏内容</small><small>适用场景：手游直播、需要频繁与观众互动</small></span>
            </button>
            <button type="button" className={`task-choice game-layout-recommended ${layout === 'game-landscape' ? 'selected' : ''}`} onClick={() => onLayoutChange('game-landscape')}>
              <LayoutTemplate size={15} />
              <span><b>横屏投屏 + 悬浮摄像头</b><small>全屏呈现游戏画面，主播实时陪伴互动</small></span>
              <em>推荐</em>
            </button>
          </div>
        </div>
      ) : isShowLayout ? (
        <div className="music-layout-picker">
          <div className="task-choice-row">
            <div className="task-choice selected show-stage-choice" role="img" aria-label="秀场舞台布局">
              <Spotlight size={15} />
              <span><b>秀场舞台布局</b><small>中央展示主播画面，上下保留舞台氛围背景</small></span>
            </div>
          </div>
          {renderStageBackgroundPicker('背景图铺满整体画布，中央 3/5 区域展示主播画面，上下露出舞台包装')}
        </div>
      ) : (
        <div className="task-choice-row">
          <button type="button" className={`task-choice ${layout === 'portrait' ? 'selected' : ''}`} onClick={() => onLayoutChange('portrait')}><Camera size={15} /><span><b>单人竖屏</b><small>9:16 · 聊天 / 音乐</small></span></button>
          <button type="button" className={`task-choice ${layout === 'stage' ? 'selected' : ''}`} onClick={() => onLayoutChange('stage')}><LayoutTemplate size={15} /><span><b>秀场舞台</b><small>16:9 · 表演 / 游戏</small></span></button>
        </div>
      )
    )}
    {task.id === 'widgets' && canvasWidgetPanel}
    {task.id === 'visual' && (
      <div className="prelive-beauty-panel">
        <CameraEffectsWidget
          spec={getCameraEffectsWidgetSpec()}
          applied
          isPreviewing={false}
          onCameraEffectsChange={onCameraEffectsChange}
          onAudioChange={onAudioChange}
          onVisualChange={onVisualChange}
          defaultSection="beauty"
        />
      </div>
    )}
    {task.id === 'content' && (
      <div className="prelive-form">
        <div className="prelive-form-section">
          <b>直播内容</b>
          <label><span>直播标题</span><input value={title} maxLength={30} onChange={(event) => onTitleChange(event.target.value)} /></label>
          <div className="title-recommendations" role="group" aria-label="直播标题推荐">
            <span>智能标题推荐</span>
            <div>
              {titleRecommendations.map((recommendation) => (
                <button
                  type="button"
                  key={recommendation}
                  className={title === recommendation ? 'selected' : ''}
                  onClick={() => onTitleChange(recommendation)}
                >
                  {recommendation}
                </button>
              ))}
            </div>
          </div>
          <label><span>主播简介</span><textarea value={hostBio} maxLength={100} rows={3} onChange={(event) => onHostBioChange(event.target.value)} /></label>
        </div>
        <div className="prelive-cover-suggestion">
          <div><Camera size={17} /><span><b>封面建议</b><small>使用当前画面的人像居中帧</small></span></div>
          <button type="button" className={coverApplied ? 'selected' : ''} onClick={() => onCoverAppliedChange(!coverApplied)}>
            {coverApplied ? <><Check size={12} />已采用</> : '采用'}
          </button>
        </div>
        <div className="prelive-form-section">
          <b>直播脚本建议</b>
          <small>完成输入后按回车或在输入框内右键，生成前 15 分钟互动脚本。</small>
          <label className="custom-chat-topic-input">
            <span>自定义聊天主题</span>
            <input
              value={customChatTopic}
              maxLength={40}
              placeholder="例如：第一次独自旅行的故事"
              onChange={(event) => updateCustomChatTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                requestScriptGeneration()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                requestScriptGeneration()
              }}
            />
          </label>
          {isGeneratingScript ? (
            <div className="smart-script-recommendation is-generating" role="status" aria-live="polite">
              <div>
                <span>正在生成互动脚本</span>
                <small>正在根据「{customChatTopic.trim()}」整理互动方案...</small>
              </div>
            </div>
          ) : scriptRecommendation ? (
            <div className="smart-script-recommendation" aria-live="polite">
              <div>
                <span>已自动生成智能脚本</span>
                <b>{scriptRecommendation.label}</b>
                <small>{scriptRecommendation.detail}</small>
              </div>
            </div>
          ) : (
            <small className="custom-chat-topic-hint">输入完成后按回车或在输入框内右键，即可生成脚本。</small>
          )}
        </div>
        <label><span>互动脚本</span><textarea value={script} maxLength={1000} rows={11} onChange={(event) => onScriptChange(event.target.value)} /></label>
        <small>{title.length} / 30 · {script.length} / 1000</small>
      </div>
    )}
    <Button className="primary-button full-button" color="primary" disabled={!canApply} onClick={onApply}><Check size={16} />{completed ? '更新当前设置' : task.action}</Button>
    <button className="card-text-button" type="button" onClick={onSkip}>跳过并稍后处理</button>
  </div>
}

function getSuggestionPresentation(suggestion: QueuedSuggestion): {
  title: string
  reason: string
} {
  const titles: Record<LiveSuggestion['signalId'], string> = {
    exposure: '提高人物补光',
    'color-accuracy': '校准画面色彩',
    'background-cleanliness': '更换虚拟背景',
    contrast: '优化画面对比度',
    framing: '调整人脸构图',
    fps: '降低画面负载',
    microphone: '调整麦克风音量',
    comments: '发起观众互动',
    entrants: '承接新进观众',
    retention: '提升新观众留存',
    gifts: '设置互动目标',
  }
  return {
    title: titles[suggestion.signalId],
    reason: suggestion.action,
  }
}

export default App

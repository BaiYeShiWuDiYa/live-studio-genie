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
import { getCameraEffectsWidgetSpec, getSceneWidgetSpec } from './agent/widgets/sceneWidgets'
import type { StudioScene, WidgetSpec } from './agent/widgets/widgetSpec'
import { createAudioProcessor, type AudioProcessor } from './capabilities/audio/audioProcessor'
import {
  createBackgroundMusicPlayer,
  type BackgroundMusicPlayer,
} from './capabilities/audio/backgroundMusic'
import type { AudioSettings } from './capabilities/audio/types'
import {
  mockAudienceEventAdapter,
  resolveAudienceStrategy,
  type AudienceComment,
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
  createCommentInsightSuggestion,
  rightRailUpdateConfig,
  selectSuggestionsForStrategy,
  selectThresholdChangedSuggestions,
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
  removeSuggestionWidget,
  type QueuedSuggestion,
} from './capabilities/monitoring/suggestionQueue'
import type { VisualSettings } from './capabilities/visual/types'
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
import { LivePoll } from './components/studio/LivePoll'
import { PostLiveReview } from './components/studio/PostLiveReview'
import { LiveWishes } from './components/studio/LiveWishes'
import { CanvasGoalRing, CanvasTextSource } from './components/studio/PreliveCanvasWidgets'
import {
  defaultCanvasTextStyle,
  type CanvasTextStyle,
  type WidgetOffset,
} from './capabilities/widgets/canvasWidgets'
import { LiveChatPanel } from './components/studio/LiveChatPanel'
import { AtomicRecallCard } from './components/atomic/AtomicRecallCard'
import { recallAtomicComponents } from './components/atomic/intentRecall'
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
type PreliveTask = 'layout' | 'visual' | 'content'
type PreliveLayout = 'portrait' | 'three-quarter' | 'stage' | 'game-vertical' | 'game-landscape'
type GoalKind = StreamGoalKind
type ChatTopicId = 'daily-life' | 'emotional-support' | 'hobby-sharing' | 'interactive-games'

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
type RightRailSource = 'trigger' | 'input'
type GenieRequestStatus = 'idle' | 'loading' | 'cancelled' | 'timeout' | 'error'
type StrategyCommentState = 'issue' | 'recovery' | 'normal'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

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
  { id: 'layout', title: '选择直播布局', detail: '根据直播类型确认画面布局，并检查画面源。', action: '确认画布方案', priority: '必须完成' },
  { id: 'visual', title: '人像美化', detail: '默认应用「清透日常」预设，可在美颜、美妆分类中微调，所有处理均在本地完成。', action: '应用美化方案', priority: '必须完成' },
  { id: 'content', title: '直播信息与内容', detail: '选择聊天主题，并完善开播前 15 分钟的内容脚本。', action: '保存内容方案', priority: '建议优化' },
]

const chatTopicRecommendations: Record<ChatTopicId, { label: string; detail: string; script: string }> = {
  'daily-life': {
    label: '日常闲聊',
    detail: '轻松破冰，适合陪伴型直播',
    script: '0-3 分钟：欢迎新进直播间的朋友，分享今天最想聊的一件小事，邀请大家在评论区报到。\n\n3-7 分钟：围绕「今天过得怎么样」展开，读 2-3 条评论并自然追问。\n\n7-11 分钟：分享一个生活小技巧或趣事，邀请观众说说自己的经历。\n\n11-15 分钟：总结高频话题，预告下一段会继续聊的内容，并引导关注。',
  },
  'emotional-support': {
    label: '情绪陪伴',
    detail: '温和交流，营造安全感',
    script: '0-3 分钟：用温和语气欢迎大家，邀请观众用一个词形容此刻的心情。\n\n3-7 分钟：选择评论区的情绪关键词回应，分享一个让自己放松的小方法。\n\n7-11 分钟：发起「今天想给自己一句什么话」的互动，耐心读出观众留言。\n\n11-15 分钟：做简短收束和积极鼓励，预告接下来会继续陪大家聊聊。',
  },
  'hobby-sharing': {
    label: '兴趣分享',
    detail: '围绕共同爱好展开交流',
    script: '0-3 分钟：介绍今天的兴趣话题，邀请观众在评论区说说自己的入坑经历。\n\n3-7 分钟：分享一个个人体验或实用建议，向评论区提一个具体问题。\n\n7-11 分钟：挑选 2-3 条留言延展讨论，比较不同做法或偏好。\n\n11-15 分钟：整理观众推荐清单，预告下一段将深入聊的方向。',
  },
  'interactive-games': {
    label: '互动小游戏',
    detail: '快速调动评论区参与',
    script: '0-3 分钟：欢迎观众并说明第一轮小游戏规则，邀请大家在评论区输入答案。\n\n3-7 分钟：公布有趣回答，发起第二轮二选一或默契挑战。\n\n7-11 分钟：根据评论区选择延续游戏，及时回应高参与观众。\n\n11-15 分钟：公布本轮互动结果，邀请大家关注并预告下一轮玩法。',
  },
}

function getCustomTopicRecommendation(topic: string): { label: string; detail: string; script: string } {
  const normalizedTopic = topic.trim()
  if (!normalizedTopic) return chatTopicRecommendations['daily-life']

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

const chatLayoutTaskTitle = '选择直播布局'
const showLayoutTaskTitle = '直播布局调整'
const chatLayoutTaskDetail = '已为你默认全屏摄像头画布（单人竖屏 · 9:16），可勾选画布小组件并在画布中拖动位置'
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
type CanvasWidgetKind = 'text' | 'goal'
type LiveCanvasComponentId = Extract<
  AtomicComponentId,
  'live-goal' | 'audience-poll' | 'audience-wishes'
>

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

function App() {
  const [view, setView] = useState<AppView>('onboarding')
  const [streamType, setStreamType] = useState<StreamKind>('music')
  const [streamTopic, setStreamTopic] = useState('晚间唱歌聊天')
  const [onboardingInput, setOnboardingInput] = useState('')
  const [lastLiveConfig, setLastLiveConfig] = useState<LastLiveConfig | null>(() =>
    loadLastLiveConfig(),
  )
  const [selectedEntryCategory, setSelectedEntryCategory] = useState<StreamThemeId | 'other' | null>(
    () => lastLiveConfig?.theme ?? null,
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
  const [preliveLayout, setPreliveLayout] = useState<PreliveLayout>('portrait')
  const [preliveScript, setPreliveScript] = useState(
    chatTopicRecommendations['daily-life'].script,
  )
  const [preliveHostBio, setPreliveHostBio] = useState('音乐聊天主播，用轻松歌单陪大家结束一天。')
  const [selectedChatTopic, setSelectedChatTopic] = useState<ChatTopicId>('daily-life')
  const [customChatTopic, setCustomChatTopic] = useState('')
  const [preliveCoverApplied, setPreliveCoverApplied] = useState(false)
  const prelivePollEnabled = true
  const prelivePollQuestion = '下一首唱什么？'
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
  const [chatTextOffset, setChatTextOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [chatGoalOffset, setChatGoalOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [gameCameraOffset, setGameCameraOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [hostComments, setHostComments] = useState<AudienceComment[]>([])
  const readyScore = Math.round(20 + completedPreliveTasks.length * (80 / preliveTasks.length))
  const [genieInput, setGenieInput] = useState('')
  const [isGenieComposerFocused, setIsGenieComposerFocused] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentWidgetSpec, setAgentWidgetSpec] = useState<WidgetSpec | null>(null)
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
  const [liveStartedAt, setLiveStartedAt] = useState(0)
  const [strategyWarmupComplete, setStrategyWarmupComplete] = useState(false)
  const [strategyCommentState, setStrategyCommentState] =
    useState<StrategyCommentState>('issue')
  const [liveAdjustment, setLiveAdjustment] = useState<LiveAdjustment | null>(null)
  const [canvasNotice, setCanvasNotice] = useState<LiveAdjustment | null>(null)
  const [isSuggestionPreview, setIsSuggestionPreview] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isBackgroundMusicPlaying, setIsBackgroundMusicPlaying] = useState(false)
  const [backgroundMusicError, setBackgroundMusicError] = useState('')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mobile')
  const [liveStageMode, setLiveStageMode] = useState<LiveStageMode>('preview')
  const [inputAtomicComponents, setInputAtomicComponents] = useState<AtomicComponentId[]>([])
  const [rightRailSource, setRightRailSource] = useState<RightRailSource>('trigger')
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
  const genieInputModeTimeoutRef = useRef<number | null>(null)
  const strategyRecoveryTimeoutRef = useRef<number | null>(null)
  const preliveVisualSettingsRef = useRef<VisualSettings | null>(null)
  const preliveAudioSettingsRef = useRef<AudioSettings | null>(null)
  const preliveSceneRef = useRef<Scene>('quality')
  const genieAbortRef = useRef<AbortController | null>(null)
  const lastGenieRequestRef = useRef<{ question: string; prompt: string } | null>(null)
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
  const audienceSnapshot = useMemo(
    () => view === 'live'
      ? mockAudienceEventAdapter.getStrategySnapshot(
          commentStrategy,
          applied,
          liveTick,
          commentPhase,
          liveStartedAt,
        )
      : emptyAudienceSnapshot,
    [applied, commentPhase, commentStrategy, liveStartedAt, liveTick, view],
  )
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
  const lastAnalyzedCommentIdRef = useRef<string | null>(null)
  const commentAnalysisTimeoutRef = useRef<number | null>(null)
  const commentTriggerTimesRef = useRef(new Map<string, number>())
  const strategyActivatedRef = useRef(false)
  const dismissedSignalIdsRef = useRef(new Set<LiveSuggestion['signalId']>())
  const removalTimeoutsRef = useRef(new Map<string, number>())
  const suggestionComponents = suggestionQueue.flatMap((suggestion) =>
    suggestion.widgets.map((widgetSpec, widgetIndex) => ({
      componentId: `${suggestion.queueId}-${widgetIndex}`,
      suggestion,
      widgetIndex,
      widgetSpec,
    })),
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
  const atomicRecalledComponents = (() => {
    const inputCandidates = inputAtomicComponents.map((componentId) => ({
        key: `input-${componentId}`,
        componentId,
        metric: 'Genie 输入意图',
        source: '输入框识别',
        suggestionNumber: null,
        suggestionId: null,
      }))
    const triggeredCandidates = suggestionQueue.flatMap((suggestion, suggestionIndex) =>
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
    const candidates = rightRailSource === 'input'
      ? inputCandidates
      : triggeredCandidates
    return candidates.filter((candidate) => {
      return !dismissedAtomicComponents.has(candidate.key)
    })
  })()
  const atomicComponentCountsBySuggestion = atomicRecalledComponents.reduce(
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
    : rightRailSource === 'input'
      ? 'components'
      : 'overview'

  useEffect(() => {
    suggestionQueueRef.current = suggestionQueue
  }, [suggestionQueue])

  useEffect(() => {
    latestDiagnosticsRef.current = diagnostics
    latestAudienceRef.current = audienceSnapshot
  }, [audienceSnapshot, diagnostics])

  useEffect(() => {
    const previous = previousDiagnosticsRef.current
    previousDiagnosticsRef.current = diagnostics
    if (view !== 'live' || strategyWarmupActive || !previous) return

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
    )
    if (nextQueue === currentQueue) return

    suggestionQueueRef.current = nextQueue
    setSelectedCanvasWidget(null)
    setRightRailSource('trigger')
    setSuggestionQueue(nextQueue)
    lastMetricUpdateAtRef.current = now
  }, [demoStrategy, diagnostics, strategyWarmupActive, view])

  useEffect(() => {
    if (
      view !== 'live' ||
      strategyWarmupActive ||
      demoStrategy !== 'normal'
    ) {
      if (commentAnalysisTimeoutRef.current !== null) {
        window.clearTimeout(commentAnalysisTimeoutRef.current)
        commentAnalysisTimeoutRef.current = null
      }
      return
    }

    const latestComment = audienceSnapshot.comments.at(-1)
    if (
      !latestComment ||
      latestComment.id === lastAnalyzedCommentIdRef.current ||
      commentAnalysisTimeoutRef.current !== null
    ) {
      return
    }
    lastAnalyzedCommentIdRef.current = latestComment.id

    commentAnalysisTimeoutRef.current = window.setTimeout(() => {
      commentAnalysisTimeoutRef.current = null
      const snapshot = latestAudienceRef.current
      const suggestion = createCommentInsightSuggestion(
        snapshot.insight,
        snapshot.comments,
      )
      if (!suggestion) return

      const triggerKey = snapshot.insight.category
      const now = Date.now()
      const lastTriggeredAt =
        commentTriggerTimesRef.current.get(triggerKey) ?? 0
      if (
        now - lastTriggeredAt <
        rightRailUpdateConfig.commentCategoryCooldownMs
      ) {
        return
      }

      const currentQueue = suggestionQueueRef.current
      const nextQueue = appendTriggeredSuggestion(
        currentQueue,
        suggestion,
        'comment',
        triggerKey,
        now,
      )
      if (nextQueue === currentQueue) return

      suggestionQueueRef.current = nextQueue
      setSelectedCanvasWidget(null)
      setRightRailSource('trigger')
      setSuggestionQueue(nextQueue)
      commentTriggerTimesRef.current.set(triggerKey, now)
    }, rightRailUpdateConfig.commentAnalysisDelayMs)
  }, [
    audienceSnapshot.comments,
    demoStrategy,
    strategyWarmupActive,
    view,
  ])

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
    if (!isGenieComposerFocused) return

    const leaveComposerOnOutsidePointer = (event: PointerEvent) => {
      if (!genieComposerRef.current?.contains(event.target as Node)) {
        setIsGenieComposerFocused(false)
      }
    }

    document.addEventListener('pointerdown', leaveComposerOnOutsidePointer)
    return () =>
      document.removeEventListener('pointerdown', leaveComposerOnOutsidePointer)
  }, [isGenieComposerFocused])

  useEffect(() => {
    if (view !== 'live') {
      strategyActivatedRef.current = false
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
    if (view !== 'live') return

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
        appendNewSuggestions(queue, incoming, dismissedSignalIdsRef.current),
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
      if (commentAnalysisTimeoutRef.current !== null) {
        window.clearTimeout(commentAnalysisTimeoutRef.current)
      }
      if (genieInputModeTimeoutRef.current !== null) {
        window.clearTimeout(genieInputModeTimeoutRef.current)
      }
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
    setLiveAdjustment(null)
    setIsPk(nextScene === 'pk')
    setCanvasNotice({
      name: `已切换至${sceneNoticeNames[nextScene]}`,
      detail: '场景配置已同步到直播画面。',
    })
  }

  const selectDemoStrategy = (strategyId: AudienceStrategyId) => {
    if (view !== 'live') return
    const strategy = getAudienceStrategy(strategyId)
    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
      strategyRecoveryTimeoutRef.current = null
    }
    setDemoStrategy(strategyId)
    setStrategyRevision((revision) => revision + 1)
    setStrategyCommentState('issue')
    setStrategyWarmupComplete(true)
    setStrategyMenuOpen(false)
    setScene(strategy.scene)
    setIsPk(view === 'live' && strategy.scene === 'pk')
    setApplied(false)
    setAgentWidgetSpec(null)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setSuggestionQueue([])
    setHiddenSuggestionIds(new Set())
    setInputAtomicComponents([])
    setRightRailSource('trigger')
    setDismissedAtomicComponents(new Set())
    setRemovingAtomicComponents(new Set())
    removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current.clear()
    dismissedSignalIdsRef.current.clear()
    commentTriggerTimesRef.current.clear()
    lastAnalyzedCommentIdRef.current = null
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
    setPreliveTaskIndex(0)
    setSelectedChatTopic('daily-life')
    setCustomChatTopic('')
    setPreliveScript(chatTopicRecommendations['daily-life'].script)
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
    setGameCameraOffset({ x: 0, y: 0 })
    applyCameraEffects(applyCameraEffectPreset('natural'))
    setView('prelive')
  }

  const selectEntryTheme = (theme: StreamThemeId | 'other') => {
    setSelectedEntryCategory(theme)
  }

  const startFromSelectedTheme = () => {
    if (!selectedEntryCategory || selectedEntryCategory === 'other') return
    beginPrelive(selectedEntryCategory)
  }

  const submitOnboardingInput = () => {
    const description = onboardingInput.trim()
    if (!description) return
    const theme = recognizeStreamTheme(description)
    setSelectedEntryCategory(theme)
    beginPrelive(theme, description)
  }

  const restoreLastLiveConfig = () => {
    if (!lastLiveConfig) return
    const { theme, savedConfig } = lastLiveConfig
    setStreamType(theme)
    setStreamTopic(savedConfig.topic)
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
    setPreliveTaskIndex(0)
    setSelectedEntryCategory(theme)
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

  const selectLiveComponent = (component: LiveCanvasComponentId | null) => {
    setSelectedLiveComponent(component)
    if (component) {
      setSelectedCanvasWidget(null)
      setRightRailSource('trigger')
    }
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
    setHostComments((prev) => [
      ...prev,
      {
        id: `host-comment-${Date.now()}-${prev.length}`,
        type: 'comment',
        userName: 'You',
        text,
        occurredAt: Date.now(),
      },
    ])
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
    if (prelivePollEnabled) {
      studioToolRegistry.execute('studio.configure_poll', {
        mode: 'apply',
        config: {
          question: prelivePollQuestion,
          options: ['甜歌', '炸场'],
          durationSeconds: 45,
        },
      }, studioToolContext)
    }
    setLiveTick(0)
    setLiveStartedAt(Math.round(performance.timeOrigin + event.timeStamp))
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
    setHiddenSuggestionIds(new Set())
    setInputAtomicComponents([])
    setRightRailSource('trigger')
    setDismissedAtomicComponents(new Set())
    setRemovingAtomicComponents(new Set())
    removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current.clear()
    dismissedSignalIdsRef.current.clear()
    commentTriggerTimesRef.current.clear()
    lastAnalyzedCommentIdRef.current = null
    lastMetricUpdateAtRef.current = 0
    previousDiagnosticsRef.current = null
    strategyActivatedRef.current = false
    setApplied(false)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setLiveStageMode('preview')
    setView('live')
  }

  const returnToPrelive = () => {
    const normalStrategy = getAudienceStrategy('normal')
    applyVisualSettings(
      preliveVisualSettingsRef.current ?? normalStrategy.visualSettings,
    )
    applyAudioSettings(
      preliveAudioSettingsRef.current ?? normalStrategy.audioSettings,
    )
    setScene(preliveSceneRef.current)
    setDemoStrategy('normal')
    setStrategyCommentState('normal')
    setStrategyWarmupComplete(false)
    setStrategyMenuOpen(false)
    setSuggestionQueue([])
    setHiddenSuggestionIds(new Set())
    setInputAtomicComponents([])
    setDismissedAtomicComponents(new Set())
    setRemovingAtomicComponents(new Set())
    setIsPk(false)
    setApplied(false)
    setLiveAdjustment(null)
    setSelectedLiveComponent(null)
    setView('prelive')
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

  const openCameraEffects = () => {
    studioToolRegistry.execute('studio.reset_camera_effects_preview', {}, studioToolContext)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    setAgentWidgetSpec(getCameraEffectsWidgetSpec())
    setApplied(false)
    setIsSuggestionPreview(false)
    setLiveAdjustment(null)
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
    request: { question: string; prompt: string },
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
        cameraEffects: studioState.cameraEffects,
        recommendedCameraEffects: recommendCameraEffects(
          studioState.cameraEffects,
          studioState.mediaMetrics.brightness.score,
        ),
      })
      if (genieAbortRef.current !== controller) return
      setChatMessages((messages) => [...messages, { role: 'assistant', text: result.text || '已生成可操作方案。' }])
      if (view !== 'onboarding' && result.widget) {
        setAgentWidgetSpec(result.widget)
        setApplied(false)
        setIsSuggestionPreview(false)
        setLiveAdjustment(null)
      }
      setGenieRequestStatus('idle')
    } catch (error) {
      if (genieAbortRef.current !== controller) return
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
    if (genieInputModeTimeoutRef.current !== null) {
      window.clearTimeout(genieInputModeTimeoutRef.current)
      genieInputModeTimeoutRef.current = null
    }
    setIsGenieComposerFocused(false)
    const intentRecall = recallAtomicComponents({
      source: 'input',
      text: question,
    })
    if (view === 'live') {
      setInputAtomicComponents(intentRecall.componentIds)
      setRightRailSource('input')
      setDismissedAtomicComponents((current) => {
        const next = new Set(current)
        intentRecall.componentIds.forEach((id) => next.delete(`input-${id}`))
        return next
      })
    }

    const context = view === 'prelive'
      ? '当前处于开播准备阶段，直播主题是晚间唱歌聊天。'
      : `当前处于直播中，诊断场景是${sceneCopy[scene].title}。`
    const studioState = useStudioStore.getState()
    const cameraContext = [
      `当前画面亮度：${studioState.mediaMetrics.brightness.value}，评分 ${studioState.mediaMetrics.brightness.score}/100。`,
      `当前人脸构图：${studioState.mediaMetrics.framing.value}，评分 ${studioState.mediaMetrics.framing.score}/100。`,
      `当前人像效果参数：${JSON.stringify({
        ...studioState.cameraEffects,
        backgroundImageUrl: studioState.cameraEffects.backgroundImageUrl ? 'local-image' : null,
      })}`,
      '涉及美颜、美妆或道具时必须返回 camera-effects 组件。settings 只需返回要修改的字段，未提及字段保持当前值。',
      '可用道具仅限 none、sparkles、glasses、heart-sticker；不要生成图片 URL 或未注册的效果。',
    ].join('\n')
    const prompt = [
      '你是 LIVE Studio Genie，一名专业、简洁的中文直播间助手。',
      context,
      cameraContext,
      '根据当前状态回答主播的问题。给出可直接执行的建议，保持在 120 个汉字以内。',
      widgetProtocol,
      `主播问题：${question}`,
    ].join('\n')

    void runGenieRequest({ question, prompt }, true)
  }

  const activateGenieInputMode = () => {
    setIsGenieComposerFocused(true)
    setSelectedCanvasWidget(null)
    setSelectedLiveComponent(null)
    if (genieInputModeTimeoutRef.current !== null) {
      window.clearTimeout(genieInputModeTimeoutRef.current)
    }
    genieInputModeTimeoutRef.current = window.setTimeout(() => {
      setIsGenieComposerFocused(false)
      genieInputModeTimeoutRef.current = null
    }, studioRuntimeConfig.suggestion.inputModeIdleMs)
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
    cameraAttemptedRef.current = false
    setView(nextView)
  }

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
          <span className="eyebrow"><i />LIVE STUDIO GENIE</span>
          <h1>陪伴你的<span>直播旅程</span></h1>
          <p>今天想播什么？告诉我，我来帮你准备。</p>
          <div className="stream-options" role="list" aria-label="直播主题">
            {STREAM_THEMES.filter((theme) => theme.id !== 'show').map((theme) => (
              <StreamOption
                key={theme.id}
                icon={themeIcon(theme.id)}
                label={theme.name}
                active={selectedEntryCategory === theme.id}
                onClick={() => selectEntryTheme(theme.id)}
              />
            ))}
            <StreamOption
              icon={<Sparkles />}
              label="其他"
              active={selectedEntryCategory === 'other'}
              onClick={() => selectEntryTheme('other')}
            />
          </div>
          {lastLiveConfig && (
            <button type="button" className="history-restore-card" onClick={restoreLastLiveConfig}>
              <span className="history-restore-icon"><History size={17} /></span>
              <span className="history-restore-body">
                <b>沿用历史直播设置</b>
                <small>点击恢复主播上场保存的直播配置</small>
              </span>
              <span className="history-restore-meta">
                <em>{lastLiveConfig.themeName}</em>
                {lastLiveConfig.lastLiveTime && (
                  <i>{formatLastLiveTime(lastLiveConfig.lastLiveTime)}</i>
                )}
              </span>
              <ArrowLeft size={15} className="arrow-forward" />
            </button>
          )}
          {selectedEntryCategory === 'other' && (
            <form className="theme-input" onSubmit={(event) => { event.preventDefault(); submitOnboardingInput() }}>
              <WandSparkles size={17} />
              <input value={onboardingInput} onChange={(event) => setOnboardingInput(event.target.value)} placeholder="用一句话描述你今天的直播..." aria-label="本场主题" autoFocus />
              <button type="submit" aria-label="识别主题并开始准备" disabled={!onboardingInput.trim()}>确认 <ArrowLeft size={16} className="arrow-forward" /></button>
            </form>
          )}
          {selectedEntryCategory !== 'other' && (
            <button
              type="button"
              className="onboarding-start-button"
              disabled={!selectedEntryCategory}
              onClick={startFromSelectedTheme}
            >
              <Sparkles size={16} />开始准备
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
    <main className={`app-shell live-app ${view === 'prelive' ? 'prelive-live-mode' : ''}`}>
      {view === 'prelive' && completedPreliveTasks.length === preliveTasks.length && !exitingPreliveTask && (
        <section className="golive-overlay" aria-label="开播准备完成">
          <div className="golive-dialog" role="status">
            <Check className="golive-mark" size={48} strokeWidth={3} aria-hidden="true" />
            <strong>准备进度100%</strong>
            <button className="golive-button" type="button" onClick={startLiveFromPrelive}>
              GO LIVE
            </button>
          </div>
        </section>
      )}
      <header className="topbar">
        <div className="live-brand">
          {view === 'live' ? (
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
                      onClick={() => selectDemoStrategy(strategy.id)}
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
          <b>{view === 'prelive' ? '今日开播准备工作台' : '直播中'}</b>
          <span className="live-session-pill"><i />{view === 'prelive' ? `${getStreamTheme(streamType).name} · ${streamTopic}` : `直播中 · ${formatDuration(liveTick)}`}</span>
        </div>
        <div className="live-status-actions">
          {view === 'live' && (
            <>
              <button
                className="prelive-entry-button"
                type="button"
                onClick={returnToPrelive}
              >
                <ArrowLeft size={14} />直播前设置
              </button>
              <button
                className="end-live-button"
                type="button"
                onClick={() => setShowEndLiveConfirm(true)}
              >
                <CircleStop size={14} />结束直播
              </button>
            </>
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
            diagnostics={view === 'live' ? diagnostics : undefined}
            hostComments={hostComments}
            onSendComment={sendHostComment}
          />
        </aside>

        <section className="stage-column">
          <div className="stage-toolbar">
            <div>
              <span className="stage-breadcrumb">{view === 'prelive' ? '今日开播准备' : isPk ? '直播中 · PK 对战' : '直播中'}</span>
              <h1>{view === 'prelive' ? streamTopic : '林小满的直播间'}</h1>
            </div>
            {view === 'prelive' ? (
              <button className="secondary-button" type="button" onClick={enableCamera}><Camera size={16} />连接设备</button>
            ) : (
              <div className="live-clock"><span /> LIVE&nbsp; {formatDuration(liveTick)}</div>
            )}
          </div>
          {view === 'live' ? (
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
          <LivePreview videoRef={videoRef} cameraEnabled={cameraEnabled} displayStream={displayStream} layoutEditing={isLayoutEditing && previewMode === 'studio'} isPk={isPk} applied={applied} scene={scene} strategy={view === 'live' && strategyCommentState === 'issue' ? demoStrategy : 'normal'} liveAdjustment={liveAdjustment} previewMode={previewMode} liveStageMode={liveStageMode} isPreviewing={isSuggestionPreview} audience={audienceSnapshot} isLive={view === 'live'} preliveTitle={streamTopic} preliveLayout={preliveLayout} stageBackgroundUrl={stageBackgroundUrl} bandLayout={bandLayoutActive} gameLayout={gameLayout} gameCameraOffset={gameCameraOffset} onGameCameraOffsetChange={setGameCameraOffset} onSelectLiveComponent={selectLiveComponent} chatWidgets={canvasWidgetsAvailable ? {
            text: chatTextEnabled ? chatTextValue : '',
            goalVisible: chatGoalEnabled,
            goal: { label: chatGoalTitle, current: 0, target: chatGoalTarget },
            textStyle: chatTextStyle,
            selectedWidget: selectedCanvasWidget,
            onSelectWidget: selectCanvasWidget,
            textOffset: chatTextOffset,
            goalOffset: chatGoalOffset,
            onTextOffsetChange: setChatTextOffset,
            onGoalOffsetChange: setChatGoalOffset,
          } : null} />
          {(cameraError || displayError || backgroundMusicError) && <p className="camera-warning">{displayError || cameraError || backgroundMusicError}</p>}
          <div className="stage-controls">
            <button type="button" className="control-button" onClick={enableCamera}><Camera size={18} /><span>{cameraEnabled ? '摄像头已连接' : '开启摄像头'}</span></button>
            <button type="button" className={`control-button ${isMicMuted ? 'active-control' : ''}`} onClick={() => setIsMicMuted((muted) => !muted)}><Mic size={18} /><span>{isMicMuted ? '麦克风已静音' : '麦克风'}</span></button>
            <button type="button" className={`control-button ${isBackgroundMusicPlaying ? 'active-control' : ''}`} onClick={toggleBackgroundMusic}><Music2 size={18} /><span>{isBackgroundMusicPlaying ? '停止 BGM' : '播放 BGM'}</span></button>
            <button type="button" className={`control-button ${activeWidgetSpec.type === 'camera-effects' ? 'active-control' : ''}`} onClick={openCameraEffects}><WandSparkles size={18} /><span>美化工具</span></button>
            <button type="button" className={`control-button ${displayStream ? 'active-control' : ''}`} onClick={toggleScreenShare}><MonitorUp size={18} /><span>{displayStream ? '停止投屏' : '游戏投屏'}</span></button>
            <button type="button" className={`control-button ${isLayoutEditing ? 'active-control' : ''}`} disabled={!displayStream} onClick={() => setIsLayoutEditing((editing) => !editing)}><LayoutTemplate size={18} /><span>{isLayoutEditing ? '锁定布局' : '编辑布局'}</span></button>
            {displayStream && isLayoutEditing && <button type="button" className="control-button" onClick={resetCameraLayerLayout}><RotateCcw size={18} /><span>重置布局</span></button>}
            <button type="button" className={`control-button ${pollStatus !== 'hidden' ? 'active-control' : ''}`} onClick={togglePollWidget}><LayoutTemplate size={18} /><span>{pollStatus !== 'hidden' ? '隐藏组件' : '互动组件'}</span></button>
            {view === 'live' && <button type="button" className={`pk-launch ${isPk ? 'active' : ''}`} onClick={() => changeScene(isPk ? 'quality' : 'pk')}><Users size={17} />{isPk ? '结束 PK' : '发起 PK'}</button>}
          </div>
          {view === 'prelive' && (
            <div className="prelive-go-live-bar">
              <div><b>直播准备度 {readyScore}%</b><span>{readyScore === 100 ? '全部设置已就绪' : `${completedPreliveTasks.length} / ${preliveTasks.length} 项已完成，可继续调整后开播`}</span></div>
              <div className="score-track"><i style={{ width: `${readyScore}%` }} /></div>
              <Button className="prelive-go-live-button" color="primary" onClick={startLiveFromPrelive}><Play size={16} fill="currentColor" />GO LIVE</Button>
            </div>
          )}
        </section>

        <aside className="genie-panel panel">
          {view === 'live' ? (
            <>
              <div className="live-genie-heading">
                <span><i />GENIE · READY TO ASSIST</span>
                <div className="live-follow-status">
                  <b>
                    {liveRightRailMode === 'canvas-config'
                      ? '组件配置'
                      : liveRightRailMode === 'components'
                        ? `${atomicRecalledComponents.length} 个组件`
                        : `${visibleSuggestionQueue.length} 条建议`}
                  </b>
                  <span className="suggestion-sync-status">
                    <i />
                    {liveRightRailMode === 'canvas-config'
                      ? '上下文已同步'
                      : liveRightRailMode === 'components'
                        ? '输入交互中'
                        : '实时监测'}
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
                    <AtomicRecallCard
                      componentId={selectedLiveComponent}
                      audience={audienceSnapshot}
                      onApplied={() => setApplied(true)}
                    />
                  ) : renderCanvasWidgetPanel(selectedCanvasWidget)}
                </section>
              ) : (
                <>
              {liveRightRailMode === 'overview' && (
                <section className="generated-suggestions" aria-label="实时生成建议">
                <div className="generated-suggestions-title">
                  <span>改进建议</span>
                  <small>阈值触发 · 评论分析不超过 3 秒</small>
                </div>
                <div className="generated-suggestion-list" role="list">
                  {visibleSuggestionQueue.map((suggestion) => {
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
                      <b className="suggestion-action-title">{presentation.title}</b>
                      <span className="suggestion-item-description">{presentation.reason}</span>
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
                className={`live-recommendations ${liveRightRailMode === 'components' ? 'is-components-only' : ''}`}
                aria-label="建议对应组件"
              >
                <div className="component-recall-heading">
                  <span><Zap size={13} />对应组件</span>
                  <b>
                    {liveRightRailMode === 'components'
                      ? '选择需要的操作组件'
                      : '全部建议的可操作组件'}
                  </b>
                  <small>{atomicRecalledComponents.length} 个待应用</small>
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
                  {atomicRecalledComponents.length === 0 && (
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
                  {agentWidgetSpec ? (
                    <WidgetRenderer
                      spec={agentWidgetSpec}
                      applied={applied}
                      isPreviewing={isSuggestionPreview}
                      onPreview={() => previewSuggestion(agentWidgetSpec)}
                      onApply={() => applySuggestion(agentWidgetSpec)}
                      onUndo={() => undoSuggestion(agentWidgetSpec)}
                      onAudioChange={updateAudioPreview}
                      onVisualChange={updateVisualPreview}
                      onCameraEffectsChange={updateCameraEffectsPreview}
                    />
                  ) : completedPreliveTasks.length === preliveTasks.length && !exitingPreliveTask ? (
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
                      taskIndex={preliveTaskIndex}
                      completed={false}
                      layout={preliveLayout}
                      streamType={streamType}
                      title={streamTopic}
                      script={preliveScript}
                      hostBio={preliveHostBio}
                      selectedChatTopic={selectedChatTopic}
                      customChatTopic={customChatTopic}
                      isChatCompanion={isChatCompanion}
                      canvasWidgetPanel={
                        canvasWidgetsAvailable && preliveTasks[preliveTaskIndex].id === 'layout'
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
                      onChatTopicChange={(topic) => {
                        setSelectedChatTopic(topic)
                        setCustomChatTopic('')
                        setPreliveScript(chatTopicRecommendations[topic].script)
                      }}
                      onCustomChatTopicChange={setCustomChatTopic}
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
          {chatMessages.length > 0 && <div className="genie-conversation" aria-live="polite">
            {chatMessages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                <div className="chat-message-meta">
                  <span>{message.role === 'assistant' ? 'Genie' : '你'}</span>
                  <small>{message.role === 'assistant' ? '直播助手' : '刚刚'}</small>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>}
          {genieRequestStatus === 'loading' && (
            <div className="genie-request-state is-loading" role="status">
              <LoaderCircle size={14} className="loading-icon" />
              <span>Genie 正在分析直播状态…</span>
              <button type="button" onClick={cancelGenieRequest}><CircleStop size={13} />取消</button>
            </div>
          )}
          {genieError && genieRequestStatus !== 'loading' && (
            <div className="genie-request-state is-error" role="alert">
              <span>{genieError}</span>
              <button type="button" onClick={retryGenieRequest}><RotateCcw size={13} />重试</button>
            </div>
          )}
          <form
            className="genie-composer"
            ref={genieComposerRef}
            onSubmit={handleGenieSubmit}
          >
            <div className="composer-field">
              <input
                value={genieInput}
                onChange={(event) => {
                  const value = event.target.value
                  setGenieInput(value)
                  if (view === 'live') {
                    setInputAtomicComponents(recallAtomicComponents({
                      source: 'input',
                      text: value,
                    }).componentIds)
                    setRightRailSource(value.trim() ? 'input' : 'trigger')
                  }
                  activateGenieInputMode()
                }}
                onFocus={activateGenieInputMode}
                onBlur={() => setIsGenieComposerFocused(false)}
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

function StreamOption({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`stream-option ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <Check size={14} />}</button>
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
}

function LivePreview({ videoRef, cameraEnabled, displayStream, layoutEditing, isPk, applied, scene, strategy, liveAdjustment, previewMode, liveStageMode, isPreviewing, audience, isLive, preliveTitle, preliveLayout, stageBackgroundUrl, bandLayout, gameLayout, gameCameraOffset, onGameCameraOffsetChange, onSelectLiveComponent, chatWidgets }: { videoRef: React.RefObject<HTMLVideoElement>; cameraEnabled: boolean; displayStream: MediaStream | null; layoutEditing: boolean; isPk: boolean; applied: boolean; scene: Scene; strategy: AudienceStrategyId; liveAdjustment: LiveAdjustment | null; previewMode: PreviewMode; liveStageMode: LiveStageMode; isPreviewing: boolean; audience: AudienceSnapshot; isLive: boolean; preliveTitle: string; preliveLayout: PreliveLayout; stageBackgroundUrl: string | null; bandLayout: boolean; gameLayout: 'vertical' | 'landscape' | null; gameCameraOffset: WidgetOffset; onGameCameraOffsetChange: (offset: WidgetOffset) => void; onSelectLiveComponent: (component: LiveCanvasComponentId | null) => void; chatWidgets: ChatCanvasWidgets | null }) {
  const displayVideoRef = useRef<HTMLVideoElement>(null)
  const visualSettings = useStudioStore((state) => state.visualSettings)
  const cameraEffects = useStudioStore((state) => state.cameraEffects)
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
        if (target.closest('.canvas-widget') || target.closest('.moveable-control-box')) return
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
      <LivePoll onSelect={() => onSelectLiveComponent('audience-poll')} />
      <LiveGoal onSelect={() => onSelectLiveComponent('live-goal')} />
      <LiveWishes onSelect={() => onSelectLiveComponent('audience-wishes')} />
      {chatWidgets && (
        <>
          <CanvasTextSource
            text={chatWidgets.text}
            textStyle={chatWidgets.textStyle}
            selected={chatWidgets.selectedWidget === 'text'}
            onSelect={() => chatWidgets.onSelectWidget('text')}
            offset={chatWidgets.textOffset}
            onOffsetChange={chatWidgets.onTextOffsetChange}
            editable={!showAudiencePreview}
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
              editable={!showAudiencePreview}
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
      <h2>互动组件</h2>
      <p>选择需要展示在直播画面中的互动内容</p>
      {renderWidgetRow('text', <Type size={15} />, '文字源', '画面中的装饰文字，可编辑内容与样式', textEnabled, onTextEnabledChange)}
      {renderWidgetRow('goal', <Target size={15} />, '目标源', '展示直播目标进度，鼓励观众互动', goalEnabled, onGoalEnabledChange)}
      <small className="chat-widget-tip">勾选后在画布中展示；点击列表项或画布中的组件即可编辑，拖动可调整位置</small>
    </div>
  )
}

function PreliveTaskCard({
  task,
  taskIndex,
  completed,
  layout,
  streamType,
  title,
  script,
  hostBio,
  selectedChatTopic,
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
  onChatTopicChange,
  onCustomChatTopicChange,
  onCoverAppliedChange,
  onVisualChange,
  onAudioChange,
  onApply,
  onSkip,
}: {
  task: typeof preliveTasks[number]
  taskIndex: number
  completed: boolean
  layout: PreliveLayout
  streamType: StreamKind
  title: string
  script: string
  hostBio: string
  selectedChatTopic: ChatTopicId
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
  onChatTopicChange: (topic: ChatTopicId) => void
  onCustomChatTopicChange: (topic: string) => void
  onCoverAppliedChange: (applied: boolean) => void
  onVisualChange: (property: keyof VisualSettings, percentage: number) => void
  onAudioChange: (property: keyof AudioSettings, value: number) => void
  onApply: () => void
  onSkip: () => void
}) {
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
  const scriptRecommendation = customChatTopic.trim()
    ? getCustomTopicRecommendation(customChatTopic)
    : chatTopicRecommendations[selectedChatTopic]
  const canApply = task.id !== 'content'
    ? true
    : [
        hostBio,
        title,
        script,
      ].every((value) => value.trim().length > 0)

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
      <span className="card-kicker">{task.priority} · 任务 {taskIndex + 1} / {preliveTasks.length}</span>
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
          <small className="chat-widget-tip">在下方「互动组件」中勾选文字源、目标源；点击画布中的组件即可编辑内容与样式，并可拖动调整位置</small>
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
    {task.id === 'layout' && canvasWidgetPanel}
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
          <label><span>主播简介</span><textarea value={hostBio} maxLength={100} rows={3} onChange={(event) => onHostBioChange(event.target.value)} /></label>
        </div>
        <div className="prelive-cover-suggestion">
          <div><Camera size={17} /><span><b>封面建议</b><small>使用当前画面的人像居中帧</small></span></div>
          <button type="button" className={coverApplied ? 'selected' : ''} onClick={() => onCoverAppliedChange(!coverApplied)}>
            {coverApplied ? <><Check size={12} />已采用</> : '采用'}
          </button>
        </div>
        <div className="prelive-form-section">
          <b>选择聊天主题</b>
          <small>选择预设主题，或输入自定义话题获取实时脚本建议。</small>
          <div className="chat-topic-grid" role="group" aria-label="聊天主题">
            {(Object.entries(chatTopicRecommendations) as Array<[ChatTopicId, typeof chatTopicRecommendations[ChatTopicId]]>).map(([topic, recommendation]) => (
              <button
                type="button"
                key={topic}
                className={`chat-topic-option ${!customChatTopic && selectedChatTopic === topic ? 'selected' : ''}`}
                aria-pressed={!customChatTopic && selectedChatTopic === topic}
                onClick={() => onChatTopicChange(topic)}
              >
                <b>{recommendation.label}</b>
                <small>{recommendation.detail}</small>
              </button>
            ))}
          </div>
          <label className="custom-chat-topic-input">
            <span>自定义聊天主题</span>
            <input
              value={customChatTopic}
              maxLength={40}
              placeholder="例如：第一次独自旅行的故事"
              onChange={(event) => onCustomChatTopicChange(event.target.value)}
            />
          </label>
          <div className="smart-script-recommendation" aria-live="polite">
            <div>
              <span>智能脚本建议</span>
              <b>{scriptRecommendation.label}</b>
              <small>{scriptRecommendation.detail}</small>
            </div>
            <button type="button" onClick={() => onScriptChange(scriptRecommendation.script)}>应用建议</button>
          </div>
        </div>
        <label><span>前 15 分钟内容脚本</span><textarea value={script} maxLength={1000} rows={11} onChange={(event) => onScriptChange(event.target.value)} /></label>
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

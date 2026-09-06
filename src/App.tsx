import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { ButtonV4 as Button } from '@byted/creator-ui'
import {
  Activity,
  ArrowLeft,
  AudioLines,
  Bell,
  Camera,
  Check,
  ChevronDown,
  CircleStop,
  Gamepad2,
  Gift,
  History,
  LayoutTemplate,
  Lightbulb,
  LoaderCircle,
  Mic,
  MessageCircle,
  MonitorUp,
  Music2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Type,
  Upload,
  Users,
  WandSparkles,
  WifiOff,
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
  appendNewSuggestions,
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
import { CanvasGoalRing, CanvasTextSource, type WidgetOffset } from './components/studio/PreliveCanvasWidgets'
import { LiveChatPanel } from './components/studio/LiveChatPanel'
import {
  audienceStrategies,
  doesSuggestionResolveStrategy,
  getAudienceStrategy,
  type AudienceStrategyId,
} from './config/audienceComments'
import { studioRuntimeConfig } from './config/studioRuntime'
import { askGenie, GenieRequestError } from './services/genie'
import { useStudioStore } from './store/studioStore'

type AppView = 'onboarding' | 'prelive' | 'live'
type Scene = StudioScene
type StreamKind = 'music' | 'chat' | 'game'
type PreliveTask = 'layout' | 'visual' | 'content' | 'interaction'
type PreliveLayout = 'portrait' | 'three-quarter' | 'stage'
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
type GenieRequestStatus = 'idle' | 'loading' | 'cancelled' | 'timeout' | 'error'
type StrategyCommentState = 'issue' | 'recovery' | 'normal'

const audienceTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

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

const preliveTasks: Array<{ id: PreliveTask; title: string; detail: string; action: string; priority: string }> = [
  { id: 'layout', title: '选择直播布局', detail: '根据直播类型确认画面布局，并检查画面源。', action: '确认画布方案', priority: '必须完成' },
  { id: 'visual', title: '人像美化', detail: '默认应用「清透日常」预设，可在美颜、美妆分类中微调，所有处理均在本地完成。', action: '应用美化方案', priority: '必须完成' },
  { id: 'content', title: '直播信息与内容', detail: '完善直播预告、主播介绍、主题说明和首 3 分钟内容脚本。', action: '保存内容方案', priority: '建议优化' },
  { id: 'interaction', title: '互动预热与开场', detail: '配置预热文案和首屏点歌投票，降低新观众的互动门槛。', action: '保存互动方案', priority: '可选增强' },
]

const chatLayoutTaskTitle = '选择直播布局'
const chatLayoutTaskDetail = '已为你默认全屏摄像头画布（单人竖屏 · 9:16），可勾选画布小组件并在画布中拖动位置'
const musicLayoutTaskDetail = '根据你的表演形式，选择适合的画面布局'
const defaultChatText = 'Good things will happen today ❤️'
const defaultGoalTitle = 'follower goal'
type CanvasWidgetKind = 'text' | 'goal'

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
  'camera-effects，props.settings 可只返回要修改的字段：smoothness(0-100)、exposure(-20到30)、warmth(0-40)、contrast(-20到40)、saturation(-30到50)、whitening/rosiness/clarity(0-100)、backgroundMode(none/blur/color/image)、backgroundPreset(neon-studio/music-room/cyber-arena/creator-loft)、backgroundColor、faceEffect(none/sparkles/glasses/sunglasses/heart-sticker/cheek-stars/butterfly-sticker/lightning-sticker)，以及 lipstick/blush/eyeshadow 的 Intensity(0-100) 和 Color、eyelinerIntensity(0-100)、highlightIntensity(0-100)。',
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
  const [strategyMenuOpen, setStrategyMenuOpen] = useState(false)
  const [isPk, setIsPk] = useState(false)
  const [applied, setApplied] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [preliveTaskIndex, setPreliveTaskIndex] = useState(0)
  const [completedPreliveTasks, setCompletedPreliveTasks] = useState<PreliveTask[]>([])
  const [preliveLayout, setPreliveLayout] = useState<PreliveLayout>('portrait')
  const [preliveScript, setPreliveScript] = useState(
    '刚进来的朋友先选一首歌，今天我们轻松聊聊；评论区打 1 选甜歌，打 2 选炸场。',
  )
  const [preliveAnnouncement, setPreliveAnnouncement] = useState('今晚 20:00 · 晚间唱歌聊天')
  const [preliveHostName, setPreliveHostName] = useState('林小满')
  const [preliveHostBio, setPreliveHostBio] = useState('音乐聊天主播，用轻松歌单陪大家结束一天。')
  const [preliveThemeDescription, setPreliveThemeDescription] = useState(
    '观众参与决定今晚歌单，包含点歌、聊天和阶段互动。',
  )
  const [preliveWarmupCopy, setPreliveWarmupCopy] = useState(
    '提前留言你最想听的歌，开播后优先安排。',
  )
  const [preliveCoverApplied, setPreliveCoverApplied] = useState(false)
  const [prelivePollEnabled, setPrelivePollEnabled] = useState(true)
  const [prelivePollQuestion, setPrelivePollQuestion] = useState('下一首唱什么？')
  const [isChatCompanion, setIsChatCompanion] = useState(false)
  const [chatTextEnabled, setChatTextEnabled] = useState(true)
  const [chatTextDraft, setChatTextDraft] = useState(defaultChatText)
  const [chatTextValue, setChatTextValue] = useState(defaultChatText)
  const [chatGoalEnabled, setChatGoalEnabled] = useState(true)
  const [chatGoalKind, setChatGoalKind] = useState<GoalKind>('follower')
  const [chatGoalTitle, setChatGoalTitle] = useState(defaultGoalTitle)
  const [musicBackgroundId, setMusicBackgroundId] = useState<string>(stageBackgrounds[0].id)
  const [customStageBackground, setCustomStageBackground] = useState<string | null>(null)
  const [stageBackgroundUploadError, setStageBackgroundUploadError] = useState('')
  const [selectedCanvasWidget, setSelectedCanvasWidget] = useState<CanvasWidgetKind | null>(null)
  const [chatTextOffset, setChatTextOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [chatGoalOffset, setChatGoalOffset] = useState<WidgetOffset>({ x: 0, y: 0 })
  const [hostComments, setHostComments] = useState<AudienceComment[]>([])
  const readyScore = 20 + completedPreliveTasks.length * 20
  const [genieInput, setGenieInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentWidgetSpec, setAgentWidgetSpec] = useState<WidgetSpec | null>(null)
  const [genieError, setGenieError] = useState('')
  const [genieRequestStatus, setGenieRequestStatus] = useState<GenieRequestStatus>('idle')
  const [liveTick, setLiveTick] = useState(0)
  const [liveStartedAt, setLiveStartedAt] = useState(0)
  const [strategyWarmupComplete, setStrategyWarmupComplete] = useState(false)
  const [strategyCommentState, setStrategyCommentState] =
    useState<StrategyCommentState>('issue')
  const [liveAdjustment, setLiveAdjustment] = useState<LiveAdjustment | null>(null)
  const [isSuggestionPreview, setIsSuggestionPreview] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isBackgroundMusicPlaying, setIsBackgroundMusicPlaying] = useState(false)
  const [backgroundMusicError, setBackgroundMusicError] = useState('')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mobile')
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [processedAudioStream, setProcessedAudioStream] = useState<MediaStream | null>(null)
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null)
  const [displayError, setDisplayError] = useState('')
  const [isLayoutEditing, setIsLayoutEditing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const backgroundMusicRef = useRef<BackgroundMusicPlayer | null>(null)
  const cameraAttemptedRef = useRef(false)
  const strategySelectorRef = useRef<HTMLDivElement>(null)
  const strategyRecoveryTimeoutRef = useRef<number | null>(null)
  const genieAbortRef = useRef<AbortController | null>(null)
  const lastGenieRequestRef = useRef<{ question: string; prompt: string } | null>(null)
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
  const [previewingComponentId, setPreviewingComponentId] = useState<string | null>(null)
  const [removingComponentIds, setRemovingComponentIds] = useState<Set<string>>(
    () => new Set(),
  )
  const latestDiagnosticsRef = useRef(diagnostics)
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
  const activeWidgetSpec = agentWidgetSpec
    ?? recalledComponents[0]?.widgetSpec
    ?? getSceneWidgetSpec(scene)

  useEffect(() => {
    latestDiagnosticsRef.current = diagnostics
  }, [diagnostics])

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
    if (strategyWarmupActive || strategyActivatedRef.current) return

    const nextQueue = appendNewSuggestions(
      [],
      latestDiagnosticsRef.current.suggestions,
      dismissedSignalIdsRef.current,
    )
    setSuggestionQueue(nextQueue)
    strategyActivatedRef.current = true
  }, [activeAudienceStrategy, strategyWarmupActive, view])

  useEffect(() => {
    if (view !== 'live') return

    let nextSyncAt = Date.now() + studioRuntimeConfig.suggestion.syncIntervalMs
    let timeoutId = 0
    const synchronizeSuggestions = () => {
      const incoming = latestDiagnosticsRef.current.suggestions
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
  }, [view])

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

  const changeScene = (nextScene: Scene) => {
    studioToolRegistry.execute('studio.reset_visual_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_audio_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_poll_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_live_goal_preview', {}, studioToolContext)
    studioToolRegistry.execute('studio.reset_camera_effects_preview', {}, studioToolContext)
    setAgentWidgetSpec(null)
    setScene(nextScene)
    setApplied(false)
    setIsSuggestionPreview(false)
    setLiveAdjustment(null)
    setIsPk(nextScene === 'pk')
  }

  const selectDemoStrategy = (strategyId: AudienceStrategyId) => {
    const strategy = getAudienceStrategy(strategyId)
    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
      strategyRecoveryTimeoutRef.current = null
    }
    setDemoStrategy(strategyId)
    setStrategyCommentState('issue')
    setStrategyMenuOpen(false)
    setScene(strategy.scene)
    setIsPk(view === 'live' && strategy.scene === 'pk')
    setApplied(false)
    setAgentWidgetSpec(null)
    setSuggestionQueue([])
    setPreviewingComponentId(null)
    setRemovingComponentIds(new Set())
    removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current.clear()
    dismissedSignalIdsRef.current.clear()
    strategyActivatedRef.current = false
    applyVisualSettings(strategy.visualSettings)
    applyAudioSettings(strategy.audioSettings)
    setLiveAdjustment({
      name: `已切换为${strategy.label}`,
      detail: strategy.description,
    })
  }

  const beginPrelive = (theme: StreamThemeId, topic?: string) => {
    const finalTopic = topic?.trim() || getStreamTheme(theme).defaultTopic
    setStreamType(theme)
    setStreamTopic(finalTopic)
    setPreliveAnnouncement(`今晚 20:00 · ${finalTopic}`)
    const chatCompanion = theme === 'chat'
    setIsChatCompanion(chatCompanion)
    setPreliveLayout('portrait')
    setPreviewMode('mobile')
    setCompletedPreliveTasks([])
    setPreliveTaskIndex(0)
    setChatTextEnabled(true)
    setChatTextDraft(defaultChatText)
    setChatTextValue(defaultChatText)
    setChatGoalEnabled(true)
    setChatGoalKind('follower')
    setChatGoalTitle(defaultGoalTitle)
    setMusicBackgroundId(stageBackgrounds[0].id)
    setCustomStageBackground(null)
    setStageBackgroundUploadError('')
    setSelectedCanvasWidget(null)
    setChatTextOffset({ x: 0, y: 0 })
    setChatGoalOffset({ x: 0, y: 0 })
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
    setPreliveAnnouncement(`今晚 20:00 · ${savedConfig.topic}`)
    setIsChatCompanion(savedConfig.isChatCompanion)
    setPreliveLayout(savedConfig.layout)
    setPreviewMode(savedConfig.layout === 'stage' ? 'studio' : 'mobile')
    setChatTextEnabled(savedConfig.chatTextEnabled)
    setChatTextValue(savedConfig.chatTextValue || defaultChatText)
    setChatTextDraft(savedConfig.chatTextValue || defaultChatText)
    setChatGoalEnabled(savedConfig.chatGoalEnabled)
    setChatGoalKind(savedConfig.chatGoalKind ?? 'follower')
    setChatGoalTitle(savedConfig.chatGoalTitle || defaultGoalTitle)
    setCustomStageBackground(null)
    setMusicBackgroundId(savedConfig.musicBackgroundId || stageBackgrounds[0].id)
    setStageBackgroundUploadError('')
    applyCameraEffects(applyCameraEffectPreset('natural'))
    setCompletedPreliveTasks(preliveTasks.map((task) => task.id))
    setPreliveTaskIndex(0)
    setSelectedEntryCategory(theme)
    setView('prelive')
  }

  const selectChatGoalKind = (kind: GoalKind) => {
    const option = goalKindOptions.find((item) => item.id === kind)
    setChatGoalKind(kind)
    if (option) setChatGoalTitle(option.defaultTitle)
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
  const showCanvasWidgets = isChatCompanion
    || (streamType === 'music' && preliveLayout === 'portrait')
  const chatGoalTarget = goalKindOptions.find((item) => item.id === chatGoalKind)?.target ?? 60000

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

    if (suggestion?.widgets.length === 1) {
      dismissedSignalIdsRef.current.add(suggestion.signalId)
    }
    setRemovingComponentIds((currentIds) => {
      const nextIds = new Set(currentIds)
      nextIds.add(componentId)
      return nextIds
    })
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
      setRemovingComponentIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(componentId)
        return nextIds
      })
      setPreviewingComponentId((currentId) =>
        currentId === componentId ? null : currentId,
      )
      setApplied(false)
      setIsSuggestionPreview(false)
      removalTimeoutsRef.current.delete(componentId)
    }, 320)
    removalTimeoutsRef.current.set(componentId, timeoutId)
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
    } else if (task.id === 'interaction') {
      if (prelivePollEnabled) {
        studioToolRegistry.execute('studio.configure_poll', {
          mode: 'preview',
          config: {
            question: prelivePollQuestion,
            options: ['甜歌', '炸场'],
            durationSeconds: 45,
          },
        }, studioToolContext)
      } else {
        studioToolRegistry.execute('studio.reset_poll_preview', {}, studioToolContext)
      }
    }

    const completed = new Set(completedPreliveTasks)
    completed.add(task.id)
    setCompletedPreliveTasks(Array.from(completed))
    setApplied(true)
    setLiveAdjustment({
      name: `${task.title}已保存`,
      detail: '配置已同步到本场直播方案。',
    })

    const nextIndex = preliveTasks.findIndex(
      (candidate) => !completed.has(candidate.id),
    )
    if (nextIndex >= 0) setPreliveTaskIndex(nextIndex)
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
        musicBackgroundId,
        completedTaskIds: completedPreliveTasks,
      },
    }
    saveLastLiveConfig(lastConfig)
    setLastLiveConfig(lastConfig)
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
    setStrategyWarmupComplete(false)
    setStrategyCommentState('issue')
    if (strategyRecoveryTimeoutRef.current !== null) {
      window.clearTimeout(strategyRecoveryTimeoutRef.current)
      strategyRecoveryTimeoutRef.current = null
    }
    setScene(selectedStrategy.scene)
    setIsPk(selectedStrategy.scene === 'pk')
    setSuggestionQueue([])
    setPreviewingComponentId(null)
    setRemovingComponentIds(new Set())
    removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    removalTimeoutsRef.current.clear()
    dismissedSignalIdsRef.current.clear()
    strategyActivatedRef.current = false
    setApplied(false)
    setView('live')
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
      '可用道具仅限 none、sparkles、glasses、sunglasses、heart-sticker、cheek-stars、butterfly-sticker、lightning-sticker；不要生成图片 URL 或未注册的效果。',
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

  const cancelGenieRequest = () => {
    genieAbortRef.current?.abort()
  }

  const retryGenieRequest = () => {
    if (!lastGenieRequestRef.current || genieRequestStatus === 'loading') return
    void runGenieRequest(lastGenieRequestRef.current, false)
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
            {STREAM_THEMES.map((theme) => (
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

  return (
    <main className={`app-shell live-app ${view === 'prelive' ? 'prelive-live-mode' : ''}`}>
      <header className="topbar">
        <div className="live-brand">
          <div className="strategy-selector" ref={strategySelectorRef}>
            <button
              className={`live-brand-mark strategy-trigger ${strategyMenuOpen ? 'active' : ''}`}
              type="button"
              aria-label={`演示策略：${selectedStrategy.label}`}
              aria-expanded={strategyMenuOpen}
              aria-haspopup="menu"
              title={`演示策略：${selectedStrategy.label}`}
              onClick={() => setStrategyMenuOpen((open) => !open)}
            >
              <Music2 size={17} />
              <i />
            </button>
            {strategyMenuOpen && (
              <div className="strategy-menu" role="menu" aria-label="选择演示策略">
                <div className="strategy-menu-heading">
                  <span>演示策略</span>
                  <small>开播后前 {studioRuntimeConfig.audience.strategyWarmupDurationMs / 1000} 秒使用正常评论</small>
                </div>
                {audienceStrategies.map((strategy) => (
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
          <strong>TikTok LIVE Studio</strong>
          <span className="live-brand-divider">/</span>
          <b>{view === 'prelive' ? '今日开播准备工作台' : '直播中'}</b>
          <span className="live-session-pill"><i />{view === 'prelive' ? `${streamType === 'music' ? '秀场' : streamType === 'game' ? '游戏' : '聊天'} · ${streamTopic}` : '直播中 · 00:42:18'}</span>
        </div>
        <div className="live-status-actions">
          {view === 'live' && (
              <button
                className="prelive-entry-button"
                type="button"
                onClick={() => {
                  setIsPk(false)
                  setView('prelive')
                }}
              >
                <ArrowLeft size={14} />直播前设置
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
          {view === 'live' ? (
            <LiveOperationsPanel audience={audienceSnapshot} diagnostics={diagnostics} />
          ) : (
            <LiveChatPanel
              isLive={false}
              cameraEnabled={cameraEnabled}
              isMicMuted={isMicMuted}
              audience={audienceSnapshot}
              hostComments={hostComments}
              onSendComment={sendHostComment}
            />
          )}
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
              <div className="live-clock"><span /> LIVE&nbsp; 00:23:41</div>
            )}
          </div>
          <div className="preview-mode-switch" role="tablist" aria-label="预览模式">
            <button type="button" className={previewMode === 'mobile' ? 'selected' : ''} onClick={() => setPreviewMode('mobile')}>移动端预览</button>
            <button type="button" className={previewMode === 'studio' ? 'selected' : ''} onClick={() => setPreviewMode('studio')}>Studio 视图</button>
          </div>
          <LivePreview videoRef={videoRef} cameraEnabled={cameraEnabled} displayStream={displayStream} layoutEditing={isLayoutEditing && previewMode === 'studio'} isPk={isPk} applied={applied} scene={scene} strategy={strategyCommentState === 'issue' ? demoStrategy : 'normal'} liveAdjustment={liveAdjustment} previewMode={previewMode} isPreviewing={isSuggestionPreview} audience={audienceSnapshot} isLive={view === 'live'} preliveTitle={streamTopic} preliveLayout={preliveLayout} stageBackgroundUrl={stageBackgroundUrl} chatWidgets={view === 'prelive' && showCanvasWidgets ? {
            text: chatTextEnabled ? chatTextValue : '',
            goalVisible: chatGoalEnabled,
            goal: { label: chatGoalTitle, current: 0, target: chatGoalTarget },
            selectedWidget: selectedCanvasWidget,
            onSelectWidget: setSelectedCanvasWidget,
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
              <div><b>直播准备度 {readyScore}%</b><span>{readyScore === 100 ? '全部设置已就绪' : `${completedPreliveTasks.length} / 4 项已完成，可继续调整后开播`}</span></div>
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
                  <b>{suggestionQueue.length} 条建议</b>
                  <span className="suggestion-sync-status"><i />每分钟同步</span>
                </div>
              </div>
              <section className="generated-suggestions" aria-label="实时生成建议">
                <div className="generated-suggestions-title">
                  <span>改进建议</span>
                  <small>仅追加新建议，保留历史记录</small>
                </div>
                <div className="generated-suggestion-list" role="list">
                  {suggestionQueue.map((suggestion) => (
                    <article
                      aria-label={`${suggestion.metric}，建议：${suggestion.action}`}
                      className={[
                        'generated-suggestion',
                        `tone-${suggestion.tone}`,
                        suggestion.isNew ? 'is-new' : '',
                        suggestion.widgets.length === 0 ? 'is-resolved' : '',
                      ].filter(Boolean).join(' ')}
                      key={suggestion.queueId}
                      role="listitem"
                    >
                      <span className="suggestion-item-heading">
                        <b>{suggestion.metric}</b>
                        <em>
                          {suggestion.widgets.length === 0
                            ? '已应用'
                            : suggestion.isNew
                              ? '新增'
                              : '待处理'}
                        </em>
                      </span>
                      <span className="suggestion-item-description">{suggestion.action}</span>
                    </article>
                  ))}
                  {suggestionQueue.length === 0 && (
                    <div className="suggestion-empty-state" role="status">
                      <Check size={15} />
                      <span>暂无待处理建议</span>
                    </div>
                  )}
                </div>
              </section>
              <div className="live-section-divider" />
              <section className="live-recommendations" aria-label="建议对应组件">
                <div className="component-recall-heading">
                  <span><Zap size={13} />对应组件</span>
                  <b>全部建议的可操作组件</b>
                  <small>{recalledComponents.length} 个待应用</small>
                </div>
                <div className="recalled-component-list">
                  {recalledComponents.map(({
                    componentId,
                    suggestion,
                    widgetIndex,
                    widgetSpec,
                  }) => (
                    <div
                      className={`recalled-component-item ${removingComponentIds.has(componentId) ? 'is-removing' : ''}`}
                      key={componentId}
                    >
                      <div className="component-source-heading">
                        <span>{suggestion?.metric ?? 'Genie 对话建议'}</span>
                        <small>{suggestion ? '实时监控召回' : '对话生成'}</small>
                      </div>
                      <WidgetRenderer
                        spec={widgetSpec}
                        applied={applied && removingComponentIds.has(componentId)}
                        isPreviewing={isSuggestionPreview && previewingComponentId === componentId}
                        onPreview={() => {
                          setPreviewingComponentId(componentId)
                          if (suggestion) {
                            setScene(suggestion.scene)
                            setIsPk(false)
                          }
                          previewSuggestion(widgetSpec)
                        }}
                        onApply={() => applySuggestion(
                          widgetSpec,
                          suggestion,
                          componentId,
                          widgetIndex,
                        )}
                        onUndo={() => {
                          setPreviewingComponentId(null)
                          undoSuggestion(widgetSpec)
                        }}
                        onAudioChange={updateAudioPreview}
                        onVisualChange={updateVisualPreview}
                        onCameraEffectsChange={updateCameraEffectsPreview}
                      />
                    </div>
                  ))}
                  {recalledComponents.length === 0 && (
                    <div className="component-empty-state">
                      <LayoutTemplate size={18} />
                      <span>暂无待应用组件</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="live-genie-heading">
                <span><i />GENIE · READY TO ASSIST</span>
                <b>{completedPreliveTasks.length} / 4 已就绪</b>
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
                  ) : (
                    <PreliveTaskCard
                      task={preliveTasks[preliveTaskIndex]}
                      taskIndex={preliveTaskIndex}
                      completed={completedPreliveTasks.includes(preliveTasks[preliveTaskIndex].id)}
                      layout={preliveLayout}
                      streamType={streamType}
                      title={streamTopic}
                      script={preliveScript}
                      announcement={preliveAnnouncement}
                      hostName={preliveHostName}
                      hostBio={preliveHostBio}
                      themeDescription={preliveThemeDescription}
                      warmupCopy={preliveWarmupCopy}
                      pollEnabled={prelivePollEnabled}
                      pollQuestion={prelivePollQuestion}
                      isChatCompanion={isChatCompanion}
                      chatTextEnabled={chatTextEnabled}
                      chatTextDraft={chatTextDraft}
                      chatGoalEnabled={chatGoalEnabled}
                      chatGoalKind={chatGoalKind}
                      chatGoalTitle={chatGoalTitle}
                      musicBackgroundId={musicBackgroundId}
                      customStageBackgroundUrl={customStageBackground}
                      stageBackgroundUploadError={stageBackgroundUploadError}
                      onChatTextEnabledChange={setChatTextEnabled}
                      onChatTextDraftChange={setChatTextDraft}
                      onChatTextApply={() => setChatTextValue(chatTextDraft)}
                      onChatGoalEnabledChange={setChatGoalEnabled}
                      onChatGoalKindChange={selectChatGoalKind}
                      onChatGoalTitleChange={setChatGoalTitle}
                      onSelectStageBackground={selectStageBackground}
                      onUploadStageBackground={uploadStageBackground}
                      onLayoutChange={(layout) => {
                        setPreliveLayout(layout)
                        setPreviewMode(layout === 'stage' ? 'studio' : 'mobile')
                      }}
                      onCameraEffectsChange={applyCameraEffects}
                      onTitleChange={setStreamTopic}
                      onScriptChange={setPreliveScript}
                      onAnnouncementChange={setPreliveAnnouncement}
                      onHostNameChange={setPreliveHostName}
                      onHostBioChange={setPreliveHostBio}
                      onThemeDescriptionChange={setPreliveThemeDescription}
                      onWarmupCopyChange={setPreliveWarmupCopy}
                      coverApplied={preliveCoverApplied}
                      onCoverAppliedChange={setPreliveCoverApplied}
                      onPollEnabledChange={setPrelivePollEnabled}
                      onPollQuestionChange={setPrelivePollQuestion}
                      onVisualChange={updateVisualPreview}
                      onAudioChange={updateAudioPreview}
                      onApply={completePreliveTask}
                      onSkip={skipPreliveTask}
                    />
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
          <form className="genie-composer" onSubmit={handleGenieSubmit}>
            <div className="composer-field">
              <input value={genieInput} onChange={(event) => setGenieInput(event.target.value)} placeholder="问 Genie：帮我调整一下…" aria-label="向 Genie 提问" />
              <span>{genieRequestStatus === 'loading' ? '正在生成建议' : 'Enter 发送'}</span>
            </div>
            <button type="submit" disabled={!genieInput.trim() || genieRequestStatus === 'loading'} aria-label="发送消息">
              {genieRequestStatus === 'loading' ? <LoaderCircle size={16} className="loading-icon" /> : <Send size={16} />}
            </button>
          </form>
        </aside>
      </section>
    </main>
  )
}

function StreamOption({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`stream-option ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <Check size={14} />}</button>
}

function themeIcon(theme: StreamThemeId) {
  if (theme === 'music') return <Music2 />
  if (theme === 'game') return <Gamepad2 />
  return <MessageCircle />
}

function StrategyIcon({ strategyId }: { strategyId: AudienceStrategyId }) {
  if (strategyId === 'dim-light') return <Lightbulb size={15} />
  if (strategyId === 'low-audio') return <Mic size={15} />
  if (strategyId === 'cold-interaction') return <MessageCircle size={15} />
  if (strategyId === 'network-lag') return <WifiOff size={15} />
  if (strategyId === 'pk-push') return <Users size={15} />
  return <Activity size={15} />
}

function LiveOperationsPanel({ audience, diagnostics }: {
  audience: AudienceSnapshot
  diagnostics: LiveDiagnostics
}) {
  const commentListRef = useRef<HTMLDivElement>(null)
  const newestCommentId = audience.comments.at(-1)?.id
  const gifts = [
    { icon: '🌹', user: audience.gifts[0]?.userName ?? 'Luna', gift: 'Rose', count: audience.gifts[0]?.count ?? 5, time: '12:41:30' },
    { icon: '♪', user: 'Alex', gift: 'TikTok', count: 1, time: '12:42:02' },
    { icon: '♥', user: audience.gifts[1]?.userName ?? 'Mie', gift: 'Heart', count: audience.gifts[1]?.count ?? 10, time: '12:42:10' },
  ]

  useEffect(() => {
    const commentList = commentListRef.current
    if (commentList) {
      commentList.scrollTop = commentList.scrollHeight
    }
  }, [newestCommentId])

  return (
    <div className="live-operations">
      <section className="indicator-section" aria-label="实时指标">
        <h2>Real-time Indicators</h2>
        <span className="monitoring-summary"><i />实时采样中 · {diagnostics.healthyCount} 项正常</span>
        <section className="metric-group good-metrics" aria-label="做得好的">
          <h3><Check size={13} />做得好的</h3>
          <div className="indicator-list">
            {diagnostics.goodSignals.map((indicator) => <IndicatorRow key={indicator.id} {...indicator} />)}
          </div>
        </section>
        <section className="metric-group improvement-metrics" aria-label="需要改进的">
          <h3><Zap size={13} />需要改进的</h3>
          <div className="indicator-list improvement-list">
            {diagnostics.improvements.map((indicator) => <IndicatorRow key={indicator.id} {...indicator} />)}
          </div>
        </section>
      </section>
      <section className="activity-section gift-activity">
        <h2>Gift</h2>
        {gifts.map((gift, index) => (
          <div className={index === 1 ? 'activity-row highlighted' : 'activity-row'} key={`${gift.user}-${gift.gift}`}>
            <i>{gift.icon}</i>
            <span><b>{gift.user}</b> 送出 <em>{gift.gift}</em> ×{gift.count}</span>
            <time>{gift.time}</time>
          </div>
        ))}
      </section>
      <section className="activity-section comment-activity">
        <h2>Comment</h2>
        <div className="prototype-comment-list" ref={commentListRef} role="log" aria-label="实时评论列表" aria-live="polite" tabIndex={0}>
          {audience.comments.map((comment, index) => (
            <div className="prototype-comment" key={comment.id}>
              <i className={`avatar avatar-${index % 4 + 1}`}>{comment.userName.slice(0, 1)}</i>
              <span><b>{comment.userName}:</b> {comment.text}</span>
              <time dateTime={new Date(comment.occurredAt).toISOString()}>
                {audienceTimeFormatter.format(comment.occurredAt)}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function IndicatorRow({ label, value, score, tone, direction, trendLabel, audio = false }: {
  label: string
  value: string
  score: number
  tone: string
  direction: 'up' | 'down'
  trendLabel: string
  audio?: boolean
}) {
  const displayValue = label === '人脸构图'
    ? value.replace('人脸 ', '')
    : value

  return (
    <div className={`indicator-row ${tone}`}>
      <span className="indicator-label"><i />{label}</span>
      {audio
        ? <span className="audio-wave" aria-hidden="true">{Array.from({ length: 17 }, (_, index) => <i key={index} />)}</span>
        : <span className="indicator-track"><i style={{ width: `${Math.max(8, Math.min(100, score))}%` }} /></span>}
      <b>{displayValue}<em>{direction === 'up' ? ` ${trendLabel} ↑` : ` ${trendLabel} ↓`}</em></b>
    </div>
  )
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
        if (!unlocked) return null
        return (
          <button
            className={`check-item ${currentTask === task.id ? 'active' : ''}`}
            type="button"
            key={task.id}
            onClick={() => onSelect(index)}
          >
            <span className={completed ? 'done' : ''}>
              {completed ? <Check size={13} /> : index + 1}
            </span>
            <div><b>{task.title}</b><small>{task.priority} · {completed ? '已完成' : currentTask === task.id ? '正在设置' : '待确认'}</small></div>
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
  selectedWidget: CanvasWidgetKind | null
  onSelectWidget: (widget: CanvasWidgetKind | null) => void
  textOffset: WidgetOffset
  goalOffset: WidgetOffset
  onTextOffsetChange: (offset: WidgetOffset) => void
  onGoalOffsetChange: (offset: WidgetOffset) => void
}

function LivePreview({ videoRef, cameraEnabled, displayStream, layoutEditing, isPk, applied, scene, strategy, liveAdjustment, previewMode, isPreviewing, audience, isLive, preliveTitle, preliveLayout, stageBackgroundUrl, chatWidgets }: { videoRef: React.RefObject<HTMLVideoElement>; cameraEnabled: boolean; displayStream: MediaStream | null; layoutEditing: boolean; isPk: boolean; applied: boolean; scene: Scene; strategy: AudienceStrategyId; liveAdjustment: LiveAdjustment | null; previewMode: PreviewMode; isPreviewing: boolean; audience: AudienceSnapshot; isLive: boolean; preliveTitle: string; preliveLayout: PreliveLayout; stageBackgroundUrl: string | null; chatWidgets: ChatCanvasWidgets | null }) {
  const displayVideoRef = useRef<HTMLVideoElement>(null)
  const visualSettings = useStudioStore((state) => state.visualSettings)
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

  return <div style={previewStyle} className={`live-stage ${applied ? 'applied' : ''} ${isPreviewing ? 'previewing' : ''} ${isPk ? 'pk-stage' : ''} scene-${scene} ${previewMode === 'studio' ? 'studio-preview' : 'mobile-preview'} ${!isLive ? `prelive-${preliveLayout}` : ''}`}>
    <div className="stage-glow" />
    <div className="scan-lines" />
    <div
      className={`host-stage ${displayStream ? 'screen-sharing' : ''}`}
      onPointerDown={() => chatWidgets?.onSelectWidget(null)}
    >
      {!isLive && preliveLayout === 'three-quarter' && stageBackgroundUrl && (
        <div
          className="stage-background-layer"
          style={{ backgroundImage: `url("${stageBackgroundUrl}")` }}
          aria-hidden="true"
        />
      )}
      {displayStream
        ? <>
            <video ref={displayVideoRef} autoPlay muted playsInline className="screen-feed" />
            {cameraEnabled && <EditableCameraLayer videoRef={videoRef} editing={layoutEditing} />}
          </>
        : cameraEnabled
          ? <div className="camera-source">
              <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
              <CameraEffectsCanvas videoRef={videoRef} />
            </div>
          : <DemoHost />}
      {previewMode === 'studio' && <div className="studio-guides"><i /><i /><i /></div>}
      <div className="stage-label"><span />{isLive ? 'LIVE' : '林小满'}</div>
      {!isPk && isLive && <><div className="viewer-bubble"><Users size={14} />{audience.viewerCount.toLocaleString()}</div><div className="stage-duration">00:42:18</div></>}
      {!isLive && <div className="prelive-stage-summary"><span>开播预览</span><b>{preliveTitle || '未填写直播标题'}</b><small>{preliveLayout === 'portrait' ? '全屏摄像头 · 单人竖屏 9:16' : preliveLayout === 'three-quarter' ? '3/4 摄像头 · 舞台背景' : '秀场舞台 · 16:9'}</small></div>}
      {applied && <div className="applied-badge"><Check size={13} />方案已应用</div>}
      {strategy === 'dim-light' && <div className="stage-hint"><Lightbulb size={14} />环境偏暗</div>}
      {strategy === 'network-lag' && <div className="stage-hint"><WifiOff size={14} />网络波动</div>}
      {strategy === 'low-audio' && <div className="audio-meter"><AudioLines size={15} /><span>音频峰值偏低</span><i /><i /><i /><i /></div>}
      {liveAdjustment && <div className="adjustment-toast"><Zap size={14} /><div><b>{liveAdjustment.name}</b><span>{liveAdjustment.detail}</span></div></div>}
      <LivePoll />
      <LiveGoal />
      {chatWidgets && (
        <>
          <CanvasTextSource
            text={chatWidgets.text}
            selected={chatWidgets.selectedWidget === 'text'}
            onSelect={() => chatWidgets.onSelectWidget('text')}
            offset={chatWidgets.textOffset}
            onOffsetChange={chatWidgets.onTextOffsetChange}
          />
          {chatWidgets.goalVisible && (
            <CanvasGoalRing
              label={chatWidgets.goal.label}
              current={chatWidgets.goal.current}
              target={chatWidgets.goal.target}
              selected={chatWidgets.selectedWidget === 'goal'}
              onSelect={() => chatWidgets.onSelectWidget('goal')}
              offset={chatWidgets.goalOffset}
              onOffsetChange={chatWidgets.onGoalOffsetChange}
            />
          )}
        </>
      )}
    </div>
    {isPk && <><div className="pk-versus">VS</div><div className="opponent-stage"><DemoOpponent /><div className="stage-label opponent"><span />陈妍</div></div><div className="pk-scorebar"><div><b>8,740</b><span>林小满</span></div><strong>01:18</strong><div><b>10,000</b><span>陈妍</span></div></div></>}
    {isLive && <div className="floating-comments">
      {audience.comments.slice(0, 2).map((comment) => <span key={comment.id}>{comment.text}</span>)}
    </div>}
  </div>
}

function DemoHost() {
  return <div className="demo-host"><div className="light-rays" /><div className="host-hair" /><div className="host-face"><i /><i /><b /></div><div className="host-body" /><div className="host-necklace" /></div>
}

function DemoOpponent() {
  return <div className="demo-opponent"><div className="opponent-hair" /><div className="opponent-face" /><div className="opponent-body" /></div>
}

function PreliveTaskCard({
  task,
  taskIndex,
  completed,
  layout,
  streamType,
  title,
  script,
  announcement,
  hostName,
  hostBio,
  themeDescription,
  warmupCopy,
  coverApplied,
  pollEnabled,
  pollQuestion,
  isChatCompanion,
  chatTextEnabled,
  chatTextDraft,
  chatGoalEnabled,
  chatGoalKind,
  chatGoalTitle,
  musicBackgroundId,
  customStageBackgroundUrl,
  stageBackgroundUploadError,
  onChatTextEnabledChange,
  onChatTextDraftChange,
  onChatTextApply,
  onChatGoalEnabledChange,
  onChatGoalKindChange,
  onChatGoalTitleChange,
  onSelectStageBackground,
  onUploadStageBackground,
  onLayoutChange,
  onCameraEffectsChange,
  onTitleChange,
  onScriptChange,
  onAnnouncementChange,
  onHostNameChange,
  onHostBioChange,
  onThemeDescriptionChange,
  onWarmupCopyChange,
  onCoverAppliedChange,
  onPollEnabledChange,
  onPollQuestionChange,
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
  announcement: string
  hostName: string
  hostBio: string
  themeDescription: string
  warmupCopy: string
  coverApplied: boolean
  pollEnabled: boolean
  pollQuestion: string
  isChatCompanion: boolean
  chatTextEnabled: boolean
  chatTextDraft: string
  chatGoalEnabled: boolean
  chatGoalKind: GoalKind
  chatGoalTitle: string
  musicBackgroundId: string
  customStageBackgroundUrl: string | null
  stageBackgroundUploadError: string
  onChatTextEnabledChange: (enabled: boolean) => void
  onChatTextDraftChange: (draft: string) => void
  onChatTextApply: () => void
  onChatGoalEnabledChange: (enabled: boolean) => void
  onChatGoalKindChange: (kind: GoalKind) => void
  onChatGoalTitleChange: (title: string) => void
  onSelectStageBackground: (backgroundId: string) => void
  onUploadStageBackground: (file: File | undefined) => void
  onLayoutChange: (layout: PreliveLayout) => void
  onCameraEffectsChange: (settings: CameraEffects) => void
  onTitleChange: (title: string) => void
  onScriptChange: (script: string) => void
  onAnnouncementChange: (announcement: string) => void
  onHostNameChange: (name: string) => void
  onHostBioChange: (bio: string) => void
  onThemeDescriptionChange: (description: string) => void
  onWarmupCopyChange: (copy: string) => void
  onCoverAppliedChange: (applied: boolean) => void
  onPollEnabledChange: (enabled: boolean) => void
  onPollQuestionChange: (question: string) => void
  onVisualChange: (property: keyof VisualSettings, percentage: number) => void
  onAudioChange: (property: keyof AudioSettings, value: number) => void
  onApply: () => void
  onSkip: () => void
}) {
  const isChatLayout = isChatCompanion && task.id === 'layout'
  const isMusicLayout = streamType === 'music' && task.id === 'layout'
  const cardTitle = isChatLayout ? chatLayoutTaskTitle : task.title
  const cardDetail = isChatLayout ? chatLayoutTaskDetail : isMusicLayout ? musicLayoutTaskDetail : task.detail
  const canApply = task.id !== 'content'
    ? task.id !== 'interaction' || (
        warmupCopy.trim().length > 0 &&
        (!pollEnabled || pollQuestion.trim().length > 0)
      )
    : [
        announcement,
        hostName,
        hostBio,
        title,
        themeDescription,
        script,
      ].every((value) => value.trim().length > 0)

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
          <b className="chat-widget-picker-title">画布小组件</b>
          <label className="prelive-toggle-row chat-widget-toggle">
            <span><Type size={15} />文字源</span>
            <input type="checkbox" checked={chatTextEnabled} onChange={(event) => onChatTextEnabledChange(event.target.checked)} />
          </label>
          {chatTextEnabled && (
            <div className="chat-text-config">
              <input
                value={chatTextDraft}
                maxLength={40}
                placeholder="输入画布上展示的文字"
                aria-label="文字源内容"
                onChange={(event) => onChatTextDraftChange(event.target.value)}
              />
              <button type="button" onClick={onChatTextApply}>更新</button>
            </div>
          )}
          <label className="prelive-toggle-row chat-widget-toggle">
            <span><Target size={15} />目标源</span>
            <input type="checkbox" checked={chatGoalEnabled} onChange={(event) => onChatGoalEnabledChange(event.target.checked)} />
          </label>
          {chatGoalEnabled && (
            <div className="chat-goal-config">
              <div className="goal-kind-select" role="group" aria-label="目标类型">
                {goalKindOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={chatGoalKind === option.id ? 'selected' : ''}
                    aria-pressed={chatGoalKind === option.id}
                    onClick={() => onChatGoalKindChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input
                value={chatGoalTitle}
                maxLength={30}
                placeholder="输入目标标题，如 follower goal"
                aria-label="目标标题"
                onChange={(event) => onChatGoalTitleChange(event.target.value)}
              />
              <small className="chat-widget-tip">已在画布中添加目标卡片，可在画布中拖动调整位置</small>
            </div>
          )}
        </div>
      ) : isMusicLayout ? (
        <div className="music-layout-picker">
          <div className="task-choice-row">
            <button type="button" className={`task-choice ${layout === 'portrait' ? 'selected' : ''}`} onClick={() => onLayoutChange('portrait')}><Camera size={15} /><span><b>全屏摄像头布局</b></span></button>
            <button type="button" className={`task-choice ${layout === 'three-quarter' ? 'selected' : ''}`} onClick={() => onLayoutChange('three-quarter')}><LayoutTemplate size={15} /><span><b>3/4 摄像头布局</b><small>保留主体画面，同时增加舞台氛围背景</small></span></button>
          </div>
          {layout === 'three-quarter' && (
            <div className="stage-background-picker">
              <b className="stage-background-title">选择舞台背景</b>
              <small className="stage-background-detail">为底部画面选择适合音乐现场的氛围背景</small>
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
          )}
        </div>
      ) : (
        <div className="task-choice-row">
          <button type="button" className={`task-choice ${layout === 'portrait' ? 'selected' : ''}`} onClick={() => onLayoutChange('portrait')}><Camera size={15} /><span><b>单人竖屏</b><small>9:16 · 聊天 / 音乐</small></span></button>
          <button type="button" className={`task-choice ${layout === 'stage' ? 'selected' : ''}`} onClick={() => onLayoutChange('stage')}><LayoutTemplate size={15} /><span><b>秀场舞台</b><small>16:9 · 表演 / 游戏</small></span></button>
        </div>
      )
    )}
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
          <b>直播预告信息</b>
          <label><span>开播时间与预告</span><input value={announcement} maxLength={50} onChange={(event) => onAnnouncementChange(event.target.value)} /></label>
        </div>
        <div className="prelive-form-section">
          <b>主播介绍</b>
          <label><span>主播名称</span><input value={hostName} maxLength={20} onChange={(event) => onHostNameChange(event.target.value)} /></label>
          <label><span>简介</span><textarea value={hostBio} maxLength={100} rows={3} onChange={(event) => onHostBioChange(event.target.value)} /></label>
        </div>
        <div className="prelive-form-section">
          <b>直播主题说明</b>
          <label><span>直播标题</span><input value={title} maxLength={30} onChange={(event) => onTitleChange(event.target.value)} /></label>
          <label><span>主题说明</span><textarea value={themeDescription} maxLength={120} rows={3} onChange={(event) => onThemeDescriptionChange(event.target.value)} /></label>
        </div>
        <div className="prelive-cover-suggestion">
          <div><Camera size={17} /><span><b>封面建议</b><small>使用当前画面的人像居中帧</small></span></div>
          <button type="button" className={coverApplied ? 'selected' : ''} onClick={() => onCoverAppliedChange(!coverApplied)}>
            {coverApplied ? <><Check size={12} />已采用</> : '采用'}
          </button>
        </div>
        <label><span>首 3 分钟内容脚本</span><textarea value={script} maxLength={240} rows={5} onChange={(event) => onScriptChange(event.target.value)} /></label>
        <small>{title.length} / 30 · {script.length} / 240</small>
      </div>
    )}
    {task.id === 'interaction' && (
      <div className="prelive-form">
        <div className="prelive-form-section">
          <b>互动预热文案</b>
          <label><span>开播前引导</span><textarea value={warmupCopy} maxLength={100} rows={3} onChange={(event) => onWarmupCopyChange(event.target.value)} /></label>
        </div>
        <label className="prelive-toggle-row">
          <span><Gift size={15} />开播时展示点歌投票</span>
          <input type="checkbox" checked={pollEnabled} onChange={(event) => onPollEnabledChange(event.target.checked)} />
        </label>
        <label className={!pollEnabled ? 'is-disabled' : ''}>
          <span>投票问题</span>
          <input value={pollQuestion} maxLength={30} disabled={!pollEnabled} onChange={(event) => onPollQuestionChange(event.target.value)} />
        </label>
        <div className="prelive-poll-preview"><b>{pollQuestion || '下一首唱什么？'}</b><span>甜歌</span><span>炸场</span><small>开播后展示 45 秒</small></div>
      </div>
    )}
    <Button className="primary-button full-button" color="primary" disabled={!canApply} onClick={onApply}><Check size={16} />{completed ? '更新当前设置' : task.action}</Button>
    <button className="card-text-button" type="button" onClick={onSkip}>跳过并稍后处理</button>
  </div>
}

export default App

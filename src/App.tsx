import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ButtonV4 as Button } from '@byted/creator-ui'
import {
  Activity,
  ArrowLeft,
  AudioLines,
  Bot,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  CircleStop,
  Gamepad2,
  Gift,
  LayoutTemplate,
  Lightbulb,
  LoaderCircle,
  Mic,
  MessageCircle,
  MonitorUp,
  Music2,
  Play,
  RotateCcw,
  Save,
  Send,
  Signal,
  Sparkles,
  Users,
  WandSparkles,
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
import { requestCameraStream, requestDisplayStream, stopMediaStream } from './capabilities/media/browserMedia'
import { useMediaMonitoring } from './capabilities/monitoring/useMediaMonitoring'
import type { MediaMetric } from './capabilities/monitoring/types'
import type { VisualSettings } from './capabilities/visual/types'
import type { CameraEffects } from './capabilities/video/cameraEffects'
import { Adjustment } from './components/genie/Adjustment'
import { WidgetRenderer } from './components/genie/WidgetRenderer'
import { CameraEffectsCanvas } from './components/studio/CameraEffectsCanvas'
import { EditableCameraLayer } from './components/studio/EditableCameraLayer'
import { LiveGoal } from './components/studio/LiveGoal'
import { LivePoll } from './components/studio/LivePoll'
import { askGenie, GenieRequestError } from './services/genie'
import { useStudioStore } from './store/studioStore'

type AppView = 'onboarding' | 'prelive' | 'live'
type Scene = StudioScene
type StreamKind = 'music' | 'chat' | 'game'
type PreliveTask = 'layout' | 'visual' | 'content' | 'interaction'
type PreviewMode = 'mobile' | 'studio'
type GenieRequestStatus = 'idle' | 'loading' | 'cancelled' | 'timeout' | 'error'

type Metric = {
  label: string
  value: string
  score: number
  tone: 'good' | 'warn' | 'bad'
}

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

const sceneMetrics: Record<Scene, Metric[]> = {
  quality: [
    { label: '画面亮度', value: '42 / 100', score: 42, tone: 'bad' },
    { label: '画面清晰度', value: '720p', score: 72, tone: 'good' },
    { label: '背景氛围', value: '待增强', score: 36, tone: 'warn' },
  ],
  interaction: [
    { label: '评论密度', value: '低', score: 28, tone: 'bad' },
    { label: '静默时长', value: '57 s', score: 34, tone: 'warn' },
    { label: '新观众进入', value: '+ 38', score: 62, tone: 'good' },
  ],
  troubleshoot: [
    { label: '麦克风峰值', value: '偏低', score: 31, tone: 'bad' },
    { label: '负向反馈', value: '声音小 × 6', score: 32, tone: 'bad' },
    { label: '画面质量', value: '正常', score: 79, tone: 'good' },
  ],
  pk: [
    { label: '当前贡献值', value: '8,740', score: 66, tone: 'warn' },
    { label: '对手贡献值', value: '10,000', score: 76, tone: 'good' },
    { label: '冲刺互动率', value: '68%', score: 68, tone: 'good' },
  ],
}

const preliveTasks: Array<{ id: PreliveTask; title: string; detail: string; action: string }> = [
  { id: 'layout', title: '确认画布布局', detail: '当前为单人竖屏相机布局，你可以换一种布局或选择画面源后生成。', action: '确认当前布局' },
  { id: 'visual', title: '完成画风检测', detail: '检测到光线偏冷，建议预览暖色补光和轻度磨皮。', action: '应用画面预览' },
  { id: 'content', title: '确认标题与开场脚本', detail: '已生成直播标题、首 3 分钟口播与点歌顺序。', action: '应用内容方案' },
  { id: 'interaction', title: '设置互动开场', detail: '建议首屏展示点歌投票，降低新观众参与门槛。', action: '添加点歌投票' },
]

const widgetProtocol = [
  '如果建议适合用控件执行，请在正文末尾追加 <widget>JSON</widget>，不要使用 Markdown 代码块。',
  'JSON 公共字段：version 固定为 "1.0"，并包含 type、title、detail、actionLabel、props。',
  '允许类型：',
  'visual-adjustment，props.settings 包含 brightness(0.6-1.6)、contrast(0.6-1.6)、warmth(0-0.6)。',
  'audience-poll，props 包含 question、options(2-4项)、durationSeconds(15-180)。',
  'audio-adjustment，props 包含 microphoneGain(-20到20)、backgroundMusicGain(-20到20)。',
  'camera-effects，props.settings 包含 smoothness、exposure、warmth、backgroundMode(none/blur/color)、backgroundColor、backgroundImageUrl(null)、faceEffect(none/halo/sparkles)，以及 lipstick/blush/eyeshadow 的 Intensity(0-100) 和 Color。',
  'live-goal，props 包含 label、current、target、supporters。',
].join('\n')

function App() {
  const [view, setView] = useState<AppView>('onboarding')
  const [streamType, setStreamType] = useState<StreamKind>('music')
  const [streamTopic, setStreamTopic] = useState('晚间唱歌聊天')
  const [scene, setScene] = useState<Scene>('quality')
  const [isPk, setIsPk] = useState(false)
  const [applied, setApplied] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [readyScore, setReadyScore] = useState(45)
  const [preliveTaskIndex, setPreliveTaskIndex] = useState(0)
  const [showGoLive, setShowGoLive] = useState(false)
  const [genieInput, setGenieInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentWidgetSpec, setAgentWidgetSpec] = useState<WidgetSpec | null>(null)
  const [genieError, setGenieError] = useState('')
  const [genieRequestStatus, setGenieRequestStatus] = useState<GenieRequestStatus>('idle')
  const [liveTick, setLiveTick] = useState(0)
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
  const activeWidgetSpec = agentWidgetSpec ?? getSceneWidgetSpec(scene)

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
    return () => {
      genieAbortRef.current?.abort()
      const backgroundImageUrl = useStudioStore.getState().cameraEffects.backgroundImageUrl
      if (backgroundImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(backgroundImageUrl)
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
    const interval = window.setInterval(() => setLiveTick((tick) => tick + 1), 3500)
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

  const startWorkspace = () => {
    if (streamTopic.trim()) setView('prelive')
  }

  const previewSuggestion = () => {
    if (activeWidgetSpec.type === 'camera-effects') {
      const result = studioToolRegistry.execute('studio.adjust_camera_effects', {
        mode: 'preview',
        settings: activeWidgetSpec.props.settings,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (activeWidgetSpec.type === 'visual-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_visual', {
        mode: 'preview',
        settings: activeWidgetSpec.props.settings,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (activeWidgetSpec.type === 'audio-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_audio', {
        mode: 'preview',
        settings: {
          microphoneGainDb: activeWidgetSpec.props.microphoneGain,
          backgroundMusicGainDb: activeWidgetSpec.props.backgroundMusicGain,
        },
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (activeWidgetSpec.type === 'audience-poll') {
      const result = studioToolRegistry.execute('studio.configure_poll', {
        mode: 'preview',
        config: activeWidgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    if (activeWidgetSpec.type === 'live-goal') {
      const result = studioToolRegistry.execute('studio.configure_live_goal', {
        mode: 'preview',
        config: activeWidgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(true)
      return
    }

    setLiveAdjustment(getWidgetAdjustment(activeWidgetSpec, 'preview'))
    setIsSuggestionPreview(true)
  }

  const applySuggestion = () => {
    setApplied(true)
    if (activeWidgetSpec.type === 'camera-effects') {
      const result = studioToolRegistry.execute('studio.adjust_camera_effects', {
        mode: 'apply',
        settings: useStudioStore.getState().cameraEffects,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(false)
      return
    }

    if (activeWidgetSpec.type === 'visual-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_visual', {
        mode: 'apply',
        settings: useStudioStore.getState().visualSettings,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(false)
      return
    }

    if (activeWidgetSpec.type === 'audio-adjustment') {
      const result = studioToolRegistry.execute('studio.adjust_audio', {
        mode: 'apply',
        settings: useStudioStore.getState().audioSettings,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(false)
      return
    }

    if (activeWidgetSpec.type === 'audience-poll') {
      const result = studioToolRegistry.execute('studio.configure_poll', {
        mode: 'apply',
        config: activeWidgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(false)
      return
    }

    if (activeWidgetSpec.type === 'live-goal') {
      const result = studioToolRegistry.execute('studio.configure_live_goal', {
        mode: 'apply',
        config: activeWidgetSpec.props,
      }, studioToolContext)
      setLiveAdjustment(result)
      setIsSuggestionPreview(false)
      return
    }

    setLiveAdjustment(getWidgetAdjustment(activeWidgetSpec, 'apply'))
    setIsSuggestionPreview(false)
  }

  const completePreliveTask = () => {
    setApplied(true)
    setReadyScore((score) => Math.min(score + 14, 100))
    if (preliveTaskIndex < preliveTasks.length - 1) {
      setPreliveTaskIndex((index) => index + 1)
      return
    }
    setReadyScore(100)
  }

  const saveConfiguration = () => {
    setShowGoLive(true)
  }

  const undoSuggestion = () => {
    if (activeWidgetSpec.type === 'camera-effects') {
      const result = studioToolRegistry.execute('studio.undo_camera_effects', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (activeWidgetSpec.type === 'visual-adjustment') {
      const result = studioToolRegistry.execute('studio.undo_visual', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (activeWidgetSpec.type === 'audio-adjustment') {
      const result = studioToolRegistry.execute('studio.undo_audio', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (activeWidgetSpec.type === 'audience-poll') {
      const result = studioToolRegistry.execute('studio.undo_poll', {}, studioToolContext)
      setLiveAdjustment(result)
    } else if (activeWidgetSpec.type === 'live-goal') {
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
      const result = await askGenie(request.prompt, { signal: controller.signal })
      if (genieAbortRef.current !== controller) return
      setChatMessages((messages) => [...messages, { role: 'assistant', text: result.text || '已生成可操作方案。' }])
      if (view === 'live' && result.widget) {
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
    const prompt = [
      '你是 LIVE Studio Genie，一名专业、简洁的中文直播间助手。',
      context,
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
          <h1>要开启你的直播<span>之旅</span>了吗！<br />先告诉我，你今天想播什么？</h1>
          <p>选一个方向，或者用你自己的话告诉精灵。</p>
          <div className="stream-options">
            <StreamOption icon={<MessageCircle />} label="聊天陪伴" active={streamType === 'chat'} onClick={() => setStreamType('chat')} />
            <StreamOption icon={<Music2 />} label="音乐现场" active={streamType === 'music'} onClick={() => setStreamType('music')} />
            <StreamOption icon={<Gamepad2 />} label="游戏直播" active={streamType === 'game'} onClick={() => setStreamType('game')} />
            <StreamOption icon={<Sparkles />} label="其他" active={false} onClick={() => { setStreamType('music'); setStreamTopic('秀场唱歌陪伴') }} />
          </div>
          <label className="theme-input">
            <WandSparkles size={17} />
            <input value={streamTopic} onChange={(event) => setStreamTopic(event.target.value)} placeholder="用一句话描述今晚的直播…（或从上方选一个方向）" aria-label="本场主题" />
            <button type="button" aria-label="生成工作台" onClick={startWorkspace}>召唤精灵 <ArrowLeft size={16} className="arrow-forward" /></button>
          </label>
        </section>
        <button className="professional-mode" type="button" onClick={() => setView('prelive')}><i />我很熟，直接进入专业模式 <ArrowLeft size={15} className="arrow-forward" /></button>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="topbar-nav" aria-label="工作台导航">
          <button className={view === 'prelive' ? 'active' : ''} onClick={() => setView('prelive')} type="button">开播准备</button>
          <button className={view === 'live' ? 'active' : ''} onClick={() => setView('live')} type="button">直播控制台</button>
        </nav>
        <div className="topbar-actions">
          <button className="icon-button" type="button" aria-label="帮助"><CircleHelp size={18} /></button>
          <button className="user-avatar" type="button" aria-label="个人中心">L</button>
        </div>
      </header>
      <section className="workspace">
        <aside className="monitor-panel panel">
          <PanelHeading icon={<Activity size={17} />} title={view === 'prelive' ? '开播检查' : '直播间状态'} status={view === 'prelive' ? '准备中' : 'LIVE'} />
          {view === 'prelive' ? (
            <PreliveChecklist score={readyScore} />
          ) : (
            <>
              <div className="monitor-summary">
                <span>实时诊断</span>
                <strong>{applied ? '状态已恢复' : scene === 'quality' ? '2 项待处理' : '1 项待处理'}</strong>
                <small><Signal size={12} />媒体实时采样 · 场景每 3 秒更新</small>
              </div>
              <div className="metric-stack">
                <LiveMetricStack scene={scene} applied={applied} liveTick={liveTick} />
              </div>
              <div className="comment-stream">
                <div className="section-label"><MessageCircle size={15} />实时评论</div>
                {getLiveComments(scene, applied, liveTick).map((comment) => <p key={comment.name}><b>{comment.name}</b>{comment.text}</p>)}
              </div>
              <div className="gift-stream">
                <div className="section-label"><Gift size={15} />礼物动态</div>
                <p><span>🌹</span><b>Luna</b>送出 Rose ×5 <small>刚刚</small></p>
                <p><span>💗</span><b>Mie</b>送出 Heart ×10 <small>1 分钟前</small></p>
              </div>
            </>
          )}
          <div className="scenario-switcher">
            <span>演示场景</span>
            <div className="scenario-options">
              <button className={scene === 'quality' ? 'selected' : ''} type="button" onClick={() => changeScene('quality')}>画质</button>
              <button className={scene === 'interaction' ? 'selected' : ''} type="button" onClick={() => changeScene('interaction')}>互动</button>
              <button className={scene === 'troubleshoot' ? 'selected' : ''} type="button" onClick={() => changeScene('troubleshoot')}>排障</button>
              <button className={scene === 'pk' ? 'selected' : ''} type="button" onClick={() => changeScene('pk')}>PK</button>
            </div>
          </div>
        </aside>

        <section className="stage-column">
          <div className="stage-toolbar">
            <div>
              <span className="stage-breadcrumb">{view === 'prelive' ? '今日开播准备' : isPk ? '直播中 · PK 对战' : '直播中'}</span>
              <h1>{view === 'prelive' ? '晚间唱歌聊天' : '林小满的直播间'}</h1>
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
          <LivePreview videoRef={videoRef} cameraEnabled={cameraEnabled} displayStream={displayStream} layoutEditing={isLayoutEditing && previewMode === 'studio'} isPk={isPk} applied={applied} scene={scene} liveAdjustment={liveAdjustment} previewMode={previewMode} isPreviewing={isSuggestionPreview} />
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
            <button type="button" className={`pk-launch ${isPk ? 'active' : ''}`} onClick={() => changeScene(isPk ? 'quality' : 'pk')}><Users size={17} />{isPk ? '结束 PK' : '发起 PK'}</button>
          </div>
          {view === 'prelive' && (
            <div className="prelive-footer">
              <div><b>准备度 {readyScore} / 100</b><span>{readyScore === 100 ? '所有播前任务已完成' : `再完成 ${preliveTasks.length - preliveTaskIndex} 项即可开播`}</span></div>
              <div className="score-track"><i style={{ width: `${readyScore}%` }} /></div>
              {readyScore === 100
                ? <Button className="primary-button" color="primary" onClick={saveConfiguration}><Save size={16} />保存配置</Button>
                : <button className="secondary-button" type="button" disabled>完成任务后保存</button>}
            </div>
          )}
        </section>

        <aside className="genie-panel panel">
          <PanelHeading icon={<Bot size={17} />} title="Genie" status="AI 在线" />
          <div className="genie-intro">
            <div className="mini-orb"><Sparkles size={17} /></div>
            <div><strong>{view === 'prelive' && activeWidgetSpec.type !== 'camera-effects' ? '为你生成了开播方案' : agentWidgetSpec ? '已生成可操作组件' : '我发现了一个机会点'}</strong><p>{view === 'prelive' && activeWidgetSpec.type !== 'camera-effects' ? '根据音乐聊天主题，已匹配舒适陪伴型场景。' : activeWidgetSpec.detail}</p></div>
          </div>
          {view === 'live' && <div className="suggestion-tabs" aria-label="Genie 建议">
            <button type="button" className={scene === 'quality' ? 'active' : ''} onClick={() => changeScene('quality')}>优化画面亮度</button>
            <button type="button" className={scene === 'interaction' ? 'active' : ''} onClick={() => changeScene('interaction')}>互动正在转冷</button>
            <button type="button" className={scene === 'troubleshoot' ? 'active' : ''} onClick={() => changeScene('troubleshoot')}>麦克风偏小</button>
          </div>}
          {view === 'prelive' && activeWidgetSpec.type !== 'camera-effects'
            ? <PreliveTaskCard task={preliveTasks[preliveTaskIndex]} completedCount={preliveTaskIndex} onApply={completePreliveTask} />
            : <WidgetRenderer spec={activeWidgetSpec} applied={applied} isPreviewing={isSuggestionPreview} onPreview={previewSuggestion} onApply={applySuggestion} onUndo={undoSuggestion} onAudioChange={updateAudioPreview} onVisualChange={updateVisualPreview} onCameraEffectsChange={updateCameraEffectsPreview} />}
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
      {showGoLive && (
        <div className="golive-overlay" role="dialog" aria-modal="true" aria-label="播前准备完成">
          <section className="golive-dialog">
            <div className="golive-mark"><Check size={26} /></div>
            <span>配置已保存</span>
            <h2>播前准备百分百，去开播</h2>
            <p>标题、画面预览、互动开场和脚本已同步到本场直播。</p>
            <Button className="primary-button golive-button" color="primary" size="large" onClick={() => { setShowGoLive(false); setView('live') }}>
              <Play size={17} fill="currentColor" />GO LIVE
            </Button>
            <button className="card-text-button" type="button" onClick={() => setShowGoLive(false)}>返回继续调整</button>
          </section>
        </div>
      )}
    </main>
  )
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><strong>LIVE STUDIO</strong><span>GENIE</span></div>
}

function PanelHeading({ icon, title, status }: { icon: ReactNode; title: string; status: string }) {
  return <div className="panel-heading"><div>{icon}<strong>{title}</strong></div><span>{status}</span></div>
}

function StreamOption({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`stream-option ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <Check size={14} />}</button>
}

function MetricCard({ metric }: { metric: Metric }) {
  return <div className="metric-card"><div><span>{metric.label}</span><b>{metric.value}</b></div><div className="metric-track"><i className={metric.tone} style={{ width: `${metric.score}%` }} /></div></div>
}

function LiveMetricStack({ scene, applied, liveTick }: { scene: Scene; applied: boolean; liveTick: number }) {
  const mediaMetrics = useStudioStore((state) => state.mediaMetrics)
  return getLiveMetrics(scene, applied, liveTick, mediaMetrics)
    .map((metric) => <MetricCard key={metric.label} metric={metric} />)
}

function getLiveMetrics(
  scene: Scene,
  applied: boolean,
  tick: number,
  mediaMetrics: Record<'brightness' | 'microphone', MediaMetric>,
): Metric[] {
  const drift = tick % 3
  let metrics: Metric[]

  if (applied) {
    metrics = [
      { label: scene === 'troubleshoot' ? '麦克风峰值' : '画面状态', value: scene === 'troubleshoot' ? '-12 dB' : '已优化', score: 82, tone: 'good' },
      { label: '评论区密度', value: scene === 'interaction' ? '回升中' : '正常', score: 74, tone: 'good' },
      { label: '网络稳定性', value: '良好', score: 88, tone: 'good' },
    ]
  } else {
    metrics = sceneMetrics[scene].map((metric, index) => ({
      ...metric,
      score: Math.max(8, Math.min(96, metric.score + (index === 0 ? drift * 2 : drift))),
    }))
  }

  if (scene === 'quality') {
    metrics[0] = toLiveMetric('画面亮度', mediaMetrics.brightness)
  }
  if (scene === 'troubleshoot') {
    metrics[0] = toLiveMetric('麦克风电平', mediaMetrics.microphone)
  }

  return metrics
}

function toLiveMetric(label: string, metric: MediaMetric): Metric {
  return {
    label,
    value: metric.value,
    score: metric.status === 'ready' ? metric.score : 8,
    tone: metric.tone,
  }
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

function getLiveComments(scene: Scene, applied: boolean, tick: number) {
  if (applied && scene === 'interaction') {
    return [{ name: '夏日汽水', text: ' 选 2！来首炸场的' }, { name: '星河入梦', text: ' 点歌投票好玩' }, { name: '甜甜圈', text: ' 主播唱得真好' }]
  }
  if (scene === 'troubleshoot') return [{ name: '星河入梦', text: ' 声音有点小' }, { name: '柚子茶', text: ' 听不清诶' }, { name: '晚风', text: ' 现在卡不卡？' }]
  if (scene === 'quality') return [{ name: '甜甜圈', text: ' 背景有点暗诶' }, { name: '小满同学', text: ' 今天的氛围好舒服' }, { name: '阿福', text: ` 刚进来 ${tick % 2 ? '求一首歌单' : '主播好'}` }]
  return [{ name: '小满同学', text: ' 今天唱哪首歌？' }, { name: '夜航星', text: ' 新来的报到' }, { name: '青柠', text: ' 好想听甜歌' }]
}

function PreliveChecklist({ score }: { score: number }) {
  return <div className="checklist">
    <div className="readiness-card"><span>当前准备度</span><strong>{score}<small>/ 100</small></strong><p>还有 3 步可以开播</p><div className="circle-progress"><i style={{ transform: `rotate(${score * 3.6}deg)` }} /></div></div>
    {['确认直播标题', '检查画面与音频', '设置互动开场'].map((item, index) => <button className="check-item" type="button" key={item}><span className={index === 0 ? 'done' : ''}>{index === 0 ? <Check size={13} /> : index + 1}</span>{item}<ChevronDown size={14} /></button>)}
  </div>
}

function LivePreview({ videoRef, cameraEnabled, displayStream, layoutEditing, isPk, applied, scene, liveAdjustment, previewMode, isPreviewing }: { videoRef: React.RefObject<HTMLVideoElement>; cameraEnabled: boolean; displayStream: MediaStream | null; layoutEditing: boolean; isPk: boolean; applied: boolean; scene: Scene; liveAdjustment: LiveAdjustment | null; previewMode: PreviewMode; isPreviewing: boolean }) {
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

  return <div style={previewStyle} className={`live-stage ${applied ? 'applied' : ''} ${isPreviewing ? 'previewing' : ''} ${isPk ? 'pk-stage' : ''} scene-${scene} ${previewMode === 'studio' ? 'studio-preview' : 'mobile-preview'}`}>
    <div className="stage-glow" />
    <div className="scan-lines" />
    <div className={`host-stage ${displayStream ? 'screen-sharing' : ''}`}>
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
      <div className="stage-label"><span />林小满</div>
      {applied && <div className="applied-badge"><Check size={13} />方案已应用</div>}
      {scene === 'quality' && !applied && <div className="stage-hint"><Lightbulb size={14} />环境偏暗</div>}
      {scene === 'troubleshoot' && <div className="audio-meter"><AudioLines size={15} /><span>音频峰值偏低</span><i /><i /><i /><i /></div>}
      {liveAdjustment && <div className="adjustment-toast"><Zap size={14} /><div><b>{liveAdjustment.name}</b><span>{liveAdjustment.detail}</span></div></div>}
      <LivePoll />
      <LiveGoal />
    </div>
    {isPk && <><div className="pk-versus">VS</div><div className="opponent-stage"><DemoOpponent /><div className="stage-label opponent"><span />陈妍</div></div><div className="pk-scorebar"><div><b>8,740</b><span>林小满</span></div><strong>01:18</strong><div><b>10,000</b><span>陈妍</span></div></div></>}
    {!isPk && <div className="viewer-bubble"><Users size={14} />1,286</div>}
    <div className="floating-comments"><span>{scene === 'interaction' ? '评论区打 1 或 2 投票' : '小满唱首《可爱女人》吧'}</span><span>{applied ? 'Genie 已应用推荐方案' : '今天的氛围好舒服'}</span></div>
  </div>
}

function DemoHost() {
  return <div className="demo-host"><div className="light-rays" /><div className="host-hair" /><div className="host-face"><i /><i /><b /></div><div className="host-body" /><div className="host-necklace" /></div>
}

function DemoOpponent() {
  return <div className="demo-opponent"><div className="opponent-hair" /><div className="opponent-face" /><div className="opponent-body" /></div>
}

function PreliveTaskCard({ task, completedCount, onApply }: { task: typeof preliveTasks[number]; completedCount: number; onApply: () => void }) {
  const [selectedLayout, setSelectedLayout] = useState<'portrait' | 'stage'>('portrait')
  const [isScriptExpanded, setIsScriptExpanded] = useState(false)
  return <div className="recommendation-card prelive-task-card">
    <span className="card-kicker">播前任务 {completedCount + 1} / {preliveTasks.length}</span>
    <h2>{task.title}</h2>
    <p>{task.detail}</p>
    {task.id === 'layout' && <div className="task-choice-row"><button type="button" className={`task-choice ${selectedLayout === 'portrait' ? 'selected' : ''}`} onClick={() => setSelectedLayout('portrait')}><Camera size={15} />单人竖屏</button><button type="button" className={`task-choice ${selectedLayout === 'stage' ? 'selected' : ''}`} onClick={() => setSelectedLayout('stage')}><LayoutTemplate size={15} />秀场舞台</button></div>}
    {task.id === 'visual' && <div className="adjustments"><Adjustment label="暖色" value="+18" /><Adjustment label="磨皮" value="20%" /></div>}
    {task.id === 'content' && <button className={`script-preview ${isScriptExpanded ? 'expanded' : ''}`} type="button" onClick={() => setIsScriptExpanded((expanded) => !expanded)}><span>首 30 秒口播 {isScriptExpanded ? '收起' : '展开'}</span><p>“刚进来的朋友先选一首歌，今天我们轻松聊聊。”</p>{isScriptExpanded && <p className="script-extra">“评论区打 1 选甜歌，打 2 选炸场，今天由你们来定歌单。”</p>}</button>}
    {task.id === 'interaction' && <div className="interaction-widget"><div><Gift size={17} /><span>点歌投票</span></div><p>甜歌还是炸场？评论区打 1 或 2</p><small>仅预览，确认后在开播时上屏</small></div>}
    <Button className="primary-button full-button" color="primary" onClick={onApply}><Check size={16} />{task.action}</Button>
    <button className="card-text-button" type="button">跳过并稍后处理</button>
  </div>
}

export default App

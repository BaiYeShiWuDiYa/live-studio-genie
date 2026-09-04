import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity,
  ArrowLeft,
  AudioLines,
  Bot,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Gamepad2,
  Gift,
  LayoutTemplate,
  Lightbulb,
  LoaderCircle,
  Mic,
  MessageCircle,
  Music2,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Signal,
  Sparkles,
  Users,
  Volume2,
  WandSparkles,
  Zap,
} from 'lucide-react'
import './App.css'
import { askGenie } from './services/genie'

type AppView = 'onboarding' | 'prelive' | 'live'
type Scene = 'quality' | 'interaction' | 'troubleshoot' | 'pk'
type StreamKind = 'music' | 'chat' | 'game'
type PreliveTask = 'layout' | 'visual' | 'content' | 'interaction'
type PreviewMode = 'mobile' | 'studio'

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
  const [genieError, setGenieError] = useState('')
  const [isAskingGenie, setIsAskingGenie] = useState(false)
  const [liveTick, setLiveTick] = useState(0)
  const [liveAdjustment, setLiveAdjustment] = useState<LiveAdjustment | null>(null)
  const [isSuggestionPreview, setIsSuggestionPreview] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isPollVisible, setIsPollVisible] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mobile')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraAttemptedRef = useRef(false)

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    if (cameraEnabled && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraEnabled])

  const enableCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is unavailable')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      setCameraEnabled(true)
      setCameraError('')
    } catch {
      setCameraError('未获取到摄像头权限，已使用演示画面。')
    }
  }, [])

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
    setScene(nextScene)
    setApplied(false)
    setIsSuggestionPreview(false)
    setLiveAdjustment(null)
    setIsPollVisible(false)
    setIsPk(nextScene === 'pk')
  }

  const startWorkspace = () => {
    if (streamTopic.trim()) setView('prelive')
  }

  const previewSuggestion = () => {
    const preview: Record<Scene, LiveAdjustment> = {
      quality: { name: '正在预览柔光氛围', detail: '仅作用于本地预览，尚未影响直播画面' },
      interaction: { name: '正在预览互动挂件', detail: '确认后才会在观众侧上屏' },
      troubleshoot: { name: '正在试听音频调整', detail: '试听 3 秒后可确认应用' },
      pk: { name: '正在预览冲刺目标', detail: '确认后向观众展示目标组件' },
    }
    setLiveAdjustment(preview[scene])
    setIsSuggestionPreview(true)
    setIsPollVisible(scene === 'interaction')
  }

  const applySuggestion = () => {
    setApplied(true)
    const adjustment: Record<Scene, LiveAdjustment> = {
      quality: { name: '柔光氛围已预览', detail: '补光 +32、暖色 +18、磨皮 20%' },
      interaction: { name: '点歌投票已上屏', detail: '将在 45 秒后自动收起' },
      troubleshoot: { name: '音频调整已应用', detail: '麦克风 +8%，BGM -5%' },
      pk: { name: '冲刺目标已上屏', detail: '正在召集观众助力反超' },
    }
    setLiveAdjustment(adjustment[scene])
    setIsSuggestionPreview(false)
    setIsPollVisible(scene === 'interaction')
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
    setApplied(false)
    setLiveAdjustment(null)
    setIsSuggestionPreview(false)
    setIsPollVisible(false)
  }

  const handleGenieSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = genieInput.trim()
    if (!question || isAskingGenie) return

    const context = view === 'prelive'
      ? '当前处于开播准备阶段，直播主题是晚间唱歌聊天。'
      : `当前处于直播中，诊断场景是${sceneCopy[scene].title}。`
    const prompt = [
      '你是 LIVE Studio Genie，一名专业、简洁的中文直播间助手。',
      context,
      '根据当前状态回答主播的问题。给出可直接执行的建议，保持在 120 个汉字以内。',
      `主播问题：${question}`,
    ].join('\n')

    setChatMessages((messages) => [...messages, { role: 'user', text: question }])
    setGenieInput('')
    setGenieError('')
    setIsAskingGenie(true)

    try {
      const result = await askGenie(prompt)
      setChatMessages((messages) => [...messages, { role: 'assistant', text: result.text }])
    } catch (error) {
      setGenieError(error instanceof Error ? error.message : 'Genie 暂时无法响应。')
    } finally {
      setIsAskingGenie(false)
    }
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
                <small><Signal size={12} />数据每 3 秒更新</small>
              </div>
              <div className="metric-stack">
                {getLiveMetrics(scene, applied, liveTick).map((metric) => <MetricCard key={metric.label} metric={metric} />)}
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
          <LivePreview videoRef={videoRef} cameraEnabled={cameraEnabled} isPk={isPk} applied={applied} scene={scene} liveAdjustment={liveAdjustment} pollVisible={isPollVisible} liveTick={liveTick} previewMode={previewMode} isPreviewing={isSuggestionPreview} />
          {cameraError && <p className="camera-warning">{cameraError}</p>}
          <div className="stage-controls">
            <button type="button" className="control-button" onClick={enableCamera}><Camera size={18} /><span>{cameraEnabled ? '摄像头已连接' : '开启摄像头'}</span></button>
            <button type="button" className={`control-button ${isMicMuted ? 'active-control' : ''}`} onClick={() => setIsMicMuted((muted) => !muted)}><Mic size={18} /><span>{isMicMuted ? '麦克风已静音' : '麦克风'}</span></button>
            <button type="button" className="control-button"><Volume2 size={18} /><span>扬声器</span></button>
            <button type="button" className="control-button" onClick={() => setIsPollVisible((visible) => !visible)}><LayoutTemplate size={18} /><span>{isPollVisible ? '隐藏组件' : '互动组件'}</span></button>
            <button type="button" className={`pk-launch ${isPk ? 'active' : ''}`} onClick={() => changeScene(isPk ? 'quality' : 'pk')}><Users size={17} />{isPk ? '结束 PK' : '发起 PK'}</button>
          </div>
          {view === 'prelive' && (
            <div className="prelive-footer">
              <div><b>准备度 {readyScore} / 100</b><span>{readyScore === 100 ? '所有播前任务已完成' : `再完成 ${preliveTasks.length - preliveTaskIndex} 项即可开播`}</span></div>
              <div className="score-track"><i style={{ width: `${readyScore}%` }} /></div>
              {readyScore === 100
                ? <button className="primary-button" type="button" onClick={saveConfiguration}><Save size={16} />保存配置</button>
                : <button className="secondary-button" type="button" disabled>完成任务后保存</button>}
            </div>
          )}
        </section>

        <aside className="genie-panel panel">
          <PanelHeading icon={<Bot size={17} />} title="Genie" status="AI 在线" />
          <div className="genie-intro">
            <div className="mini-orb"><Sparkles size={17} /></div>
            <div><strong>{view === 'prelive' ? '为你生成了开播方案' : '我发现了一个机会点'}</strong><p>{view === 'prelive' ? '根据音乐聊天主题，已匹配舒适陪伴型场景。' : sceneCopy[scene].detail}</p></div>
          </div>
          {view === 'live' && <div className="suggestion-tabs" aria-label="Genie 建议">
            <button type="button" className={scene === 'quality' ? 'active' : ''} onClick={() => changeScene('quality')}>优化画面亮度</button>
            <button type="button" className={scene === 'interaction' ? 'active' : ''} onClick={() => changeScene('interaction')}>互动正在转冷</button>
            <button type="button" className={scene === 'troubleshoot' ? 'active' : ''} onClick={() => changeScene('troubleshoot')}>麦克风偏小</button>
          </div>}
          {view === 'prelive'
            ? <PreliveTaskCard task={preliveTasks[preliveTaskIndex]} completedCount={preliveTaskIndex} onApply={completePreliveTask} />
            : <SceneRecommendation scene={scene} applied={applied} isPreviewing={isSuggestionPreview} onPreview={previewSuggestion} onApply={applySuggestion} onUndo={undoSuggestion} />}
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
          {genieError && <p className="genie-error">{genieError}</p>}
          <form className="genie-composer" onSubmit={handleGenieSubmit}>
            <div className="composer-field">
              <input value={genieInput} onChange={(event) => setGenieInput(event.target.value)} placeholder="问 Genie：帮我调整一下…" aria-label="向 Genie 提问" />
              <span>Enter 发送</span>
            </div>
            <button type="submit" disabled={!genieInput.trim() || isAskingGenie} aria-label="发送消息">
              {isAskingGenie ? <LoaderCircle size={16} className="loading-icon" /> : <Send size={16} />}
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
            <button className="primary-button golive-button" type="button" onClick={() => { setShowGoLive(false); setView('live') }}>
              <Play size={17} fill="currentColor" />GO LIVE
            </button>
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

function getLiveMetrics(scene: Scene, applied: boolean, tick: number): Metric[] {
  const drift = tick % 3
  if (applied) {
    return [
      { label: scene === 'troubleshoot' ? '麦克风峰值' : '画面状态', value: scene === 'troubleshoot' ? '-12 dB' : '已优化', score: 82, tone: 'good' },
      { label: '评论区密度', value: scene === 'interaction' ? '回升中' : '正常', score: 74, tone: 'good' },
      { label: '网络稳定性', value: '良好', score: 88, tone: 'good' },
    ]
  }
  return sceneMetrics[scene].map((metric, index) => ({
    ...metric,
    score: Math.max(8, Math.min(96, metric.score + (index === 0 ? drift * 2 : drift))),
  }))
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

function LivePreview({ videoRef, cameraEnabled, isPk, applied, scene, liveAdjustment, pollVisible, liveTick, previewMode, isPreviewing }: { videoRef: React.RefObject<HTMLVideoElement | null>; cameraEnabled: boolean; isPk: boolean; applied: boolean; scene: Scene; liveAdjustment: LiveAdjustment | null; pollVisible: boolean; liveTick: number; previewMode: PreviewMode; isPreviewing: boolean }) {
  return <div className={`live-stage ${applied ? 'applied' : ''} ${isPreviewing ? 'previewing' : ''} ${isPk ? 'pk-stage' : ''} scene-${scene} ${previewMode === 'studio' ? 'studio-preview' : 'mobile-preview'}`}>
    <div className="stage-glow" />
    <div className="scan-lines" />
    <div className="host-stage">
      {cameraEnabled ? <video ref={videoRef} autoPlay muted playsInline className="camera-feed" /> : <DemoHost />}
      {previewMode === 'studio' && <div className="studio-guides"><i /><i /><i /></div>}
      <div className="stage-label"><span />林小满</div>
      {applied && <div className="applied-badge"><Check size={13} />方案已应用</div>}
      {scene === 'quality' && !applied && <div className="stage-hint"><Lightbulb size={14} />环境偏暗</div>}
      {scene === 'troubleshoot' && <div className="audio-meter"><AudioLines size={15} /><span>音频峰值偏低</span><i /><i /><i /><i /></div>}
      {liveAdjustment && <div className="adjustment-toast"><Zap size={14} /><div><b>{liveAdjustment.name}</b><span>{liveAdjustment.detail}</span></div></div>}
      {pollVisible && <div className="live-poll"><span>点歌投票 · 00:{45 - (liveTick % 18)}</span><strong>下一首唱什么？</strong><div><button type="button">1 甜歌 <b>62%</b></button><button type="button">2 炸场 <b>38%</b></button></div></div>}
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
    <button className="primary-button full-button" type="button" onClick={onApply}><Check size={16} />{task.action}</button>
    <button className="card-text-button" type="button">跳过并稍后处理</button>
  </div>
}

function SceneRecommendation({ scene, applied, isPreviewing, onPreview, onApply, onUndo }: { scene: Scene; applied: boolean; isPreviewing: boolean; onPreview: () => void; onApply: () => void; onUndo: () => void }) {
  const copy = sceneCopy[scene]
  return <div className={`recommendation-card ${scene}`}>
    <span className="card-kicker">{scene === 'troubleshoot' ? '需要确认' : '实时建议'}</span>
    <h2>{copy.title}</h2>
    <p>{copy.detail}</p>
    {scene === 'quality' && <div className="adjustments"><Adjustment label="补光" value="+32" /><Adjustment label="暖色" value="+18" /><Adjustment label="磨皮" value="20%" /></div>}
    {scene === 'interaction' && <div className="interaction-widget"><div><Gift size={17} /><span>点歌投票</span></div><p>甜歌还是炸场？评论区打 1 或 2</p><small>展示 45 秒 · 评论即可参与</small></div>}
    {scene === 'troubleshoot' && <div className="adjustments"><Adjustment label="麦克风" value="+8%" /><Adjustment label="BGM" value="-5%" /></div>}
    {scene === 'pk' && <div className="goal-widget"><span>本轮冲刺目标</span><strong>再差 1,260 分反超</strong><div><i style={{ width: '76%' }} /></div><small>已获得 38 位观众响应</small></div>}
    {!isPreviewing && !applied && <button className="primary-button full-button" type="button" onClick={onPreview}><Sparkles size={16} />预览调整</button>}
    {isPreviewing && <button className="primary-button full-button" type="button" onClick={onApply}><Check size={16} />{copy.action}</button>}
    {applied && <button className="primary-button full-button" type="button" disabled><Check size={16} />已应用</button>}
    {applied ? <button className="card-text-button" type="button" onClick={onUndo}><RotateCcw size={14} />撤回最近一次调整</button> : <button className="card-text-button" type="button"><RefreshCw size={14} />换一组建议</button>}
  </div>
}

function Adjustment({ label, value }: { label: string; value: string }) {
  const numericValue = Number.parseInt(value, 10)
  const [currentValue, setCurrentValue] = useState(Number.isNaN(numericValue) ? 20 : Math.abs(numericValue))
  const suffix = value.includes('%') ? '%' : value.includes('20') && label === '磨皮' ? '%' : ''
  const sign = value.startsWith('-') ? '-' : value.startsWith('+') ? '+' : ''

  return <label className="adjustment">
    <span>{label}</span>
    <input type="range" min="0" max="100" value={currentValue} onChange={(event) => setCurrentValue(Number(event.target.value))} aria-label={`${label} 调节`} />
    <b>{sign}{currentValue}{suffix}</b>
  </label>
}

export default App

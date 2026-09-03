import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  Mic,
  MessageCircle,
  Music2,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  Volume2,
  WandSparkles,
} from 'lucide-react'
import './App.css'

type AppView = 'onboarding' | 'prelive' | 'live'
type Scene = 'quality' | 'interaction' | 'troubleshoot' | 'pk'
type StreamKind = 'music' | 'chat' | 'game'

type Metric = {
  label: string
  value: string
  score: number
  tone: 'good' | 'warn' | 'bad'
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

function App() {
  const [view, setView] = useState<AppView>('onboarding')
  const [streamType, setStreamType] = useState<StreamKind>('music')
  const [scene, setScene] = useState<Scene>('quality')
  const [isPk, setIsPk] = useState(false)
  const [applied, setApplied] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [readyScore, setReadyScore] = useState(45)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraEnabled(true)
      setCameraError('')
    } catch {
      setCameraError('未获取到摄像头权限，已使用演示画面。')
    }
  }

  const changeScene = (nextScene: Scene) => {
    setScene(nextScene)
    setApplied(false)
    setIsPk(nextScene === 'pk')
  }

  const applySuggestion = () => {
    setApplied(true)
    if (view === 'prelive') setReadyScore((score) => Math.min(score + 18, 100))
  }

  if (view === 'onboarding') {
    return (
      <main className="onboarding-shell">
        <div className="ambient-grid" />
        <header className="onboarding-header">
          <Brand />
          <span className="draft-status"><span />已保存为草稿</span>
        </header>
        <section className="welcome-card">
          <div className="genie-orb"><Sparkles size={31} /></div>
          <span className="eyebrow">LIVE STUDIO GENIE</span>
          <h1>要开启你的直播之旅了吗？</h1>
          <p>告诉 Genie 你今天想播什么，我会为你准备适合这一场的直播工作台。</p>
          <div className="stream-options">
            <StreamOption icon={<MessageCircle />} label="聊天陪伴" active={streamType === 'chat'} onClick={() => setStreamType('chat')} />
            <StreamOption icon={<Music2 />} label="音乐现场" active={streamType === 'music'} onClick={() => setStreamType('music')} />
            <StreamOption icon={<Gamepad2 />} label="游戏直播" active={streamType === 'game'} onClick={() => setStreamType('game')} />
          </div>
          <label className="theme-input">
            <WandSparkles size={17} />
            <input defaultValue="晚间唱歌聊天" aria-label="本场主题" />
            <button type="button" aria-label="发送"><Send size={17} /></button>
          </label>
          <button className="primary-button welcome-cta" type="button" onClick={() => setView('prelive')}>
            生成今日开播工作台 <ArrowLeft size={17} className="arrow-forward" />
          </button>
          <button className="text-button" type="button" onClick={() => setView('prelive')}>跳过，直接进入专业模式</button>
        </section>
        <div className="onboarding-footer">Genie 会根据你的选择动态生成直播方案</div>
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
                <strong>{scene === 'quality' ? '2' : scene === 'troubleshoot' ? '1' : '1'} 项待处理</strong>
              </div>
              <div className="metric-stack">
                {sceneMetrics[scene].map((metric) => <MetricCard key={metric.label} metric={metric} />)}
              </div>
              <div className="comment-stream">
                <div className="section-label"><MessageCircle size={15} />实时评论</div>
                <p><b>甜甜圈</b> 背景有点暗诶</p>
                <p><b>星河入梦</b> 主播声音有点小</p>
                <p><b>小满同学</b> 今天唱哪首歌？</p>
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
          <LivePreview videoRef={videoRef} cameraEnabled={cameraEnabled} isPk={isPk} applied={applied} scene={scene} />
          {cameraError && <p className="camera-warning">{cameraError}</p>}
          <div className="stage-controls">
            <button type="button" className="control-button" onClick={enableCamera}><Camera size={18} /><span>{cameraEnabled ? '摄像头已连接' : '开启摄像头'}</span></button>
            <button type="button" className="control-button"><Mic size={18} /><span>麦克风</span></button>
            <button type="button" className="control-button"><Volume2 size={18} /><span>扬声器</span></button>
            <button type="button" className="control-button"><LayoutTemplate size={18} /><span>布局</span></button>
            <button type="button" className={`pk-launch ${isPk ? 'active' : ''}`} onClick={() => changeScene(isPk ? 'quality' : 'pk')}><Users size={17} />{isPk ? '结束 PK' : '发起 PK'}</button>
          </div>
          {view === 'prelive' && (
            <div className="prelive-footer">
              <div><b>准备度 {readyScore} / 100</b><span>再完成 3 项即可开播</span></div>
              <div className="score-track"><i style={{ width: `${readyScore}%` }} /></div>
              <button className="primary-button" type="button" onClick={() => setView('live')}><Play size={16} fill="currentColor" />开始直播</button>
            </div>
          )}
        </section>

        <aside className="genie-panel panel">
          <PanelHeading icon={<Bot size={17} />} title="Genie" status="AI 在线" />
          <div className="genie-intro">
            <div className="mini-orb"><Sparkles size={17} /></div>
            <div><strong>{view === 'prelive' ? '为你生成了开播方案' : '我发现了一个机会点'}</strong><p>{view === 'prelive' ? '根据音乐聊天主题，已匹配舒适陪伴型场景。' : sceneCopy[scene].detail}</p></div>
          </div>
          {view === 'prelive' ? <PreliveRecommendation applied={applied} onApply={applySuggestion} /> : <SceneRecommendation scene={scene} applied={applied} onApply={applySuggestion} />}
          <div className="genie-composer">
            <input placeholder="问 Genie：帮我调整一下…" aria-label="向 Genie 提问" />
            <button type="button" aria-label="发送消息"><Send size={16} /></button>
          </div>
        </aside>
      </section>
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

function PreliveChecklist({ score }: { score: number }) {
  return <div className="checklist">
    <div className="readiness-card"><span>当前准备度</span><strong>{score}<small>/ 100</small></strong><p>还有 3 步可以开播</p><div className="circle-progress"><i style={{ transform: `rotate(${score * 3.6}deg)` }} /></div></div>
    {['确认直播标题', '检查画面与音频', '设置互动开场'].map((item, index) => <button className="check-item" type="button" key={item}><span className={index === 0 ? 'done' : ''}>{index === 0 ? <Check size={13} /> : index + 1}</span>{item}<ChevronDown size={14} /></button>)}
  </div>
}

function LivePreview({ videoRef, cameraEnabled, isPk, applied, scene }: { videoRef: React.RefObject<HTMLVideoElement | null>; cameraEnabled: boolean; isPk: boolean; applied: boolean; scene: Scene }) {
  return <div className={`live-stage ${applied ? 'applied' : ''} ${isPk ? 'pk-stage' : ''}`}>
    <div className="stage-glow" />
    <div className="host-stage">
      {cameraEnabled ? <video ref={videoRef} autoPlay muted playsInline className="camera-feed" /> : <DemoHost />}
      <div className="stage-label"><span />林小满</div>
      {applied && <div className="applied-badge"><Check size={13} />方案已应用</div>}
      {scene === 'quality' && !applied && <div className="stage-hint"><Lightbulb size={14} />环境偏暗</div>}
      {scene === 'troubleshoot' && <div className="audio-meter"><AudioLines size={15} /><span>音频峰值偏低</span><i /><i /><i /><i /></div>}
    </div>
    {isPk && <><div className="pk-versus">VS</div><div className="opponent-stage"><DemoOpponent /><div className="stage-label opponent"><span />陈妍</div></div><div className="pk-scorebar"><div><b>8,740</b><span>林小满</span></div><strong>01:18</strong><div><b>10,000</b><span>陈妍</span></div></div></>}
    {!isPk && <div className="viewer-bubble"><Users size={14} />1,286</div>}
    <div className="floating-comments"><span>小满唱首《可爱女人》吧</span><span>今天的氛围好舒服</span></div>
  </div>
}

function DemoHost() {
  return <div className="demo-host"><div className="light-rays" /><div className="host-hair" /><div className="host-face"><i /><i /><b /></div><div className="host-body" /><div className="host-necklace" /></div>
}

function DemoOpponent() {
  return <div className="demo-opponent"><div className="opponent-hair" /><div className="opponent-face" /><div className="opponent-body" /></div>
}

function PreliveRecommendation({ applied, onApply }: { applied: boolean; onApply: () => void }) {
  return <div className="recommendation-card"><span className="card-kicker">推荐方案</span><h2>温柔陪伴 · 音乐现场</h2><p>暖色背景、点歌投票和开场欢迎语，适合 20:00 后的轻松聊天氛围。</p><div className="template-grid"><span>暖光<br />氛围</span><span>点歌<br />投票</span><span>欢迎<br />贴纸</span></div><button className="primary-button full-button" type="button" onClick={onApply}>{applied ? <><Check size={16} />已应用方案</> : <><WandSparkles size={16} />一键应用方案</>}</button><button className="card-text-button" type="button">查看参数</button></div>
}

function SceneRecommendation({ scene, applied, onApply }: { scene: Scene; applied: boolean; onApply: () => void }) {
  const copy = sceneCopy[scene]
  return <div className={`recommendation-card ${scene}`}>
    <span className="card-kicker">{scene === 'troubleshoot' ? '需要确认' : '实时建议'}</span>
    <h2>{copy.title}</h2>
    <p>{copy.detail}</p>
    {scene === 'quality' && <div className="adjustments"><Adjustment label="补光" value="+32" /><Adjustment label="暖色" value="+18" /><Adjustment label="磨皮" value="20%" /></div>}
    {scene === 'interaction' && <div className="interaction-widget"><div><Gift size={17} /><span>点歌投票</span></div><p>甜歌还是炸场？评论区打 1 或 2</p><small>展示 45 秒 · 评论即可参与</small></div>}
    {scene === 'troubleshoot' && <div className="adjustments"><Adjustment label="麦克风" value="+8%" /><Adjustment label="BGM" value="-5%" /></div>}
    {scene === 'pk' && <div className="goal-widget"><span>本轮冲刺目标</span><strong>再差 1,260 分反超</strong><div><i style={{ width: '76%' }} /></div><small>已获得 38 位观众响应</small></div>}
    <button className="primary-button full-button" type="button" onClick={onApply}>{applied ? <><Check size={16} />已应用</> : <><Sparkles size={16} />{copy.action}</>}</button>
    <button className="card-text-button" type="button"><RefreshCw size={14} />换一组建议</button>
  </div>
}

function Adjustment({ label, value }: { label: string; value: string }) {
  return <div className="adjustment"><span>{label}</span><div><i /></div><b>{value}</b></div>
}

export default App

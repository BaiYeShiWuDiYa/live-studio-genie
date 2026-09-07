import { useMemo, useState } from 'react'
import { Check, Plus, Trophy } from 'lucide-react'
import { useStudioStore } from '../../../store/studioStore'
import type { AtomicPanelProps } from '../types'

export function PollPanel({ onApplied }: AtomicPanelProps) {
  const publish = useStudioStore((state) => state.publishPoll)
  const poll = useStudioStore((state) => state.pollState)
  const [question, setQuestion] = useState('接下来想看什么？')
  const [options, setOptions] = useState(['继续当前内容', '换个主题'])
  const votes = poll.votes.length ? poll.votes : [31, 19]
  const total = Math.max(1, votes.reduce((sum, value) => sum + value, 0))

  return (
    <Panel title="观众投票">
      <input value={question} maxLength={60} onChange={(event) => setQuestion(event.target.value)} aria-label="投票问题" />
      {options.map((option, index) => <input key={index} value={option} maxLength={24} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} aria-label={`投票选项 ${index + 1}`} />)}
      <button className="atomic-secondary-button" type="button" disabled={options.length >= 4} onClick={() => setOptions((current) => [...current, `选项 ${current.length + 1}`])}><Plus size={13} />添加选项</button>
      {poll.status !== 'hidden' && <div className="atomic-results">{options.map((option, index) => <span key={option}><b>{option}</b><i style={{ width: `${Math.round(((votes[index] ?? 0) / total) * 100)}%` }} /><small>{votes[index] ?? 0} 票</small></span>)}</div>}
      <ApplyButton label="发布投票" onClick={() => { publish({ question, options, durationSeconds: 60 }); onApplied?.('audience-poll') }} />
    </Panel>
  )
}

export function GoalPanel({ onApplied }: AtomicPanelProps) {
  const publish = useStudioStore((state) => state.publishLiveGoal)
  const goal = useStudioStore((state) => state.liveGoalState)
  const [label, setLabel] = useState('本场点赞目标')
  const [target, setTarget] = useState(10000)
  const current = goal.config?.current ?? 3280
  const progress = Math.min(100, Math.round(current / target * 100))

  return (
    <Panel title="设置 LIVE goal">
      <input value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} aria-label="目标名称" />
      <label className="atomic-field"><span>目标值</span><input type="number" min={1} value={target} onChange={(event) => setTarget(Math.max(1, Number(event.target.value)))} /></label>
      <div className="atomic-goal-preview"><span><b>{progress}%</b><small>{current.toLocaleString()} / {target.toLocaleString()}</small></span><i><em style={{ width: `${progress}%` }} /></i>{progress >= 100 && <strong><Check size={13} />目标已达成</strong>}</div>
      <ApplyButton label="发布目标" onClick={() => { publish({ label, current: Math.min(current, target), target, supporters: goal.config?.supporters ?? 28 }); onApplied?.('live-goal') }} />
    </Panel>
  )
}

export function WishesPanel({ onApplied }: AtomicPanelProps) {
  const [wishes, setWishes] = useState([
    { id: 1, text: '唱一首轻快的歌', user: '柚子茶', done: false },
    { id: 2, text: '分享今天的妆容', user: '甜甜圈', done: false },
    { id: 3, text: '和新观众打招呼', user: '小宇同学', done: true },
  ])

  return (
    <Panel title="观众心愿">
      <div className="atomic-wish-list">{wishes.map((wish) => <button type="button" className={wish.done ? 'done' : ''} key={wish.id} onClick={() => setWishes((items) => items.map((item) => item.id === wish.id ? { ...item, done: !item.done } : item))}><span>{wish.text}<small>{wish.user}</small></span>{wish.done && <Check size={14} />}</button>)}</div>
      <ApplyButton label="展示未完成心愿" onClick={() => onApplied?.('audience-wishes')} />
    </Panel>
  )
}

export function LikeRankingPanel({ audience, onApplied }: AtomicPanelProps) {
  const [range, setRange] = useState('本场')
  const rows = useMemo(() => audience.comments.slice(-5).reverse().map((comment, index) => ({
    name: comment.userName,
    value: 1280 - index * 173,
    delta: index % 2 === 0 ? 1 : -1,
  })), [audience.comments])
  return <RankingPanel title="点赞榜单" range={range} onRangeChange={setRange} rows={rows} suffix="赞" onApplied={() => onApplied?.('like-ranking')} />
}

export function GiftRankingPanel({ audience, onApplied }: AtomicPanelProps) {
  const [range, setRange] = useState('本场')
  const [filter, setFilter] = useState('全部礼物')
  const rows = useMemo(() => audience.gifts.slice(0, 5).map((gift, index) => ({
    name: gift.userName,
    value: gift.count * (100 - index * 8),
    delta: index < 2 ? 1 : -1,
  })), [audience.gifts])
  return (
    <Panel title="送礼榜单">
      <label className="atomic-field"><span>礼物类型</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>全部礼物</option><option>高价值礼物</option><option>订阅礼物</option></select></label>
      <RankingContent range={range} onRangeChange={setRange} rows={rows} suffix="钻" />
      <ApplyButton label="展示榜单" onClick={() => onApplied?.('gift-ranking')} />
    </Panel>
  )
}

function RankingPanel({ title, range, onRangeChange, rows, suffix, onApplied }: { title: string; range: string; onRangeChange: (value: string) => void; rows: RankRow[]; suffix: string; onApplied: () => void }) {
  return <Panel title={title}><RankingContent range={range} onRangeChange={onRangeChange} rows={rows} suffix={suffix} /><ApplyButton label="展示榜单" onClick={onApplied} /></Panel>
}

interface RankRow { name: string; value: number; delta: number }

function RankingContent({ range, onRangeChange, rows, suffix }: { range: string; onRangeChange: (value: string) => void; rows: RankRow[]; suffix: string }) {
  return <><div className="atomic-preset-row">{['近 5 分钟', '近 30 分钟', '本场'].map((item) => <button type="button" className={range === item ? 'selected' : ''} key={item} onClick={() => onRangeChange(item)}>{item}</button>)}</div><div className="atomic-ranking">{rows.map((row, index) => <div key={`${row.name}-${index}`}><b><Trophy size={12} />{index + 1}</b><span>{row.name}</span><strong>{row.value.toLocaleString()} {suffix}</strong><i className={row.delta > 0 ? 'up' : 'down'}>{row.delta > 0 ? '↑' : '↓'}</i></div>)}</div></>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="atomic-panel-body"><h3>{title}</h3>{children}</div>
}

function ApplyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="atomic-apply-button" type="button" onClick={onClick}><Check size={14} />{label}</button>
}

import { Gift, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useStudioStore } from '../../store/studioStore'

export function LiveGoal() {
  const goalState = useStudioStore((state) => state.liveGoalState)
  const advanceGoal = useStudioStore((state) => state.advanceLiveGoal)

  useEffect(() => {
    if (goalState.status !== 'active' || !goalState.config) return
    if (goalState.config.current >= goalState.config.target) return
    const interval = window.setInterval(() => advanceGoal(120), 3000)
    return () => window.clearInterval(interval)
  }, [advanceGoal, goalState.config, goalState.status])

  if (goalState.status === 'hidden' || !goalState.config) return null

  const { config } = goalState
  const progress = Math.min(100, Math.round((config.current / config.target) * 100))
  const complete = config.current >= config.target

  return (
    <div className={`live-goal-overlay ${goalState.status === 'preview' ? 'is-preview' : ''} ${complete ? 'is-complete' : ''}`}>
      <div className="live-goal-heading">
        <Trophy size={15} />
        <span>{goalState.status === 'preview' ? '目标预览' : config.label}</span>
        <b>{progress}%</b>
      </div>
      <div className="live-goal-track"><i style={{ width: `${progress}%` }} /></div>
      <div className="live-goal-meta">
        <strong>{complete ? '目标达成' : `${config.current.toLocaleString()} / ${config.target.toLocaleString()}`}</strong>
        <span>{config.supporters} 人助力</span>
      </div>
      <button type="button" disabled={goalState.status !== 'active' || complete} onClick={() => advanceGoal(250)}>
        <Gift size={13} />{complete ? '已达成' : '模拟礼物 +250'}
      </button>
    </div>
  )
}

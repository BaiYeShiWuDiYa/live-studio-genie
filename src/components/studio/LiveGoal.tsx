import { Gift, Trophy } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { studioRuntimeConfig } from '../../config/studioRuntime'
import { useStudioStore } from '../../store/studioStore'

export function LiveGoal({ onSelect }: { onSelect?: () => void }) {
  const goalState = useStudioStore((state) => state.liveGoalState)
  const advanceGoal = useStudioStore((state) => state.advanceLiveGoal)
  const syncGoalProgress = useStudioStore((state) => state.syncLiveGoalProgress)
  const goalStartedAtRef = useRef<number | null>(null)
  const goalKeyRef = useRef('')
  const goalLabel = goalState.config?.label
  const goalTarget = goalState.config?.target

  useEffect(() => {
    if (goalState.status !== 'active' || !goalLabel || !goalTarget) return
    const goalKey = `${goalLabel}:${goalTarget}`
    if (goalKeyRef.current !== goalKey) {
      goalKeyRef.current = goalKey
      goalStartedAtRef.current = performance.now()
    }
    const startedAt = goalStartedAtRef.current ?? performance.now()
    let frameId = 0

    const updateProgress = (now: number) => {
      const progress = Math.min(
        1,
        (now - startedAt) / studioRuntimeConfig.liveGoal.targetDurationMs,
      )
      syncGoalProgress(Math.floor(goalTarget * progress))
      if (progress < 1) frameId = window.requestAnimationFrame(updateProgress)
    }

    frameId = window.requestAnimationFrame(updateProgress)
    return () => window.cancelAnimationFrame(frameId)
  }, [goalLabel, goalState.status, goalTarget, syncGoalProgress])

  if (goalState.status === 'hidden' || !goalState.config) return null

  const { config } = goalState
  const progress = Math.min(100, Math.round((config.current / config.target) * 100))
  const complete = config.current >= config.target

  return (
    <div
      className={`live-goal-overlay ${goalState.status === 'preview' ? 'is-preview' : ''} ${complete ? 'is-complete' : ''}`}
      aria-label="LIVE goal 组件"
      tabIndex={0}
      onPointerDown={(event) => {
        if (!onSelect) return
        event.stopPropagation()
        onSelect?.()
      }}
      onClick={() => onSelect?.()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect?.()
      }}
    >
      <div className="live-goal-heading">
        <Trophy size={15} />
        <span>{goalState.status === 'preview' ? '目标预览' : config.label}</span>
        <b>{progress}%</b>
      </div>
      <div
        className="live-goal-track"
        role="progressbar"
        aria-label={config.label}
        aria-valuemin={0}
        aria-valuemax={config.target}
        aria-valuenow={config.current}
        aria-valuetext={`${progress}%`}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="live-goal-meta">
        <strong>{complete ? '目标达成' : `${config.current.toLocaleString()} / ${config.target.toLocaleString()}`}</strong>
        <span>{config.supporters} 人助力</span>
      </div>
      <button
        type="button"
        disabled={goalState.status !== 'active' || complete}
        onClick={() => advanceGoal(studioRuntimeConfig.liveGoal.manualGiftAmount)}
      >
        <Gift size={13} />
        {complete
          ? '已达成'
          : `模拟礼物 +${studioRuntimeConfig.liveGoal.manualGiftAmount}`}
      </button>
    </div>
  )
}

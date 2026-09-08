import { useEffect, useState } from 'react'
import { studioRuntimeConfig } from '../../config/studioRuntime'
import { useStudioStore } from '../../store/studioStore'

export function LivePoll({ onSelect }: { onSelect?: () => void }) {
  const pollState = useStudioStore((state) => state.pollState)
  const hidePoll = useStudioStore((state) => state.hidePoll)
  const votePoll = useStudioStore((state) => state.votePoll)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (pollState.status !== 'active' || !pollState.startedAt || !pollState.config) return
    const interval = window.setInterval(() => {
      const timestamp = Date.now()
      const elapsedSeconds = Math.floor((timestamp - pollState.startedAt!) / 1000)
      if (elapsedSeconds >= pollState.config!.durationSeconds) {
        hidePoll()
        return
      }
      setNow(timestamp)
    }, studioRuntimeConfig.poll.countdownIntervalMs)
    return () => window.clearInterval(interval)
  }, [hidePoll, pollState.config, pollState.startedAt, pollState.status])

  if (pollState.status === 'hidden' || !pollState.config) return null

  const elapsedSeconds = pollState.startedAt && now
    ? Math.floor((now - pollState.startedAt) / 1000)
    : 0
  const remainingSeconds = Math.max(0, pollState.config.durationSeconds - elapsedSeconds)

  const totalVotes = pollState.votes.reduce((total, count) => total + count, 0)

  return (
    <div
      className={`live-poll ${pollState.status === 'preview' ? 'is-preview' : ''}`}
      aria-label="观众投票组件"
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
      <span>{pollState.status === 'preview' ? '预览' : '点歌投票'} · {formatDuration(remainingSeconds)}</span>
      <strong>{pollState.config.question}</strong>
      <div>
        {pollState.config.options.map((option, index) => {
          const percentage = totalVotes === 0 ? 0 : Math.round((pollState.votes[index] / totalVotes) * 100)
          return (
            <button
              key={option}
              type="button"
              disabled={pollState.status !== 'active'}
              onClick={() => votePoll(index)}
            >
              {index + 1} {option} <b>{percentage}%</b>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

import { useRef, type CSSProperties, type ReactNode } from 'react'
import Moveable from 'react-moveable'

export type WidgetOffset = { x: number; y: number }

interface DraggableWidgetProps {
  className: string
  selected: boolean
  offset: WidgetOffset
  onSelect: () => void
  onOffsetChange: (offset: WidgetOffset) => void
  children: ReactNode
  style?: CSSProperties
}

function DraggableWidget({
  className,
  selected,
  offset,
  onSelect,
  onOffsetChange,
  children,
  style,
}: DraggableWidgetProps) {
  const targetRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div
        ref={targetRef}
        className={`canvas-widget ${className} ${selected ? 'is-selected' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, ...style }}
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelect()
        }}
      >
        {children}
      </div>
      {selected && (
        <Moveable
          target={targetRef}
          draggable
          origin={false}
          edge={false}
          onDrag={({ beforeTranslate }) => {
            onOffsetChange({ x: beforeTranslate[0], y: beforeTranslate[1] })
          }}
        />
      )}
    </>
  )
}

interface CanvasTextSourceProps {
  text: string
  selected: boolean
  onSelect: () => void
  offset: WidgetOffset
  onOffsetChange: (offset: WidgetOffset) => void
}

export function CanvasTextSource({ text, selected, onSelect, offset, onOffsetChange }: CanvasTextSourceProps) {
  if (!text.trim()) return null

  const emojiMatch = text.match(/^([\s\S]*?)(\s*(?:\p{Extended_Pictographic}|\u200D|\uFE0F|[\u2640-\u2642])+\s*)$/u)
  const mainText = emojiMatch ? emojiMatch[1] : text
  const emoji = emojiMatch ? emojiMatch[2].trim() : ''

  return (
    <DraggableWidget
      className="canvas-text-source"
      selected={selected}
      offset={offset}
      onSelect={onSelect}
      onOffsetChange={onOffsetChange}
    >
      <span className="canvas-text-gradient">{mainText}</span>
      {emoji && <span className="canvas-text-emoji">{emoji}</span>}
    </DraggableWidget>
  )
}

interface CanvasGoalRingProps {
  label: string
  current: number
  target: number
  selected: boolean
  onSelect: () => void
  offset: WidgetOffset
  onOffsetChange: (offset: WidgetOffset) => void
}

export function CanvasGoalRing({
  label,
  current,
  target,
  selected,
  onSelect,
  offset,
  onOffsetChange,
}: CanvasGoalRingProps) {
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const radius = 44
  const center = 60
  const circumference = 2 * Math.PI * radius
  const trackArc = circumference * 0.75
  const filled = (progress / 100) * trackArc

  return (
    <DraggableWidget
      className="canvas-goal-ring"
      selected={selected}
      offset={offset}
      onSelect={onSelect}
      onOffsetChange={onOffsetChange}
    >
      <div className="canvas-goal-panel">
        <div className="goal-gauge">
          <svg viewBox="0 0 120 110" aria-hidden="true">
            <defs>
              <linearGradient id="chatGoalRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffbf64" />
                <stop offset="50%" stopColor="#ff718d" />
                <stop offset="100%" stopColor="#78e6d5" />
              </linearGradient>
            </defs>
            <circle
              className="goal-gauge-track"
              cx={center}
              cy={center}
              r={radius}
              strokeDasharray={`${trackArc} ${circumference - trackArc}`}
              transform={`rotate(135 ${center} ${center})`}
            />
            {filled > 0 && (
              <circle
                className="goal-gauge-fill"
                cx={center}
                cy={center}
                r={radius}
                stroke="url(#chatGoalRingGradient)"
                strokeDasharray={`${filled} ${circumference}`}
                transform={`rotate(135 ${center} ${center})`}
              />
            )}
          </svg>
          <b className="goal-gauge-percent">{progress}%</b>
        </div>
        <span className="goal-gauge-value">
          {current}/{target}
        </span>
        <span className="goal-gauge-name">{label}</span>
      </div>
    </DraggableWidget>
  )
}

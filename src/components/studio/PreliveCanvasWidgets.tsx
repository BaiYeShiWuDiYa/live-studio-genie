import { useRef, type CSSProperties, type ReactNode } from 'react'
import Moveable from 'react-moveable'
import {
  type CanvasTextStyle,
  defaultCanvasTextStyle,
  type WidgetOffset,
} from '../../capabilities/widgets/canvasWidgets'

interface DraggableWidgetProps {
  className: string
  ariaLabel: string
  selected: boolean
  offset: WidgetOffset
  onSelect: () => void
  onOffsetChange: (offset: WidgetOffset) => void
  children: ReactNode
  style?: CSSProperties
}

function DraggableWidget({
  className,
  ariaLabel,
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
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-pressed={selected}
        className={`canvas-widget ${className} ${selected ? 'is-selected' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, ...style }}
        onPointerDown={() => onSelect()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            onSelect()
          }
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
  textStyle?: CanvasTextStyle
  selected: boolean
  onSelect: () => void
  offset: WidgetOffset
  onOffsetChange: (offset: WidgetOffset) => void
}

export function CanvasTextSource({
  text,
  textStyle = defaultCanvasTextStyle,
  selected,
  onSelect,
  offset,
  onOffsetChange,
}: CanvasTextSourceProps) {
  if (!text.trim()) return null

  const emojiMatch = text.match(/^([\s\S]*?)(\s*(?:\p{Extended_Pictographic}|\u200D|\uFE0F|[\u2640-\u2642])+\s*)$/u)
  const mainText = emojiMatch ? emojiMatch[1] : text
  const emoji = emojiMatch ? emojiMatch[2].trim() : ''
  const isPlainColor = textStyle.color !== 'gradient'
  const classNames = [
    'canvas-text-source',
    isPlainColor ? 'is-plain-color' : '',
    textStyle.decoration === 'stroke' ? 'has-stroke' : '',
    textStyle.decoration === 'pill' ? 'has-pill' : '',
    `align-${textStyle.align}`,
  ].filter(Boolean).join(' ')
  const style: CSSProperties = {
    fontSize: `${textStyle.size}px`,
    fontWeight: textStyle.bold ? 800 : 500,
    textAlign: textStyle.align,
    ['--widget-text-color' as string]: isPlainColor ? textStyle.color : undefined,
  }

  return (
    <DraggableWidget
      className={classNames}
      ariaLabel="画布文字源"
      selected={selected}
      offset={offset}
      onSelect={onSelect}
      onOffsetChange={onOffsetChange}
      style={style}
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
  variant?: 'ring' | 'progress-bar'
  selected: boolean
  onSelect: () => void
  offset: WidgetOffset
  onOffsetChange: (offset: WidgetOffset) => void
}

export function CanvasGoalRing({
  label,
  current,
  target,
  variant = 'ring',
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

  if (variant === 'progress-bar') {
    return (
      <DraggableWidget
        className="canvas-goal-ring canvas-goal-progress"
        ariaLabel="画布目标源"
        selected={selected}
        offset={offset}
        onSelect={onSelect}
        onOffsetChange={onOffsetChange}
      >
        <div className="goal-progress-panel">
          <div className="goal-progress-heading">
            <span>{label}</span>
            <b>{current.toLocaleString()}/{target.toLocaleString()}</b>
          </div>
          <div
            className="goal-progress-track"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.min(current, target)}
            aria-valuetext={`${progress}%`}
          >
            <i style={{ width: `${progress}%` }} />
            <span>{progress}%</span>
          </div>
        </div>
      </DraggableWidget>
    )
  }

  return (
    <DraggableWidget
      className="canvas-goal-ring"
      ariaLabel="画布目标源"
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

import { useRef, type CSSProperties, type ReactNode } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
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
  editable: boolean
  offset: WidgetOffset
  onSelect: () => void
  onOffsetChange: (offset: WidgetOffset) => void
  onDelete?: () => void
  children: ReactNode
  style?: CSSProperties
}

function DraggableWidget({
  className,
  ariaLabel,
  selected,
  editable,
  offset,
  onSelect,
  onOffsetChange,
  onDelete,
  children,
  style,
}: DraggableWidgetProps) {
  const targetRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div
        ref={targetRef}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-label={ariaLabel}
        aria-pressed={editable ? selected : undefined}
        className={`canvas-widget ${className} ${selected ? 'is-selected' : ''} ${editable ? '' : 'is-read-only'}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, ...style }}
        onClick={editable ? onSelect : undefined}
        onKeyDown={editable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                onSelect()
              }
            }
          : undefined}
      >
        {editable && selected && (
          <div className="canvas-widget-toolbar">
            <span
              className="canvas-widget-drag"
              title="拖拽组件即可移动"
              aria-hidden="true"
            >
              <GripVertical size={13} />
            </span>
            {onDelete && (
              <button
                type="button"
                aria-label={`删除${ariaLabel}`}
                title="删除组件"
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete()
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
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
  onDelete?: () => void
  editable?: boolean
}

export function CanvasTextSource({
  text,
  textStyle = defaultCanvasTextStyle,
  selected,
  onSelect,
  offset,
  onOffsetChange,
  onDelete,
  editable = true,
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
      selected={editable && selected}
      editable={editable}
      offset={offset}
      onSelect={onSelect}
      onOffsetChange={onOffsetChange}
      onDelete={onDelete}
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
  onDelete?: () => void
  editable?: boolean
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
  onDelete,
  editable = true,
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
        selected={editable && selected}
        editable={editable}
        offset={offset}
        onSelect={onSelect}
        onOffsetChange={onOffsetChange}
        onDelete={onDelete}
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
      selected={editable && selected}
      editable={editable}
      offset={offset}
      onSelect={onSelect}
      onOffsetChange={onOffsetChange}
      onDelete={onDelete}
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

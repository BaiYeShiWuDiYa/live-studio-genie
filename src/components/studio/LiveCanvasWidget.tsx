import { useRef, type ReactNode } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import Moveable from 'react-moveable'
import type { WidgetOffset } from '../../capabilities/widgets/canvasWidgets'

type LiveCanvasWidgetProps = {
  kind: 'live-goal' | 'audience-poll' | 'audience-wishes'
  label: string
  selected: boolean
  offset: WidgetOffset
  onSelect: () => void
  onOffsetChange: (offset: WidgetOffset) => void
  onDelete: () => void
  children: ReactNode
}

export function LiveCanvasWidget({
  kind,
  label,
  selected,
  offset,
  onSelect,
  onOffsetChange,
  onDelete,
  children,
}: LiveCanvasWidgetProps) {
  const targetRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div
        ref={targetRef}
        className={`live-canvas-widget widget-${kind} ${selected ? 'is-selected' : ''}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        role="group"
        aria-label={`${label}画布组件`}
        tabIndex={0}
        onFocus={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            onDelete()
            return
          }
          const distance = event.shiftKey ? 24 : 8
          const movement = {
            ArrowLeft: { x: -distance, y: 0 },
            ArrowRight: { x: distance, y: 0 },
            ArrowUp: { x: 0, y: -distance },
            ArrowDown: { x: 0, y: distance },
          }[event.key]
          if (selected && movement) {
            event.preventDefault()
            onOffsetChange({
              x: offset.x + movement.x,
              y: offset.y + movement.y,
            })
          }
        }}
      >
        {!selected && (
          <button
            type="button"
            className="live-canvas-widget-select"
            aria-label={`选择${label}`}
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
          />
        )}
        {selected && (
          <div className="live-canvas-widget-toolbar">
            <span
              className="live-canvas-widget-drag"
              title="拖拽组件即可移动"
              aria-hidden="true"
            >
              <GripVertical size={13} />
            </span>
            <button
              type="button"
              className="live-canvas-widget-delete"
              aria-label={`删除${label}`}
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
          preventClickEventOnDrag
          onDrag={({ beforeTranslate }) => {
            const target = targetRef.current
            const parent = target?.parentElement
            if (!target || !parent) return

            const parentRect = parent.getBoundingClientRect()
            const targetRect = target.getBoundingClientRect()
            const deltaX = beforeTranslate[0] - offset.x
            const deltaY = beforeTranslate[1] - offset.y
            let nextX = beforeTranslate[0]
            let nextY = beforeTranslate[1]
            const padding = 8

            if (targetRect.left + deltaX < parentRect.left + padding) {
              nextX += parentRect.left + padding - (targetRect.left + deltaX)
            }
            if (targetRect.right + deltaX > parentRect.right - padding) {
              nextX -= targetRect.right + deltaX - (parentRect.right - padding)
            }
            if (targetRect.top + deltaY < parentRect.top + padding) {
              nextY += parentRect.top + padding - (targetRect.top + deltaY)
            }
            if (targetRect.bottom + deltaY > parentRect.bottom - padding) {
              nextY -= targetRect.bottom + deltaY - (parentRect.bottom - padding)
            }

            onOffsetChange({ x: nextX, y: nextY })
          }}
        />
      )}
    </>
  )
}

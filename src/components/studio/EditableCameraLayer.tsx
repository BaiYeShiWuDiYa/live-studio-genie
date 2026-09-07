import { useRef, useState, type ReactNode, type RefObject } from 'react'
import Moveable from 'react-moveable'
import { useStudioStore } from '../../store/studioStore'
import { CameraEffectsCanvas } from './CameraEffectsCanvas'

interface EditableCameraLayerProps {
  videoRef: RefObject<HTMLVideoElement>
  editing: boolean
  draggable?: boolean
  position?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
  className?: string
  children?: ReactNode
}

export function EditableCameraLayer({
  videoRef,
  editing,
  draggable = false,
  position,
  onPositionChange,
  className = '',
  children,
}: EditableCameraLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(false)
  const layout = useStudioStore((state) => state.cameraLayerLayout)
  const setLayout = useStudioStore((state) => state.setCameraLayerLayout)
  const activePosition = position ?? layout
  const movable = editing || (draggable && selected)
  const updatePosition = (nextPosition: { x: number; y: number }) => {
    if (onPositionChange) {
      onPositionChange(nextPosition)
      return
    }
    setLayout({
      ...layout,
      ...nextPosition,
    })
  }

  return (
    <>
      <div
        ref={layerRef}
        role={draggable ? 'button' : undefined}
        tabIndex={draggable ? 0 : undefined}
        aria-label={draggable ? '游戏直播摄像头源' : undefined}
        aria-pressed={draggable ? selected : undefined}
        className={`camera-picture-in-picture ${className} ${movable ? 'is-editing' : ''} ${selected ? 'is-selected' : ''}`}
        style={{
          ...(position ? {} : { width: layout.width, height: layout.height }),
          transform: `translate(${activePosition.x}px, ${activePosition.y}px)`,
        }}
        onPointerDown={() => {
          if (draggable) setSelected(true)
        }}
        onKeyDown={(event) => {
          if (!draggable || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          setSelected(true)
        }}
      >
        <div className="camera-source">
          {children ?? (
            <>
              <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
              <CameraEffectsCanvas videoRef={videoRef} />
            </>
          )}
        </div>
      </div>
      {editing ? (
        <Moveable
          target={layerRef}
          draggable
          resizable
          keepRatio
          origin={false}
          edge={false}
          minWidth={120}
          maxWidth={360}
          minHeight={160}
          maxHeight={480}
          renderDirections={['nw', 'ne', 'sw', 'se']}
          onDrag={({ beforeTranslate }) => {
            updatePosition({
              x: beforeTranslate[0],
              y: beforeTranslate[1],
            })
          }}
          onResize={({ width, height, drag }) => {
            setLayout({
              x: drag.beforeTranslate[0],
              y: drag.beforeTranslate[1],
              width,
              height,
            })
          }}
        />
      ) : movable && (
        <Moveable
          target={layerRef}
          draggable
          origin={false}
          edge={false}
          onDrag={({ beforeTranslate }) => {
            updatePosition({
              x: beforeTranslate[0],
              y: beforeTranslate[1],
            })
          }}
        />
      )}
    </>
  )
}

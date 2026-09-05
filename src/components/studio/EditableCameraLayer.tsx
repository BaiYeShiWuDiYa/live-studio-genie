import { useRef, type RefObject } from 'react'
import Moveable from 'react-moveable'
import { useStudioStore } from '../../store/studioStore'

interface EditableCameraLayerProps {
  videoRef: RefObject<HTMLVideoElement>
  editing: boolean
}

export function EditableCameraLayer({ videoRef, editing }: EditableCameraLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const layout = useStudioStore((state) => state.cameraLayerLayout)
  const setLayout = useStudioStore((state) => state.setCameraLayerLayout)

  return (
    <>
      <div
        ref={layerRef}
        className={`camera-picture-in-picture ${editing ? 'is-editing' : ''}`}
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${layout.x}px, ${layout.y}px)`,
        }}
      >
        <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
      </div>
      {editing && (
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
            setLayout({
              ...layout,
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
      )}
    </>
  )
}

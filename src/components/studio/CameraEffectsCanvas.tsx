import type { ImageSegmenter, MPMask } from '@mediapipe/tasks-vision'
import { useEffect, useRef, type RefObject } from 'react'
import { createAlphaMask, isCameraEffectActive } from '../../capabilities/video/cameraEffects'
import { useStudioStore } from '../../store/studioStore'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_PATH = '/mediapipe/models/selfie_segmenter_landscape.tflite'
const SEGMENT_INTERVAL_MS = 90

let segmenterPromise: Promise<ImageSegmenter> | null = null

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import('@mediapipe/tasks-vision')
      .then(async ({ FilesetResolver, ImageSegmenter }) => {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
        return ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
        })
      })
      .catch((error) => {
        segmenterPromise = null
        throw error
      })
  }
  return segmenterPromise
}

interface CameraEffectsCanvasProps {
  videoRef: RefObject<HTMLVideoElement>
}

export function CameraEffectsCanvas({ videoRef }: CameraEffectsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settings = useStudioStore((state) => state.cameraEffects)
  const active = isCameraEffectActive(settings)

  useEffect(() => {
    if (!active) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!video || !canvas || !context) return

    const personCanvas = document.createElement('canvas')
    const maskCanvas = document.createElement('canvas')
    const personContext = personCanvas.getContext('2d')
    const maskContext = maskCanvas.getContext('2d')
    if (!personContext || !maskContext) return

    let animationFrame = 0
    let disposed = false
    let segmenter: ImageSegmenter | null = null
    let lastSegmentAt = 0
    let latestMask: MPMask | null = null

    if (settings.backgroundMode !== 'none') {
      void getSegmenter().then((instance) => {
        if (!disposed) segmenter = instance
      })
    }

    const draw = (timestamp: number) => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationFrame = requestAnimationFrame(draw)
        return
      }

      const width = video.videoWidth
      const height = video.videoHeight
      if (width === 0 || height === 0) {
        animationFrame = requestAnimationFrame(draw)
        return
      }

      resizeCanvas(canvas, width, height)
      resizeCanvas(personCanvas, width, height)

      if (
        settings.backgroundMode !== 'none' &&
        segmenter &&
        timestamp - lastSegmentAt >= SEGMENT_INTERVAL_MS
      ) {
        latestMask?.close()
        const result = segmenter.segmentForVideo(video, timestamp)
        latestMask = result.confidenceMasks?.[0]?.clone() ?? null
        result.confidenceMasks?.forEach((mask) => mask.close())
        lastSegmentAt = timestamp
      }

      drawProcessedFrame({
        video,
        context,
        personCanvas,
        personContext,
        maskCanvas,
        maskContext,
        mask: latestMask,
        width,
        height,
        settings,
      })
      animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)
    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      latestMask?.close()
    }
  }, [active, settings, videoRef])

  if (!active) return null
  return <canvas ref={canvasRef} className="camera-feed camera-effects-canvas" aria-label="美化后摄像头画面" />
}

function drawProcessedFrame({
  video,
  context,
  personCanvas,
  personContext,
  maskCanvas,
  maskContext,
  mask,
  width,
  height,
  settings,
}: {
  video: HTMLVideoElement
  context: CanvasRenderingContext2D
  personCanvas: HTMLCanvasElement
  personContext: CanvasRenderingContext2D
  maskCanvas: HTMLCanvasElement
  maskContext: CanvasRenderingContext2D
  mask: MPMask | null
  width: number
  height: number
  settings: ReturnType<typeof useStudioStore.getState>['cameraEffects']
}) {
  context.clearRect(0, 0, width, height)
  const filter = [
    `brightness(${1 + settings.exposure / 100})`,
    `sepia(${settings.warmth / 160})`,
    `saturate(${1 + settings.warmth / 180})`,
    `blur(${settings.smoothness * 0.008}px)`,
  ].join(' ')

  if (settings.backgroundMode === 'none' || !mask) {
    context.filter = filter
    context.drawImage(video, 0, 0, width, height)
    context.filter = 'none'
    return
  }

  if (settings.backgroundMode === 'color') {
    context.fillStyle = settings.backgroundColor
    context.fillRect(0, 0, width, height)
  } else {
    context.filter = 'blur(18px) brightness(0.72)'
    context.drawImage(video, -24, -24, width + 48, height + 48)
    context.filter = 'none'
  }

  const maskPixels = createAlphaMask(mask.getAsFloat32Array())
  resizeCanvas(maskCanvas, mask.width, mask.height)
  const imageData = maskContext.createImageData(mask.width, mask.height)
  imageData.data.set(maskPixels)
  maskContext.putImageData(imageData, 0, 0)

  personContext.clearRect(0, 0, width, height)
  personContext.filter = filter
  personContext.drawImage(video, 0, 0, width, height)
  personContext.filter = 'none'
  personContext.globalCompositeOperation = 'destination-in'
  personContext.drawImage(maskCanvas, 0, 0, width, height)
  personContext.globalCompositeOperation = 'source-over'
  context.drawImage(personCanvas, 0, 0)
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  if (canvas.width === width && canvas.height === height) return
  canvas.width = width
  canvas.height = height
}

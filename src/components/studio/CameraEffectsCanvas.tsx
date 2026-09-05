import type {
  FaceLandmarker,
  ImageSegmenter,
  MPMask,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { useEffect, useRef, type RefObject } from 'react'
import { createAlphaMask, isCameraEffectActive } from '../../capabilities/video/cameraEffects'
import { useStudioStore } from '../../store/studioStore'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_PATH = '/mediapipe/models/selfie_segmenter_landscape.tflite'
const FACE_MODEL_PATH = '/mediapipe/models/face_landmarker.task'
const SEGMENT_INTERVAL_MS = 90
const FACE_INTERVAL_MS = 120

let segmenterPromise: Promise<ImageSegmenter> | null = null
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null

async function getVisionFileset() {
  const { FilesetResolver } = await import('@mediapipe/tasks-vision')
  return FilesetResolver.forVisionTasks(WASM_ROOT)
}

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = Promise.all([
      getVisionFileset(),
      import('@mediapipe/tasks-vision'),
    ])
      .then(([vision, { ImageSegmenter }]) => {
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

function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = Promise.all([
      getVisionFileset(),
      import('@mediapipe/tasks-vision'),
    ])
      .then(([vision, { FaceLandmarker }]) => {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_MODEL_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        })
      })
      .catch((error) => {
        faceLandmarkerPromise = null
        throw error
      })
  }
  return faceLandmarkerPromise
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
    let faceLandmarker: FaceLandmarker | null = null
    let lastSegmentAt = 0
    let lastFaceAt = 0
    let latestMask: MPMask | null = null
    let latestFace: NormalizedLandmark[] | null = null
    let backgroundImage: HTMLImageElement | null = null

    if (settings.backgroundMode !== 'none') {
      void getSegmenter().then((instance) => {
        if (!disposed) segmenter = instance
      })
    }
    if (settings.faceEffect !== 'none') {
      void getFaceLandmarker().then((instance) => {
        if (!disposed) faceLandmarker = instance
      })
    }
    if (settings.backgroundImageUrl) {
      const image = new Image()
      image.onload = () => {
        if (!disposed) backgroundImage = image
      }
      image.src = settings.backgroundImageUrl
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
      if (
        settings.faceEffect !== 'none' &&
        faceLandmarker &&
        timestamp - lastFaceAt >= FACE_INTERVAL_MS
      ) {
        const result = faceLandmarker.detectForVideo(video, timestamp)
        latestFace = result.faceLandmarks[0]?.map((landmark) => ({ ...landmark })) ?? null
        lastFaceAt = timestamp
      }

      drawProcessedFrame({
        video,
        context,
        personCanvas,
        personContext,
        maskCanvas,
        maskContext,
        mask: latestMask,
        faceLandmarks: latestFace,
        backgroundImage,
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
  faceLandmarks,
  backgroundImage,
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
  faceLandmarks: NormalizedLandmark[] | null
  backgroundImage: HTMLImageElement | null
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
    drawFaceEffect(context, faceLandmarks, settings.faceEffect, width, height)
    return
  }

  if (settings.backgroundMode === 'color') {
    context.fillStyle = settings.backgroundColor
    context.fillRect(0, 0, width, height)
  } else if (settings.backgroundMode === 'image' && backgroundImage) {
    drawImageCover(context, backgroundImage, width, height)
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
  drawFaceEffect(context, faceLandmarks, settings.faceEffect, width, height)
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

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
}

function drawFaceEffect(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null,
  effect: 'none' | 'halo' | 'sparkles',
  width: number,
  height: number,
) {
  if (!landmarks || effect === 'none') return
  const forehead = landmarks[10]
  const left = landmarks[234]
  const right = landmarks[454]
  if (!forehead || !left || !right) return

  const centerX = forehead.x * width
  const faceWidth = Math.abs(right.x - left.x) * width
  const topY = forehead.y * height - faceWidth * 0.28
  context.save()
  context.shadowBlur = 14
  context.shadowColor = '#78f0dd'
  context.lineWidth = Math.max(2, faceWidth * 0.018)

  if (effect === 'halo') {
    context.strokeStyle = '#9ff7e8'
    context.beginPath()
    context.ellipse(centerX, topY, faceWidth * 0.48, faceWidth * 0.13, 0, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.fillStyle = '#fff3ad'
    ;[
      [centerX - faceWidth * 0.52, topY],
      [centerX + faceWidth * 0.48, topY - faceWidth * 0.08],
      [centerX, topY - faceWidth * 0.22],
    ].forEach(([x, y], index) => {
      drawSparkle(context, x, y, faceWidth * (index === 2 ? 0.1 : 0.07))
    })
  }
  context.restore()
}

function drawSparkle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  context.beginPath()
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI / 4) * index - Math.PI / 2
    const distance = index % 2 === 0 ? radius : radius * 0.28
    const pointX = x + Math.cos(angle) * distance
    const pointY = y + Math.sin(angle) * distance
    if (index === 0) context.moveTo(pointX, pointY)
    else context.lineTo(pointX, pointY)
  }
  context.closePath()
  context.fill()
}

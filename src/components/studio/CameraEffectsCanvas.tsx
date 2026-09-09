import type {
  FaceLandmarker,
  ImageSegmenter,
  MPMask,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { useEffect, useRef, type RefObject } from 'react'
import {
  createAlphaMask,
  type FaceEffect,
  hasMakeupEnabled,
  type CameraEffects,
  isCameraEffectActive,
  type VirtualBackground,
} from '../../capabilities/video/cameraEffects'
import { createGlassesGeometry } from '../../capabilities/video/faceEffectGeometry'
import { createFramingMetric } from '../../capabilities/monitoring/mediaAnalysis'
import type { MediaMetric } from '../../capabilities/monitoring/types'
import { studioRuntimeConfig } from '../../config/studioRuntime'
import { useStudioStore } from '../../store/studioStore'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_PATH = '/mediapipe/models/selfie_segmenter_landscape.tflite'
const FACE_MODEL_PATH = '/mediapipe/models/face_landmarker.task'

const framingMeasuringMetric: MediaMetric = {
  score: 0,
  value: '检测中',
  tone: 'warn',
  status: 'measuring',
  updatedAt: 0,
}

const framingUnavailableMetric: MediaMetric = {
  score: 0,
  value: '检测不可用',
  tone: 'bad',
  status: 'unavailable',
  updatedAt: 0,
}

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
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
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
  const faceLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const settings = useStudioStore((state) => state.cameraEffects)
  const settingsRef = useRef(settings)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const updateMetric = useStudioStore((state) => state.updateMediaMetric)
  const resetMetric = useStudioStore((state) => state.resetMediaMetric)
  const active = isCameraEffectActive(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const imageUrl = settings.backgroundImageUrl
    backgroundImageRef.current = null
    if (!imageUrl) return

    let disposed = false
    const image = new Image()
    image.onload = () => {
      if (!disposed) backgroundImageRef.current = image
    }
    image.src = imageUrl
    return () => {
      disposed = true
    }
  }, [settings.backgroundImageUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let animationFrame = 0
    let disposed = false
    let faceLandmarker: FaceLandmarker | null = null
    let lastFaceAt = 0
    let lastMetricAt = 0
    updateMetric('framing', framingMeasuringMetric)

    void getFaceLandmarker()
      .then((instance) => {
        if (!disposed) faceLandmarker = instance
      })
      .catch(() => {
        if (!disposed) updateMetric('framing', framingUnavailableMetric)
      })

    const track = (timestamp: number) => {
      if (
        faceLandmarker &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        timestamp - lastFaceAt >= studioRuntimeConfig.cameraEffects.faceLandmarkIntervalMs
      ) {
        try {
          const result = faceLandmarker.detectForVideo(video, timestamp)
          const detectedLandmarks = result.faceLandmarks[0] ?? null
          faceLandmarksRef.current = detectedLandmarks
            ? smoothFaceLandmarks(faceLandmarksRef.current, detectedLandmarks)
            : null
        } catch {
          faceLandmarksRef.current = null
        }
        lastFaceAt = timestamp
        if (
          timestamp - lastMetricAt >=
          studioRuntimeConfig.cameraEffects.framingMetricIntervalMs
        ) {
          updateMetric('framing', createFramingMetric(faceLandmarksRef.current))
          lastMetricAt = timestamp
        }
      }
      animationFrame = requestAnimationFrame(track)
    }

    animationFrame = requestAnimationFrame(track)
    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      faceLandmarksRef.current = null
      resetMetric('framing')
    }
  }, [resetMetric, updateMetric, videoRef])

  useEffect(() => {
    if (!active) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!video || !canvas || !context) return

    const personCanvas = document.createElement('canvas')
    const maskCanvas = document.createElement('canvas')
    const smoothingCanvas = document.createElement('canvas')
    const skinMaskCanvas = document.createElement('canvas')
    const skinLayerCanvas = document.createElement('canvas')
    const geometryCanvas = document.createElement('canvas')
    const personContext = personCanvas.getContext('2d')
    const maskContext = maskCanvas.getContext('2d')
    const smoothingContext = smoothingCanvas.getContext('2d')
    const skinMaskContext = skinMaskCanvas.getContext('2d')
    const skinLayerContext = skinLayerCanvas.getContext('2d')
    const geometryContext = geometryCanvas.getContext('2d')
    if (
      !personContext ||
      !maskContext ||
      !smoothingContext ||
      !skinMaskContext ||
      !skinLayerContext ||
      !geometryContext
    ) {
      return
    }

    let animationFrame = 0
    let disposed = false
    let segmenter: ImageSegmenter | null = null
    let segmenterLoading = false
    let segmenterUnavailable = false
    let lastSegmentAt = 0
    let hasSegmentationMask = false
    let previousMaskPixels: Uint8ClampedArray | null = null

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
      resizeCanvas(smoothingCanvas, width, height)
      resizeCanvas(skinMaskCanvas, width, height)
      resizeCanvas(skinLayerCanvas, width, height)
      resizeCanvas(geometryCanvas, width, height)

      const currentSettings = settingsRef.current
      if (
        currentSettings.backgroundMode !== 'none' &&
        !segmenter &&
        !segmenterLoading &&
        !segmenterUnavailable
      ) {
        segmenterLoading = true
        void getSegmenter()
          .then((instance) => {
            if (!disposed) segmenter = instance
          })
          .catch(() => {
            if (!disposed) segmenterUnavailable = true
          })
          .finally(() => {
            segmenterLoading = false
          })
      }
      if (
        currentSettings.backgroundMode !== 'none' &&
        segmenter &&
        timestamp - lastSegmentAt >=
          studioRuntimeConfig.cameraEffects.segmentationIntervalMs
      ) {
        const result = segmenter.segmentForVideo(video, timestamp)
        const mask = result.confidenceMasks?.[0]
        if (mask) {
          previousMaskPixels = updateMaskCanvas(
            maskCanvas,
            maskContext,
            mask,
            previousMaskPixels,
          )
          hasSegmentationMask = true
        }
        result.confidenceMasks?.forEach((mask) => mask.close())
        lastSegmentAt = timestamp
      }
      drawProcessedFrame({
        video,
        context,
        personCanvas,
        personContext,
        maskCanvas,
        smoothingCanvas,
        smoothingContext,
        skinMaskCanvas,
        skinMaskContext,
        skinLayerCanvas,
        skinLayerContext,
        geometryCanvas,
        geometryContext,
        hasSegmentationMask,
        faceLandmarks: faceLandmarksRef.current,
        backgroundImage: backgroundImageRef.current,
        width,
        height,
        settings: currentSettings,
      })
      animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)
    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
    }
  }, [active, videoRef])

  if (!active) return null
  return <canvas ref={canvasRef} className="camera-feed camera-effects-canvas" aria-label="美化后摄像头画面" />
}

function drawProcessedFrame({
  video,
  context,
  personCanvas,
  personContext,
  maskCanvas,
  smoothingCanvas,
  smoothingContext,
  skinMaskCanvas,
  skinMaskContext,
  skinLayerCanvas,
  skinLayerContext,
  geometryCanvas,
  geometryContext,
  hasSegmentationMask,
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
  smoothingCanvas: HTMLCanvasElement
  smoothingContext: CanvasRenderingContext2D
  skinMaskCanvas: HTMLCanvasElement
  skinMaskContext: CanvasRenderingContext2D
  skinLayerCanvas: HTMLCanvasElement
  skinLayerContext: CanvasRenderingContext2D
  geometryCanvas: HTMLCanvasElement
  geometryContext: CanvasRenderingContext2D
  hasSegmentationMask: boolean
  faceLandmarks: NormalizedLandmark[] | null
  backgroundImage: HTMLImageElement | null
  width: number
  height: number
  settings: ReturnType<typeof useStudioStore.getState>['cameraEffects']
}) {
  context.clearRect(0, 0, width, height)
  const filter = [
    `brightness(${1 + settings.exposure / 100})`,
    `contrast(${1 + settings.contrast / 100})`,
    `sepia(${settings.warmth / 160})`,
    `saturate(${1 + settings.warmth / 180 + settings.saturation / 100})`,
  ].join(' ')

  if (settings.backgroundMode === 'none' || !hasSegmentationMask) {
    context.filter = filter
    context.drawImage(video, 0, 0, width, height)
    context.filter = 'none'
    const renderedLandmarks = drawFaceGeometry(
      context,
      geometryCanvas,
      geometryContext,
      faceLandmarks,
      settings,
      width,
      height,
    )
    drawSkinSmoothing(
      context,
      smoothingCanvas,
      smoothingContext,
      skinMaskCanvas,
      skinMaskContext,
      skinLayerCanvas,
      skinLayerContext,
      renderedLandmarks,
      settings,
      width,
      height,
    )
    drawSkinTone(context, renderedLandmarks, settings, width, height)
    drawMakeup(context, renderedLandmarks, settings, width, height)
    drawFaceEffect(context, renderedLandmarks, settings.faceEffect, width, height)
    return
  }

  if (settings.backgroundMode === 'color') {
    context.fillStyle = settings.backgroundColor
    context.fillRect(0, 0, width, height)
  } else if (settings.backgroundMode === 'image' && settings.backgroundPreset) {
    drawVirtualBackground(context, settings.backgroundPreset, width, height)
  } else if (settings.backgroundMode === 'image' && backgroundImage) {
    drawImageCover(context, backgroundImage, width, height)
  } else {
    const blurRadius = 4 + settings.backgroundBlur * 0.22
    const bleed = Math.ceil(blurRadius * 1.4)
    context.filter = `blur(${blurRadius}px) brightness(0.72)`
    context.drawImage(
      video,
      -bleed,
      -bleed,
      width + bleed * 2,
      height + bleed * 2,
    )
    context.filter = 'none'
  }

  personContext.clearRect(0, 0, width, height)
  personContext.filter = filter
  personContext.drawImage(video, 0, 0, width, height)
  personContext.filter = 'none'
  personContext.globalCompositeOperation = 'destination-in'
  personContext.drawImage(maskCanvas, 0, 0, width, height)
  personContext.globalCompositeOperation = 'source-over'
  context.drawImage(personCanvas, 0, 0)
  const renderedLandmarks = drawFaceGeometry(
    context,
    geometryCanvas,
    geometryContext,
    faceLandmarks,
    settings,
    width,
    height,
  )
  drawSkinSmoothing(
    context,
    smoothingCanvas,
    smoothingContext,
    skinMaskCanvas,
    skinMaskContext,
    skinLayerCanvas,
    skinLayerContext,
    renderedLandmarks,
    settings,
    width,
    height,
  )
  drawSkinTone(context, renderedLandmarks, settings, width, height)
  drawMakeup(context, renderedLandmarks, settings, width, height)
  drawFaceEffect(context, renderedLandmarks, settings.faceEffect, width, height)
}

function updateMaskCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  mask: MPMask,
  previousPixels: Uint8ClampedArray | null,
): Uint8ClampedArray {
  resizeCanvas(canvas, mask.width, mask.height)
  const pixels = createAlphaMask(mask.getAsFloat32Array())
  if (previousPixels?.length === pixels.length) {
    for (let offset = 3; offset < pixels.length; offset += 4) {
      pixels[offset] = Math.round(
        previousPixels[offset] * 0.58 + pixels[offset] * 0.42,
      )
    }
  }
  const imageData = context.createImageData(mask.width, mask.height)
  imageData.data.set(pixels)
  context.putImageData(imageData, 0, 0)
  return pixels
}

function drawVirtualBackground(
  context: CanvasRenderingContext2D,
  preset: VirtualBackground,
  width: number,
  height: number,
) {
  const wall = context.createLinearGradient(0, 0, width, height)

  if (preset === 'neon-studio') {
    wall.addColorStop(0, '#102a32')
    wall.addColorStop(0.48, '#101522')
    wall.addColorStop(1, '#35172f')
    context.fillStyle = wall
    context.fillRect(0, 0, width, height)
    for (let index = 0; index < 7; index += 1) {
      context.fillStyle = index % 2 === 0 ? '#172736' : '#201b31'
      context.fillRect(width * (0.06 + index * 0.135), height * 0.08, width * 0.085, height * 0.48)
    }
    drawNeonLine(context, width * 0.08, height * 0.16, width * 0.08, height * 0.7, '#55eddf', width)
    drawNeonLine(context, width * 0.92, height * 0.14, width * 0.92, height * 0.7, '#ef72c0', width)
    context.fillStyle = '#0b1018'
    context.fillRect(width * 0.12, height * 0.72, width * 0.76, height * 0.28)
    context.fillStyle = 'rgba(116, 237, 221, 0.28)'
    context.fillRect(width * 0.22, height * 0.72, width * 0.56, height * 0.015)
    return
  }

  if (preset === 'music-room') {
    wall.addColorStop(0, '#35261f')
    wall.addColorStop(0.58, '#1d2228')
    wall.addColorStop(1, '#123b3a')
    context.fillStyle = wall
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#15191f'
    context.fillRect(0, height * 0.72, width, height * 0.28)
    context.fillStyle = '#211a1a'
    context.fillRect(width * 0.08, height * 0.15, width * 0.25, height * 0.48)
    for (let row = 0; row < 3; row += 1) {
      context.fillStyle = '#8b5935'
      context.fillRect(width * 0.1, height * (0.25 + row * 0.14), width * 0.21, height * 0.012)
      for (let column = 0; column < 4; column += 1) {
        context.fillStyle = ['#af5c66', '#d09a58', '#497f83', '#74638e'][column]
        context.fillRect(
          width * (0.115 + column * 0.047),
          height * (0.19 + row * 0.14),
          width * 0.026,
          height * 0.06,
        )
      }
    }
    context.fillStyle = '#e8bb72'
    context.beginPath()
    context.arc(width * 0.82, height * 0.28, width * 0.055, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#172326'
    context.fillRect(width * 0.79, height * 0.32, width * 0.06, height * 0.41)
    return
  }

  if (preset === 'cyber-arena') {
    wall.addColorStop(0, '#07121b')
    wall.addColorStop(0.5, '#111027')
    wall.addColorStop(1, '#180c22')
    context.fillStyle = wall
    context.fillRect(0, 0, width, height)
    const horizon = height * 0.5
    context.strokeStyle = 'rgba(85, 237, 223, 0.3)'
    context.lineWidth = Math.max(1, width * 0.0015)
    for (let index = -8; index <= 8; index += 1) {
      context.beginPath()
      context.moveTo(width / 2, horizon)
      context.lineTo(width / 2 + index * width * 0.12, height)
      context.stroke()
    }
    for (let index = 0; index < 8; index += 1) {
      const y = horizon + (height - horizon) * (index / 8) ** 1.7
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.stroke()
    }
    drawNeonLine(context, width * 0.08, height * 0.17, width * 0.35, height * 0.17, '#ef72c0', width)
    drawNeonLine(context, width * 0.65, height * 0.17, width * 0.92, height * 0.17, '#55eddf', width)
    context.fillStyle = 'rgba(18, 27, 43, 0.92)'
    context.fillRect(width * 0.18, height * 0.68, width * 0.64, height * 0.2)
    return
  }

  wall.addColorStop(0, '#85959a')
  wall.addColorStop(0.55, '#59666d')
  wall.addColorStop(1, '#6d5b55')
  context.fillStyle = wall
  context.fillRect(0, 0, width, height)
  context.fillStyle = 'rgba(210, 231, 228, 0.72)'
  context.fillRect(width * 0.08, height * 0.1, width * 0.27, height * 0.46)
  context.strokeStyle = '#48575d'
  context.lineWidth = Math.max(3, width * 0.008)
  context.strokeRect(width * 0.08, height * 0.1, width * 0.27, height * 0.46)
  context.beginPath()
  context.moveTo(width * 0.215, height * 0.1)
  context.lineTo(width * 0.215, height * 0.56)
  context.moveTo(width * 0.08, height * 0.33)
  context.lineTo(width * 0.35, height * 0.33)
  context.stroke()
  context.fillStyle = '#313d3b'
  context.fillRect(width * 0.72, height * 0.2, width * 0.2, height * 0.035)
  context.fillStyle = '#355e49'
  for (let index = 0; index < 7; index += 1) {
    context.beginPath()
    context.ellipse(
      width * (0.78 + (index % 3) * 0.04),
      height * (0.38 + index * 0.026),
      width * 0.045,
      height * 0.024,
      index * 0.55,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
  context.fillStyle = '#20292d'
  context.fillRect(0, height * 0.76, width, height * 0.24)
}

function drawNeonLine(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string,
  width: number,
) {
  context.save()
  context.strokeStyle = color
  context.lineWidth = Math.max(3, width * 0.007)
  context.shadowBlur = width * 0.025
  context.shadowColor = color
  context.beginPath()
  context.moveTo(startX, startY)
  context.lineTo(endX, endY)
  context.stroke()
  context.restore()
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

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]
const LEFT_EYE = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380]

function drawFaceGeometry(
  context: CanvasRenderingContext2D,
  geometryCanvas: HTMLCanvasElement,
  geometryContext: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null,
  settings: CameraEffects,
  width: number,
  height: number,
): NormalizedLandmark[] | null {
  if (
    !landmarks ||
    (settings.slimFace === 0 && settings.bigEyes === 0)
  ) {
    return landmarks
  }

  const leftFace = landmarks[234]
  const rightFace = landmarks[454]
  const forehead = landmarks[10]
  const chin = landmarks[152]
  if (!leftFace || !rightFace || !forehead || !chin) return landmarks

  const faceLeft = Math.min(leftFace.x, rightFace.x) * width
  const faceRight = Math.max(leftFace.x, rightFace.x) * width
  const faceTop = Math.min(forehead.y, chin.y) * height
  const faceBottom = Math.max(forehead.y, chin.y) * height
  const faceWidth = faceRight - faceLeft
  const faceHeight = faceBottom - faceTop
  if (faceWidth < 2 || faceHeight < 2) return landmarks

  const transformed = landmarks.map((landmark) => ({ ...landmark }))
  if (settings.slimFace > 0) {
    geometryContext.clearRect(0, 0, width, height)
    geometryContext.drawImage(context.canvas, 0, 0)
    const outerLeft = Math.max(0, faceLeft - faceWidth * 0.38)
    const outerRight = Math.min(width, faceRight + faceWidth * 0.38)
    const top = Math.max(0, faceTop - faceHeight * 0.08)
    const bottom = Math.min(height, faceBottom + faceHeight * 0.08)
    const rowCount = 22

    for (let row = 0; row < rowCount; row += 1) {
      const sourceY = top + ((bottom - top) * row) / rowCount
      const nextY = top + ((bottom - top) * (row + 1)) / rowCount
      const stripHeight = Math.max(1, nextY - sourceY + 0.6)
      const middleY = (sourceY + nextY) / 2
      const inset = getSlimFaceInset(
        middleY,
        faceTop,
        faceBottom,
        faceWidth,
        settings.slimFace,
      )
      const targetLeft = faceLeft + inset
      const targetRight = faceRight - inset

      drawHorizontalWarpSection(
        context,
        geometryCanvas,
        outerLeft,
        faceLeft,
        outerLeft,
        targetLeft,
        sourceY,
        stripHeight,
      )
      drawHorizontalWarpSection(
        context,
        geometryCanvas,
        faceLeft,
        faceRight,
        targetLeft,
        targetRight,
        sourceY,
        stripHeight,
      )
      drawHorizontalWarpSection(
        context,
        geometryCanvas,
        faceRight,
        outerRight,
        targetRight,
        outerRight,
        sourceY,
        stripHeight,
      )
    }

    transformed.forEach((landmark) => {
      const x = landmark.x * width
      const y = landmark.y * height
      landmark.x = mapSlimFaceX(
        x,
        y,
        outerLeft,
        faceLeft,
        faceRight,
        outerRight,
        faceTop,
        faceBottom,
        faceWidth,
        settings.slimFace,
      ) / width
    })
  }

  if (settings.bigEyes > 0) {
    geometryContext.clearRect(0, 0, width, height)
    geometryContext.drawImage(context.canvas, 0, 0)
    for (const indices of [LEFT_EYE, RIGHT_EYE]) {
      magnifyEye(
        context,
        geometryCanvas,
        transformed,
        indices,
        settings.bigEyes,
        width,
        height,
      )
      magnifyLandmarksAroundEye(
        transformed,
        indices,
        settings.bigEyes,
        width,
        height,
      )
    }
  }

  return transformed
}

function getSlimFaceInset(
  y: number,
  faceTop: number,
  faceBottom: number,
  faceWidth: number,
  intensity: number,
) {
  const progress = Math.min(
    1,
    Math.max(0, (y - faceTop) / Math.max(1, faceBottom - faceTop)),
  )
  const verticalWeight = Math.sin(Math.PI * progress) *
    Math.min(1, Math.max(0, (progress - 0.18) / 0.32))
  return faceWidth * 0.055 * (intensity / 100) * verticalWeight
}

function mapSlimFaceX(
  x: number,
  y: number,
  outerLeft: number,
  faceLeft: number,
  faceRight: number,
  outerRight: number,
  faceTop: number,
  faceBottom: number,
  faceWidth: number,
  intensity: number,
) {
  const inset = getSlimFaceInset(
    y,
    faceTop,
    faceBottom,
    faceWidth,
    intensity,
  )
  if (x <= faceLeft) {
    const progress = (x - outerLeft) / Math.max(1, faceLeft - outerLeft)
    return x + inset * Math.min(1, Math.max(0, progress))
  }
  if (x >= faceRight) {
    const progress = (outerRight - x) / Math.max(1, outerRight - faceRight)
    return x - inset * Math.min(1, Math.max(0, progress))
  }
  const progress = (x - faceLeft) / Math.max(1, faceRight - faceLeft)
  return faceLeft + inset + progress * (faceWidth - inset * 2)
}

function drawHorizontalWarpSection(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  sourceLeft: number,
  sourceRight: number,
  targetLeft: number,
  targetRight: number,
  y: number,
  height: number,
) {
  const sourceWidth = sourceRight - sourceLeft
  const targetWidth = targetRight - targetLeft
  if (sourceWidth <= 0 || targetWidth <= 0) return
  context.drawImage(
    source,
    sourceLeft,
    y,
    sourceWidth,
    height,
    targetLeft,
    y,
    targetWidth,
    height,
  )
}

function magnifyEye(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
  indices: number[],
  intensity: number,
  width: number,
  height: number,
) {
  const points = indices.map((index) => landmarks[index])
  if (points.some((point) => !point)) return
  const xs = points.map((point) => point.x * width)
  const ys = points.map((point) => point.y * height)
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
  const radiusX = Math.max(2, (Math.max(...xs) - Math.min(...xs)) * 0.82)
  const radiusY = Math.max(2, radiusX * 0.62)
  const scale = 1 + intensity * 0.0018
  const targetRadiusX = radiusX * scale
  const targetRadiusY = radiusY * scale

  context.save()
  context.beginPath()
  context.ellipse(
    centerX,
    centerY,
    targetRadiusX,
    targetRadiusY,
    0,
    0,
    Math.PI * 2,
  )
  context.clip()
  context.drawImage(
    source,
    centerX - radiusX,
    centerY - radiusY,
    radiusX * 2,
    radiusY * 2,
    centerX - targetRadiusX,
    centerY - targetRadiusY,
    targetRadiusX * 2,
    targetRadiusY * 2,
  )
  context.restore()
}

function magnifyLandmarksAroundEye(
  landmarks: NormalizedLandmark[],
  indices: number[],
  intensity: number,
  width: number,
  height: number,
) {
  const eyePoints = indices.map((index) => landmarks[index])
  if (eyePoints.some((point) => !point)) return
  const centerX = eyePoints.reduce((sum, point) => sum + point.x, 0) /
    eyePoints.length
  const centerY = eyePoints.reduce((sum, point) => sum + point.y, 0) /
    eyePoints.length
  const eyeWidth = Math.max(
    ...eyePoints.map((point) => Math.abs(point.x - centerX) * width),
  ) * 1.7
  const radius = Math.max(0.001, eyeWidth / width)
  const scaleDelta = intensity * 0.0018

  landmarks.forEach((landmark) => {
    const dx = landmark.x - centerX
    const dy = (landmark.y - centerY) * (height / width)
    const distance = Math.hypot(dx, dy)
    if (distance >= radius) return
    const weight = (1 - distance / radius) ** 2
    landmark.x = centerX + dx * (1 + scaleDelta * weight)
    landmark.y = centerY +
      (landmark.y - centerY) * (1 + scaleDelta * weight)
  })
}

function smoothFaceLandmarks(
  previous: NormalizedLandmark[] | null,
  detected: NormalizedLandmark[],
): NormalizedLandmark[] {
  if (!previous || previous.length !== detected.length) {
    return detected.map((landmark) => ({ ...landmark }))
  }

  const anchors = [1, 10, 33, 152, 234, 263, 454]
  const movement = anchors.reduce((total, index) => {
    const before = previous[index]
    const after = detected[index]
    if (!before || !after) return total
    return total + Math.hypot(after.x - before.x, after.y - before.y)
  }, 0) / anchors.length
  const alpha = Math.min(0.88, Math.max(0.34, 0.34 + movement * 24))

  return detected.map((landmark, index) => {
    const before = previous[index]
    if (!before) return { ...landmark }
    return {
      ...landmark,
      x: before.x + (landmark.x - before.x) * alpha,
      y: before.y + (landmark.y - before.y) * alpha,
      z: before.z + (landmark.z - before.z) * alpha,
    }
  })
}

function drawSkinSmoothing(
  context: CanvasRenderingContext2D,
  smoothingCanvas: HTMLCanvasElement,
  smoothingContext: CanvasRenderingContext2D,
  skinMaskCanvas: HTMLCanvasElement,
  skinMaskContext: CanvasRenderingContext2D,
  skinLayerCanvas: HTMLCanvasElement,
  skinLayerContext: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null,
  settings: CameraEffects,
  width: number,
  height: number,
) {
  if (
    !landmarks ||
    (settings.smoothness === 0 && settings.clarity === 0)
  ) {
    return
  }

  skinMaskContext.clearRect(0, 0, width, height)
  skinMaskContext.save()
  skinMaskContext.filter = `blur(${Math.max(1.5, width * 0.0022)}px)`
  skinMaskContext.fillStyle = '#fff'
  traceFaceSkinPath(skinMaskContext, landmarks, width, height)
  skinMaskContext.fill('evenodd')
  skinMaskContext.restore()

  smoothingContext.clearRect(0, 0, width, height)
  smoothingContext.filter = settings.smoothness > 0
    ? `blur(${0.7 + settings.smoothness * 0.018}px)`
    : 'none'
  smoothingContext.drawImage(context.canvas, 0, 0, width, height)
  smoothingContext.filter = 'none'

  skinLayerContext.clearRect(0, 0, width, height)
  skinLayerContext.drawImage(smoothingCanvas, 0, 0, width, height)
  skinLayerContext.globalCompositeOperation = 'destination-in'
  skinLayerContext.drawImage(skinMaskCanvas, 0, 0, width, height)
  skinLayerContext.globalCompositeOperation = 'source-over'

  if (settings.smoothness > 0) {
    context.save()
    context.globalAlpha = Math.min(0.72, settings.smoothness / 125)
    context.drawImage(skinLayerCanvas, 0, 0)
    context.restore()
  }
  if (settings.clarity > 0) {
    context.save()
    context.globalCompositeOperation = 'soft-light'
    context.globalAlpha = Math.min(0.3, settings.clarity / 330)
    context.filter = `contrast(${1 + settings.clarity / 180})`
    context.drawImage(skinLayerCanvas, 0, 0)
    context.restore()
  }
}

function traceFaceSkinPath(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
) {
  context.beginPath()
  traceLandmarkPath(context, landmarks, FACE_OVAL, width, height)
  traceLandmarkPath(context, landmarks, LEFT_EYE, width, height)
  traceLandmarkPath(context, landmarks, RIGHT_EYE, width, height)
  traceLandmarkPath(context, landmarks, LIPS_OUTER, width, height)
}

// Landmark regions and compositing approach adapted from simple-makeup-filter (MIT).
const LIPS_OUTER = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
]
const LIPS_INNER = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
  308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
]
const EYE_TOP_LEFT = [33, 246, 161, 160, 159, 158, 157, 173, 133]
const EYE_TOP_RIGHT = [263, 466, 388, 387, 386, 385, 384, 398, 362]

function drawSkinTone(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null,
  settings: CameraEffects,
  width: number,
  height: number,
) {
  if (!landmarks || (settings.whitening === 0 && settings.rosiness === 0)) return
  const forehead = landmarks[10]
  const chin = landmarks[152]
  const left = landmarks[234]
  const right = landmarks[454]
  if (!forehead || !chin || !left || !right) return

  const centerX = ((left.x + right.x) / 2) * width
  const centerY = ((forehead.y + chin.y) / 2) * height
  const faceWidth = Math.hypot(
    (right.x - left.x) * width,
    (right.y - left.y) * height,
  )
  const faceHeight = Math.hypot(
    (chin.x - forehead.x) * width,
    (chin.y - forehead.y) * height,
  )
  const roll = Math.atan2(
    (right.y - left.y) * height,
    (right.x - left.x) * width,
  )

  const fillTone = (
    color: string,
    alpha: number,
    operation: GlobalCompositeOperation,
  ) => {
    if (alpha <= 0) return
    context.save()
    context.globalCompositeOperation = operation
    context.translate(centerX, centerY)
    context.rotate(roll)
    context.scale(faceWidth * 0.5, faceHeight * 0.53)
    const gradient = context.createRadialGradient(0, -0.06, 0.08, 0, 0, 1)
    gradient.addColorStop(0, hexToRgba(color, alpha))
    gradient.addColorStop(0.62, hexToRgba(color, alpha * 0.72))
    gradient.addColorStop(1, hexToRgba(color, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.arc(0, 0, 1, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  fillTone('#fff8f1', settings.whitening / 520, 'screen')
  fillTone('#ef8e9f', settings.rosiness / 420, 'soft-light')
}

function drawMakeup(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null,
  settings: CameraEffects,
  width: number,
  height: number,
) {
  if (!landmarks || !hasMakeupEnabled(settings)) return
  const left = landmarks[234]
  const right = landmarks[454]
  if (!left || !right) return

  const faceWidth = Math.hypot(
    (right.x - left.x) * width,
    (right.y - left.y) * height,
  )
  const roll = Math.atan2(
    (right.y - left.y) * height,
    (right.x - left.x) * width,
  )

  drawLipstick(context, landmarks, settings, width, height, faceWidth)
  drawBlush(context, landmarks, settings, width, height, faceWidth, roll)
  drawEyeshadow(context, landmarks, settings, width, height, faceWidth, roll)
  drawEyeliner(context, landmarks, settings, width, height, faceWidth)
  drawHighlight(context, landmarks, settings, width, height, faceWidth)
}

function drawLipstick(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  settings: CameraEffects,
  width: number,
  height: number,
  faceWidth: number,
) {
  if (settings.lipstickIntensity === 0) return
  context.save()
  context.globalCompositeOperation = 'multiply'
  context.filter = `blur(${Math.max(0.8, faceWidth * 0.005)}px)`
  context.fillStyle = hexToRgba(
    settings.lipstickColor,
    settings.lipstickIntensity / 145,
  )
  context.beginPath()
  traceLandmarkPath(context, landmarks, LIPS_OUTER, width, height)
  traceLandmarkPath(context, landmarks, LIPS_INNER, width, height)
  context.fill('evenodd')
  context.filter = 'none'
  context.restore()

  const lowerLip = landmarks[17]
  const upperLip = landmarks[0]
  if (!lowerLip || !upperLip) return
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = Math.min(0.18, settings.lipstickIntensity / 520)
  context.fillStyle = '#fff1e8'
  context.filter = `blur(${Math.max(0.8, faceWidth * 0.004)}px)`
  context.beginPath()
  context.ellipse(
    ((lowerLip.x + upperLip.x) * 0.5) * width,
    ((lowerLip.y + upperLip.y) * 0.5) * height + faceWidth * 0.012,
    faceWidth * 0.085,
    faceWidth * 0.018,
    0,
    0,
    Math.PI * 2,
  )
  context.fill()
  context.restore()
}

function drawBlush(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  settings: CameraEffects,
  width: number,
  height: number,
  faceWidth: number,
  roll: number,
) {
  if (settings.blushIntensity === 0) return
  const nose = landmarks[1]
  if (!nose) return
  const rightX = Math.cos(roll)
  const rightY = Math.sin(roll)
  const upX = Math.sin(roll)
  const upY = -Math.cos(roll)

  for (const index of [205, 425]) {
    const cheek = landmarks[index]
    if (!cheek) continue
    const side = Math.sign(
      (cheek.x - nose.x) * width * rightX +
      (cheek.y - nose.y) * height * rightY,
    ) || 1
    const centerX =
      cheek.x * width + rightX * side * faceWidth * 0.025 + upX * faceWidth * 0.045
    const centerY =
      cheek.y * height + rightY * side * faceWidth * 0.025 + upY * faceWidth * 0.045
    const radius = faceWidth * 0.15
    const alpha = settings.blushIntensity / 260
    context.save()
    context.globalCompositeOperation = 'soft-light'
    context.translate(centerX, centerY)
    context.rotate(roll)
    context.scale(1.55, 1)
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradient.addColorStop(0, hexToRgba(settings.blushColor, alpha))
    gradient.addColorStop(0.5, hexToRgba(settings.blushColor, alpha * 0.5))
    gradient.addColorStop(1, hexToRgba(settings.blushColor, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
}

function drawEyeshadow(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  settings: CameraEffects,
  width: number,
  height: number,
  faceWidth: number,
  roll: number,
) {
  if (settings.eyeshadowIntensity === 0) return
  context.save()
  context.globalCompositeOperation = 'multiply'
  const upX = Math.sin(roll)
  const upY = -Math.cos(roll)
  const lift = faceWidth * 0.055
  context.filter = `blur(${Math.max(1.5, faceWidth * 0.012)}px)`

  for (const indices of [EYE_TOP_LEFT, EYE_TOP_RIGHT]) {
    const lid = indices.map((index) => {
      const landmark = landmarks[index]
      return [landmark.x * width, landmark.y * height] as const
    })
    const band = [...lid]
    for (let index = lid.length - 1; index >= 0; index -= 1) {
      const taper = index === 0 || index === lid.length - 1 ? 0.28 : 1
      band.push([
        lid[index][0] + upX * lift * taper,
        lid[index][1] + upY * lift * taper,
      ])
    }
    const centerX = lid.reduce((sum, point) => sum + point[0], 0) / lid.length
    const centerY = lid.reduce((sum, point) => sum + point[1], 0) / lid.length
    const alpha = settings.eyeshadowIntensity / 185
    const gradient = context.createLinearGradient(
      centerX,
      centerY,
      centerX + upX * lift,
      centerY + upY * lift,
    )
    gradient.addColorStop(0, hexToRgba(settings.eyeshadowColor, alpha))
    gradient.addColorStop(1, hexToRgba(settings.eyeshadowColor, alpha * 0.12))
    context.fillStyle = gradient
    context.beginPath()
    band.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
    context.fill()
  }
  context.filter = 'none'
  context.restore()
}

function drawEyeliner(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  settings: CameraEffects,
  width: number,
  height: number,
  faceWidth: number,
) {
  if (settings.eyelinerIntensity === 0) return
  context.save()
  context.globalCompositeOperation = 'source-over'
  const left = landmarks[234]
  const right = landmarks[454]
  const nose = landmarks[1]
  if (!left || !right || !nose) return
  const roll = Math.atan2(
    (right.y - left.y) * height,
    (right.x - left.x) * width,
  )
  const upX = Math.sin(roll)
  const upY = -Math.cos(roll)
  const thickness = faceWidth * (0.004 + settings.eyelinerIntensity * 0.00007)
  const alpha = Math.min(0.86, 0.18 + settings.eyelinerIntensity / 160)
  context.fillStyle = `rgba(18, 15, 24, ${alpha})`

  for (const indices of [EYE_TOP_LEFT, EYE_TOP_RIGHT]) {
    const points = indices.map((index) => ({
      x: landmarks[index].x * width,
      y: landmarks[index].y * height,
    }))
    context.beginPath()
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const progress = index / (points.length - 1)
      const taper = Math.sin(progress * Math.PI)
      context.lineTo(
        points[index].x + upX * thickness * taper,
        points[index].y + upY * thickness * taper,
      )
    }
    context.closePath()
    context.fill()

    const outer = points[0]
    const direction = outer.x < nose.x * width ? -1 : 1
    const wingLength = faceWidth * (0.025 + settings.eyelinerIntensity * 0.00018)
    context.beginPath()
    context.moveTo(outer.x, outer.y)
    context.lineTo(
      outer.x + direction * wingLength + upX * wingLength * 0.35,
      outer.y + upY * wingLength * 0.35,
    )
    context.lineTo(
      outer.x + upX * thickness * 0.5,
      outer.y + upY * thickness * 0.5,
    )
    context.closePath()
    context.fill()
  }
  context.restore()
}

function drawHighlight(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  settings: CameraEffects,
  width: number,
  height: number,
  faceWidth: number,
) {
  if (settings.highlightIntensity === 0) return
  const bridge = landmarks[168]
  const tip = landmarks[1]
  const leftCheek = landmarks[117]
  const rightCheek = landmarks[346]
  const left = landmarks[234]
  const right = landmarks[454]
  if (!bridge || !tip || !leftCheek || !rightCheek || !left || !right) return
  const alpha = settings.highlightIntensity / 520
  const roll = Math.atan2(
    (right.y - left.y) * height,
    (right.x - left.x) * width,
  )

  const drawSpot = (
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    opacity: number,
  ) => {
    context.save()
    context.translate(x, y)
    context.rotate(rotation)
    context.scale(radiusX, radiusY)
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1)
    gradient.addColorStop(0, `rgba(255, 244, 226, ${opacity})`)
    gradient.addColorStop(0.58, `rgba(255, 238, 216, ${opacity * 0.5})`)
    gradient.addColorStop(1, 'rgba(255, 238, 216, 0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(0, 0, 1, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  context.save()
  context.globalCompositeOperation = 'screen'
  const noseAngle = Math.atan2(
    (tip.y - bridge.y) * height,
    (tip.x - bridge.x) * width,
  ) - Math.PI / 2
  drawSpot(
    ((bridge.x + tip.x) / 2) * width,
    ((bridge.y + tip.y) / 2) * height,
    faceWidth * 0.035,
    faceWidth * 0.16,
    noseAngle,
    alpha,
  )
  drawSpot(tip.x * width, tip.y * height, faceWidth * 0.055, faceWidth * 0.04, roll, alpha)
  drawSpot(leftCheek.x * width, leftCheek.y * height, faceWidth * 0.13, faceWidth * 0.055, roll, alpha * 0.72)
  drawSpot(rightCheek.x * width, rightCheek.y * height, faceWidth * 0.13, faceWidth * 0.055, roll, alpha * 0.72)
  context.restore()
}

function traceLandmarkPath(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  indices: number[],
  width: number,
  height: number,
) {
  indices.forEach((index, pointIndex) => {
    const landmark = landmarks[index]
    const x = landmark.x * width
    const y = landmark.y * height
    if (pointIndex === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.closePath()
}

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function drawFaceEffect(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | null,
  effect: FaceEffect,
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
  const roll = Math.atan2(
    (right.y - left.y) * height,
    (right.x - left.x) * width,
  )
  context.save()
  context.shadowBlur = 14
  context.shadowColor = '#78f0dd'
  context.lineWidth = Math.max(2, faceWidth * 0.018)

  if (effect === 'sparkles') {
    context.fillStyle = '#fff3ad'
    ;[
      [centerX - faceWidth * 0.52, topY],
      [centerX + faceWidth * 0.48, topY - faceWidth * 0.08],
      [centerX, topY - faceWidth * 0.22],
    ].forEach(([x, y], index) => {
      drawSparkle(context, x, y, faceWidth * (index === 2 ? 0.1 : 0.07))
    })
  } else if (effect === 'glasses') {
    drawTechGlasses(context, landmarks, width, height)
  } else if (effect === 'sunglasses') {
    drawBlackSunglasses(context, landmarks, width, height)
  } else if (effect === 'heart-sticker') {
    drawCheekHearts(context, landmarks, width, height, faceWidth)
  } else if (effect === 'cheek-stars') {
    drawCheekStars(context, landmarks, width, height, faceWidth)
  } else if (effect === 'butterfly-sticker') {
    drawButterflyStickers(context, landmarks, width, height, faceWidth, roll)
  } else if (effect === 'lightning-sticker') {
    drawLightningStickers(context, landmarks, width, height, faceWidth, roll)
  }
  context.restore()
}

function drawButterflyStickers(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  faceWidth: number,
  roll: number,
) {
  const anchors = [landmarks[205], landmarks[425]]
  anchors.forEach((anchor, index) => {
    if (!anchor) return
    const direction = index === 0 ? -1 : 1
    const x = anchor.x * width + direction * faceWidth * 0.08
    const y = anchor.y * height - faceWidth * 0.12
    const size = faceWidth * 0.12
    context.save()
    context.translate(x, y)
    context.rotate(roll + direction * 0.18)
    context.shadowBlur = 10
    context.shadowColor = '#d68cff'
    context.fillStyle = 'rgba(214, 140, 255, 0.86)'
    context.strokeStyle = '#8ff4e3'
    context.lineWidth = Math.max(1, size * 0.08)
    for (const wingDirection of [-1, 1]) {
      context.beginPath()
      context.ellipse(
        wingDirection * size * 0.46,
        -size * 0.16,
        size * 0.34,
        size * 0.52,
        wingDirection * 0.48,
        0,
        Math.PI * 2,
      )
      context.fill()
      context.stroke()
      context.beginPath()
      context.ellipse(
        wingDirection * size * 0.33,
        size * 0.32,
        size * 0.25,
        size * 0.31,
        wingDirection * 0.22,
        0,
        Math.PI * 2,
      )
      context.fill()
      context.stroke()
    }
    context.fillStyle = '#fff2b8'
    context.beginPath()
    context.ellipse(0, 0, size * 0.08, size * 0.55, 0, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = '#fff2b8'
    context.lineWidth = Math.max(1, size * 0.055)
    context.beginPath()
    context.moveTo(-size * 0.02, -size * 0.46)
    context.quadraticCurveTo(-size * 0.16, -size * 0.8, -size * 0.34, -size * 0.74)
    context.moveTo(size * 0.02, -size * 0.46)
    context.quadraticCurveTo(size * 0.16, -size * 0.8, size * 0.34, -size * 0.74)
    context.stroke()
    context.restore()
  })
}

function drawLightningStickers(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  faceWidth: number,
  roll: number,
) {
  const anchors = [landmarks[127], landmarks[356]]
  anchors.forEach((anchor, index) => {
    if (!anchor) return
    const direction = index === 0 ? -1 : 1
    const x = anchor.x * width - direction * faceWidth * 0.04
    const y = anchor.y * height + faceWidth * 0.04
    const size = faceWidth * 0.16
    context.save()
    context.translate(x, y)
    context.rotate(roll + direction * 0.1)
    context.scale(direction, 1)
    context.fillStyle = index === 0 ? '#78f0dd' : '#f68ed8'
    context.shadowBlur = 12
    context.shadowColor = context.fillStyle
    context.beginPath()
    context.moveTo(-size * 0.18, -size * 0.58)
    context.lineTo(size * 0.3, -size * 0.58)
    context.lineTo(size * 0.02, -size * 0.04)
    context.lineTo(size * 0.34, -size * 0.04)
    context.lineTo(-size * 0.28, size * 0.62)
    context.lineTo(-size * 0.04, size * 0.1)
    context.lineTo(-size * 0.34, size * 0.1)
    context.closePath()
    context.fill()
    context.restore()
  })
}

function drawCheekHearts(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  faceWidth: number,
) {
  const cheeks = [landmarks[205], landmarks[425]]
  context.fillStyle = 'rgba(255, 105, 163, 0.88)'
  context.shadowBlur = 10
  context.shadowColor = '#ff76bd'
  cheeks.forEach((cheek) => {
    if (!cheek) return
    drawHeart(
      context,
      cheek.x * width,
      cheek.y * height,
      faceWidth * 0.075,
    )
  })
}

function drawCheekStars(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  faceWidth: number,
) {
  const cheeks = [landmarks[205], landmarks[425]]
  context.fillStyle = '#fff3ad'
  context.shadowBlur = 10
  context.shadowColor = '#78f0dd'
  cheeks.forEach((cheek, index) => {
    if (!cheek) return
    const direction = index === 0 ? -1 : 1
    const x = cheek.x * width
    const y = cheek.y * height
    drawSparkle(context, x, y, faceWidth * 0.055)
    drawSparkle(
      context,
      x + direction * faceWidth * 0.09,
      y - faceWidth * 0.065,
      faceWidth * 0.032,
    )
  })
}

function drawHeart(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.beginPath()
  context.moveTo(x, y + size * 0.82)
  context.bezierCurveTo(
    x - size * 1.15,
    y + size * 0.1,
    x - size * 0.72,
    y - size * 0.78,
    x,
    y - size * 0.2,
  )
  context.bezierCurveTo(
    x + size * 0.72,
    y - size * 0.78,
    x + size * 1.15,
    y + size * 0.1,
    x,
    y + size * 0.82,
  )
  context.fill()
}

function drawGlassesTempleArms(
  context: CanvasRenderingContext2D,
  geometry: NonNullable<ReturnType<typeof createGlassesGeometry>>,
  lensRadiusX: number,
  lensHeight: number,
) {
  const axisX = Math.cos(geometry.roll)
  const axisY = Math.sin(geometry.roll)
  const upX = axisY
  const upY = -axisX
  const sides = [
    {
      center: geometry.leftCenter,
      anchor: geometry.leftTempleAnchor,
      end: geometry.leftTemple,
      direction: -1,
    },
    {
      center: geometry.rightCenter,
      anchor: geometry.rightTempleAnchor,
      end: geometry.rightTemple,
      direction: 1,
    },
  ] as const

  for (const { center, anchor, end, direction } of sides) {
    const hinge = {
      x: center.x + axisX * lensRadiusX * direction + upX * lensHeight * 0.08,
      y: center.y + axisY * lensRadiusX * direction + upY * lensHeight * 0.08,
    }
    const extension = Math.hypot(end.x - anchor.x, end.y - anchor.y)
    context.beginPath()
    context.moveTo(hinge.x, hinge.y)
    context.lineTo(anchor.x, anchor.y)
    context.quadraticCurveTo(
      anchor.x + axisX * extension * direction * 0.72,
      anchor.y + axisY * extension * direction * 0.72,
      end.x,
      end.y,
    )
    context.stroke()
  }
}

function drawBlackSunglasses(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
) {
  const geometry = createGlassesGeometry(landmarks, width, height)
  if (!geometry) return
  const { leftCenter, rightCenter, roll } = geometry
  const lensWidth = geometry.lensWidth * 1.12
  const lensHeight = lensWidth * 0.72
  const radiusX = lensWidth / 2
  const radiusY = lensHeight / 2
  const axisX = Math.cos(roll)
  const axisY = Math.sin(roll)
  const upX = axisY
  const upY = -axisX

  context.save()
  context.lineJoin = 'round'
  context.lineCap = 'round'
  const frameWidth = Math.max(4, lensWidth * 0.062)
  context.lineWidth = frameWidth
  context.strokeStyle = '#05070a'
  context.shadowBlur = 8
  context.shadowColor = 'rgba(0, 0, 0, 0.7)'
  drawGlassesTempleArms(context, geometry, radiusX, lensHeight)

  for (const center of [leftCenter, rightCenter]) {
    context.save()
    context.translate(center.x, center.y)
    context.rotate(roll)
    const lensGradient = context.createLinearGradient(0, -radiusY, 0, radiusY)
    lensGradient.addColorStop(0, 'rgba(8, 10, 14, 0.98)')
    lensGradient.addColorStop(0.55, 'rgba(16, 20, 25, 0.95)')
    lensGradient.addColorStop(1, 'rgba(42, 50, 56, 0.88)')
    context.fillStyle = lensGradient
    context.beginPath()
    context.roundRect(
      -radiusX,
      -radiusY,
      lensWidth,
      lensHeight,
      lensHeight * 0.12,
    )
    context.fill()
    context.stroke()

    context.shadowBlur = 0
    context.strokeStyle = '#020304'
    context.lineWidth = frameWidth * 1.35
    context.beginPath()
    context.moveTo(-radiusX * 0.86, -radiusY * 0.82)
    context.lineTo(radiusX * 0.86, -radiusY * 0.82)
    context.stroke()

    context.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    context.lineWidth = Math.max(1.5, lensWidth * 0.018)
    context.beginPath()
    context.moveTo(-radiusX * 0.58, -radiusY * 0.46)
    context.quadraticCurveTo(
      -radiusX * 0.32,
      -radiusY * 0.58,
      -radiusX * 0.02,
      -radiusY * 0.46,
    )
    context.stroke()
    context.restore()
  }

  context.shadowBlur = 0
  context.strokeStyle = '#05070a'
  context.lineWidth = frameWidth
  context.beginPath()
  context.moveTo(
    leftCenter.x + axisX * radiusX,
    leftCenter.y + axisY * radiusX,
  )
  context.quadraticCurveTo(
    (leftCenter.x + rightCenter.x) / 2 + upX * lensHeight * 0.12,
    (leftCenter.y + rightCenter.y) / 2 + upY * lensHeight * 0.12,
    rightCenter.x - axisX * radiusX,
    rightCenter.y - axisY * radiusX,
  )
  context.stroke()
  context.restore()
}

function drawTechGlasses(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
) {
  const geometry = createGlassesGeometry(landmarks, width, height)
  if (!geometry) return
  const {
    leftCenter,
    rightCenter,
    lensWidth,
    lensHeight,
    roll,
  } = geometry
  const lensRadiusX = lensWidth / 2
  const lensRadiusY = lensHeight / 2
  const axisX = Math.cos(roll)
  const axisY = Math.sin(roll)
  const upX = axisY
  const upY = -axisX

  context.save()
  context.fillStyle = 'rgba(54, 198, 230, 0.15)'
  context.strokeStyle = '#78f0dd'
  context.lineWidth = Math.max(2.5, lensWidth * 0.065)
  context.lineJoin = 'round'
  context.shadowBlur = 14
  context.shadowColor = '#5be8ff'
  drawGlassesTempleArms(context, geometry, lensRadiusX, lensHeight)

  for (const center of [leftCenter, rightCenter]) {
    context.save()
    context.translate(center.x, center.y)
    context.rotate(roll)
    context.beginPath()
    context.roundRect(
      -lensRadiusX,
      -lensRadiusY,
      lensWidth,
      lensHeight,
      lensHeight * 0.3,
    )
    context.fill()
    context.stroke()
    context.restore()
  }

  context.shadowBlur = 0
  context.beginPath()
  context.moveTo(
    leftCenter.x + axisX * lensRadiusX,
    leftCenter.y + axisY * lensRadiusX,
  )
  context.quadraticCurveTo(
    (leftCenter.x + rightCenter.x) / 2 + upX * lensHeight * 0.12,
    (leftCenter.y + rightCenter.y) / 2 + upY * lensHeight * 0.12,
    rightCenter.x - axisX * lensRadiusX,
    rightCenter.y - axisY * lensRadiusX,
  )
  context.stroke()
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

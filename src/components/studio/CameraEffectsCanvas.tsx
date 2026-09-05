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
} from '../../capabilities/video/cameraEffects'
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
    if (settings.faceEffect !== 'none' || hasMakeupEnabled(settings)) {
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
        (settings.faceEffect !== 'none' || hasMakeupEnabled(settings)) &&
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
    drawMakeup(context, faceLandmarks, settings, width, height)
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
  drawMakeup(context, faceLandmarks, settings, width, height)
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

  context.save()
  context.globalCompositeOperation = 'multiply'
  drawLipstick(context, landmarks, settings, width, height, faceWidth)
  drawBlush(context, landmarks, settings, width, height, faceWidth, roll)
  drawEyeshadow(context, landmarks, settings, width, height, faceWidth, roll)
  context.restore()
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
  context.save()
  context.shadowBlur = 14
  context.shadowColor = '#78f0dd'
  context.lineWidth = Math.max(2, faceWidth * 0.018)

  if (effect === 'halo') {
    context.strokeStyle = '#9ff7e8'
    context.beginPath()
    context.ellipse(centerX, topY, faceWidth * 0.48, faceWidth * 0.13, 0, 0, Math.PI * 2)
    context.stroke()
  } else if (effect === 'sparkles') {
    context.fillStyle = '#fff3ad'
    ;[
      [centerX - faceWidth * 0.52, topY],
      [centerX + faceWidth * 0.48, topY - faceWidth * 0.08],
      [centerX, topY - faceWidth * 0.22],
    ].forEach(([x, y], index) => {
      drawSparkle(context, x, y, faceWidth * (index === 2 ? 0.1 : 0.07))
    })
  } else {
    drawTechGlasses(context, landmarks, width, height)
  }
  context.restore()
}

function drawTechGlasses(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
) {
  const leftOuter = landmarks[33]
  const leftInner = landmarks[133]
  const rightInner = landmarks[362]
  const rightOuter = landmarks[263]
  if (!leftOuter || !leftInner || !rightInner || !rightOuter) return

  const toPoint = (landmark: NormalizedLandmark) => ({
    x: landmark.x * width,
    y: landmark.y * height,
  })
  const leftA = toPoint(leftOuter)
  const leftB = toPoint(leftInner)
  const rightA = toPoint(rightInner)
  const rightB = toPoint(rightOuter)
  const leftCenter = {
    x: (leftA.x + leftB.x) / 2,
    y: (leftA.y + leftB.y) / 2,
  }
  const rightCenter = {
    x: (rightA.x + rightB.x) / 2,
    y: (rightA.y + rightB.y) / 2,
  }
  const lensWidth = Math.max(
    Math.hypot(leftB.x - leftA.x, leftB.y - leftA.y),
    Math.hypot(rightB.x - rightA.x, rightB.y - rightA.y),
  ) * 0.82
  const roll = Math.atan2(
    rightCenter.y - leftCenter.y,
    rightCenter.x - leftCenter.x,
  )

  context.save()
  context.translate(
    (leftCenter.x + rightCenter.x) / 2,
    (leftCenter.y + rightCenter.y) / 2,
  )
  context.rotate(roll)
  context.translate(
    -(leftCenter.x + rightCenter.x) / 2,
    -(leftCenter.y + rightCenter.y) / 2,
  )
  context.fillStyle = 'rgba(54, 198, 230, 0.2)'
  context.strokeStyle = '#78f0dd'
  context.lineWidth = Math.max(2, lensWidth * 0.08)
  context.shadowBlur = 12
  context.shadowColor = '#5be8ff'

  for (const center of [leftCenter, rightCenter]) {
    context.beginPath()
    context.ellipse(
      center.x,
      center.y,
      lensWidth * 0.62,
      lensWidth * 0.42,
      0,
      0,
      Math.PI * 2,
    )
    context.fill()
    context.stroke()
  }

  context.beginPath()
  context.moveTo(leftCenter.x + lensWidth * 0.62, leftCenter.y)
  context.lineTo(rightCenter.x - lensWidth * 0.62, rightCenter.y)
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

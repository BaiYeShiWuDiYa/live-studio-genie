export interface FaceEffectPoint {
  x: number
  y: number
}

export interface GlassesGeometry {
  leftCenter: FaceEffectPoint
  rightCenter: FaceEffectPoint
  leftTemple: FaceEffectPoint
  rightTemple: FaceEffectPoint
  lensWidth: number
  lensHeight: number
  roll: number
}

export function createGlassesGeometry(
  landmarks: FaceEffectPoint[],
  width: number,
  height: number,
): GlassesGeometry | null {
  const leftOuter = landmarks[33]
  const leftInner = landmarks[133]
  const leftUpper = landmarks[159]
  const leftLower = landmarks[145]
  const rightInner = landmarks[362]
  const rightOuter = landmarks[263]
  const rightUpper = landmarks[386]
  const rightLower = landmarks[374]
  const leftTemple = landmarks[127]
  const rightTemple = landmarks[356]
  if (
    !leftOuter ||
    !leftInner ||
    !leftUpper ||
    !leftLower ||
    !rightInner ||
    !rightOuter ||
    !rightUpper ||
    !rightLower ||
    !leftTemple ||
    !rightTemple
  ) {
    return null
  }

  const toPoint = (point: FaceEffectPoint) => ({
    x: point.x * width,
    y: point.y * height,
  })
  const leftPoints = [
    toPoint(leftOuter),
    toPoint(leftInner),
    toPoint(leftUpper),
    toPoint(leftLower),
  ]
  const rightPoints = [
    toPoint(rightInner),
    toPoint(rightOuter),
    toPoint(rightUpper),
    toPoint(rightLower),
  ]
  const centerOf = (points: FaceEffectPoint[]) => ({
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  })
  const leftCenter = centerOf(leftPoints)
  const rightCenter = centerOf(rightPoints)
  const leftEyeWidth = Math.hypot(
    leftPoints[1].x - leftPoints[0].x,
    leftPoints[1].y - leftPoints[0].y,
  )
  const rightEyeWidth = Math.hypot(
    rightPoints[1].x - rightPoints[0].x,
    rightPoints[1].y - rightPoints[0].y,
  )
  const eyeOpening = Math.max(
    Math.hypot(
      leftPoints[3].x - leftPoints[2].x,
      leftPoints[3].y - leftPoints[2].y,
    ),
    Math.hypot(
      rightPoints[3].x - rightPoints[2].x,
      rightPoints[3].y - rightPoints[2].y,
    ),
  )
  const lensWidth = Math.max(leftEyeWidth, rightEyeWidth) * 1.52
  const lensHeight = Math.max(lensWidth * 0.66, eyeOpening * 2.8)
  const verticalOffset = lensHeight * 0.04

  leftCenter.y -= verticalOffset
  rightCenter.y -= verticalOffset

  return {
    leftCenter,
    rightCenter,
    leftTemple: toPoint(leftTemple),
    rightTemple: toPoint(rightTemple),
    lensWidth,
    lensHeight,
    roll: Math.atan2(
      rightCenter.y - leftCenter.y,
      rightCenter.x - leftCenter.x,
    ),
  }
}

import { describe, expect, it } from 'vitest'
import {
  createGlassesGeometry,
  type FaceEffectPoint,
} from './faceEffectGeometry'

function createLandmarks(): FaceEffectPoint[] {
  return Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }))
}

describe('face effect geometry', () => {
  it('expands glasses beyond the eyelids to cover the eye sockets', () => {
    const landmarks = createLandmarks()
    landmarks[33] = { x: 0.3, y: 0.4 }
    landmarks[133] = { x: 0.42, y: 0.4 }
    landmarks[159] = { x: 0.36, y: 0.38 }
    landmarks[145] = { x: 0.36, y: 0.43 }
    landmarks[362] = { x: 0.58, y: 0.41 }
    landmarks[263] = { x: 0.7, y: 0.41 }
    landmarks[386] = { x: 0.64, y: 0.39 }
    landmarks[374] = { x: 0.64, y: 0.44 }
    landmarks[127] = { x: 0.2, y: 0.41 }
    landmarks[356] = { x: 0.8, y: 0.42 }

    const geometry = createGlassesGeometry(landmarks, 1000, 500)

    expect(geometry).not.toBeNull()
    expect(geometry!.lensWidth).toBeCloseTo(228)
    expect(geometry!.lensHeight).toBeGreaterThan(164)
    expect(geometry!.leftCenter.y).toBeLessThan(200)
    expect(geometry!.leftTemple.x).toBeLessThan(geometry!.leftTempleAnchor.x)
    expect(geometry!.rightTemple.x).toBeGreaterThan(geometry!.rightTempleAnchor.x)
    expect(geometry!.leftTemple.y - geometry!.leftTempleAnchor.y).toBeLessThan(20)
    expect(geometry!.rightTemple.y - geometry!.rightTempleAnchor.y).toBeLessThan(20)
  })

  it('shortens the less visible temple arm for a turned face', () => {
    const landmarks = createLandmarks()
    landmarks[33] = { x: 0.3, y: 0.4 }
    landmarks[133] = { x: 0.42, y: 0.4 }
    landmarks[159] = { x: 0.36, y: 0.38 }
    landmarks[145] = { x: 0.36, y: 0.43 }
    landmarks[362] = { x: 0.58, y: 0.4 }
    landmarks[263] = { x: 0.7, y: 0.4 }
    landmarks[386] = { x: 0.64, y: 0.38 }
    landmarks[374] = { x: 0.64, y: 0.43 }
    landmarks[127] = { x: 0.27, y: 0.41 }
    landmarks[356] = { x: 0.9, y: 0.41 }

    const geometry = createGlassesGeometry(landmarks, 1000, 500)!
    const leftExtension = Math.hypot(
      geometry.leftTemple.x - geometry.leftTempleAnchor.x,
      geometry.leftTemple.y - geometry.leftTempleAnchor.y,
    )
    const rightExtension = Math.hypot(
      geometry.rightTemple.x - geometry.rightTempleAnchor.x,
      geometry.rightTemple.y - geometry.rightTempleAnchor.y,
    )

    expect(rightExtension).toBeGreaterThan(leftExtension)
  })

  it('returns null when required eye landmarks are unavailable', () => {
    expect(createGlassesGeometry([], 1000, 500)).toBeNull()
  })
})

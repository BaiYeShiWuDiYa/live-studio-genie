import { describe, expect, it } from 'vitest'
import { dbToLinearGain } from './audioProcessor'

describe('audio processor', () => {
  it('converts decibel gain to linear gain', () => {
    expect(dbToLinearGain(0)).toBe(1)
    expect(dbToLinearGain(6)).toBeCloseTo(1.995, 3)
    expect(dbToLinearGain(-6)).toBeCloseTo(0.501, 3)
  })
})

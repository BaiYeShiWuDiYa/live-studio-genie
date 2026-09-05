import { describe, expect, it } from 'vitest'
import { dbToBackgroundMusicGain } from './backgroundMusic'

describe('background music', () => {
  it('scales the safe base output level with decibel gain', () => {
    expect(dbToBackgroundMusicGain(0)).toBe(0.08)
    expect(dbToBackgroundMusicGain(-6)).toBeCloseTo(0.04, 2)
    expect(dbToBackgroundMusicGain(20)).toBeCloseTo(0.8, 2)
  })
})

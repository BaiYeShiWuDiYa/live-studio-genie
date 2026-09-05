import { describe, expect, it } from 'vitest'
import { liveGoalConfigSchema } from './liveGoal'

describe('live goal', () => {
  it('accepts progress within the target', () => {
    expect(liveGoalConfigSchema.safeParse({
      label: '本轮冲刺目标',
      current: 8740,
      target: 10000,
      supporters: 38,
    }).success).toBe(true)
  })

  it('rejects progress beyond the target', () => {
    expect(liveGoalConfigSchema.safeParse({
      label: '本轮冲刺目标',
      current: 12000,
      target: 10000,
      supporters: 38,
    }).success).toBe(false)
  })
})

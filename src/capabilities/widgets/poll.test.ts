import { describe, expect, it } from 'vitest'
import { createPollVotes, pollConfigSchema } from './poll'

describe('audience poll', () => {
  it('creates deterministic demo votes for all options', () => {
    expect(createPollVotes(3)).toEqual([31, 19, 0])
  })

  it('validates duration and option counts', () => {
    expect(pollConfigSchema.safeParse({
      question: '下一首唱什么？',
      options: ['甜歌', '炸场'],
      durationSeconds: 45,
    }).success).toBe(true)

    expect(pollConfigSchema.safeParse({
      question: '下一首唱什么？',
      options: ['甜歌'],
      durationSeconds: 5,
    }).success).toBe(false)
  })
})

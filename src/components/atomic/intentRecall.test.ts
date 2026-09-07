import { describe, expect, it } from 'vitest'
import { recallAtomicComponents, type IntentFewShotExample } from './intentRecall'

describe('atomic component intent recall', () => {
  it('composes multiple components from a host input', () => {
    const result = recallAtomicComponents({
      source: 'input',
      text: '画面有点暗，背景也很乱，再加一个投票',
    })

    expect(result.componentIds).toContain('lighting')
    expect(result.componentIds).toContain('background')
    expect(result.componentIds).toContain('audience-poll')
  })

  it('recalls components from monitoring signals', () => {
    const result = recallAtomicComponents({
      source: 'monitor',
      signalIds: ['microphone', 'gifts'],
    })

    expect(result.componentIds).toEqual([
      'microphone',
      'live-goal',
      'gift-ranking',
    ])
  })

  it('supports external few-shot examples without changing recognition code', () => {
    const examples: IntentFewShotExample[] = [
      {
        input: '帮我接住刚才的高价值用户',
        componentIds: ['gift-ranking', 'audience-wishes'],
      },
    ]
    const result = recallAtomicComponents({
      source: 'input',
      text: '接住刚才的高价值用户',
    }, examples)

    expect(result.componentIds).toEqual(['gift-ranking', 'audience-wishes'])
    expect(result.matchedExamples).toHaveLength(1)
  })

  it('returns no component for an unrelated intent', () => {
    expect(recallAtomicComponents({
      source: 'comment',
      text: '主播晚上好',
    }).componentIds).toEqual([])
  })
})

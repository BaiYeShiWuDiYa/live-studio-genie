import { describe, expect, it } from 'vitest'
import { audienceStrategies } from '../../config/audienceComments'
import {
  recallAtomicComponents,
  scenarioIntentFewShots,
  type IntentFewShotExample,
} from './intentRecall'

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
    ])
  })

  it('keeps the requested component priority for all seven scenarios', () => {
    audienceStrategies.forEach((scenario) => {
      const result = recallAtomicComponents({
        source: 'monitor',
        text: scenario.recommendation,
        signalIds: [scenario.primarySignal],
        strategyId: scenario.id,
      })

      expect(result.componentIds).toEqual(scenario.componentPriority)
    })
  })

  it('does not let a secondary monitor signal override scenario components', () => {
    expect(recallAtomicComponents({
      source: 'monitor',
      signalIds: ['retention'],
      strategyId: 'entrant-drop',
    }).componentIds).toEqual([])
  })

  it('exports seven complete scenario few-shot training samples', () => {
    expect(scenarioIntentFewShots).toHaveLength(7)
    scenarioIntentFewShots.forEach((example) => {
      expect(example.sceneDescription).toBeTruthy()
      expect(example.input).toBeTruthy()
      expect(example.aliases?.length).toBeGreaterThanOrEqual(2)
      expect(example.standardResponse).toMatch(/检测到/)
      expect(example.componentIds.length).toBeGreaterThan(0)
    })
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

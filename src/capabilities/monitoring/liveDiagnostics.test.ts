import { describe, expect, it } from 'vitest'
import {
  mockAudienceEventAdapter,
  type AudienceSnapshot,
} from '../audience/audienceEvents'
import { idleMediaMetric, type MediaMetric } from './types'
import { buildLiveDiagnostics } from './liveDiagnostics'
import { audienceStrategies } from '../../config/audienceComments'

const metric = (score: number, value = `${score}`): MediaMetric => ({
  score,
  value,
  tone: score < 40 ? 'bad' : score < 65 ? 'warn' : 'good',
  status: 'ready',
  updatedAt: 1,
})

const audience = (patch: Partial<AudienceSnapshot> = {}): AudienceSnapshot => ({
  comments: [],
  gifts: [{
    id: 'gift-normal',
    type: 'gift',
    userName: 'Luna',
    giftName: 'Rose',
    count: 16,
    icon: '🌹',
    occurredAt: 1,
  }],
  viewerCount: 1200,
  entrantsLastMinute: 40,
  commentsPerMinute: 42,
  newViewerRetention: 52,
  insight: { category: 'positive', label: '正向反馈', count: 2 },
  ...patch,
})

const mediaMetrics = {
  brightness: metric(72, '72 / 100'),
  microphone: metric(58, '-18 dB'),
  framing: metric(78, '人脸 31% · 居中'),
}

describe('live diagnostics', () => {
  it('prioritizes a critical exposure problem and creates a matching visual widget', () => {
    const result = buildLiveDiagnostics({
      mediaMetrics: { ...mediaMetrics, brightness: metric(28, '28 / 100') },
      audience: audience({ insight: { category: 'visual', label: '画面反馈', count: 3 } }),
    })

    expect(result.primaryScene).toBe('quality')
    expect(result.suggestions[0].widget.type).toBe('visual-adjustment')
    expect(result.suggestions[0].action).toContain('补光')
    expect(result.improvements).toHaveLength(2)
    expect(result.goodSignals).toHaveLength(2)
  })

  it('recalls the interaction widget when new-viewer retention drops', () => {
    const result = buildLiveDiagnostics({
      mediaMetrics,
      audience: audience({
        commentsPerMinute: 14,
        entrantsLastMinute: 18,
        newViewerRetention: 19,
      }),
    })

    expect(result.primaryScene).toBe('interaction')
    expect(result.suggestions[0].widget.type).toBe('audience-poll')
    expect(result.suggestions[0].action).toContain('参与入口')
    expect(result.suggestions[0].signalId).toBe(result.improvements[0].id)
  })

  it('prioritizes audio feedback and moves on after the issue is resolved', () => {
    const noisyAudience = audience({
      insight: { category: 'audio', label: '声音反馈', count: 4 },
    })
    const before = buildLiveDiagnostics({
      mediaMetrics,
      audience: noisyAudience,
    })
    const after = buildLiveDiagnostics({
      mediaMetrics,
      audience: noisyAudience,
      resolvedScene: 'troubleshoot',
    })

    expect(before.primaryScene).toBe('troubleshoot')
    expect(before.suggestions[0].widget.type).toBe('audio-adjustment')
    expect(after.primaryScene).not.toBe('troubleshoot')
  })

  it('maps a comment-density decline to one actionable sentence', () => {
    const result = buildLiveDiagnostics({
      mediaMetrics,
      audience: audience({
        commentsPerMinute: 12,
        entrantsLastMinute: 35,
        newViewerRetention: 44,
      }),
    })
    const commentSuggestion = result.suggestions.find(
      (suggestion) => suggestion.signalId === 'comments',
    )

    expect(commentSuggestion?.action)
      .toContain('轻量互动')
  })

  it('always exposes two ranked metrics in each section and one sentence per decline', () => {
    const result = buildLiveDiagnostics({
      mediaMetrics,
      audience: audience({
        commentsPerMinute: 12,
        entrantsLastMinute: 18,
        newViewerRetention: 20,
      }),
    })

    expect(result.goodSignals).toHaveLength(2)
    expect(result.improvements).toHaveLength(2)
    expect(result.goodSignals[0].trend).toBeGreaterThanOrEqual(result.goodSignals[1].trend)
    expect(result.improvements[0].trend).toBeLessThanOrEqual(result.improvements[1].trend)
    expect(result.suggestions.map((suggestion) => suggestion.signalId))
      .toEqual(result.improvements.map((signal) => signal.id))
    expect(result.suggestions.every(
      (suggestion) => (suggestion.action.match(/[。！？]/g) ?? []).length === 1,
    )).toBe(true)
  })

  it('recalls a LIVE Goal when gift volume is the largest decline', () => {
    const result = buildLiveDiagnostics({
      mediaMetrics,
      audience: audience({ gifts: [] }),
    })

    expect(result.suggestions[0].signalId).toBe('gifts')
    expect(result.suggestions[0].widget.type).toBe('live-goal')
    expect(result.suggestions[0].action).toContain('阶段目标')
  })

  it('changes the recalled component as independent live signals change', () => {
    const disconnectedMedia = {
      brightness: idleMediaMetric,
      microphone: idleMediaMetric,
      framing: idleMediaMetric,
    }
    const scenes = ([
      'dim-light',
      'cold-comments',
      'low-audio',
    ] as const).map((strategy) => buildLiveDiagnostics({
      mediaMetrics: disconnectedMedia,
      audience: mockAudienceEventAdapter.getStrategySnapshot(
        strategy,
        false,
        20,
      ),
      strategy,
    }).primaryScene)

    expect(scenes).toEqual(['quality', 'interaction', 'troubleshoot'])
  })

  it('turns color cast and cluttered background into targeted diagnoses', () => {
    const colorResult = buildLiveDiagnostics({
      mediaMetrics,
      audience: mockAudienceEventAdapter.getStrategySnapshot(
        'color-cast',
        false,
        20,
      ),
      strategy: 'color-cast',
    })
    const backgroundResult = buildLiveDiagnostics({
      mediaMetrics,
      audience: mockAudienceEventAdapter.getStrategySnapshot(
        'cluttered-background',
        false,
        20,
      ),
      strategy: 'cluttered-background',
    })

    expect(colorResult.improvements[0].id).toBe('color-accuracy')
    expect(colorResult.suggestions[0].action).toContain('白平衡')
    expect(backgroundResult.improvements[0].id).toBe('background-cleanliness')
    expect(backgroundResult.suggestions[0].action).toContain('虚拟背景')
  })

  it('uses each scenario threshold to prioritize its primary suggestion', () => {
    audienceStrategies.forEach((scenario) => {
      const result = buildLiveDiagnostics({
        mediaMetrics,
        audience: mockAudienceEventAdapter.getStrategySnapshot(
          scenario.id,
          false,
          20,
        ),
        strategy: scenario.id,
      })

      expect(scenario.monitoring.simulatedValue)
        .toBeLessThan(scenario.monitoring.criticalBelow)
      expect(result.improvements[0].id).toBe(scenario.primarySignal)
      expect(result.suggestions[0].action).toBe(scenario.recommendation)
      expect(result.suggestions[0].severity).toBe(96)
    })
  })
})

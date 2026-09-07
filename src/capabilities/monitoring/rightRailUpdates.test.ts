import { describe, expect, it } from 'vitest'
import type { AudienceComment, CommentInsight } from '../audience/audienceEvents'
import {
  createCommentInsightSuggestion,
  rightRailUpdateConfig,
  selectThresholdChangedSuggestions,
} from './rightRailUpdates'
import type {
  LiveDiagnostics,
  LiveSignal,
  LiveSuggestion,
} from './liveDiagnostics'

const signal = (
  id: LiveSignal['id'],
  trend: number,
  tone: LiveSignal['tone'],
): LiveSignal => ({
  id,
  label: id,
  value: String(trend),
  score: 50,
  trend,
  trendLabel: `${trend}%`,
  tone,
  direction: trend >= 0 ? 'up' : 'down',
})

const suggestion = (
  signalId: LiveSuggestion['signalId'],
): LiveSuggestion => ({
  signalId,
  scene: 'quality',
  severity: 80,
  tone: 'bad',
  metric: signalId,
  action: `${signalId} action`,
  widget: {
    version: '1.0',
    type: 'visual-adjustment',
    title: `${signalId} widget`,
    detail: `${signalId} detail`,
    actionLabel: '应用',
    props: {
      settings: {
        brightness: 1,
        contrast: 1,
        warmth: 0,
      },
    },
  },
})

const diagnostics = (
  signals: LiveSignal[],
  suggestions: LiveSuggestion[],
): LiveDiagnostics => ({
  signals,
  suggestions,
  improvements: signals.slice(0, 2),
  goodSignals: signals.slice(-2),
  primaryScene: suggestions[0]?.scene ?? 'quality',
  healthyCount: signals.filter((item) => item.trend >= 0).length,
  issueCount: signals.filter((item) => item.trend < 0).length,
})

describe('right rail updates', () => {
  it('only reacts to metric changes that cross the configured threshold', () => {
    const previous = diagnostics(
      [signal('exposure', -5, 'warn'), signal('comments', -10, 'warn')],
      [suggestion('exposure'), suggestion('comments')],
    )
    const current = diagnostics(
      [signal('exposure', -14, 'bad'), signal('comments', -14, 'bad')],
      [suggestion('exposure'), suggestion('comments')],
    )

    expect(rightRailUpdateConfig.metricTrendDeltaThreshold).toBe(8)
    expect(
      selectThresholdChangedSuggestions(previous, current).map(
        (item) => item.signalId,
      ),
    ).toEqual(['exposure', 'comments'])
  })

  it('ignores stable and recovered metrics', () => {
    const previous = diagnostics(
      [signal('exposure', -16, 'bad'), signal('comments', -5, 'warn')],
      [suggestion('exposure'), suggestion('comments')],
    )
    const current = diagnostics(
      [signal('exposure', -18, 'bad'), signal('comments', 4, 'good')],
      [suggestion('exposure'), suggestion('comments')],
    )

    expect(selectThresholdChangedSuggestions(previous, current)).toEqual([])
  })

  it.each([
    ['audio', 'audio-adjustment'],
    ['visual', 'visual-adjustment'],
    ['network', 'visual-adjustment'],
    ['request', 'audience-poll'],
  ] as const)(
    'maps %s comment feedback to the matching component',
    (category, widgetType) => {
      const insight: CommentInsight = {
        category,
        label: `${category} feedback`,
        count: 3,
      }
      const comments: AudienceComment[] = [{
        id: 'comment-1',
        type: 'comment',
        userName: 'viewer',
        text: '想听下一首歌',
        occurredAt: 100,
      }]

      expect(
        createCommentInsightSuggestion(insight, comments)?.widget.type,
      ).toBe(widgetType)
    },
  )

  it('does not create suggestions for positive or empty feedback', () => {
    expect(createCommentInsightSuggestion(
      { category: 'positive', label: '正向反馈', count: 3 },
      [],
    )).toBeNull()
    expect(createCommentInsightSuggestion(
      { category: 'none', label: '暂无集中反馈', count: 0 },
      [],
    )).toBeNull()
  })
})

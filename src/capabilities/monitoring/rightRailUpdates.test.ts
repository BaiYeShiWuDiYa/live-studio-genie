import { describe, expect, it } from 'vitest'
import {
  analyzeAudienceComment,
  type AudienceComment,
  type AudienceSnapshot,
  type CommentInsight,
} from '../audience/audienceEvents'
import {
  advanceFixedRateDeadline,
  createAiAnalyzedSuggestion,
  createNormalAiAnalysisPrompt,
  createNormalModeDetectionSnapshot,
  createCommentInsightSuggestion,
  detectNormalModeUpdates,
  rightRailUpdateConfig,
  selectSuggestionsForStrategy,
  selectThresholdChangedSuggestions,
} from './rightRailUpdates'
import { audienceStrategies } from '../../config/audienceComments'
import { studioRuntimeConfig } from '../../config/studioRuntime'
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

const commentInsight = (
  category: CommentInsight['category'],
  label: string,
  count: number,
): CommentInsight => ({
  category,
  label,
  count,
  confidence: count > 0 ? 0.9 : 0,
  priority: category === 'positive' || category === 'none' ? 'low' : 'medium',
  shouldTrigger: !['positive', 'none'].includes(category) && count >= 2,
  latestCommentId: count > 0 ? 'comment-1' : null,
  sampleTexts: [],
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

  it('checks right-rail analysis at an exact 5-second interval', () => {
    expect(rightRailUpdateConfig.normalDetectionIntervalMs).toBe(5_000)
    expect(studioRuntimeConfig.monitoringDisplay.refreshIntervalMs).toBe(10_000)
  })

  it('keeps analysis deadlines aligned after a slow run', () => {
    expect(advanceFixedRateDeadline(5_000, 6_200, 5_000)).toBe(10_000)
    expect(advanceFixedRateDeadline(5_000, 16_200, 5_000)).toBe(20_000)
  })

  it('detects monitoring, comment, and visual changes independently', () => {
    const baseDiagnostics = diagnostics(
      [signal('exposure', -5, 'warn')],
      [suggestion('exposure')],
    )
    const mediaMetrics = {
      brightness: {
        score: 60,
        value: '60 / 100',
        tone: 'good' as const,
        status: 'ready' as const,
        updatedAt: 100,
      },
      microphone: {
        score: 50,
        value: '-30 dB',
        tone: 'good' as const,
        status: 'ready' as const,
        updatedAt: 100,
      },
      framing: {
        score: 70,
        value: '人脸 34% · 居中',
        tone: 'good' as const,
        status: 'ready' as const,
        updatedAt: 100,
      },
    }
    const previous = createNormalModeDetectionSnapshot(
      baseDiagnostics,
      [{ id: 'comment-1' }],
      mediaMetrics,
    )
    const current = createNormalModeDetectionSnapshot(
      baseDiagnostics,
      [{ id: 'comment-1' }, { id: 'comment-2' }],
      {
        ...mediaMetrics,
        brightness: {
          ...mediaMetrics.brightness,
          score: 42,
          value: '42 / 100',
          updatedAt: 200,
        },
      },
    )

    expect(detectNormalModeUpdates(previous, current)).toEqual({
      monitoring: true,
      comments: true,
      visual: true,
      hasUpdates: true,
    })
    expect(detectNormalModeUpdates(previous, previous).hasUpdates).toBe(false)
  })

  it('builds normal-mode AI context from metrics, comments, and updates', () => {
    const currentDiagnostics = diagnostics(
      [signal('exposure', -18, 'bad')],
      [suggestion('exposure')],
    )
    const audience: AudienceSnapshot = {
      comments: [{
        id: 'comment-1',
        type: 'comment',
        userName: 'viewer',
        text: '画面有点暗',
        source: 'viewer',
        analysis: analyzeAudienceComment('画面有点暗'),
        occurredAt: 100,
      }],
      gifts: [],
      viewerCount: 120,
      entrantsLastMinute: 24,
      commentsPerMinute: 18,
      newViewerRetention: 42,
      insight: {
        ...commentInsight('visual', '画面反馈', 1),
        shouldTrigger: true,
      },
    }
    const prompt = createNormalAiAnalysisPrompt(
      currentDiagnostics,
      audience,
      {
        monitoring: true,
        comments: true,
        visual: true,
        hasUpdates: true,
      },
      currentDiagnostics.suggestions,
    )

    expect(prompt).toContain('监控指标、评论区、直播画面')
    expect(prompt).toContain('画面有点暗')
    expect(prompt).toContain('NO_ACTION')
  })

  it('uses AI copy and widget while allowing NO_ACTION', () => {
    const base = suggestion('exposure')
    const aiWidget = suggestion('comments').widget

    expect(createAiAnalyzedSuggestion(
      base,
      '画面与评论共同显示主体偏暗，建议小幅补光。',
      aiWidget,
    )).toMatchObject({
      action: '画面与评论共同显示主体偏暗，建议小幅补光。',
      widget: aiWidget,
      analysisSource: 'ai',
    })
    expect(createAiAnalyzedSuggestion(base, 'NO_ACTION')).toBeNull()
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

  it('keeps only the primary suggestion for each typical scenario', () => {
    const unrelated = suggestion('microphone')

    audienceStrategies.forEach((strategy) => {
      const primary = suggestion(strategy.primarySignal)
      expect(selectSuggestionsForStrategy(
        [unrelated, primary, suggestion('retention')],
        strategy.id,
      )).toEqual([primary])
    })
  })

  it('keeps multi-signal suggestions in normal live mode', () => {
    const suggestions = [suggestion('exposure'), suggestion('microphone')]
    expect(selectSuggestionsForStrategy(suggestions, 'normal'))
      .toEqual(suggestions)
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
        ...commentInsight(category, `${category} feedback`, 3),
      }
      const comments: AudienceComment[] = [{
        id: 'comment-1',
        type: 'comment',
        userName: 'viewer',
        text: '想听下一首歌',
        source: 'viewer',
        analysis: analyzeAudienceComment('想听下一首歌'),
        occurredAt: 100,
      }]

      expect(
        createCommentInsightSuggestion(insight, comments)?.widget.type,
      ).toBe(widgetType)
    },
  )

  it('does not create suggestions for positive or empty feedback', () => {
    expect(createCommentInsightSuggestion(
      commentInsight('positive', '正向反馈', 3),
      [],
    )).toBeNull()
    expect(createCommentInsightSuggestion(
      commentInsight('none', '暂无集中反馈', 0),
      [],
    )).toBeNull()
  })
})

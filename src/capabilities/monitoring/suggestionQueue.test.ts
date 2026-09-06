import { describe, expect, it } from 'vitest'
import { studioRuntimeConfig } from '../../config/studioRuntime'
import type { LiveSuggestion } from './liveDiagnostics'
import {
  appendNewSuggestions,
  markSuggestionSeen,
  removeSuggestionWidget,
} from './suggestionQueue'

const suggestion = (
  signalId: LiveSuggestion['signalId'],
  tone: LiveSuggestion['tone'] = 'bad',
): LiveSuggestion => ({
  signalId,
  scene: signalId === 'microphone' ? 'troubleshoot' : 'interaction',
  severity: 80,
  tone,
  action: `${signalId} action.`,
  metric: `${signalId} -20%`,
  widget: {
    version: '1.0',
    type: 'audience-poll',
    title: `${signalId} widget`,
    detail: `${signalId} detail`,
    actionLabel: '应用',
    props: {
      question: '下一步做什么？',
      options: ['A', 'B'],
      durationSeconds: 45,
    },
  },
})

describe('suggestion queue', () => {
  it('uses an exact one-minute synchronization interval', () => {
    expect(studioRuntimeConfig.suggestion.syncIntervalMs).toBe(60_000)
  })

  it('only appends unseen declining suggestions and preserves history', () => {
    const first = appendNewSuggestions(
      [],
      [suggestion('comments'), suggestion('fps', 'good')],
      new Set(),
      100,
    )
    const second = appendNewSuggestions(
      first,
      [suggestion('comments'), suggestion('retention')],
      new Set(),
      200,
    )

    expect(first.map((item) => item.signalId)).toEqual(['comments'])
    expect(second.map((item) => item.signalId)).toEqual(['comments', 'retention'])
    expect(second[0]).toBe(first[0])
    expect(second[1].isNew).toBe(true)
  })

  it('does not re-add a dismissed issue until the caller clears its suppression', () => {
    const result = appendNewSuggestions(
      [],
      [suggestion('gifts')],
      new Set<LiveSuggestion['signalId']>(['gifts']),
      100,
    )

    expect(result).toEqual([])
  })

  it('marks a selected suggestion as seen without changing other items', () => {
    const queue = appendNewSuggestions(
      [],
      [suggestion('comments'), suggestion('retention')],
      new Set(),
      100,
    )
    const result = markSuggestionSeen(queue, queue[0].queueId)

    expect(result.map((item) => item.isNew)).toEqual([false, true])
  })

  it('removes only the applied widget and keeps its suggestion history', () => {
    const queue = appendNewSuggestions(
      [],
      [suggestion('comments'), suggestion('retention')],
      new Set(),
      100,
    )
    queue[0].widgets.push({
      ...queue[0].widgets[0],
      title: 'comments secondary widget',
    })

    const result = removeSuggestionWidget(queue, queue[0].queueId, 0)

    expect(result).toHaveLength(2)
    expect(result[0].signalId).toBe('comments')
    expect(result[0].isNew).toBe(false)
    expect(result[0].widgets.map((widget) => widget.title)).toEqual([
      'comments secondary widget',
    ])
    expect(result[1]).toBe(queue[1])
  })

  it('can append a recurring issue after its historical card was applied', () => {
    const queue = appendNewSuggestions([], [suggestion('comments')], new Set(), 100)
    const history = removeSuggestionWidget(queue, queue[0].queueId, 0)
    const suppressed = appendNewSuggestions(
      history,
      [suggestion('comments')],
      new Set<LiveSuggestion['signalId']>(['comments']),
      200,
    )
    const recurring = appendNewSuggestions(
      history,
      [suggestion('comments')],
      new Set(),
      300,
    )

    expect(suppressed).toBe(history)
    expect(recurring).toHaveLength(2)
    expect(recurring[0].widgets).toEqual([])
    expect(recurring[1].widgets).toHaveLength(1)
  })
})

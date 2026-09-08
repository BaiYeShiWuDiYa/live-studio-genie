import type { WidgetSpec } from '../../agent/widgets/widgetSpec'
import type { LiveSuggestion } from './liveDiagnostics'

export interface QueuedSuggestion extends LiveSuggestion {
  queueId: string
  addedAt: number
  isNew: boolean
  source: 'monitor' | 'comment'
  triggerKey: string
  widgets: WidgetSpec[]
}

export function getWidgetUiType(type: WidgetSpec['type']): string {
  if (type === 'audience-poll') return 'audience-poll'
  if (type === 'live-goal') return 'live-goal'
  if (type === 'audio-adjustment') return 'microphone'
  return `widget:${type}`
}

export function keepLatestUniqueBy<T>(
  items: readonly T[],
  getKey: (item: T) => string,
): T[] {
  const seen = new Set<string>()
  return [...items].reverse().filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).reverse()
}

export function appendNewSuggestions(
  queue: QueuedSuggestion[],
  incoming: LiveSuggestion[],
  dismissedSignalIds: ReadonlySet<LiveSuggestion['signalId']>,
  addedAt = Date.now(),
): QueuedSuggestion[] {
  const queuedSignalIds = new Set(
    queue
      .filter((suggestion) =>
        suggestion.source === 'monitor' &&
        suggestion.widgets.length > 0,
      )
      .map((suggestion) => suggestion.signalId),
  )
  const queuedWidgetTypes = new Set(
    queue.flatMap((suggestion) =>
      suggestion.widgets.map((widget) => getWidgetUiType(widget.type)),
    ),
  )
  const additions: QueuedSuggestion[] = []
  incoming.forEach((suggestion, index) => {
    const widgetType = getWidgetUiType(suggestion.widget.type)
    if (
      suggestion.tone === 'good' ||
      queuedSignalIds.has(suggestion.signalId) ||
      queuedWidgetTypes.has(widgetType) ||
      dismissedSignalIds.has(suggestion.signalId)
    ) {
      return
    }
    additions.push({
      ...suggestion,
      queueId: `${suggestion.signalId}-${addedAt}-${index}`,
      addedAt,
      isNew: true,
      source: 'monitor' as const,
      triggerKey: `monitor:${suggestion.signalId}`,
      widgets: [suggestion.widget],
    })
    queuedSignalIds.add(suggestion.signalId)
    queuedWidgetTypes.add(widgetType)
  })

  return additions.length > 0 ? [...queue, ...additions] : queue
}

export function appendTriggeredSuggestion(
  queue: QueuedSuggestion[],
  incoming: LiveSuggestion,
  source: QueuedSuggestion['source'],
  triggerKey: string,
  addedAt = Date.now(),
): QueuedSuggestion[] {
  const alreadyQueued = queue.some((suggestion) =>
    suggestion.source === source &&
    suggestion.triggerKey === triggerKey &&
    suggestion.widgets.length > 0,
  )
  if (incoming.tone === 'good' || alreadyQueued) return queue

  const queuedSuggestion: QueuedSuggestion = {
    ...incoming,
    queueId: `${source}-${triggerKey}-${addedAt}`,
    addedAt,
    isNew: true,
    source,
    triggerKey,
    widgets: [incoming.widget],
  }
  const widgetType = getWidgetUiType(incoming.widget.type)
  const duplicateIndex = queue.findIndex((suggestion) =>
    suggestion.widgets.some(
      (widget) => getWidgetUiType(widget.type) === widgetType,
    ),
  )
  if (duplicateIndex < 0) return [...queue, queuedSuggestion]

  return [
    ...queue.filter((_, index) => index !== duplicateIndex),
    queuedSuggestion,
  ]
}

export function markSuggestionSeen(
  queue: QueuedSuggestion[],
  queueId: string,
): QueuedSuggestion[] {
  return queue.map((suggestion) =>
    suggestion.queueId === queueId && suggestion.isNew
      ? { ...suggestion, isNew: false }
      : suggestion,
  )
}

export function removeSuggestionWidget(
  queue: QueuedSuggestion[],
  queueId: string,
  widgetIndex: number,
): QueuedSuggestion[] {
  return queue.map((suggestion) => {
    if (suggestion.queueId !== queueId) return suggestion

    return {
      ...suggestion,
      isNew: false,
      widgets: suggestion.widgets.filter((_, index) => index !== widgetIndex),
    }
  })
}

import type { WidgetSpec } from '../../agent/widgets/widgetSpec'
import type { LiveSuggestion } from './liveDiagnostics'

export interface QueuedSuggestion extends LiveSuggestion {
  queueId: string
  addedAt: number
  isNew: boolean
  widgets: WidgetSpec[]
}

export function appendNewSuggestions(
  queue: QueuedSuggestion[],
  incoming: LiveSuggestion[],
  dismissedSignalIds: ReadonlySet<LiveSuggestion['signalId']>,
  addedAt = Date.now(),
): QueuedSuggestion[] {
  const queuedSignalIds = new Set(
    queue
      .filter((suggestion) => suggestion.widgets.length > 0)
      .map((suggestion) => suggestion.signalId),
  )
  const additions = incoming
    .filter((suggestion) =>
      suggestion.tone !== 'good' &&
      !queuedSignalIds.has(suggestion.signalId) &&
      !dismissedSignalIds.has(suggestion.signalId),
    )
    .map((suggestion, index) => ({
      ...suggestion,
      queueId: `${suggestion.signalId}-${addedAt}-${index}`,
      addedAt,
      isNew: true,
      widgets: [suggestion.widget],
    }))

  return additions.length > 0 ? [...queue, ...additions] : queue
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

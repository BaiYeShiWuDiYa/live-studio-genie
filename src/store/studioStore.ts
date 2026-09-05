import { create } from 'zustand'
import {
  idleMediaMetric,
  mediaMetricSchema,
  type MediaMetric,
  type MediaMetricKind,
} from '../capabilities/monitoring/types'

interface StudioState {
  mediaMetrics: Record<MediaMetricKind, MediaMetric>
  updateMediaMetric: (kind: MediaMetricKind, metric: MediaMetric) => void
  resetMediaMetric: (kind: MediaMetricKind) => void
}

export const useStudioStore = create<StudioState>((set) => ({
  mediaMetrics: {
    brightness: idleMediaMetric,
    microphone: idleMediaMetric,
  },
  updateMediaMetric: (kind, metric) => {
    const validatedMetric = mediaMetricSchema.parse(metric)
    set((state) => ({
      mediaMetrics: {
        ...state.mediaMetrics,
        [kind]: validatedMetric,
      },
    }))
  },
  resetMediaMetric: (kind) => {
    set((state) => ({
      mediaMetrics: {
        ...state.mediaMetrics,
        [kind]: idleMediaMetric,
      },
    }))
  },
}))

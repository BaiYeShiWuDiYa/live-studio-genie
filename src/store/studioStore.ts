import { create } from 'zustand'
import {
  cameraLayerLayoutSchema,
  defaultCameraLayerLayout,
  type CameraLayerLayout,
} from '../capabilities/layout/types'
import {
  idleMediaMetric,
  mediaMetricSchema,
  type MediaMetric,
  type MediaMetricKind,
} from '../capabilities/monitoring/types'

interface StudioState {
  cameraLayerLayout: CameraLayerLayout
  mediaMetrics: Record<MediaMetricKind, MediaMetric>
  setCameraLayerLayout: (layout: CameraLayerLayout) => void
  resetCameraLayerLayout: () => void
  updateMediaMetric: (kind: MediaMetricKind, metric: MediaMetric) => void
  resetMediaMetric: (kind: MediaMetricKind) => void
}

export const useStudioStore = create<StudioState>((set) => ({
  cameraLayerLayout: defaultCameraLayerLayout,
  mediaMetrics: {
    brightness: idleMediaMetric,
    microphone: idleMediaMetric,
  },
  setCameraLayerLayout: (layout) => {
    set({ cameraLayerLayout: cameraLayerLayoutSchema.parse(layout) })
  },
  resetCameraLayerLayout: () => {
    set({ cameraLayerLayout: defaultCameraLayerLayout })
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

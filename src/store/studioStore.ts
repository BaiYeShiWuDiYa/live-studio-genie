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
import {
  defaultVisualSettings,
  visualSettingsSchema,
  type VisualSettings,
} from '../capabilities/visual/types'

interface StudioState {
  cameraLayerLayout: CameraLayerLayout
  visualSettings: VisualSettings
  committedVisualSettings: VisualSettings
  previousVisualSettings: VisualSettings | null
  mediaMetrics: Record<MediaMetricKind, MediaMetric>
  setCameraLayerLayout: (layout: CameraLayerLayout) => void
  resetCameraLayerLayout: () => void
  previewVisualSettings: (settings: VisualSettings) => void
  applyVisualSettings: (settings: VisualSettings) => void
  resetVisualPreview: () => void
  undoVisualSettings: () => void
  updateMediaMetric: (kind: MediaMetricKind, metric: MediaMetric) => void
  resetMediaMetric: (kind: MediaMetricKind) => void
}

export const useStudioStore = create<StudioState>((set) => ({
  cameraLayerLayout: defaultCameraLayerLayout,
  visualSettings: defaultVisualSettings,
  committedVisualSettings: defaultVisualSettings,
  previousVisualSettings: null,
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
  previewVisualSettings: (settings) => {
    set({ visualSettings: visualSettingsSchema.parse(settings) })
  },
  applyVisualSettings: (settings) => {
    const validatedSettings = visualSettingsSchema.parse(settings)
    set((state) => ({
      visualSettings: validatedSettings,
      previousVisualSettings: state.committedVisualSettings,
      committedVisualSettings: validatedSettings,
    }))
  },
  resetVisualPreview: () => {
    set((state) => ({ visualSettings: state.committedVisualSettings }))
  },
  undoVisualSettings: () => {
    set((state) => {
      const restoredSettings = state.previousVisualSettings ?? defaultVisualSettings
      return {
        visualSettings: restoredSettings,
        committedVisualSettings: restoredSettings,
        previousVisualSettings: null,
      }
    })
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

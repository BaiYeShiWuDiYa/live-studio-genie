import { create } from 'zustand'
import {
  audioSettingsSchema,
  defaultAudioSettings,
  type AudioSettings,
} from '../capabilities/audio/types'
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
import {
  hiddenLiveGoalState,
  liveGoalConfigSchema,
  type LiveGoalConfig,
  type LiveGoalState,
} from '../capabilities/widgets/liveGoal'
import {
  createPollVotes,
  hiddenPollState,
  pollConfigSchema,
  type PollConfig,
  type PollState,
} from '../capabilities/widgets/poll'

interface StudioState {
  audioSettings: AudioSettings
  committedAudioSettings: AudioSettings
  previousAudioSettings: AudioSettings | null
  cameraLayerLayout: CameraLayerLayout
  visualSettings: VisualSettings
  committedVisualSettings: VisualSettings
  previousVisualSettings: VisualSettings | null
  pollState: PollState
  committedPollState: PollState
  previousPollState: PollState | null
  liveGoalState: LiveGoalState
  committedLiveGoalState: LiveGoalState
  previousLiveGoalState: LiveGoalState | null
  mediaMetrics: Record<MediaMetricKind, MediaMetric>
  previewAudioSettings: (settings: AudioSettings) => void
  applyAudioSettings: (settings: AudioSettings) => void
  resetAudioPreview: () => void
  undoAudioSettings: () => void
  setCameraLayerLayout: (layout: CameraLayerLayout) => void
  resetCameraLayerLayout: () => void
  previewVisualSettings: (settings: VisualSettings) => void
  applyVisualSettings: (settings: VisualSettings) => void
  resetVisualPreview: () => void
  undoVisualSettings: () => void
  previewPoll: (config: PollConfig) => void
  publishPoll: (config: PollConfig) => void
  resetPollPreview: () => void
  undoPoll: () => void
  hidePoll: () => void
  votePoll: (optionIndex: number) => void
  previewLiveGoal: (config: LiveGoalConfig) => void
  publishLiveGoal: (config: LiveGoalConfig) => void
  resetLiveGoalPreview: () => void
  undoLiveGoal: () => void
  advanceLiveGoal: (amount: number) => void
  updateMediaMetric: (kind: MediaMetricKind, metric: MediaMetric) => void
  resetMediaMetric: (kind: MediaMetricKind) => void
}

export const useStudioStore = create<StudioState>((set) => ({
  audioSettings: defaultAudioSettings,
  committedAudioSettings: defaultAudioSettings,
  previousAudioSettings: null,
  cameraLayerLayout: defaultCameraLayerLayout,
  visualSettings: defaultVisualSettings,
  committedVisualSettings: defaultVisualSettings,
  previousVisualSettings: null,
  pollState: hiddenPollState,
  committedPollState: hiddenPollState,
  previousPollState: null,
  liveGoalState: hiddenLiveGoalState,
  committedLiveGoalState: hiddenLiveGoalState,
  previousLiveGoalState: null,
  mediaMetrics: {
    brightness: idleMediaMetric,
    microphone: idleMediaMetric,
  },
  previewAudioSettings: (settings) => {
    set({ audioSettings: audioSettingsSchema.parse(settings) })
  },
  applyAudioSettings: (settings) => {
    const validatedSettings = audioSettingsSchema.parse(settings)
    set((state) => ({
      audioSettings: validatedSettings,
      previousAudioSettings: state.committedAudioSettings,
      committedAudioSettings: validatedSettings,
    }))
  },
  resetAudioPreview: () => {
    set((state) => ({ audioSettings: state.committedAudioSettings }))
  },
  undoAudioSettings: () => {
    set((state) => {
      const restoredSettings = state.previousAudioSettings ?? defaultAudioSettings
      return {
        audioSettings: restoredSettings,
        committedAudioSettings: restoredSettings,
        previousAudioSettings: null,
      }
    })
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
  previewPoll: (config) => {
    const validatedConfig = pollConfigSchema.parse(config)
    set({
      pollState: {
        config: validatedConfig,
        status: 'preview',
        startedAt: null,
        votes: createPollVotes(validatedConfig.options.length),
      },
    })
  },
  publishPoll: (config) => {
    const validatedConfig = pollConfigSchema.parse(config)
    set((state) => {
      const activePoll: PollState = {
        config: validatedConfig,
        status: 'active',
        startedAt: Date.now(),
        votes: createPollVotes(validatedConfig.options.length),
      }
      return {
        pollState: activePoll,
        committedPollState: activePoll,
        previousPollState: state.committedPollState,
      }
    })
  },
  resetPollPreview: () => {
    set((state) => ({ pollState: state.committedPollState }))
  },
  undoPoll: () => {
    set((state) => {
      const restoredPoll = state.previousPollState ?? hiddenPollState
      return {
        pollState: restoredPoll,
        committedPollState: restoredPoll,
        previousPollState: null,
      }
    })
  },
  hidePoll: () => {
    set({
      pollState: hiddenPollState,
      committedPollState: hiddenPollState,
      previousPollState: null,
    })
  },
  votePoll: (optionIndex) => {
    set((state) => {
      if (state.pollState.status !== 'active' || state.pollState.votes[optionIndex] === undefined) return state
      const votes = [...state.pollState.votes]
      votes[optionIndex] += 1
      const pollState = { ...state.pollState, votes }
      return { pollState, committedPollState: pollState }
    })
  },
  previewLiveGoal: (config) => {
    set({
      liveGoalState: {
        config: liveGoalConfigSchema.parse(config),
        status: 'preview',
      },
    })
  },
  publishLiveGoal: (config) => {
    const validatedConfig = liveGoalConfigSchema.parse(config)
    set((state) => {
      const activeGoal: LiveGoalState = {
        config: validatedConfig,
        status: 'active',
      }
      return {
        liveGoalState: activeGoal,
        committedLiveGoalState: activeGoal,
        previousLiveGoalState: state.committedLiveGoalState,
      }
    })
  },
  resetLiveGoalPreview: () => {
    set((state) => ({ liveGoalState: state.committedLiveGoalState }))
  },
  undoLiveGoal: () => {
    set((state) => {
      const restoredGoal = state.previousLiveGoalState ?? hiddenLiveGoalState
      return {
        liveGoalState: restoredGoal,
        committedLiveGoalState: restoredGoal,
        previousLiveGoalState: null,
      }
    })
  },
  advanceLiveGoal: (amount) => {
    set((state) => {
      if (state.liveGoalState.status !== 'active' || !state.liveGoalState.config) return state
      const config = {
        ...state.liveGoalState.config,
        current: Math.min(
          state.liveGoalState.config.target,
          state.liveGoalState.config.current + Math.max(0, Math.round(amount)),
        ),
        supporters: state.liveGoalState.config.supporters + 1,
      }
      const liveGoalState: LiveGoalState = { config, status: 'active' }
      return { liveGoalState, committedLiveGoalState: liveGoalState }
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

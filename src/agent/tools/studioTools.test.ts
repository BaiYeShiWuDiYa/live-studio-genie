import { describe, expect, it, vi } from 'vitest'
import type { VisualSettings } from '../../capabilities/visual/types'
import { studioToolRegistry, type StudioToolContext } from './studioTools'

function createContext(): StudioToolContext {
  return {
    previewAudioSettings: vi.fn(),
    applyAudioSettings: vi.fn(),
    resetAudioPreview: vi.fn(),
    undoAudioSettings: vi.fn(),
    previewPoll: vi.fn(),
    publishPoll: vi.fn(),
    resetPollPreview: vi.fn(),
    undoPoll: vi.fn(),
    previewLiveGoal: vi.fn(),
    publishLiveGoal: vi.fn(),
    resetLiveGoalPreview: vi.fn(),
    undoLiveGoal: vi.fn(),
    previewVisualSettings: vi.fn(),
    applyVisualSettings: vi.fn(),
    resetVisualPreview: vi.fn(),
    undoVisualSettings: vi.fn(),
    previewCameraEffects: vi.fn(),
    applyCameraEffects: vi.fn(),
    resetCameraEffectsPreview: vi.fn(),
    undoCameraEffects: vi.fn(),
  }
}

const settings: VisualSettings = {
  brightness: 1.3,
  contrast: 1.08,
  warmth: 0.18,
}

describe('studio tool registry', () => {
  it('validates and previews visual settings', () => {
    const context = createContext()
    const result = studioToolRegistry.execute('studio.adjust_visual', {
      mode: 'preview',
      settings,
    }, context)

    expect(context.previewVisualSettings).toHaveBeenCalledWith(settings)
    expect(result.name).toBe('正在预览柔光氛围')
  })

  it('rejects visual settings outside the supported range', () => {
    expect(() => studioToolRegistry.execute('studio.adjust_visual', {
      mode: 'apply',
      settings: { ...settings, brightness: 2 },
    }, createContext())).toThrow()
  })

  it('rejects tools outside the registry', () => {
    expect(() => studioToolRegistry.execute('studio.unknown', {}, createContext()))
      .toThrow('Unknown tool')
  })

  it('validates and applies audio gain settings', () => {
    const context = createContext()
    studioToolRegistry.execute('studio.adjust_audio', {
      mode: 'apply',
      settings: { microphoneGainDb: 8, backgroundMusicGainDb: -5 },
    }, context)

    expect(context.applyAudioSettings).toHaveBeenCalledWith({
      microphoneGainDb: 8,
      backgroundMusicGainDb: -5,
    })
  })

  it('previews validated camera effects', () => {
    const context = createContext()
    const cameraEffects = {
      smoothness: 24,
      slimFace: 16,
      bigEyes: 18,
      exposure: 8,
      warmth: 12,
      contrast: 6,
      saturation: 8,
      whitening: 18,
      rosiness: 10,
      clarity: 12,
      backgroundMode: 'blur' as const,
      backgroundBlur: 55,
      backgroundColor: '#163d38',
      backgroundImageUrl: null,
      backgroundPreset: null,
      faceEffect: 'butterfly-sticker' as const,
      lipstickIntensity: 32,
      lipstickColor: '#c2476e',
      blushIntensity: 20,
      blushColor: '#e8889a',
      eyeshadowIntensity: 14,
      eyeshadowColor: '#8d63b8',
      eyelinerIntensity: 18,
      highlightIntensity: 20,
    }
    const result = studioToolRegistry.execute('studio.adjust_camera_effects', {
      mode: 'preview',
      settings: cameraEffects,
    }, context)

    expect(context.previewCameraEffects).toHaveBeenCalledWith(cameraEffects)
    expect(result.detail).toContain('5 项美妆')
  })

  it('publishes a validated audience poll', () => {
    const context = createContext()
    const config = {
      question: '下一首唱什么？',
      options: ['甜歌', '炸场'],
      durationSeconds: 45,
    }
    studioToolRegistry.execute('studio.configure_poll', {
      mode: 'apply',
      config,
    }, context)

    expect(context.publishPoll).toHaveBeenCalledWith(config)
  })

  it('publishes a validated live goal', () => {
    const context = createContext()
    const config = {
      label: '本轮冲刺目标',
      current: 8740,
      target: 10000,
      supporters: 38,
    }
    studioToolRegistry.execute('studio.configure_live_goal', {
      mode: 'apply',
      config,
    }, context)

    expect(context.publishLiveGoal).toHaveBeenCalledWith(config)
  })
})

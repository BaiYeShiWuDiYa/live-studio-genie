import { describe, expect, it, vi } from 'vitest'
import type { VisualSettings } from '../../capabilities/visual/types'
import { studioToolRegistry, type StudioToolContext } from './studioTools'

function createContext(): StudioToolContext {
  return {
    previewAudioSettings: vi.fn(),
    applyAudioSettings: vi.fn(),
    resetAudioPreview: vi.fn(),
    undoAudioSettings: vi.fn(),
    previewVisualSettings: vi.fn(),
    applyVisualSettings: vi.fn(),
    resetVisualPreview: vi.fn(),
    undoVisualSettings: vi.fn(),
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
})

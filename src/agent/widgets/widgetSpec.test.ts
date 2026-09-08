import { describe, expect, it } from 'vitest'
import {
  getAlternativeWidgetSpec,
  getCameraEffectsWidgetSpec,
  getSceneWidgetSpec,
} from './sceneWidgets'
import { widgetSpecSchema } from './widgetSpec'

describe('widget specs', () => {
  it('provides a validated widget for every studio scene', () => {
    const types = ['quality', 'interaction', 'troubleshoot', 'pk']
      .map((scene) => getSceneWidgetSpec(scene as Parameters<typeof getSceneWidgetSpec>[0]).type)

    expect(types).toEqual([
      'visual-adjustment',
      'audience-poll',
      'audio-adjustment',
      'live-goal',
    ])
  })

  it('rejects component types outside the allowlist', () => {
    const result = widgetSpecSchema.safeParse({
      version: '1.0',
      type: 'raw-html',
      title: 'Unsafe',
      detail: 'Unsafe',
      actionLabel: 'Run',
      props: { html: '<script />' },
    })

    expect(result.success).toBe(false)
  })

  it('provides a validated camera effects widget', () => {
    const spec = getCameraEffectsWidgetSpec()
    expect(spec.type).toBe('camera-effects')
    expect(widgetSpecSchema.safeParse(spec).success).toBe(true)
  })

  it('rejects malformed widget properties', () => {
    const result = widgetSpecSchema.safeParse({
      ...getSceneWidgetSpec('interaction'),
      props: { question: '', options: ['one'], durationSeconds: 2 },
    })

    expect(result.success).toBe(false)
  })

  it('cycles every widget type to a different valid suggestion', () => {
    const specs = [
      getCameraEffectsWidgetSpec(),
      getSceneWidgetSpec('quality'),
      getSceneWidgetSpec('interaction'),
      getSceneWidgetSpec('troubleshoot'),
      getSceneWidgetSpec('pk'),
    ]

    specs.forEach((spec) => {
      const alternative = getAlternativeWidgetSpec(spec)
      expect(widgetSpecSchema.safeParse(alternative).success).toBe(true)
      expect(alternative).not.toEqual(spec)
    })
  })

  it('continues cycling poll suggestions instead of repeating one card', () => {
    const first = getSceneWidgetSpec('interaction')
    const second = getAlternativeWidgetSpec(first)
    const third = getAlternativeWidgetSpec(second)

    expect(second.type).toBe('audience-poll')
    expect(third.type).toBe('audience-poll')
    if (
      first.type === 'audience-poll' &&
      second.type === 'audience-poll' &&
      third.type === 'audience-poll'
    ) {
      expect(new Set([
        first.props.question,
        second.props.question,
        third.props.question,
      ]).size).toBe(3)
    }
  })
})

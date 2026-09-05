import { describe, expect, it } from 'vitest'
import { getSceneWidgetSpec } from './sceneWidgets'
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

  it('rejects malformed widget properties', () => {
    const result = widgetSpecSchema.safeParse({
      ...getSceneWidgetSpec('interaction'),
      props: { question: '', options: ['one'], durationSeconds: 2 },
    })

    expect(result.success).toBe(false)
  })
})

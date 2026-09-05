import { describe, expect, it } from 'vitest'
import { parseGenieContent } from './genie'

describe('parseGenieContent', () => {
  it('extracts a validated widget from assistant text', () => {
    const result = parseGenieContent(`建议先提高补光。
<widget>
{"version":"1.0","type":"visual-adjustment","title":"调整画面","detail":"提高主体亮度","actionLabel":"预览调整","props":{"settings":{"brightness":1.2,"contrast":1.05,"warmth":0.1}}}
</widget>`)

    expect(result.text).toBe('建议先提高补光。')
    expect(result.widget?.type).toBe('visual-adjustment')
  })

  it('drops invalid widgets without losing the assistant response', () => {
    const result = parseGenieContent('保持节奏。<widget>{"type":"raw-html"}</widget>')

    expect(result.text).toBe('保持节奏。')
    expect(result.widget).toBeUndefined()
  })

  it('supports plain text responses', () => {
    expect(parseGenieContent('当前状态稳定。')).toEqual({ text: '当前状态稳定。' })
  })
})

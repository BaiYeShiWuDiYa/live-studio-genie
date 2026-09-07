import { useState } from 'react'
import { Check, Save } from 'lucide-react'
import { applyCameraEffectPreset } from '../../../capabilities/video/cameraEffects'
import { useStudioStore } from '../../../store/studioStore'
import type { AtomicPanelProps } from '../types'

const templates = [
  { id: 'clean', name: '清爽聊天', color: '#5fd5bd', visual: { brightness: 1.12, contrast: 1.04, warmth: 0.08 }, effect: 'natural' },
  { id: 'music', name: '夜间音乐', color: '#d885a6', visual: { brightness: 1.08, contrast: 1.12, warmth: 0.18 }, effect: 'stage' },
  { id: 'game', name: '游戏竞技', color: '#7a9de8', visual: { brightness: 1, contrast: 1.16, warmth: 0.02 }, effect: 'cyber' },
] as const

export function TemplatePanel({ onApplied }: AtomicPanelProps) {
  const applyVisual = useStudioStore((state) => state.applyVisualSettings)
  const applyEffects = useStudioStore((state) => state.applyCameraEffects)
  const currentVisual = useStudioStore((state) => state.visualSettings)
  const [selected, setSelected] = useState<(typeof templates)[number]['id']>(templates[0].id)
  const [saved, setSaved] = useState(false)

  const apply = () => {
    const template = templates.find((item) => item.id === selected) ?? templates[0]
    applyVisual(template.visual)
    applyEffects(applyCameraEffectPreset(template.effect))
    onApplied?.('studio-template')
  }

  return (
    <div className="atomic-panel-body">
      <h3>装修模板</h3>
      <div className="atomic-template-grid">
        {templates.map((template) => (
          <button type="button" className={selected === template.id ? 'selected' : ''} key={template.id} onClick={() => setSelected(template.id)}>
            <i style={{ backgroundColor: template.color }} />
            <b>{template.name}</b>
            <small>画面、背景与组件布局</small>
          </button>
        ))}
      </div>
      <button className="atomic-secondary-button" type="button" onClick={() => {
        localStorage.setItem('live-studio-custom-template', JSON.stringify(currentVisual))
        setSaved(true)
      }}><Save size={14} />{saved ? '当前配置已保存' : '保存当前配置'}</button>
      <button className="atomic-apply-button" type="button" onClick={apply}><Check size={14} />加载模板</button>
    </div>
  )
}

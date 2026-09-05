import { ButtonV4 as Button } from '@byted/creator-ui'
import { Check, Gift, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { type ComponentType } from 'react'
import { widgetSpecSchema, type WidgetSpec } from '../../agent/widgets/widgetSpec'
import type { VisualSettings } from '../../capabilities/visual/types'
import { useStudioStore } from '../../store/studioStore'
import { Adjustment } from './Adjustment'

interface WidgetRendererProps {
  spec: unknown
  applied: boolean
  isPreviewing: boolean
  onPreview: () => void
  onApply: () => void
  onUndo: () => void
  onVisualChange: (property: keyof VisualSettings, percentage: number) => void
}

interface WidgetBodyProps {
  spec: WidgetSpec
  applied: boolean
  isPreviewing: boolean
  onVisualChange: WidgetRendererProps['onVisualChange']
}

const widgetRegistry: Record<WidgetSpec['type'], ComponentType<WidgetBodyProps>> = {
  'visual-adjustment': VisualAdjustmentWidget,
  'audience-poll': AudiencePollWidget,
  'audio-adjustment': AudioAdjustmentWidget,
  'live-goal': LiveGoalWidget,
}

export function WidgetRenderer(props: WidgetRendererProps) {
  const parsedSpec = widgetSpecSchema.safeParse(props.spec)
  if (!parsedSpec.success) {
    return <div className="recommendation-card"><span className="card-kicker">组件不可用</span><p>Genie 返回的组件配置未通过校验。</p></div>
  }

  const spec = parsedSpec.data
  const WidgetBody = widgetRegistry[spec.type]
  const tone = {
    'visual-adjustment': 'quality',
    'audience-poll': 'interaction',
    'audio-adjustment': 'troubleshoot',
    'live-goal': 'pk',
  }[spec.type]

  return (
    <div className={`recommendation-card ${tone}`} data-widget-type={spec.type} data-schema-version={spec.version}>
      <span className="card-kicker">{spec.type === 'audio-adjustment' ? '需要确认' : '实时建议'}</span>
      <h2>{spec.title}</h2>
      <p>{spec.detail}</p>
      <WidgetBody
        spec={spec}
        applied={props.applied}
        isPreviewing={props.isPreviewing}
        onVisualChange={props.onVisualChange}
      />
      {!props.isPreviewing && !props.applied && <Button className="primary-button full-button" color="primary" onClick={props.onPreview}><Sparkles size={16} />预览调整</Button>}
      {props.isPreviewing && <Button className="primary-button full-button" color="primary" onClick={props.onApply}><Check size={16} />{spec.actionLabel}</Button>}
      {props.applied && <Button className="primary-button full-button" color="primary" disabled><Check size={16} />已应用</Button>}
      {props.applied
        ? <button className="card-text-button" type="button" onClick={props.onUndo}><RotateCcw size={14} />撤回最近一次调整</button>
        : <button className="card-text-button" type="button"><RefreshCw size={14} />换一组建议</button>}
    </div>
  )
}

function VisualAdjustmentWidget({ spec, applied, isPreviewing, onVisualChange }: WidgetBodyProps) {
  const visualSettings = useStudioStore((state) => state.visualSettings)
  if (spec.type !== 'visual-adjustment') return null

  const settings = applied || isPreviewing ? visualSettings : spec.props.settings
  return (
    <div className="adjustments">
      <Adjustment label="补光" value={`+${Math.round((settings.brightness - 1) * 100)}`} onChange={(value) => onVisualChange('brightness', value)} />
      <Adjustment label="对比度" value={`+${Math.round((settings.contrast - 1) * 100)}`} onChange={(value) => onVisualChange('contrast', value)} />
      <Adjustment label="暖色" value={`+${Math.round(settings.warmth * 100)}`} onChange={(value) => onVisualChange('warmth', value)} />
    </div>
  )
}

function AudiencePollWidget({ spec }: WidgetBodyProps) {
  if (spec.type !== 'audience-poll') return null
  return (
    <div className="interaction-widget">
      <div><Gift size={17} /><span>点歌投票</span></div>
      <p>{spec.props.question} {spec.props.options.map((option, index) => `${index + 1} ${option}`).join(' / ')}</p>
      <small>展示 {spec.props.durationSeconds} 秒 · 评论即可参与</small>
    </div>
  )
}

function AudioAdjustmentWidget({ spec }: WidgetBodyProps) {
  if (spec.type !== 'audio-adjustment') return null
  return (
    <div className="adjustments">
      <Adjustment label="麦克风" value={`${withSign(spec.props.microphoneGain)}%`} />
      <Adjustment label="BGM" value={`${withSign(spec.props.backgroundMusicGain)}%`} />
    </div>
  )
}

function LiveGoalWidget({ spec }: WidgetBodyProps) {
  if (spec.type !== 'live-goal') return null
  const progress = Math.min(100, Math.round((spec.props.current / spec.props.target) * 100))
  return (
    <div className="goal-widget">
      <span>{spec.props.label}</span>
      <strong>再差 {(spec.props.target - spec.props.current).toLocaleString()} 分达成</strong>
      <div><i style={{ width: `${progress}%` }} /></div>
      <small>已获得 {spec.props.supporters} 位观众响应</small>
    </div>
  )
}

function withSign(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

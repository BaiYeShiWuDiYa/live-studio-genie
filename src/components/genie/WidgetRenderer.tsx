import { ButtonV4 as Button } from '@byted/creator-ui'
import { Check, Gift, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { type ComponentType } from 'react'
import { widgetSpecSchema, type WidgetSpec } from '../../agent/widgets/widgetSpec'
import type { AudioSettings } from '../../capabilities/audio/types'
import type { VisualSettings } from '../../capabilities/visual/types'
import type { CameraEffects } from '../../capabilities/video/cameraEffects'
import { useStudioStore } from '../../store/studioStore'
import { Adjustment } from './Adjustment'

interface WidgetRendererProps {
  spec: unknown
  applied: boolean
  isPreviewing: boolean
  onPreview: () => void
  onApply: () => void
  onUndo: () => void
  onAudioChange: (property: keyof AudioSettings, value: number) => void
  onVisualChange: (property: keyof VisualSettings, percentage: number) => void
  onCameraEffectsChange: (settings: CameraEffects) => void
}

interface WidgetBodyProps {
  spec: WidgetSpec
  applied: boolean
  isPreviewing: boolean
  onAudioChange: WidgetRendererProps['onAudioChange']
  onVisualChange: WidgetRendererProps['onVisualChange']
  onCameraEffectsChange: WidgetRendererProps['onCameraEffectsChange']
}

const widgetRegistry: Record<WidgetSpec['type'], ComponentType<WidgetBodyProps>> = {
  'camera-effects': CameraEffectsWidget,
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
    'camera-effects': 'quality',
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
        onAudioChange={props.onAudioChange}
        onVisualChange={props.onVisualChange}
        onCameraEffectsChange={props.onCameraEffectsChange}
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

function CameraEffectsWidget({
  spec,
  applied,
  isPreviewing,
  onCameraEffectsChange,
}: WidgetBodyProps) {
  const cameraEffects = useStudioStore((state) => state.cameraEffects)
  if (spec.type !== 'camera-effects') return null
  const settings = applied || isPreviewing
    ? cameraEffects
    : spec.props.settings
  const update = (patch: Partial<CameraEffects>) => {
    onCameraEffectsChange({ ...settings, ...patch })
  }

  return (
    <>
      <div className="effect-mode-control" role="group" aria-label="虚拟背景模式">
        {([
          ['none', '原始'],
          ['blur', '虚化'],
          ['color', '纯色'],
        ] as const).map(([mode, label]) => (
          <button
            type="button"
            className={settings.backgroundMode === mode ? 'selected' : ''}
            key={mode}
            onClick={() => update({ backgroundMode: mode })}
          >
            {label}
          </button>
        ))}
      </div>
      {settings.backgroundMode === 'color' && (
        <label className="effect-color-control">
          <span>背景颜色</span>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(event) => update({ backgroundColor: event.target.value })}
            aria-label="背景颜色"
          />
          <b>{settings.backgroundColor.toUpperCase()}</b>
        </label>
      )}
      <div className="adjustments">
        <Adjustment label="柔肤" max={100} value={`${settings.smoothness}%`} onChange={(value) => update({ smoothness: value })} />
        <Adjustment label="提亮" min={-20} max={30} value={`${withSign(settings.exposure)}%`} onChange={(value) => update({ exposure: value })} />
        <Adjustment label="暖肤" max={40} value={`${settings.warmth}%`} onChange={(value) => update({ warmth: value })} />
      </div>
    </>
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

function AudioAdjustmentWidget({ spec, applied, isPreviewing, onAudioChange }: WidgetBodyProps) {
  const audioSettings = useStudioStore((state) => state.audioSettings)
  if (spec.type !== 'audio-adjustment') return null

  const settings = applied || isPreviewing
    ? audioSettings
    : {
        microphoneGainDb: spec.props.microphoneGain,
        backgroundMusicGainDb: spec.props.backgroundMusicGain,
      }
  return (
    <div className="adjustments">
      <Adjustment label="麦克风" min={-20} max={20} value={`${withSign(settings.microphoneGainDb)} dB`} onChange={(value) => onAudioChange('microphoneGainDb', value)} />
      <Adjustment label="BGM" min={-20} max={20} value={`${withSign(settings.backgroundMusicGainDb)} dB`} onChange={(value) => onAudioChange('backgroundMusicGainDb', value)} />
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

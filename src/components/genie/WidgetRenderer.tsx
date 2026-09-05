import { ButtonV4 as Button } from '@byted/creator-ui'
import { Check, Gift, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { widgetSpecSchema, type WidgetSpec } from '../../agent/widgets/widgetSpec'
import type { AudioSettings } from '../../capabilities/audio/types'
import type { VisualSettings } from '../../capabilities/visual/types'
import {
  applyCameraBeautyPreset,
  applyCameraEffectPreset,
  applyCameraMakeupPreset,
  cameraBeautyPresets,
  cameraEffectPresets,
  cameraMakeupPresets,
  getMatchingCameraBeautyPresetId,
  getMatchingCameraEffectPresetId,
  getMatchingCameraMakeupPresetId,
  virtualBackgrounds,
  type CameraEffects,
} from '../../capabilities/video/cameraEffects'
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
  const [activeSection, setActiveSection] = useState<
    'bundle' | 'beauty' | 'makeup' | 'props' | 'background'
  >('bundle')
  const cameraEffects = useStudioStore((state) => state.cameraEffects)
  if (spec.type !== 'camera-effects') return null
  const settings = applied || isPreviewing
    ? cameraEffects
    : spec.props.settings
  const selectedPresetId = getMatchingCameraEffectPresetId(settings)
  const selectedBeautyId = getMatchingCameraBeautyPresetId(settings)
  const selectedMakeupId = getMatchingCameraMakeupPresetId(settings)
  const update = (patch: Partial<CameraEffects>) => {
    onCameraEffectsChange({ ...settings, ...patch })
  }

  return (
    <>
      <div className="effect-category-tabs" role="tablist" aria-label="效果分类">
        {([
          ['bundle', '整套'],
          ['beauty', '美颜'],
          ['makeup', '美妆'],
          ['props', '道具'],
          ['background', '背景'],
        ] as const).map(([section, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === section}
            className={activeSection === section ? 'selected' : ''}
            key={section}
            onClick={() => setActiveSection(section)}
          >
            {label}
          </button>
        ))}
      </div>
      {activeSection === 'bundle' && (
        <div className="effect-preset-grid" role="group" aria-label="整套风格">
          {cameraEffectPresets.map((preset) => (
            <button
              type="button"
              className={selectedPresetId === preset.id ? 'selected' : ''}
              key={preset.id}
              title={preset.detail}
              onClick={() => onCameraEffectsChange(applyCameraEffectPreset(preset.id))}
            >
              <EffectSwatches colors={preset.swatches} />
              <b>{preset.label}</b>
            </button>
          ))}
        </div>
      )}
      {activeSection === 'beauty' && (
        <div className="effect-preset-grid beauty-presets" role="group" aria-label="美颜方案">
          {cameraBeautyPresets.map((preset) => (
            <button
              type="button"
              className={selectedBeautyId === preset.id ? 'selected' : ''}
              key={preset.id}
              onClick={() => onCameraEffectsChange(
                applyCameraBeautyPreset(settings, preset.id),
              )}
            >
              <Sparkles size={13} />
              <b>{preset.label}</b>
            </button>
          ))}
        </div>
      )}
      {activeSection === 'makeup' && (
        <div className="effect-preset-grid" role="group" aria-label="美妆方案">
          {cameraMakeupPresets.map((preset) => (
            <button
              type="button"
              className={selectedMakeupId === preset.id ? 'selected' : ''}
              key={preset.id}
              onClick={() => onCameraEffectsChange(
                applyCameraMakeupPreset(settings, preset.id),
              )}
            >
              <EffectSwatches colors={preset.swatches} />
              <b>{preset.label}</b>
            </button>
          ))}
        </div>
      )}
      {(activeSection === 'bundle' || activeSection === 'beauty') && (
        <>
          {activeSection === 'bundle' && <p className="effect-section-label">美颜微调</p>}
          <div className="adjustments">
            <Adjustment label="柔肤" max={100} value={`${settings.smoothness}%`} onChange={(value) => update({ smoothness: value })} />
            <Adjustment label="提亮" min={-20} max={30} value={`${withSign(settings.exposure)}%`} onChange={(value) => update({ exposure: value })} />
            <Adjustment label="暖肤" max={40} value={`${settings.warmth}%`} onChange={(value) => update({ warmth: value })} />
            <Adjustment label="对比度" min={-20} max={40} value={`${withSign(settings.contrast)}%`} onChange={(value) => update({ contrast: value })} />
            <Adjustment label="饱和度" min={-30} max={50} value={`${withSign(settings.saturation)}%`} onChange={(value) => update({ saturation: value })} />
          </div>
        </>
      )}
      {(activeSection === 'bundle' || activeSection === 'makeup') && (
        <>
          {activeSection === 'bundle' && <p className="effect-section-label">美妆微调</p>}
          <div className="makeup-controls">
            <MakeupControl
              label="口红"
              color={settings.lipstickColor}
              intensity={settings.lipstickIntensity}
              onColorChange={(lipstickColor) => update({ lipstickColor })}
              onIntensityChange={(lipstickIntensity) => update({ lipstickIntensity })}
            />
            <MakeupControl
              label="腮红"
              color={settings.blushColor}
              intensity={settings.blushIntensity}
              onColorChange={(blushColor) => update({ blushColor })}
              onIntensityChange={(blushIntensity) => update({ blushIntensity })}
            />
            <MakeupControl
              label="眼影"
              color={settings.eyeshadowColor}
              intensity={settings.eyeshadowIntensity}
              onColorChange={(eyeshadowColor) => update({ eyeshadowColor })}
              onIntensityChange={(eyeshadowIntensity) => update({ eyeshadowIntensity })}
            />
            <Adjustment label="眼线" max={100} value={`${settings.eyelinerIntensity}%`} onChange={(value) => update({ eyelinerIntensity: value })} />
            <Adjustment label="高光" max={100} value={`${settings.highlightIntensity}%`} onChange={(value) => update({ highlightIntensity: value })} />
          </div>
        </>
      )}
      {(activeSection === 'bundle' || activeSection === 'props') && (
        <>
          {activeSection === 'bundle' && <p className="effect-section-label">人脸道具</p>}
        <div className="effect-mode-control prop-modes" role="group" aria-label="道具方案">
          {([
            ['none', '无道具'],
            ['sparkles', '星光'],
            ['glasses', '眼镜'],
            ['heart-sticker', '爱心贴纸'],
            ['cheek-stars', '星星贴纸'],
            ['butterfly-sticker', '蝴蝶贴纸'],
            ['lightning-sticker', '闪电贴纸'],
          ] as const).map(([faceEffect, label]) => (
            <button
              type="button"
              className={settings.faceEffect === faceEffect ? 'selected' : ''}
              key={faceEffect}
              onClick={() => update({ faceEffect })}
            >
              {label}
            </button>
          ))}
        </div>
        </>
      )}
      {(activeSection === 'bundle' || activeSection === 'background') && (
        <>
          {activeSection === 'bundle' && <p className="effect-section-label">虚拟背景</p>}
          <div className="effect-mode-control background-modes" role="group" aria-label="虚拟背景模式">
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
          <div className="virtual-background-grid" role="group" aria-label="预置虚拟背景">
            {virtualBackgrounds.map((background) => (
              <button
                type="button"
                className={
                  settings.backgroundMode === 'image' &&
                  settings.backgroundPreset === background.id
                    ? 'selected'
                    : ''
                }
                key={background.id}
                onClick={() => update({
                  backgroundMode: 'image',
                  backgroundImageUrl: null,
                  backgroundPreset: background.id,
                })}
              >
                <span
                  className={`virtual-background-preview ${background.id}`}
                  aria-hidden="true"
                />
                <span>{background.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function EffectSwatches({
  colors,
}: {
  colors: readonly [string, string, string]
}) {
  return (
    <span className="effect-preset-swatches" aria-hidden="true">
      {colors.map((color) => (
        <i key={color} style={{ backgroundColor: color }} />
      ))}
    </span>
  )
}

function MakeupControl({
  label,
  color,
  intensity,
  onColorChange,
  onIntensityChange,
}: {
  label: string
  color: string
  intensity: number
  onColorChange: (color: string) => void
  onIntensityChange: (intensity: number) => void
}) {
  return (
    <div className="makeup-control">
      <input
        type="color"
        value={color}
        onChange={(event) => onColorChange(event.target.value)}
        aria-label={`${label}颜色`}
      />
      <Adjustment
        label={label}
        max={100}
        value={`${intensity}%`}
        onChange={onIntensityChange}
      />
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

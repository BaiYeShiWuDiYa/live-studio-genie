import { ButtonV4 as Button } from '@byted/creator-ui'
import {
  Check,
  Gamepad2,
  Gift,
  Glasses,
  Heart,
  House,
  Music2,
  Plus,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
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
  type VirtualBackground,
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
  onRefresh: () => void
  onSpecChange: (spec: WidgetSpec) => void
  onAudioChange: (property: keyof AudioSettings, value: number) => void
  onVisualChange: (property: keyof VisualSettings, percentage: number) => void
  onCameraEffectsChange: (settings: CameraEffects) => void
}

interface WidgetBodyProps {
  spec: WidgetSpec
  applied: boolean
  isPreviewing: boolean
  onSpecChange?: WidgetRendererProps['onSpecChange']
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
        key={`${spec.type}:${spec.title}:${spec.detail}`}
        spec={spec}
        applied={props.applied}
        isPreviewing={props.isPreviewing}
        onSpecChange={props.onSpecChange}
        onAudioChange={props.onAudioChange}
        onVisualChange={props.onVisualChange}
        onCameraEffectsChange={props.onCameraEffectsChange}
      />
      {!props.isPreviewing && !props.applied && <Button className="primary-button full-button" color="primary" onClick={props.onPreview}><Sparkles size={16} />预览调整</Button>}
      {props.isPreviewing && <Button className="primary-button full-button" color="primary" onClick={props.onApply}><Check size={16} />{spec.actionLabel}</Button>}
      {props.applied && <Button className="primary-button full-button" color="primary" disabled><Check size={16} />已应用</Button>}
      {props.applied
        ? <button className="card-text-button" type="button" onClick={props.onUndo}><RotateCcw size={14} />撤回最近一次调整</button>
        : <button className="card-text-button" type="button" onClick={props.onRefresh}><RefreshCw size={14} />换一组建议</button>}
    </div>
  )
}

type CameraEffectsSection = 'bundle' | 'beauty' | 'makeup' | 'props' | 'background'

export function CameraEffectsWidget({
  spec,
  applied,
  isPreviewing,
  onCameraEffectsChange,
  defaultSection = 'bundle',
}: WidgetBodyProps & { defaultSection?: CameraEffectsSection }) {
  const [activeSection, setActiveSection] = useState<CameraEffectsSection>(defaultSection)
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
            <Adjustment label="瘦脸" max={100} value={`${settings.slimFace}%`} onChange={(value) => update({ slimFace: value })} />
            <Adjustment label="磨皮" max={100} value={`${settings.smoothness}%`} onChange={(value) => update({ smoothness: value })} />
            <Adjustment label="大眼" max={100} value={`${settings.bigEyes}%`} onChange={(value) => update({ bigEyes: value })} />
            <Adjustment label="提亮" min={-20} max={30} value={`${withSign(settings.exposure)}%`} onChange={(value) => update({ exposure: value })} />
            <Adjustment label="暖肤" max={40} value={`${settings.warmth}%`} onChange={(value) => update({ warmth: value })} />
            <Adjustment label="对比度" min={-20} max={40} value={`${withSign(settings.contrast)}%`} onChange={(value) => update({ contrast: value })} />
            <Adjustment label="饱和度" min={-30} max={50} value={`${withSign(settings.saturation)}%`} onChange={(value) => update({ saturation: value })} />
            <Adjustment label="美白" max={100} value={`${settings.whitening}%`} onChange={(value) => update({ whitening: value })} />
            <Adjustment label="红润" max={100} value={`${settings.rosiness}%`} onChange={(value) => update({ rosiness: value })} />
            <Adjustment label="清晰" max={100} value={`${settings.clarity}%`} onChange={(value) => update({ clarity: value })} />
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
            ['none', '关闭', X],
            ['sparkles', '星光', Sparkles],
            ['glasses', '眼镜', Glasses],
            ['sunglasses', '墨镜', Glasses],
            ['heart-sticker', '爱心', Heart],
            ['cheek-stars', '星星贴', Sparkles],
            ['butterfly-sticker', '蝴蝶贴', Heart],
            ['lightning-sticker', '闪电贴', Sparkles],
          ] as const).map(([faceEffect, label, Icon]) => (
            <button
              type="button"
              className={settings.faceEffect === faceEffect ? 'selected' : ''}
              key={faceEffect}
              title={label}
              aria-label={label}
              onClick={() => update({ faceEffect })}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        </>
      )}
      {(activeSection === 'bundle' || activeSection === 'background') && (
        <>
          {activeSection === 'bundle' && <p className="effect-section-label">虚拟背景</p>}
          <div className="adjustments">
            <Adjustment
              label="虚化"
              max={100}
              value={`${settings.backgroundMode === 'blur' ? settings.backgroundBlur : 0}%`}
              onChange={(backgroundBlur) => update({
                backgroundBlur,
                backgroundMode: backgroundBlur === 0 ? 'none' : 'blur',
              })}
            />
          </div>
          <div className="virtual-background-grid" role="group" aria-label="预置虚拟背景">
            {virtualBackgrounds.map((background) => {
              const Icon = virtualBackgroundIcon(background.id)
              return (
                <button
                  type="button"
                  className={
                    settings.backgroundMode === 'image' &&
                    settings.backgroundPreset === background.id
                      ? 'selected'
                      : ''
                  }
                  key={background.id}
                  title={background.label}
                  aria-label={background.label}
                  onClick={() => update({
                    backgroundMode: 'image',
                    backgroundImageUrl: null,
                    backgroundPreset: background.id,
                  })}
                >
                  <Icon size={17} />
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function virtualBackgroundIcon(background: VirtualBackground) {
  const icons: Record<VirtualBackground, typeof RadioTower> = {
    'neon-studio': RadioTower,
    'music-room': Music2,
    'cyber-arena': Gamepad2,
    'creator-loft': House,
  }
  return icons[background]
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
      <Adjustment label="补光" min={-40} max={60} value={`${withSign(Math.round((settings.brightness - 1) * 100))}%`} onChange={(value) => onVisualChange('brightness', value)} />
      <Adjustment label="对比度" min={-40} max={60} value={`${withSign(Math.round((settings.contrast - 1) * 100))}%`} onChange={(value) => onVisualChange('contrast', value)} />
      <Adjustment label="暖色" max={60} value={`${withSign(Math.round(settings.warmth * 100))}%`} onChange={(value) => onVisualChange('warmth', value)} />
    </div>
  )
}

function AudiencePollWidget({ spec, applied, onSpecChange }: WidgetBodyProps) {
  const pollProps = spec.type === 'audience-poll'
    ? spec.props
    : { question: '', options: ['', ''], durationSeconds: 15 }
  const [question, setQuestion] = useState(pollProps.question)
  const [options, setOptions] = useState([...pollProps.options])
  const [duration, setDuration] = useState(String(pollProps.durationSeconds))

  if (spec.type !== 'audience-poll') return null

  const updateDraft = (
    nextQuestion: string,
    nextOptions: string[],
    nextDuration: string,
  ) => {
    setQuestion(nextQuestion)
    setOptions(nextOptions)
    setDuration(nextDuration)
    const durationSeconds = Number(nextDuration)
    if (
      !nextQuestion.trim() ||
      nextOptions.some((option) => !option.trim()) ||
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 15 ||
      durationSeconds > 180
    ) {
      return
    }
    onSpecChange?.({
      ...spec,
      props: {
        question: nextQuestion.trim(),
        options: nextOptions.map((option) => option.trim()),
        durationSeconds,
      },
    })
  }
  const isValid = question.trim() &&
    options.every((option) => option.trim()) &&
    Number.isInteger(Number(duration)) &&
    Number(duration) >= 15 &&
    Number(duration) <= 180

  return (
    <div className="widget-inline-editor">
      <div className="interaction-widget">
        <div><Gift size={17} /><span>点歌投票</span></div>
        <p>{question || '请输入投票问题'} {options.map((option, index) => `${index + 1} ${option || '待填写'}`).join(' / ')}</p>
        <small>展示 {duration || '--'} 秒 · 评论即可参与</small>
      </div>
      <label className="widget-editor-field">
        <span>投票问题</span>
        <input
          aria-label="投票问题"
          maxLength={60}
          value={question}
          disabled={applied}
          onChange={(event) =>
            updateDraft(event.target.value, options, duration)}
        />
      </label>
      {options.map((option, index) => (
        <div className="widget-option-editor" key={index}>
          <label className="widget-editor-field">
            <span>选项 {index + 1}</span>
            <input
              aria-label={`投票选项 ${index + 1}`}
              maxLength={24}
              value={option}
              disabled={applied}
              onChange={(event) =>
                updateDraft(
                  question,
                  options.map((current, optionIndex) =>
                    optionIndex === index ? event.target.value : current,
                  ),
                  duration,
                )}
            />
          </label>
          {options.length > 2 && (
            <button
              type="button"
              className="widget-option-remove"
              aria-label={`删除投票选项 ${index + 1}`}
              title="删除选项"
              disabled={applied}
              onClick={() => updateDraft(
                question,
                options.filter((_, optionIndex) => optionIndex !== index),
                duration,
              )}
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      {options.length < 4 && (
        <button
          type="button"
          className="widget-option-add"
          disabled={applied}
          onClick={() => updateDraft(
            question,
            [...options, `选项 ${options.length + 1}`],
            duration,
          )}
        >
          <Plus size={13} />
          添加选项
        </button>
      )}
      <label className="widget-editor-field">
        <span>展示时长（秒）</span>
        <input
          aria-label="投票展示时长"
          type="number"
          min={15}
          max={180}
          value={duration}
          disabled={applied}
          onChange={(event) =>
            updateDraft(question, options, event.target.value)}
        />
      </label>
      {!isValid && (
        <small className="widget-editor-error">
          请填写完整内容，展示时长需为 15～180 秒。
        </small>
      )}
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

function LiveGoalWidget({ spec, applied, onSpecChange }: WidgetBodyProps) {
  const goalProps = spec.type === 'live-goal'
    ? spec.props
    : { label: '', target: 1, current: 0, supporters: 0 }
  const [label, setLabel] = useState(goalProps.label)
  const [target, setTarget] = useState(String(goalProps.target))

  if (spec.type !== 'live-goal') return null

  const updateDraft = (nextLabel: string, nextTarget: string) => {
    setLabel(nextLabel)
    setTarget(nextTarget)
    const targetValue = Number(nextTarget)
    if (
      !nextLabel.trim() ||
      !Number.isInteger(targetValue) ||
      targetValue < 1
    ) {
      return
    }
    onSpecChange?.({
      ...spec,
      props: {
        ...spec.props,
        label: nextLabel.trim(),
        target: targetValue,
        current: Math.min(spec.props.current, targetValue),
      },
    })
  }
  const targetValue = Math.max(1, Number(target) || 1)
  const progress = Math.min(
    100,
    Math.round((spec.props.current / targetValue) * 100),
  )
  const isValid = label.trim() &&
    Number.isInteger(Number(target)) &&
    Number(target) >= 1

  return (
    <div className="widget-inline-editor">
      <div className="goal-widget">
        <span>{label || '请输入目标名称'}</span>
        <strong>再差 {Math.max(0, targetValue - spec.props.current).toLocaleString()} 分达成</strong>
        <div><i style={{ width: `${progress}%` }} /></div>
        <small>已获得 {spec.props.supporters} 位观众响应</small>
      </div>
      <label className="widget-editor-field">
        <span>目标名称</span>
        <input
          aria-label="LIVE Goal 名称"
          maxLength={40}
          value={label}
          disabled={applied}
          onChange={(event) => updateDraft(event.target.value, target)}
        />
      </label>
      <label className="widget-editor-field">
        <span>目标值</span>
        <input
          aria-label="LIVE Goal 目标值"
          type="number"
          min={1}
          value={target}
          disabled={applied}
          onChange={(event) => updateDraft(label, event.target.value)}
        />
      </label>
      {!isValid && (
        <small className="widget-editor-error">
          请填写目标名称，并设置大于 0 的整数目标。
        </small>
      )}
    </div>
  )
}

function withSign(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

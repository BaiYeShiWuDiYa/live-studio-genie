import { useRef, useState } from 'react'
import {
  Check,
  Gamepad2,
  Glasses,
  Heart,
  House,
  Mic,
  Music2,
  RadioTower,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Adjustment } from '../../genie/Adjustment'
import {
  applyCameraBeautyPreset,
  applyCameraMakeupPreset,
  cameraBeautyPresets,
  cameraMakeupPresets,
  virtualBackgrounds,
  type VirtualBackground,
} from '../../../capabilities/video/cameraEffects'
import { useStudioStore } from '../../../store/studioStore'
import type { AtomicPanelProps } from '../types'

export function LightingPanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.visualSettings)
  const preview = useStudioStore((state) => state.previewVisualSettings)
  const apply = useStudioStore((state) => state.applyVisualSettings)
  const [mode, setMode] = useState<'auto' | 'soft' | 'stage'>('auto')
  const update = (patch: Partial<typeof settings>) => preview({ ...settings, ...patch })
  const selectMode = (nextMode: typeof mode) => {
    const modeSettings: Record<typeof mode, Partial<typeof settings>> = {
      auto: { brightness: 1.08, contrast: 1.02, warmth: 0.08 },
      soft: { brightness: 1.2, contrast: 0.96, warmth: 0.18 },
      stage: { brightness: 1.34, contrast: 1.14, warmth: 0.1 },
    }
    setMode(nextMode)
    update(modeSettings[nextMode])
  }

  return (
    <Panel title="亮度调节">
      <Segmented label="补光模式" value={mode} options={[['auto', '自动'], ['soft', '柔光'], ['stage', '舞台']]} onChange={selectMode} />
      <Adjustment label="亮度" min={60} max={160} value={`${Math.round(settings.brightness * 100)}%`} onChange={(value) => update({ brightness: value / 100 })} />
      <Adjustment label="色温" max={60} value={`${Math.round(settings.warmth * 100)}%`} onChange={(value) => update({ warmth: value / 100 })} />
      <ApplyButton onClick={() => { apply(settings); onApplied?.('lighting') }} />
    </Panel>
  )
}

export function ColorAdjustmentPanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.visualSettings)
  const preview = useStudioStore((state) => state.previewVisualSettings)
  const apply = useStudioStore((state) => state.applyVisualSettings)
  const [whiteBalance, setWhiteBalance] = useState<'auto' | 'neutral' | 'warm'>('neutral')
  const update = (patch: Partial<typeof settings>) =>
    preview({ ...settings, ...patch })

  return (
    <Panel title="色彩调节">
      <Segmented
        label="白平衡"
        value={whiteBalance}
        options={[['auto', '自动'], ['neutral', '自然'], ['warm', '暖色']]}
        onChange={(value) => {
          setWhiteBalance(value)
          update({ warmth: value === 'warm' ? 0.24 : value === 'neutral' ? 0 : 0.08 })
        }}
      />
      <Adjustment
        label="色温"
        max={60}
        value={`${Math.round(settings.warmth * 100)}%`}
        onChange={(value) => update({ warmth: value / 100 })}
      />
      <Adjustment
        label="色彩层次"
        min={70}
        max={130}
        value={`${Math.round(settings.contrast * 100)}%`}
        onChange={(value) => update({ contrast: value / 100 })}
      />
      <ApplyButton onClick={() => { apply(settings); onApplied?.('color-adjustment') }} />
    </Panel>
  )
}

export function MicrophonePanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.audioSettings)
  const preview = useStudioStore((state) => state.previewAudioSettings)
  const apply = useStudioStore((state) => state.applyAudioSettings)
  const [noiseReduction, setNoiseReduction] = useState(true)
  const [sound, setSound] = useState('原声')
  const [testing, setTesting] = useState(false)

  return (
    <Panel title="麦克风调节">
      <Adjustment label="音量" min={-20} max={20} value={`${settings.microphoneGainDb} dB`} onChange={(value) => preview({ ...settings, microphoneGainDb: value })} />
      <Toggle label="智能降噪" checked={noiseReduction} onChange={setNoiseReduction} />
      <label className="atomic-field"><span>音效</span><select value={sound} onChange={(event) => setSound(event.target.value)}><option>原声</option><option>磁性</option><option>明亮</option><option>演唱会</option></select></label>
      <div className="atomic-test-row">
        <button type="button" onClick={() => setTesting((value) => !value)}><Mic size={14} />{testing ? '停止测试' : '测试麦克风'}</button>
        {testing && <span className="atomic-level"><i style={{ width: '68%' }} /></span>}
      </div>
      <ApplyButton onClick={() => { apply(settings); onApplied?.('microphone') }} />
    </Panel>
  )
}

export function BeautyPanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.cameraEffects)
  const preview = useStudioStore((state) => state.previewCameraEffects)
  const apply = useStudioStore((state) => state.applyCameraEffects)
  const update = (patch: Partial<typeof settings>) => preview({ ...settings, ...patch })

  return (
    <Panel title="美颜面板">
      <div className="atomic-preset-row">
        {cameraBeautyPresets.map((preset) => <button type="button" key={preset.id} onClick={() => preview(applyCameraBeautyPreset(settings, preset.id))}>{preset.label}</button>)}
      </div>
      <Adjustment label="磨皮" max={100} value={`${settings.smoothness}%`} onChange={(smoothness) => update({ smoothness })} />
      <Adjustment label="美白" max={100} value={`${settings.whitening}%`} onChange={(whitening) => update({ whitening })} />
      <Adjustment label="瘦脸" max={100} value={`${settings.slimFace}%`} onChange={(slimFace) => update({ slimFace })} />
      <ApplyButton onClick={() => { apply(settings); onApplied?.('beauty') }} />
    </Panel>
  )
}

export function MakeupPanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.cameraEffects)
  const preview = useStudioStore((state) => state.previewCameraEffects)
  const apply = useStudioStore((state) => state.applyCameraEffects)
  const update = (patch: Partial<typeof settings>) => preview({ ...settings, ...patch })

  return (
    <Panel title="美妆面板">
      <div className="atomic-preset-row">
        {cameraMakeupPresets.map((preset) => <button type="button" key={preset.id} onClick={() => preview(applyCameraMakeupPreset(settings, preset.id))}>{preset.label}</button>)}
      </div>
      <Adjustment label="口红" max={100} value={`${settings.lipstickIntensity}%`} onChange={(lipstickIntensity) => update({ lipstickIntensity })} />
      <Adjustment label="腮红" max={100} value={`${settings.blushIntensity}%`} onChange={(blushIntensity) => update({ blushIntensity })} />
      <Adjustment label="眼妆" max={100} value={`${settings.eyeshadowIntensity}%`} onChange={(eyeshadowIntensity) => update({ eyeshadowIntensity })} />
      <ApplyButton onClick={() => { apply(settings); onApplied?.('makeup') }} />
    </Panel>
  )
}

export function BackgroundPanel({ onApplied }: AtomicPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const settings = useStudioStore((state) => state.cameraEffects)
  const preview = useStudioStore((state) => state.previewCameraEffects)
  const apply = useStudioStore((state) => state.applyCameraEffects)
  const update = (patch: Partial<typeof settings>) => preview({ ...settings, ...patch })

  return (
    <Panel title="背景面板">
      <Adjustment
        label="虚化"
        max={100}
        value={`${settings.backgroundMode === 'blur' ? settings.backgroundBlur : 0}%`}
        onChange={(backgroundBlur) => update({
          backgroundBlur,
          backgroundMode: backgroundBlur === 0 ? 'none' : 'blur',
        })}
      />
      <div className="atomic-icon-grid" role="group" aria-label="虚拟背景">
        {virtualBackgrounds.map((background) => {
          const Icon = backgroundIcon(background.id)
          const selected =
            settings.backgroundMode === 'image' &&
            settings.backgroundPreset === background.id
          return (
            <button
              type="button"
              className={selected ? 'selected' : ''}
              key={background.id}
              title={background.label}
              aria-label={background.label}
              onClick={() => update({
                backgroundMode: 'image',
                backgroundPreset: background.id,
                backgroundImageUrl: null,
              })}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) update({ backgroundMode: 'image', backgroundImageUrl: URL.createObjectURL(file), backgroundPreset: null })
      }} />
      <button className="atomic-secondary-button" type="button" onClick={() => inputRef.current?.click()}><Upload size={14} />上传背景</button>
      <ApplyButton onClick={() => { apply(settings); onApplied?.('background') }} />
    </Panel>
  )
}

export function EffectsPanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.cameraEffects)
  const preview = useStudioStore((state) => state.previewCameraEffects)
  const apply = useStudioStore((state) => state.applyCameraEffects)
  const [intensity, setIntensity] = useState(50)
  const [trigger, setTrigger] = useState('持续')

  return (
    <Panel title="特效面板">
      <div className="atomic-icon-grid" role="group" aria-label="特效">
        {([
          ['sparkles', '星光', Sparkles],
          ['glasses', '眼镜', Glasses],
          ['heart-sticker', '爱心', Heart],
        ] as const).map(([id, label, Icon]) => (
          <button
            type="button"
            className={settings.faceEffect === id ? 'selected' : ''}
            key={id}
            title={label}
            aria-label={label}
            onClick={() => preview({ ...settings, faceEffect: id })}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <Adjustment label="特效强度" max={100} value={`${intensity}%`} onChange={setIntensity} />
      <label className="atomic-field"><span>触发方式</span><select value={trigger} onChange={(event) => setTrigger(event.target.value)}><option>持续</option><option>收到礼物</option><option>点赞里程碑</option></select></label>
      <ApplyButton onClick={() => { apply(settings); onApplied?.('effects') }} />
    </Panel>
  )
}

function backgroundIcon(background: VirtualBackground) {
  const icons: Record<VirtualBackground, typeof RadioTower> = {
    'neon-studio': RadioTower,
    'music-room': Music2,
    'cyber-arena': Gamepad2,
    'creator-loft': House,
  }
  return icons[background]
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="atomic-panel-body"><h3>{title}</h3>{children}</div>
}

function ApplyButton({ onClick }: { onClick: () => void }) {
  return <button className="atomic-apply-button" type="button" onClick={onClick}><Check size={14} />应用设置</button>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="atomic-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <div className="atomic-segmented"><span>{label}</span><div>{options.map(([id, name]) => <button type="button" className={value === id ? 'selected' : ''} key={id} onClick={() => onChange(id)}>{name}</button>)}</div></div>
}

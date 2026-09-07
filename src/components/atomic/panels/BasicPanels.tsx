import { useRef, useState } from 'react'
import { Check, Mic, Upload } from 'lucide-react'
import { Adjustment } from '../../genie/Adjustment'
import {
  applyCameraBeautyPreset,
  applyCameraMakeupPreset,
  cameraBeautyPresets,
  cameraMakeupPresets,
  virtualBackgrounds,
} from '../../../capabilities/video/cameraEffects'
import { useStudioStore } from '../../../store/studioStore'
import type { AtomicPanelProps } from '../types'

export function LightingPanel({ onApplied }: AtomicPanelProps) {
  const settings = useStudioStore((state) => state.visualSettings)
  const preview = useStudioStore((state) => state.previewVisualSettings)
  const apply = useStudioStore((state) => state.applyVisualSettings)
  const [mode, setMode] = useState<'auto' | 'soft' | 'stage'>('auto')
  const update = (patch: Partial<typeof settings>) => preview({ ...settings, ...patch })

  return (
    <Panel title="补光面板">
      <Segmented label="补光模式" value={mode} options={[['auto', '自动'], ['soft', '柔光'], ['stage', '舞台']]} onChange={setMode} />
      <Adjustment label="亮度" value={`${Math.round(settings.brightness * 100)}%`} onChange={(value) => update({ brightness: 0.6 + value / 100 })} />
      <Adjustment label="色温" value={`${Math.round(settings.warmth * 100)}%`} onChange={(value) => update({ warmth: value * 0.006 })} />
      <ApplyButton onClick={() => { apply(settings); onApplied?.('lighting') }} />
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
      <Adjustment label="磨皮" value={`${settings.smoothness}%`} onChange={(smoothness) => update({ smoothness })} />
      <Adjustment label="美白" value={`${settings.whitening}%`} onChange={(whitening) => update({ whitening })} />
      <Adjustment label="瘦脸" value={`${settings.slimFace}%`} onChange={(slimFace) => update({ slimFace })} />
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
      <Adjustment label="口红" value={`${settings.lipstickIntensity}%`} onChange={(lipstickIntensity) => update({ lipstickIntensity })} />
      <Adjustment label="腮红" value={`${settings.blushIntensity}%`} onChange={(blushIntensity) => update({ blushIntensity })} />
      <Adjustment label="眼妆" value={`${settings.eyeshadowIntensity}%`} onChange={(eyeshadowIntensity) => update({ eyeshadowIntensity })} />
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
      <Segmented label="背景模式" value={settings.backgroundMode} options={[['none', '原始'], ['blur', '虚化'], ['image', '虚拟']]} onChange={(backgroundMode) => update({ backgroundMode })} />
      <div className="atomic-preset-row">
        {virtualBackgrounds.map((background) => <button type="button" key={background.id} onClick={() => update({ backgroundMode: 'image', backgroundPreset: background.id, backgroundImageUrl: null })}>{background.label}</button>)}
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
      <div className="atomic-preset-row">
        {([['none', '无'], ['sparkles', '星光'], ['glasses', '眼镜'], ['heart-sticker', '爱心']] as const).map(([id, label]) => <button type="button" className={settings.faceEffect === id ? 'selected' : ''} key={id} onClick={() => preview({ ...settings, faceEffect: id })}>{label}</button>)}
      </div>
      <Adjustment label="特效强度" value={`${intensity}%`} onChange={setIntensity} />
      <label className="atomic-field"><span>触发方式</span><select value={trigger} onChange={(event) => setTrigger(event.target.value)}><option>持续</option><option>收到礼物</option><option>点赞里程碑</option></select></label>
      <ApplyButton onClick={() => { apply(settings); onApplied?.('effects') }} />
    </Panel>
  )
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

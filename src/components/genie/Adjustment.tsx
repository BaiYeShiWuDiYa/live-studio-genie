import { useState, type CSSProperties } from 'react'

interface AdjustmentProps {
  label: string
  value: string
  min?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
}

export function Adjustment({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}: AdjustmentProps) {
  const numericValue = Number.parseInt(value, 10)
  const initialValue = Number.isNaN(numericValue) ? 0 : min < 0 ? numericValue : Math.abs(numericValue)
  const [internalValue, setInternalValue] = useState(initialValue)
  const currentValue = Math.min(max, Math.max(
    min,
    onChange ? initialValue : internalValue,
  ))
  const rawProgress = max === min
    ? 0
    : ((currentValue - min) / (max - min)) * 100
  const progress = Math.round(rawProgress * 100) / 100
  const suffix = value.includes('%') ? '%' : value.includes('dB') ? ' dB' : ''
  const sign = min < 0
    ? currentValue >= 0 ? '+' : ''
    : value.startsWith('-') ? '-' : value.startsWith('+') ? '+' : ''

  return (
    <label className="adjustment">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        style={{ '--range-progress': `${progress}%` } as CSSProperties}
        onInput={(event) => {
          const nextValue = Number(event.currentTarget.value)
          if (onChange) onChange(nextValue)
          else setInternalValue(nextValue)
        }}
        aria-label={`${label} 调节`}
      />
      <b>{sign}{currentValue}{suffix}</b>
    </label>
  )
}

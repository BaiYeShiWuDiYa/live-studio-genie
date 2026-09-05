import { useState } from 'react'

interface AdjustmentProps {
  label: string
  value: string
  min?: number
  max?: number
  onChange?: (value: number) => void
}

export function Adjustment({ label, value, min = 0, max = 60, onChange }: AdjustmentProps) {
  const numericValue = Number.parseInt(value, 10)
  const initialValue = Number.isNaN(numericValue) ? 0 : min < 0 ? numericValue : Math.abs(numericValue)
  const [internalValue, setInternalValue] = useState(initialValue)
  const currentValue = onChange ? initialValue : internalValue
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
        value={currentValue}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          if (onChange) onChange(nextValue)
          else setInternalValue(nextValue)
        }}
        aria-label={`${label} 调节`}
      />
      <b>{sign}{currentValue}{suffix}</b>
    </label>
  )
}

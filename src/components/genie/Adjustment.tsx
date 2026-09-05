import { useState } from 'react'

interface AdjustmentProps {
  label: string
  value: string
  max?: number
  onChange?: (value: number) => void
}

export function Adjustment({ label, value, max = 60, onChange }: AdjustmentProps) {
  const numericValue = Number.parseInt(value, 10)
  const initialValue = Number.isNaN(numericValue) ? 20 : Math.abs(numericValue)
  const [internalValue, setInternalValue] = useState(initialValue)
  const currentValue = onChange ? initialValue : internalValue
  const suffix = value.includes('%') ? '%' : ''
  const sign = value.startsWith('-') ? '-' : value.startsWith('+') ? '+' : ''

  return (
    <label className="adjustment">
      <span>{label}</span>
      <input
        type="range"
        min="0"
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

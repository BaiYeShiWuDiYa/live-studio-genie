export type WidgetOffset = { x: number; y: number }

export type CanvasTextStyle = {
  size: number
  color: string
  bold: boolean
  align: 'left' | 'center' | 'right'
  decoration: 'none' | 'stroke' | 'pill'
}

export const defaultCanvasTextStyle: CanvasTextStyle = {
  size: 13.5,
  color: 'gradient',
  bold: true,
  align: 'left',
  decoration: 'none',
}

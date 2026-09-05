import { z } from 'zod'

export const visualSettingsSchema = z.object({
  brightness: z.number().finite().min(0.6).max(1.6),
  contrast: z.number().finite().min(0.6).max(1.6),
  warmth: z.number().finite().min(0).max(0.6),
})

export type VisualSettings = z.infer<typeof visualSettingsSchema>

export const defaultVisualSettings: VisualSettings = {
  brightness: 1,
  contrast: 1,
  warmth: 0,
}

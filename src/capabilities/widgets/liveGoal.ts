import { z } from 'zod'

export const liveGoalConfigSchema = z.object({
  label: z.string().min(1).max(40),
  current: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  supporters: z.number().int().nonnegative(),
}).refine((value) => value.current <= value.target, {
  message: 'Current goal progress cannot exceed the target.',
})

export type LiveGoalConfig = z.infer<typeof liveGoalConfigSchema>
export type LiveGoalStatus = 'hidden' | 'preview' | 'active'

export interface LiveGoalState {
  config: LiveGoalConfig | null
  status: LiveGoalStatus
}

export const hiddenLiveGoalState: LiveGoalState = {
  config: null,
  status: 'hidden',
}

import { z } from 'zod'

export const pollConfigSchema = z.object({
  question: z.string().min(1).max(60),
  options: z.array(z.string().min(1).max(24)).min(2).max(4),
  durationSeconds: z.number().int().min(15).max(180),
})

export type PollConfig = z.infer<typeof pollConfigSchema>
export type PollStatus = 'hidden' | 'preview' | 'active'

export interface PollState {
  config: PollConfig | null
  status: PollStatus
  startedAt: number | null
  votes: number[]
}

export const hiddenPollState: PollState = {
  config: null,
  status: 'hidden',
  startedAt: null,
  votes: [],
}

export function createPollVotes(optionCount: number): number[] {
  return Array.from({ length: optionCount }, (_, index) => {
    if (index === 0) return 31
    if (index === 1) return 19
    return 0
  })
}

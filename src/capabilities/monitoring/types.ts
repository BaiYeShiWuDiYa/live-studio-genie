import { z } from 'zod'

export const metricToneSchema = z.enum(['good', 'warn', 'bad'])
export const metricStatusSchema = z.enum(['idle', 'measuring', 'ready', 'unavailable'])

export const mediaMetricSchema = z.object({
  score: z.number().finite().min(0).max(100),
  value: z.string().min(1),
  tone: metricToneSchema,
  status: metricStatusSchema,
  updatedAt: z.number().int().nonnegative(),
})

export type MediaMetric = z.infer<typeof mediaMetricSchema>
export type MediaMetricKind = 'brightness' | 'microphone' | 'framing'

export const idleMediaMetric: MediaMetric = {
  score: 0,
  value: '未连接',
  tone: 'warn',
  status: 'idle',
  updatedAt: 0,
}

import { z } from 'zod'
import { visualSettingsSchema } from '../../capabilities/visual/types'
import { pollConfigSchema } from '../../capabilities/widgets/poll'

export const studioSceneSchema = z.enum(['quality', 'interaction', 'troubleshoot', 'pk'])
export type StudioScene = z.infer<typeof studioSceneSchema>

const widgetBase = {
  version: z.literal('1.0'),
  title: z.string().min(1).max(80),
  detail: z.string().min(1).max(180),
  actionLabel: z.string().min(1).max(24),
}

export const widgetSpecSchema = z.discriminatedUnion('type', [
  z.object({
    ...widgetBase,
    type: z.literal('visual-adjustment'),
    props: z.object({
      settings: visualSettingsSchema,
    }),
  }),
  z.object({
    ...widgetBase,
    type: z.literal('audience-poll'),
    props: pollConfigSchema,
  }),
  z.object({
    ...widgetBase,
    type: z.literal('audio-adjustment'),
    props: z.object({
      microphoneGain: z.number().int().min(-20).max(20),
      backgroundMusicGain: z.number().int().min(-20).max(20),
    }),
  }),
  z.object({
    ...widgetBase,
    type: z.literal('live-goal'),
    props: z.object({
      label: z.string().min(1).max(40),
      current: z.number().int().nonnegative(),
      target: z.number().int().positive(),
      supporters: z.number().int().nonnegative(),
    }),
  }),
])

export type WidgetSpec = z.infer<typeof widgetSpecSchema>

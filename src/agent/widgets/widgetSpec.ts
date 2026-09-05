import { z } from 'zod'
import { visualSettingsSchema } from '../../capabilities/visual/types'
import { cameraEffectsSchema } from '../../capabilities/video/cameraEffects'
import { liveGoalConfigSchema } from '../../capabilities/widgets/liveGoal'
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
    type: z.literal('camera-effects'),
    props: z.object({
      settings: cameraEffectsSchema,
    }),
  }),
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
    props: liveGoalConfigSchema,
  }),
])

export type WidgetSpec = z.infer<typeof widgetSpecSchema>

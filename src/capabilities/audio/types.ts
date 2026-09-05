import { z } from 'zod'

export const audioSettingsSchema = z.object({
  microphoneGainDb: z.number().finite().min(-20).max(20),
  backgroundMusicGainDb: z.number().finite().min(-20).max(20),
})

export type AudioSettings = z.infer<typeof audioSettingsSchema>

export const defaultAudioSettings: AudioSettings = {
  microphoneGainDb: 0,
  backgroundMusicGainDb: 0,
}

import { z } from 'zod'

export const cameraLayerLayoutSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(120).max(360),
  height: z.number().finite().min(160).max(480),
})

export type CameraLayerLayout = z.infer<typeof cameraLayerLayoutSchema>

export const defaultCameraLayerLayout: CameraLayerLayout = {
  x: 0,
  y: 0,
  width: 180,
  height: 240,
}

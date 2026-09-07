import { z } from 'zod'

export const audienceWishesConfigSchema = z.object({
  title: z.string().min(1).max(40),
  items: z.array(z.string().min(1).max(40)).min(1).max(5),
})

export type AudienceWishesConfig = z.infer<typeof audienceWishesConfigSchema>

export type AudienceWishesState = {
  config: AudienceWishesConfig | null
  status: 'hidden' | 'preview' | 'active'
}

export const hiddenAudienceWishesState: AudienceWishesState = {
  config: null,
  status: 'hidden',
}

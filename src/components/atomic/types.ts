import type { ComponentType, LazyExoticComponent } from 'react'
import type { AudienceSnapshot } from '../../capabilities/audience/audienceEvents'

export type AtomicComponentId =
  | 'lighting'
  | 'color-adjustment'
  | 'microphone'
  | 'beauty'
  | 'makeup'
  | 'background'
  | 'effects'
  | 'audience-poll'
  | 'speaking-suggestion'
  | 'live-goal'
  | 'audience-wishes'
  | 'like-ranking'
  | 'gift-ranking'
  | 'studio-template'

export type AtomicCategory = 'basic' | 'interaction' | 'overall'

export interface AtomicPanelProps {
  audience: AudienceSnapshot
  onApplied?: (componentId: AtomicComponentId) => void
}

export interface AtomicComponentDefinition {
  id: AtomicComponentId
  name: string
  description: string
  category: AtomicCategory
  keywords: readonly string[]
  preload: () => Promise<unknown>
  component: LazyExoticComponent<ComponentType<AtomicPanelProps>>
}

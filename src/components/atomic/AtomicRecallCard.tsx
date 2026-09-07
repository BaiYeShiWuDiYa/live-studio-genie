import { Suspense } from 'react'
import type { AudienceSnapshot } from '../../capabilities/audience/audienceEvents'
import { atomicComponentRegistry } from './registry'
import type { AtomicComponentId } from './types'

export function AtomicRecallCard({
  componentId,
  audience,
  onApplied,
}: {
  componentId: AtomicComponentId
  audience: AudienceSnapshot
  onApplied: () => void
}) {
  const definition = atomicComponentRegistry[componentId]
  const Panel = definition.component

  return (
    <div
      className={`recommendation-card atomic-recall-card atomic-${definition.category}`}
      data-atomic-component={componentId}
      onMouseEnter={() => void definition.preload()}
    >
      <h2>{definition.name}</h2>
      <p>{definition.description}</p>
      <Suspense fallback={<div className="atomic-loading">正在加载组件...</div>}>
        <Panel audience={audience} onApplied={onApplied} />
      </Suspense>
    </div>
  )
}

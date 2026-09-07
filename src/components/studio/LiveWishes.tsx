import { HeartHandshake } from 'lucide-react'
import { useStudioStore } from '../../store/studioStore'

export function LiveWishes({ onSelect }: { onSelect?: () => void }) {
  const state = useStudioStore((store) => store.audienceWishesState)

  if (state.status === 'hidden' || !state.config) return null

  const select = () => onSelect?.()

  return (
    <section
      className={`live-wishes-overlay ${state.status === 'preview' ? 'is-preview' : ''}`}
      aria-label="观众心愿组件"
      tabIndex={0}
      onPointerDown={(event) => {
        event.stopPropagation()
        select()
      }}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') select()
      }}
    >
      <div><HeartHandshake size={14} /><b>{state.config.title}</b></div>
      {state.config.items.slice(0, 3).map((item, index) => (
        <p key={`${item}-${index}`}><i>{index + 1}</i><span>{item}</span></p>
      ))}
    </section>
  )
}

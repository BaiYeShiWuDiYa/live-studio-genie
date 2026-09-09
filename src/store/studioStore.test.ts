import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioStore } from './studioStore'

describe('studioStore live canvas widgets', () => {
  beforeEach(() => {
    const store = useStudioStore.getState()
    store.hideLiveGoal()
    store.hidePoll()
    store.hideAudienceWishes()
  })

  it('removes a published live goal from both active and committed state', () => {
    useStudioStore.getState().publishLiveGoal({
      label: '本场点赞目标',
      current: 120,
      target: 1000,
      supporters: 8,
    })

    useStudioStore.getState().hideLiveGoal()

    const state = useStudioStore.getState()
    expect(state.liveGoalState.status).toBe('hidden')
    expect(state.committedLiveGoalState.status).toBe('hidden')
  })

  it('starts a published live goal from zero and completes it without regressing', () => {
    const store = useStudioStore.getState()
    store.publishLiveGoal({
      label: '本场点赞目标',
      current: 320,
      target: 1000,
      supporters: 8,
    })

    expect(useStudioStore.getState().liveGoalState.config?.current).toBe(0)

    store.syncLiveGoalProgress(480)
    store.syncLiveGoalProgress(120)
    expect(useStudioStore.getState().liveGoalState.config?.current).toBe(480)

    store.completeLiveGoal()
    expect(useStudioStore.getState().liveGoalState.config?.current).toBe(1000)
  })

  it('removes published poll and audience wishes widgets', () => {
    const store = useStudioStore.getState()
    store.publishPoll({
      question: '下一首想听什么？',
      options: ['慢歌', '快歌'],
      durationSeconds: 60,
    })
    store.publishAudienceWishes({
      title: '观众心愿',
      items: ['唱一首歌'],
    })

    useStudioStore.getState().hidePoll()
    useStudioStore.getState().hideAudienceWishes()

    const state = useStudioStore.getState()
    expect(state.pollState.status).toBe('hidden')
    expect(state.audienceWishesState.status).toBe('hidden')
  })
})

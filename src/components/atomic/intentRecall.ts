import type { LiveSignalId } from '../../capabilities/monitoring/liveDiagnostics'
import type { AtomicComponentId } from './types'

export type IntentSource = 'input' | 'comment' | 'monitor'

export interface IntentRecallRequest {
  source: IntentSource
  text?: string
  signalIds?: readonly LiveSignalId[]
}

export interface IntentRecallResult {
  componentIds: AtomicComponentId[]
  confidence: number
  matchedExamples: string[]
}

export interface IntentFewShotExample {
  input: string
  componentIds: readonly AtomicComponentId[]
}

export const defaultIntentFewShots: readonly IntentFewShotExample[] = [
  { input: '画面太暗，帮我补点光并调暖一点', componentIds: ['lighting'] },
  { input: '听不清主播，人声小还有噪声', componentIds: ['microphone'] },
  { input: '想让皮肤自然一点并稍微瘦脸', componentIds: ['beauty'] },
  { input: '加一点口红和腮红，让气色更好', componentIds: ['makeup'] },
  { input: '背景太乱，帮我虚化或换背景', componentIds: ['background'] },
  { input: '收到礼物时播放庆祝特效', componentIds: ['effects', 'gift-ranking'] },
  { input: '让观众投票决定下一首歌', componentIds: ['audience-poll'] },
  { input: '设置本场点赞目标并展示进度', componentIds: ['live-goal'] },
  { input: '收集大家想听的歌', componentIds: ['audience-wishes'] },
  { input: '看看谁点赞最多', componentIds: ['like-ranking'] },
  { input: '展示本场礼物贡献排行', componentIds: ['gift-ranking'] },
  { input: '给整场直播换一套装修', componentIds: ['studio-template'] },
] as const

const signalComponents: Readonly<Record<LiveSignalId, readonly AtomicComponentId[]>> = {
  exposure: ['lighting'],
  contrast: ['lighting', 'background'],
  framing: ['beauty', 'background'],
  fps: ['background', 'effects'],
  microphone: ['microphone'],
  comments: ['audience-poll', 'audience-wishes'],
  entrants: ['audience-poll', 'like-ranking'],
  retention: ['audience-wishes', 'live-goal'],
  gifts: ['live-goal', 'gift-ranking'],
}

const intentPatterns: ReadonlyArray<{
  pattern: RegExp
  componentIds: readonly AtomicComponentId[]
}> = [
  { pattern: /暗|曝光|亮度|补光|色温|冷光|暖光/, componentIds: ['lighting'] },
  { pattern: /声音|音量|麦克风|话筒|噪声|降噪|听不清|音效/, componentIds: ['microphone'] },
  { pattern: /美颜|磨皮|美白|瘦脸|大眼|皮肤/, componentIds: ['beauty'] },
  { pattern: /美妆|妆容|口红|腮红|眼影|眼线|高光|气色/, componentIds: ['makeup'] },
  { pattern: /背景|虚化|抠图|布景|杂乱/, componentIds: ['background'] },
  { pattern: /特效|道具|贴纸|庆祝|星光|眼镜/, componentIds: ['effects'] },
  { pattern: /投票|选择题|二选一|让观众选/, componentIds: ['audience-poll'] },
  { pattern: /目标|冲刺|进度|里程碑/, componentIds: ['live-goal'] },
  { pattern: /心愿|点歌|想看|想听|收集诉求/, componentIds: ['audience-wishes'] },
  { pattern: /点赞榜|点赞排行|谁点赞/, componentIds: ['like-ranking'] },
  { pattern: /礼物榜|送礼榜|贡献榜|礼物排行/, componentIds: ['gift-ranking'] },
  { pattern: /装修|整套|模板|整体风格|一键布置/, componentIds: ['studio-template'] },
]

export function recallAtomicComponents(
  request: IntentRecallRequest,
  fewShots: readonly IntentFewShotExample[] = defaultIntentFewShots,
): IntentRecallResult {
  const scores = new Map<AtomicComponentId, number>()
  const matchedExamples: string[] = []
  const add = (id: AtomicComponentId, score: number) =>
    scores.set(id, Math.max(scores.get(id) ?? 0, score))

  request.signalIds?.forEach((signalId) => {
    signalComponents[signalId].forEach((id, index) => add(id, 0.96 - index * 0.04))
  })

  const normalized = normalize(request.text ?? '')
  if (normalized) {
    intentPatterns.forEach(({ pattern, componentIds }) => {
      if (!pattern.test(normalized)) return
      componentIds.forEach((id, index) => add(id, 0.92 - index * 0.04))
    })

    fewShots.forEach((example) => {
      const similarity = tokenSimilarity(normalized, normalize(example.input))
      if (similarity < 0.16) return
      matchedExamples.push(example.input)
      example.componentIds.forEach((id) => add(id, Math.min(0.95, 0.62 + similarity)))
    })
  }

  const componentIds = [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([id]) => id)

  return {
    componentIds,
    confidence: componentIds.length > 0
      ? Math.max(...componentIds.map((id) => scores.get(id) ?? 0))
      : 0,
    matchedExamples,
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

function tokenSimilarity(left: string, right: string): number {
  if (left.includes(right) || right.includes(left)) return 1
  const leftTokens = new Set([...left])
  const rightTokens = new Set([...right])
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union === 0 ? 0 : intersection / union
}

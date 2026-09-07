import type { LiveSignalId } from '../../capabilities/monitoring/liveDiagnostics'
import {
  audienceStrategies,
  getAudienceStrategy,
  type AudienceStrategyId,
} from '../../config/audienceComments'
import type { AtomicComponentId } from './types'

export type IntentSource = 'input' | 'comment' | 'monitor'

export interface IntentRecallRequest {
  source: IntentSource
  text?: string
  signalIds?: readonly LiveSignalId[]
  strategyId?: AudienceStrategyId
}

export interface IntentRecallResult {
  componentIds: AtomicComponentId[]
  confidence: number
  matchedExamples: string[]
}

export interface IntentFewShotExample {
  sceneId?: AudienceStrategyId
  sceneDescription?: string
  input: string
  aliases?: readonly string[]
  standardResponse?: string
  componentIds: readonly AtomicComponentId[]
}

/** 七个典型场景的 few-shot 训练样本，与场景配置保持同步。 */
export const scenarioIntentFewShots: readonly IntentFewShotExample[] =
  audienceStrategies.map((scenario) => ({
    sceneId: scenario.id,
    sceneDescription: scenario.description,
    input: scenario.intent.userUtterances[0],
    aliases: scenario.intent.userUtterances.slice(1),
    standardResponse: scenario.intent.standardResponse,
    componentIds: scenario.componentPriority,
  }))

export const defaultIntentFewShots = scenarioIntentFewShots

const signalComponents: Readonly<Record<LiveSignalId, readonly AtomicComponentId[]>> = {
  exposure: ['lighting'],
  'color-accuracy': ['color-adjustment'],
  'background-cleanliness': ['background'],
  contrast: ['color-adjustment', 'lighting'],
  framing: ['beauty', 'background'],
  fps: ['background', 'effects'],
  microphone: ['microphone'],
  comments: ['audience-wishes'],
  entrants: ['studio-template', 'beauty', 'makeup', 'effects', 'background'],
  retention: ['audience-wishes', 'live-goal'],
  gifts: ['live-goal'],
}

const intentPatterns: ReadonlyArray<{
  pattern: RegExp
  componentIds: readonly AtomicComponentId[]
}> = [
  { pattern: /暗|曝光|亮度|补光|冷光|暖光/, componentIds: ['lighting'] },
  { pattern: /偏色|白平衡|饱和度|颜色失真|色彩|色温|肤色发红|肤色发黄/, componentIds: ['color-adjustment'] },
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
  { pattern: /进房|新人|第一印象|首屏|直播间氛围/, componentIds: ['studio-template', 'beauty', 'makeup', 'effects', 'background'] },
]

export function recallAtomicComponents(
  request: IntentRecallRequest,
  fewShots: readonly IntentFewShotExample[] = defaultIntentFewShots,
): IntentRecallResult {
  const scores = new Map<AtomicComponentId, number>()
  const matchedExamples: string[] = []
  const add = (id: AtomicComponentId, score: number) =>
    scores.set(id, Math.max(scores.get(id) ?? 0, score))

  if (request.strategyId) {
    const strategy = getAudienceStrategy(request.strategyId)
    const primarySignalTriggered = request.signalIds?.includes(
      strategy.primarySignal,
    )
    if (primarySignalTriggered) {
      strategy.componentPriority.forEach((id, index) =>
        add(id, 1 - index * 0.01),
      )
      if (request.source === 'monitor') {
        return {
          componentIds: [...strategy.componentPriority],
          confidence: 1,
          matchedExamples: [],
        }
      }
    }
    if (
      request.source === 'monitor' &&
      request.strategyId !== 'normal' &&
      request.signalIds?.length &&
      !primarySignalTriggered
    ) {
      return {
        componentIds: [],
        confidence: 0,
        matchedExamples: [],
      }
    }
  }

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
      const candidateInputs = [example.input, ...(example.aliases ?? [])]
      const similarity = Math.max(...candidateInputs.map((input) =>
        tokenSimilarity(normalized, normalize(input)),
      ))
      if (similarity < 0.22) return
      matchedExamples.push(example.input)
      example.componentIds.forEach((id) => add(id, Math.min(0.95, 0.62 + similarity)))
    })
  }

  const componentIds = [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
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

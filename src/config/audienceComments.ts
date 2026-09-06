import type { StudioScene } from '../agent/widgets/widgetSpec'
import type { AudioSettings } from '../capabilities/audio/types'
import type { LiveSignalId } from '../capabilities/monitoring/liveDiagnostics'
import type { VisualSettings } from '../capabilities/visual/types'

export type AudienceStrategyId =
  | 'normal'
  | 'dim-light'
  | 'low-audio'
  | 'cold-interaction'
  | 'network-lag'
  | 'pk-push'

export interface AudienceStrategyDefinition {
  id: AudienceStrategyId
  label: string
  description: string
  scene: StudioScene
  visualSettings: VisualSettings
  audioSettings: AudioSettings
  diagnostics: {
    brightnessCeiling?: number
    microphoneCeiling?: number
    fps?: number
  }
  resolutionSignals: readonly LiveSignalId[]
  audienceMetrics: {
    commentsPerMinute: number
    entrantsLastMinute: number
    newViewerRetention: number
  }
}

/** 策略选择器展示的顺序、说明，以及对应的播前模拟参数。 */
export const audienceStrategies: readonly AudienceStrategyDefinition[] = [
  {
    id: 'normal',
    label: '正常模式',
    description: '使用自然评论与健康直播指标',
    scene: 'quality',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: {},
    resolutionSignals: [],
    audienceMetrics: {
      commentsPerMinute: 42,
      entrantsLastMinute: 38,
      newViewerRetention: 52,
    },
  },
  {
    id: 'dim-light',
    label: '画面偏暗',
    description: '播前压暗画面，开播后触发亮度反馈',
    scene: 'quality',
    visualSettings: { brightness: 0.68, contrast: 0.9, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: { brightnessCeiling: 32 },
    resolutionSignals: ['exposure', 'contrast', 'framing'],
    audienceMetrics: {
      commentsPerMinute: 36,
      entrantsLastMinute: 34,
      newViewerRetention: 44,
    },
  },
  {
    id: 'low-audio',
    label: '声音偏小',
    description: '播前降低麦克风增益，触发声音反馈',
    scene: 'troubleshoot',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: -12, backgroundMusicGainDb: 0 },
    diagnostics: { microphoneCeiling: 22 },
    resolutionSignals: ['microphone'],
    audienceMetrics: {
      commentsPerMinute: 34,
      entrantsLastMinute: 31,
      newViewerRetention: 39,
    },
  },
  {
    id: 'cold-interaction',
    label: '互动转冷',
    description: '降低评论密度与新观众留存',
    scene: 'interaction',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: {},
    resolutionSignals: ['comments', 'entrants', 'retention'],
    audienceMetrics: {
      commentsPerMinute: 14,
      entrantsLastMinute: 19,
      newViewerRetention: 22,
    },
  },
  {
    id: 'network-lag',
    label: '网络卡顿',
    description: '模拟帧率下降和观众卡顿反馈',
    scene: 'quality',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: { fps: 18 },
    resolutionSignals: ['fps'],
    audienceMetrics: {
      commentsPerMinute: 31,
      entrantsLastMinute: 31,
      newViewerRetention: 46,
    },
  },
  {
    id: 'pk-push',
    label: 'PK 冲刺',
    description: '开播后进入 PK，并生成助力评论',
    scene: 'pk',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: {},
    resolutionSignals: ['gifts'],
    audienceMetrics: {
      commentsPerMinute: 46,
      entrantsLastMinute: 41,
      newViewerRetention: 49,
    },
  },
] as const

/** 模拟评论使用的用户名池，按刷新序号循环取值。 */
export const audienceUserNames = [
  '甜甜圈',
  '小满同学',
  '阿福',
  '星河入梦',
  '柚子茶',
  '晚风',
  '橘子汽水',
  '听歌的人',
  '小宇同学',
  '月亮邮差',
] as const

/** 各策略的评论池；开播预热阶段始终读取 normal。 */
export const audienceCommentsByStrategy: Readonly<Record<AudienceStrategyId, readonly string[]>> = {
  normal: [
    '主播晚上好呀',
    '刚进来，今天准备唱什么歌？',
    '晚上好，先来打个卡',
    '今天的直播主题是什么？',
    '主播今天状态不错',
    '第一次进直播间，大家好',
    '可以点歌吗？',
    '今晚会播多久呀',
    '这个直播间氛围好舒服',
    '等一个开场曲',
    '下班了来听会儿歌',
    '主播能看到评论吗？',
    '今天有互动环节吗',
    '朋友推荐我来的',
    '先关注了，慢慢看',
    '大家想听甜歌还是炸场？',
  ],
  'dim-light': [
    '画面是不是有点暗？',
    '主播脸上光线不太够',
    '可以把灯打开一点吗',
    '背景都快看不清了',
    '画面再亮一点会更好看',
    '感觉镜头曝光有点低',
    '主播是不是没开补光灯',
    '脸部有点暗，看不太清',
    '能不能调高一点亮度',
    '画面暗暗的，是滤镜吗',
    '灯光再亮一点就完美了',
    '现在整体颜色有点沉',
    '右边的背景都黑掉了',
    '补一点正面光试试',
  ],
  'low-audio': [
    '声音有点小，听不太清',
    '主播麦克风是不是离得太远了',
    '可以把人声调大一点吗',
    '背景音乐比说话声大',
    '音量再提高一点点',
    '刚才那句话没听清',
    '麦克风声音忽大忽小',
    '大家听得到主播说话吗',
    '耳机开最大还是有点小',
    '主播检查一下麦克风',
    '人声可以再突出一些',
    '唱歌声音有点轻',
    'BGM 稍微压低一点会更好',
    '现在听起来有点远',
  ],
  'cold-interaction': [
    '主播看看评论呀',
    '今天没有互动环节吗',
    '可以聊聊今天的歌单吗',
    '新来的不知道怎么参与',
    '要不要开一个点歌投票',
    '大家都在潜水吗',
    '主播可以问大家一个问题',
    '想听歌但不知道怎么点',
    '来个简单的选择题吧',
    '评论区好安静',
    '可以和新观众打个招呼吗',
    '今天能不能让观众选歌',
    '主播多看看弹幕',
    '等一个互动小游戏',
  ],
  'network-lag': [
    '刚刚画面是不是卡了一下',
    '我这里一直在转圈',
    '声音和画面对不上了',
    '直播有一点延迟',
    '画面刚才停住了',
    '大家那里也卡吗',
    '清晰度降一点可能会流畅',
    '主播检查一下网络',
    '刚才断断续续的',
    '画面掉帧有点明显',
    '重新连接后还是有延迟',
    '声音正常但画面卡住了',
    '网络好像不太稳定',
    '现在比刚才流畅一点了',
  ],
  'pk-push': [
    'PK 加油，马上追上了',
    '还差一点，大家冲一冲',
    '目标快完成了',
    '给主播送个小心心',
    '守住这一轮优势',
    '对面分数追上来了',
    '最后一分钟一起加油',
    '主播唱一首拉拉票吧',
    '已经帮忙点亮了',
    '大家一起完成冲刺目标',
    '这轮一定要赢',
    '还差多少分呀',
    '新来的朋友一起助力',
    '倒计时快结束了',
  ],
}

/** 用户接纳 AI 建议后短暂展示的正向反馈评论池。 */
export const audienceRecoveryCommentsByStrategy: Readonly<
  Partial<Record<AudienceStrategyId, readonly string[]>>
> = {
  'dim-light': [
    '现在画面亮度可以了',
    '现在挺好的了',
    '这下看得很清楚',
    '补光之后自然多了',
    '现在人物和背景都能看清',
    '这个亮度刚刚好',
    '画面调整后舒服多了',
    '现在曝光正常了',
    '这样就很好看了',
    '灯光效果可以了',
  ],
  'low-audio': [
    '现在声音清楚了',
    '这个音量刚刚好',
    '现在能听清主播说话了',
    '人声比刚才清晰多了',
    '麦克风现在正常了',
    '这样听起来很舒服',
    '声音调整后好多了',
    '现在唱歌很清楚',
    '音量可以了',
    '这下不用开最大音量了',
  ],
  'cold-interaction': [
    '这个投票挺有意思',
    '我选甜歌',
    '已投票，等主播揭晓',
    '新来的也能马上参与',
    '互动起来就热闹多了',
    '主播终于看到评论啦',
    '这个问题很好选',
    '大家都开始投票了',
    '选项很清楚',
    '现在直播间气氛好多了',
  ],
  'network-lag': [
    '现在画面流畅了',
    '这次不卡了',
    '声音和画面对上了',
    '现在延迟正常了',
    '重新调整后清楚多了',
    '画面已经恢复正常',
    '我这里现在很流畅',
    '刚才的卡顿没有了',
    '现在观看体验挺好的',
    '网络状态可以了',
  ],
  'pk-push': [
    '目标组件看到了',
    '进度显示很清楚',
    '这样大家知道还差多少了',
    '已经帮主播助力',
    '目标快达成了',
    '冲刺提示很醒目',
    '大家一起完成目标',
    '现在 PK 氛围起来了',
    '进度条更新很及时',
    '最后一点一起冲',
  ],
}

export function getAudienceStrategy(
  strategyId: AudienceStrategyId,
): AudienceStrategyDefinition {
  return audienceStrategies.find(({ id }) => id === strategyId) ?? audienceStrategies[0]
}

export function doesSuggestionResolveStrategy(
  strategyId: AudienceStrategyId,
  signalId: LiveSignalId,
): boolean {
  return getAudienceStrategy(strategyId).resolutionSignals.includes(signalId)
}

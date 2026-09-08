import type { StudioScene } from '../agent/widgets/widgetSpec'
import type { AudioSettings } from '../capabilities/audio/types'
import type { LiveSignalId } from '../capabilities/monitoring/liveDiagnostics'
import type { VisualSettings } from '../capabilities/visual/types'
import type { AtomicComponentId } from '../components/atomic/types'

export type AudienceStrategyId =
  | 'normal'
  | 'dim-light'
  | 'color-cast'
  | 'cluttered-background'
  | 'low-audio'
  | 'cold-comments'
  | 'active-comments'
  | 'gift-drop'
  | 'entrant-drop'

export interface AudienceStrategyDefinition {
  id: AudienceStrategyId
  label: string
  description: string
  scene: StudioScene
  visualSettings: VisualSettings
  audioSettings: AudioSettings
  diagnostics: {
    brightnessCeiling?: number
    colorAccuracyCeiling?: number
    backgroundCleanlinessCeiling?: number
    microphoneCeiling?: number
    fps?: number
  }
  primarySignal: LiveSignalId
  monitoring: {
    metricLabel: string
    warningBelow: number
    criticalBelow: number
    simulatedValue: number
    unit: string
    triggerDirection?: 'below' | 'above'
  }
  componentPriority: readonly AtomicComponentId[]
  recommendation: string
  intent: {
    userUtterances: readonly string[]
    standardResponse: string
  }
  resolutionSignals: readonly LiveSignalId[]
  audienceMetrics: {
    commentsPerMinute: number
    entrantsLastMinute: number
    newViewerRetention: number
    giftLevel: 'normal' | 'reduced'
  }
}

export const normalAudienceStrategy: AudienceStrategyDefinition = {
  id: 'normal',
  label: '正常场景',
  description: '模拟自然进房、评论和送礼分布，并根据实时监控动态生成建议',
  scene: 'quality',
  visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
  audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
  diagnostics: {},
  primarySignal: 'exposure',
  monitoring: {
    metricLabel: '面部曝光',
    warningBelow: 55,
    criticalBelow: 35,
    simulatedValue: 72,
    unit: '/100',
  },
  componentPriority: [],
  recommendation: '当前直播状态稳定，继续保持现有设置即可。',
  intent: {
    userUtterances: [],
    standardResponse: '当前直播状态稳定，暂时不需要调整。',
  },
  resolutionSignals: [],
  audienceMetrics: {
    commentsPerMinute: 42,
    entrantsLastMinute: 38,
    newViewerRetention: 52,
    giftLevel: 'normal',
  },
}

/** 历史问题场景配置继续保留，用于兼容复盘与既有数据。 */
export const audienceStrategies: readonly AudienceStrategyDefinition[] = [
  {
    id: 'dim-light',
    label: '画面转暗',
    description: '环境光突然下降，面部阴影加深，服装与背景暗部细节连续丢失',
    scene: 'quality',
    visualSettings: { brightness: 0.62, contrast: 0.88, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: { brightnessCeiling: 26 },
    primarySignal: 'exposure',
    monitoring: {
      metricLabel: '面部曝光',
      warningBelow: 55,
      criticalBelow: 35,
      simulatedValue: 26,
      unit: '/100',
    },
    componentPriority: ['lighting'],
    recommendation: '当前面部亮度有些偏低，我可以先把画面提亮并保留肤色层次，应用后再帮你观察曝光变化。',
    intent: {
      userUtterances: [
        '画面突然暗下来了，帮我调亮一点',
        '主播脸上太暗了，把屏幕亮度提高',
        '暗部看不清，帮我恢复正常曝光',
      ],
      standardResponse: '检测到面部曝光低于 35/100，已优先召回亮度调节，建议先提升亮度并预览肤色细节。',
    },
    resolutionSignals: ['exposure'],
    audienceMetrics: {
      commentsPerMinute: 36,
      entrantsLastMinute: 34,
      newViewerRetention: 44,
      giftLevel: 'normal',
    },
  },
  {
    id: 'color-cast',
    label: '画面偏色',
    description: '白平衡持续偏暖，肤色发红，白色物体和服装颜色出现明显失真',
    scene: 'quality',
    visualSettings: { brightness: 0.96, contrast: 0.82, warmth: 0.58 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: { colorAccuracyCeiling: 31 },
    primarySignal: 'color-accuracy',
    monitoring: {
      metricLabel: '色彩还原度',
      warningBelow: 65,
      criticalBelow: 45,
      simulatedValue: 31,
      unit: '/100',
    },
    componentPriority: ['color-adjustment'],
    recommendation: '画面有些偏暖，我可以帮你校准白平衡和色彩强度，让肤色与背景颜色更自然。',
    intent: {
      userUtterances: [
        '画面颜色太红了，帮我调自然一点',
        '肤色看起来发黄，调一下画面色彩',
        '白平衡不对，帮我恢复真实颜色',
      ],
      standardResponse: '检测到色彩还原度低于 45/100，已优先召回色彩调节，建议校准白平衡并降低暖色偏移。',
    },
    resolutionSignals: ['color-accuracy'],
    audienceMetrics: {
      commentsPerMinute: 35,
      entrantsLastMinute: 33,
      newViewerRetention: 41,
      giftLevel: 'normal',
    },
  },
  {
    id: 'cluttered-background',
    label: '背景杂乱',
    description: '杂物、灯架和高对比物件进入镜头，背景抢占注意力并削弱人物主体',
    scene: 'quality',
    visualSettings: { brightness: 1, contrast: 0.94, warmth: 0.06 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: { backgroundCleanlinessCeiling: 28 },
    primarySignal: 'background-cleanliness',
    monitoring: {
      metricLabel: '背景整洁度',
      warningBelow: 60,
      criticalBelow: 40,
      simulatedValue: 28,
      unit: '/100',
    },
    componentPriority: ['background'],
    recommendation: '背景信息有些拥挤，我可以为你换上更干净的虚拟背景，让观众注意力回到主播身上。',
    intent: {
      userUtterances: [
        '后面太乱了，帮我换一个好看的背景',
        '把杂乱背景虚化一下',
        '想换一个更适合直播的虚拟背景',
      ],
      standardResponse: '检测到背景整洁度低于 40/100，已优先召回背景组件，建议使用虚化或美观的虚拟背景突出人物。',
    },
    resolutionSignals: ['background-cleanliness'],
    audienceMetrics: {
      commentsPerMinute: 33,
      entrantsLastMinute: 31,
      newViewerRetention: 38,
      giftLevel: 'normal',
    },
  },
  {
    id: 'low-audio',
    label: '声音偏小',
    description: '人声峰值持续偏低，语句尾音难以听清，背景音乐开始掩盖主播声音',
    scene: 'troubleshoot',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: -12, backgroundMusicGainDb: 0 },
    diagnostics: { microphoneCeiling: 22 },
    primarySignal: 'microphone',
    monitoring: {
      metricLabel: '人声清晰度',
      warningBelow: 45,
      criticalBelow: 28,
      simulatedValue: 22,
      unit: '/100',
    },
    componentPriority: ['microphone'],
    recommendation: '观众听人声有些吃力，我可以适当提高麦克风增益并压低背景音乐，让声音更清楚。',
    intent: {
      userUtterances: [
        '主播声音太小了，调大麦克风',
        '人声听不清，帮我提高音量',
        '背景音乐盖住说话声了',
      ],
      standardResponse: '检测到人声清晰度低于 28/100，已优先召回麦克风，建议提高人声增益并适当降低背景音乐。',
    },
    resolutionSignals: ['microphone'],
    audienceMetrics: {
      commentsPerMinute: 34,
      entrantsLastMinute: 31,
      newViewerRetention: 39,
      giftLevel: 'normal',
    },
  },
  {
    id: 'cold-comments',
    label: '评论区转冷',
    description: '连续一分钟评论频率下滑，观众以围观为主，点歌和主动提问明显减少',
    scene: 'interaction',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: {},
    primarySignal: 'comments',
    monitoring: {
      metricLabel: '每分钟评论数',
      warningBelow: 25,
      criticalBelow: 16,
      simulatedValue: 14,
      unit: '/min',
    },
    componentPriority: ['speaking-suggestion'],
    recommendation: '评论区有点安静，可以用一句低门槛口播主动抛出话题，引导观众用简单答案重新参与。',
    intent: {
      userUtterances: [
        '评论区太安静了，帮我活跃一下',
        '生成一句自然的口播话术',
        '大家都不说话，想增加互动',
      ],
      standardResponse: '检测到评论量低于 16 条/分钟，已生成口播建议，帮助主播用低门槛问题重新带动评论。',
    },
    resolutionSignals: ['comments'],
    audienceMetrics: {
      commentsPerMinute: 14,
      entrantsLastMinute: 32,
      newViewerRetention: 36,
      giftLevel: 'normal',
    },
  },
  {
    id: 'gift-drop',
    label: '送礼减少',
    description: '近一分钟礼物次数和贡献值同步回落，观众缺少清晰可见的助力目标',
    scene: 'interaction',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: {},
    primarySignal: 'gifts',
    monitoring: {
      metricLabel: '近一分钟礼物数',
      warningBelow: 10,
      criticalBelow: 4,
      simulatedValue: 1,
      unit: '/min',
    },
    componentPriority: ['live-goal'],
    recommendation: '本轮送礼节奏放缓了，可以设置一个轻量 LIVE goal，让观众清楚看到目标和当前进度。',
    intent: {
      userUtterances: [
        '最近礼物少了，帮我设置一个目标',
        '加一个 live goal 带动大家助力',
        '想展示本轮礼物目标和进度',
      ],
      standardResponse: '检测到礼物数低于 4 个/分钟，已优先召回 LIVE goal，建议设置清晰、可达成的阶段目标。',
    },
    resolutionSignals: ['gifts'],
    audienceMetrics: {
      commentsPerMinute: 38,
      entrantsLastMinute: 35,
      newViewerRetention: 48,
      giftLevel: 'reduced',
    },
  },
  {
    id: 'entrant-drop',
    label: '进房人数减少',
    description: '近一分钟进房人数快速回落，新观众停留时间缩短，直播间第一眼吸引力不足',
    scene: 'interaction',
    visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
    audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
    diagnostics: {},
    primarySignal: 'entrants',
    monitoring: {
      metricLabel: '近一分钟进房人数',
      warningBelow: 24,
      criticalBelow: 12,
      simulatedValue: 8,
      unit: '/min',
    },
    componentPriority: [
      'studio-template',
      'beauty',
      'makeup',
      'effects',
      'background',
    ],
    recommendation: '新观众进房速度在下降，建议先用装修模板统一氛围，再搭配美颜、美妆、特效和背景提升首屏吸引力。',
    intent: {
      userUtterances: [
        '最近进房人数少了，帮我优化直播间氛围',
        '新观众留不住，整体装修好看一点',
        '想用美颜美妆特效和背景提升第一印象',
      ],
      standardResponse: '检测到近一分钟进房低于 12 人，已按优先级召回装修模板、美颜、美妆、特效和背景，建议先统一整体风格再细调人物与氛围。',
    },
    resolutionSignals: ['entrants'],
    audienceMetrics: {
      commentsPerMinute: 28,
      entrantsLastMinute: 8,
      newViewerRetention: 27,
      giftLevel: 'normal',
    },
  },
] as const

export const activeCommentsStrategy: AudienceStrategyDefinition = {
  id: 'active-comments',
  label: '评论区活跃',
  description: '评论频率持续走高，观众主动点歌、提问和互动，适合进一步承接参与热度',
  scene: 'interaction',
  visualSettings: { brightness: 1, contrast: 1, warmth: 0 },
  audioSettings: { microphoneGainDb: 0, backgroundMusicGainDb: 0 },
  diagnostics: {},
  primarySignal: 'comments',
  monitoring: {
    metricLabel: '每分钟评论数',
    warningBelow: 60,
    criticalBelow: 75,
    simulatedValue: 82,
    unit: '/min',
    triggerDirection: 'above',
  },
  componentPriority: ['audience-wishes'],
  recommendation: '评论区互动正在升温，可以展示观众心愿，集中承接大家想听、想看和想参与的内容。',
  intent: {
    userUtterances: [
      '评论区现在很活跃，帮我接住互动',
      '大家都在点歌，展示一下观众心愿',
      '评论很多，帮我整理观众想看的内容',
    ],
    standardResponse: '检测到评论量高于 75 条/分钟，已优先召回观众心愿，用集中展示承接当前互动热度。',
  },
  resolutionSignals: ['comments'],
  audienceMetrics: {
    commentsPerMinute: 82,
    entrantsLastMinute: 48,
    newViewerRetention: 64,
    giftLevel: 'normal',
  },
}

/** 直播中场景菜单保留正常场景，并展示四个指定演示场景。 */
export const audienceSceneOptions: readonly AudienceStrategyDefinition[] = [
  normalAudienceStrategy,
  audienceStrategies.find(({ id }) => id === 'dim-light')!,
  audienceStrategies.find(({ id }) => id === 'low-audio')!,
  audienceStrategies.find(({ id }) => id === 'cold-comments')!,
  activeCommentsStrategy,
]

const allAudienceStrategies: readonly AudienceStrategyDefinition[] = [
  normalAudienceStrategy,
  ...audienceStrategies,
  activeCommentsStrategy,
]

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
    '主播声音好像有点小',
    '刚才那句话没听清',
    '麦克风音量可以再大一点',
    '人声听起来有点远',
    '背景音乐快盖住声音了',
    '声音忽大忽小的',
    '耳机开最大还是听不清',
    '麦克风是不是离得太远',
    '人声可以再突出一点',
    '主播检查一下音量',
    '说话声音有点轻',
    '现在声音不太清楚',
    '主播脸上的画面有点暗',
    '画面亮度可以提高一点',
    '背景看起来有点暗',
    '画面是不是欠曝了',
    '脸部看不太清楚',
    '镜头画面颜色有点沉',
    '画面再亮一点会更好',
    '背景和人物不太分明',
    '画面细节有点看不清',
    '补一点正面光试试',
    '直播画面突然变暗了',
    '整体画面有点灰',
    '直播刚才有点卡',
    '延迟好像变高了',
    '弹幕显示有点延迟',
    '直播一直卡顿',
    '刚才是不是掉线了',
    '声音断断续续有点卡',
    '互动响应有点延迟',
    '直播卡住了几秒',
    '现在延迟还是很明显',
    '刚刚又卡了一下',
    '网络是不是不太稳定',
    '直播有点卡，检查一下',
    '下一首可以唱甜歌吗',
    '想听一首轻快的歌',
    '可以开放点歌吗',
    '今晚准备唱哪些歌',
    '大家想听经典老歌',
    '下一段想听主播聊天',
    '想听刚才提到的那首歌',
    '可以唱一首节奏快的吗',
    '点歌什么时候开始',
    '想听主播的拿手歌',
    '下一首歌让大家选吧',
    '今天会唱到几点',
    '今天有礼物目标吗',
    '礼物助力还差多少',
    '可以展示送礼榜单吗',
    '想看看今天的贡献榜',
    '送什么礼物可以助力',
    '礼物进度在哪里看',
    '大家一起帮主播助力',
    '贡献榜现在谁是第一',
    '可以设置一个礼物目标',
    '今天的礼物榜好热闹',
    '助力完成会有加唱吗',
    '想看看本轮礼物进度',
    '主播今天状态很好',
    '这个直播间氛围很舒服',
    '画面和声音都很清楚',
    '这首歌真好听',
    '很喜欢今天的内容',
    '直播现在很流畅',
    '主播加油',
    '这个环节很好看',
    '刚进来感觉很舒服',
    '现在效果刚刚好',
    '朋友推荐我来的',
    '先关注了慢慢看',
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
  'color-cast': [
    '画面颜色是不是有点偏红？',
    '主播肤色看起来太暖了',
    '白色背景都变成黄色了',
    '色温好像调得有点高',
    '镜头有明显的红色偏色',
    '可以把白平衡恢复一下吗',
    '今天画面颜色不太自然',
    '肤色看起来有点失真',
    '画面饱和度是不是太高了',
    '冷暖色再平衡一点会更好',
    '主播衣服颜色和刚才不一样',
    '背景的白色不够干净',
  ],
  'cluttered-background': [
    '后面的东西有点多',
    '背景太乱了有点抢镜',
    '可以把背景虚化一点吗',
    '主播和背景快融在一起了',
    '后面的杂物有点影响观看',
    '换个干净的虚拟背景吧',
    '背景层次太多看着有点累',
    '人物主体不够突出',
    '可以收拾一下镜头后面吗',
    '背景虚化后应该会更清楚',
    '后面的灯和架子太显眼了',
    '镜头里东西有点拥挤',
  ],
  'cold-comments': [
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
  'active-comments': [
    '我想听一首轻快的歌',
    '主播看看我的心愿',
    '下一首可以唱甜歌吗',
    '今天能不能多聊一会儿',
    '想看主播挑战高音',
    '大家都在点歌好热闹',
    '可以把我们的心愿展示出来吗',
    '我也来许一个愿',
    '下一段想听经典老歌',
    '评论区刷得好快',
    '主播快看大家想听的歌',
    '想看一个即兴互动',
    '今晚的气氛太好了',
    '再来一首不要停',
  ],
  'gift-drop': [
    '今天还没有礼物目标吗',
    '可以设置一个小目标',
    '完成目标会有加唱吗',
    '礼物进度在哪里看呀',
    '主播可以说一下本轮目标',
    '大家今天都在安静听歌',
    '加一个礼物里程碑吧',
    '达到目标可以点歌吗',
    '送什么礼物能触发特效',
    '想助力但不知道差多少',
    '可以展示贡献榜吗',
    '这一轮送礼好像少了',
  ],
  'entrant-drop': [
    '刚刷到直播间，今天播什么',
    '新来的朋友怎么参与呀',
    '主播可以介绍一下主题吗',
    '第一次进来先听一会儿',
    '封面写的内容什么时候开始',
    '可以欢迎一下刚进来的朋友吗',
    '新观众有点跟不上节奏',
    '刚进来不知道前面聊了什么',
    '今天直播间人好像少了一点',
    '可以做个新人签到吗',
    '刚进来的先打个招呼',
    '主播介绍一下接下来的安排吧',
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
  'color-cast': [
    '现在颜色自然多了',
    '肤色恢复正常了',
    '白平衡调好后很舒服',
    '现在白色背景很干净',
    '偏红的问题解决了',
    '这个色温刚刚好',
    '画面颜色准确多了',
    '现在衣服颜色正常了',
  ],
  'cluttered-background': [
    '背景虚化后主体很清楚',
    '现在背景干净多了',
    '这个虚拟背景很合适',
    '人物终于突出出来了',
    '整理后看着舒服多了',
    '背景层次现在刚刚好',
    '这样注意力都在主播身上',
    '镜头画面清爽多了',
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
  'cold-comments': [
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
  'active-comments': [
    '看到我的心愿了',
    '大家想听的内容都展示出来了',
    '这个心愿墙很方便',
    '主播快选一个实现吧',
    '互动接得很及时',
    '评论区更有参与感了',
    '已经提交我的心愿',
    '大家继续许愿',
  ],
  'gift-drop': [
    '礼物目标看到了',
    '现在知道还差多少了',
    '已经给主播助力',
    '这个阶段目标很清楚',
    '贡献榜展示得很直观',
    '达到目标记得加唱',
    '送礼特效很有氛围',
    '大家一起完成这一轮',
  ],
  'entrant-drop': [
    '新人签到完成',
    '现在知道直播主题了',
    '欢迎提示很清楚',
    '刚进来就能参与投票',
    '这个开场介绍很有用',
    '已经关注准备慢慢看',
    '新观众也跟上节奏了',
    '进来就有互动很友好',
  ],
}

export function getAudienceStrategy(
  strategyId: AudienceStrategyId,
): AudienceStrategyDefinition {
  return allAudienceStrategies.find(({ id }) => id === strategyId)
    ?? normalAudienceStrategy
}

export function doesSuggestionResolveStrategy(
  strategyId: AudienceStrategyId,
  signalId: LiveSignalId,
): boolean {
  return getAudienceStrategy(strategyId).resolutionSignals.includes(signalId)
}

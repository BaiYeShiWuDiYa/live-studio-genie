export const studioRuntimeConfig = {
  audience: {
    /** 直播间 Mock 数据刷新周期，单位为毫秒。 */
    refreshIntervalMs: 1000,
    /** 评论生成的最短间隔，避免活跃场景出现不可读的高速刷屏。 */
    minimumCommentIntervalMs: 550,
    /** 评论生成的最长间隔，避免转冷场景长时间没有演示反馈。 */
    maximumCommentIntervalMs: 4_500,
    /** 评论间隔的确定性波动系数，使 Mock 节奏更接近真实直播间。 */
    commentIntervalJitter: [0.88, 1.08, 0.96, 1.14, 0.92] as const,
    /** 开播后保持正常评论的预热时长，单位为毫秒。 */
    strategyWarmupDurationMs: 15_000,
    /** 接纳策略建议后展示正向反馈评论的时长，单位为毫秒。 */
    strategyRecoveryDurationMs: 10_000,
    /** 左侧实时评论区每次保留的评论数量。 */
    visibleCommentCount: 12,
    /** 第二条礼物记录相对当前时刻的时间偏移，单位为毫秒。 */
    previousGiftOffsetMs: 60_000,
    /** 最新一条玫瑰礼物的基础数量。 */
    recentGiftBaseCount: 6,
    /** 最新一条玫瑰礼物数量的循环变化范围。 */
    recentGiftVariationRange: 3,
    /** 较早一条爱心礼物的固定数量。 */
    previousGiftCount: 10,
    /** Mock 在线观众数的初始值。 */
    initialViewerCount: 1_286,
    /** 每次刷新增加的 Mock 在线观众数。 */
    viewerGrowthPerTick: 3,
  },
  suggestion: {
    /** 正常模式检查监控、评论和画面变化的周期，单位为毫秒。 */
    normalDetectionIntervalMs: 5_000,
    /** 右侧 Genie 建议队列同步周期，单位为毫秒。 */
    syncIntervalMs: 60_000,
    /** 指标趋势变化达到该值时触发即时更新。 */
    metricTrendDeltaThreshold: 8,
    /** 指标更新后的最短冷却时间，避免右栏频繁抖动。 */
    metricUpdateCooldownMs: 5_000,
    /** 评论变化后的分析延迟，保证在三秒响应要求内完成聚合。 */
    commentAnalysisDelayMs: 1_200,
    /** 同类评论洞察再次触发的最短间隔。 */
    commentCategoryCooldownMs: 8_000,
    /** 停止输入后自动恢复建议视图的等待时间。 */
    inputModeIdleMs: 1_800,
  },
  mediaMonitoring: {
    /** 摄像头亮度采样周期，单位为毫秒。 */
    brightnessSampleIntervalMs: 900,
    /** 麦克风电平采样周期，单位为毫秒。 */
    microphoneSampleIntervalMs: 250,
  },
  monitoringDisplay: {
    /** 左侧实时监控标签刷新周期，单位为毫秒。 */
    refreshIntervalMs: 10_000,
  },
  cameraEffects: {
    /** 人像分割推理的最小时间间隔，单位为毫秒。 */
    segmentationIntervalMs: 90,
    /** 人脸关键点推理的最小时间间隔，单位为毫秒。 */
    faceLandmarkIntervalMs: 120,
    /** 人像构图指标发布周期，单位为毫秒。 */
    framingMetricIntervalMs: 600,
  },
  poll: {
    /** 互动投票倒计时刷新周期，单位为毫秒。 */
    countdownIntervalMs: 1_000,
  },
  liveGoal: {
    /** LIVE Goal 自动增长周期，单位为毫秒。 */
    autoAdvanceIntervalMs: 3_000,
    /** LIVE Goal 每次自动增长的分值。 */
    autoAdvanceAmount: 120,
    /** 点击模拟礼物时增加的 LIVE Goal 分值。 */
    manualGiftAmount: 250,
  },
  backgroundMusic: {
    /** 本地 BGM 的基础输出增益，避免默认音量过大。 */
    baseOutputGain: 0.08,
    /** 本地 BGM 和弦切换周期，单位为毫秒。 */
    chordDurationMs: 1_800,
  },
} as const

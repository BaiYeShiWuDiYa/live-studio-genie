export const studioRuntimeConfig = {
  audience: {
    /** 直播间 Mock 数据刷新周期，单位为毫秒。 */
    refreshIntervalMs: 3_500,
    /** 左侧实时评论区每次保留的评论数量。 */
    visibleCommentCount: 7,
    /** 相邻历史评论的模拟时间间隔，单位为毫秒。 */
    commentHistorySpacingMs: 8_000,
    /** 第二条礼物记录相对当前时刻的时间偏移，单位为毫秒。 */
    previousGiftOffsetMs: 60_000,
    /** Mock 在线观众数的初始值。 */
    initialViewerCount: 1_286,
    /** 每次刷新增加的 Mock 在线观众数。 */
    viewerGrowthPerTick: 3,
    /** 近一分钟进房人数的基础值。 */
    entrantCountBase: 24,
    /** 近一分钟进房人数每次刷新的变化步长。 */
    entrantCountStep: 7,
    /** 近一分钟进房人数循环变化的取模范围。 */
    entrantCountRange: 23,
    /** 每分钟评论数的基础值。 */
    commentRateBase: 18,
    /** 每分钟评论数每次刷新的变化步长。 */
    commentRateStep: 5,
    /** 每分钟评论数循环变化的取模范围。 */
    commentRateRange: 31,
    /** 新观众留存率的基础百分比。 */
    retentionBase: 36,
    /** 新观众留存率每次刷新的变化步长。 */
    retentionStep: 6,
    /** 新观众留存率循环变化的取模范围。 */
    retentionRange: 29,
    /** 实时诊断中每个模拟场景持续的刷新次数。 */
    realtimePhaseDurationTicks: 2,
  },
  suggestion: {
    /** 右侧 Genie 建议队列同步周期，单位为毫秒。 */
    syncIntervalMs: 60_000,
  },
  mediaMonitoring: {
    /** 摄像头亮度采样周期，单位为毫秒。 */
    brightnessSampleIntervalMs: 900,
    /** 麦克风电平采样周期，单位为毫秒。 */
    microphoneSampleIntervalMs: 250,
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

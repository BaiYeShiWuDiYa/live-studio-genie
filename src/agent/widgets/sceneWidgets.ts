import { widgetSpecSchema, type StudioScene, type WidgetSpec } from './widgetSpec'
import { recommendedCameraEffects } from '../../capabilities/video/cameraEffects'

const sceneWidgets: Record<StudioScene, WidgetSpec> = {
  quality: {
    version: '1.0',
    type: 'visual-adjustment',
    title: '曝光与背景',
    detail: '人脸亮度低于背景 32% · 持续 10 秒',
    actionLabel: '确认应用',
    props: {
      settings: {
        brightness: 1.32,
        contrast: 1.08,
        warmth: 0.18,
      },
    },
  },
  interaction: {
    version: '1.0',
    type: 'audience-poll',
    title: '发起观众心愿',
    detail: '评论密度持续走低，建议发起轻互动。',
    actionLabel: '发布心愿',
    props: {
      question: '下一首唱什么？',
      options: ['甜歌', '炸场'],
      durationSeconds: 45,
    },
  },
  troubleshoot: {
    version: '1.0',
    type: 'audio-adjustment',
    title: '麦克风增益',
    detail: '声音偏小，滋滋声正常',
    actionLabel: '应用',
    props: {
      microphoneGain: 8,
      backgroundMusicGain: -5,
    },
  },
  pk: {
    version: '1.0',
    type: 'live-goal',
    title: 'PK 进入关键拉票阶段',
    detail: '距离对手 1,260 分，建议用目标挂件聚焦观众行动。',
    actionLabel: '发起冲刺目标',
    props: {
      label: '本轮冲刺目标',
      current: 8740,
      target: 10000,
      supporters: 38,
    },
  },
}

export function getSceneWidgetSpec(scene: StudioScene): WidgetSpec {
  return widgetSpecSchema.parse(sceneWidgets[scene])
}

export function getCameraEffectsWidgetSpec(): WidgetSpec {
  return widgetSpecSchema.parse({
    version: '1.0',
    type: 'camera-effects',
    title: '让人物更自然，背景更干净',
    detail: '使用本地人像分割与轻量美化处理，不上传摄像头画面。',
    actionLabel: '应用美化方案',
    props: {
      settings: recommendedCameraEffects,
    },
  })
}

const pollAlternatives = [
  {
    title: '今晚内容投票',
    detail: '让刚进入直播间的观众快速选择今晚最想看的内容。',
    actionLabel: '发布投票',
    props: {
      question: '今晚先来点什么？',
      options: ['先唱歌', '先聊天', '开放点歌'],
      durationSeconds: 45,
    },
  },
  {
    title: '下一首风格投票',
    detail: '用低门槛选项承接当前评论，提高观众参与密度。',
    actionLabel: '发布投票',
    props: {
      question: '下一首想听哪种风格？',
      options: ['治愈慢歌', '热血快歌', '经典老歌'],
      durationSeconds: 60,
    },
  },
  {
    title: '直播互动方式投票',
    detail: '让观众决定下一段直播节奏，减少冷场。',
    actionLabel: '发布投票',
    props: {
      question: '接下来想看什么互动？',
      options: ['点歌', '问答', '小游戏'],
      durationSeconds: 45,
    },
  },
] as const

function nextIndex(currentIndex: number, length: number): number {
  return currentIndex < 0 ? 0 : (currentIndex + 1) % length
}

export function getAlternativeWidgetSpec(spec: WidgetSpec): WidgetSpec {
  if (spec.type === 'audience-poll') {
    const currentIndex = pollAlternatives.findIndex(
      (alternative) => alternative.props.question === spec.props.question,
    )
    const alternative = pollAlternatives[
      nextIndex(currentIndex, pollAlternatives.length)
    ]
    return widgetSpecSchema.parse({
      version: '1.0',
      type: 'audience-poll',
      ...alternative,
    })
  }

  if (spec.type === 'visual-adjustment') {
    const alternatives = [
      {
        title: '柔和提亮画面',
        detail: '降低对比度并适度提亮，保留面部细节。',
        settings: { brightness: 1.18, contrast: 0.96, warmth: 0.12 },
      },
      {
        title: '增强主体层次',
        detail: '提高亮度与对比度，让人物从背景中更清晰地分离。',
        settings: { brightness: 1.3, contrast: 1.12, warmth: 0.08 },
      },
      {
        title: '平衡暖色氛围',
        detail: '轻微提亮并增加暖色，改善偏冷的直播画面。',
        settings: { brightness: 1.12, contrast: 1.04, warmth: 0.24 },
      },
    ] as const
    const currentIndex = alternatives.findIndex(
      (alternative) =>
        alternative.settings.brightness === spec.props.settings.brightness &&
        alternative.settings.contrast === spec.props.settings.contrast &&
        alternative.settings.warmth === spec.props.settings.warmth,
    )
    const alternative = alternatives[
      nextIndex(currentIndex, alternatives.length)
    ]
    return widgetSpecSchema.parse({
      version: '1.0',
      type: 'visual-adjustment',
      title: alternative.title,
      detail: alternative.detail,
      actionLabel: '确认应用',
      props: { settings: alternative.settings },
    })
  }

  if (spec.type === 'audio-adjustment') {
    const microphoneGain = spec.props.microphoneGain >= 8 ? 5 : 8
    const backgroundMusicGain = microphoneGain === 8 ? -5 : -3
    return widgetSpecSchema.parse({
      ...spec,
      title: microphoneGain === 8 ? '突出主播人声' : '平衡人声与伴奏',
      detail: microphoneGain === 8
        ? '提高麦克风增益并压低背景音乐，让讲话更清楚。'
        : '适度提升人声，同时保留背景音乐的现场氛围。',
      props: { microphoneGain, backgroundMusicGain },
    })
  }

  if (spec.type === 'live-goal') {
    const alternatives = [
      { label: '本轮点赞目标', target: 12000 },
      { label: '新增关注目标', target: 500 },
      { label: '本场互动目标', target: 20000 },
    ] as const
    const currentIndex = alternatives.findIndex(
      (alternative) => alternative.label === spec.props.label,
    )
    const alternative = alternatives[
      nextIndex(currentIndex, alternatives.length)
    ]
    return widgetSpecSchema.parse({
      ...spec,
      title: alternative.label,
      detail: '用清晰的阶段目标引导观众立即参与。',
      props: {
        label: alternative.label,
        current: 0,
        target: alternative.target,
        supporters: 0,
      },
    })
  }

  const faceEffects = ['sparkles', 'glasses', 'heart-sticker'] as const
  const currentIndex = faceEffects.indexOf(
    spec.props.settings.faceEffect as typeof faceEffects[number],
  )
  const faceEffect = faceEffects[nextIndex(currentIndex, faceEffects.length)]
  const labels = {
    sparkles: '星光氛围方案',
    glasses: '趣味眼镜方案',
    'heart-sticker': '爱心互动方案',
  }
  return widgetSpecSchema.parse({
    ...spec,
    title: labels[faceEffect],
    detail: '保留当前美化参数，并切换一套新的互动道具方案。',
    props: {
      settings: {
        ...spec.props.settings,
        faceEffect,
      },
    },
  })
}

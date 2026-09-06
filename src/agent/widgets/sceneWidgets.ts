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

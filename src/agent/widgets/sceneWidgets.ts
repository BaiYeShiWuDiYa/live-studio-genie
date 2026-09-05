import { widgetSpecSchema, type StudioScene, type WidgetSpec } from './widgetSpec'
import { recommendedCameraEffects } from '../../capabilities/video/cameraEffects'

const sceneWidgets: Record<StudioScene, WidgetSpec> = {
  quality: {
    version: '1.0',
    type: 'visual-adjustment',
    title: '画面偏暗，氛围可以更有记忆点',
    detail: '检测到亮度低于建议区间，背景层次不足。',
    actionLabel: '应用柔光方案',
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
    title: '互动节奏正在放缓',
    detail: '评论密度连续 57 秒低于平均值，建议发起轻互动。',
    actionLabel: '发布互动挂件',
    props: {
      question: '下一首唱什么？',
      options: ['甜歌', '炸场'],
      durationSeconds: 45,
    },
  },
  troubleshoot: {
    version: '1.0',
    type: 'audio-adjustment',
    title: '“声音小”反馈正在增加',
    detail: '6 条评论提到音量问题，麦克风峰值低于建议区间。',
    actionLabel: '确认音频调整',
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

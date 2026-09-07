import { lazy, type ComponentType } from 'react'
import type {
  AtomicComponentDefinition,
  AtomicComponentId,
  AtomicPanelProps,
} from './types'

const loadBasic = () => import('./panels/BasicPanels')
const loadInteractive = () => import('./panels/InteractivePanels')
const loadTemplate = () => import('./panels/TemplatePanel')

export const atomicComponentRegistry: Readonly<Record<AtomicComponentId, AtomicComponentDefinition>> = {
  lighting: definition('lighting', '补光', '亮度、色温与补光模式', 'basic', ['曝光', '偏暗', '亮度'], loadBasic, 'LightingPanel'),
  microphone: definition('microphone', '麦克风', '音量、降噪、音效与测试', 'basic', ['声音', '麦克风', '噪声'], loadBasic, 'MicrophonePanel'),
  beauty: definition('beauty', '美颜', '磨皮、美白、瘦脸与预设', 'basic', ['人脸', '肤色', '美颜'], loadBasic, 'BeautyPanel'),
  makeup: definition('makeup', '美妆', '虚拟妆容与局部精细控制', 'basic', ['妆容', '口红', '气色'], loadBasic, 'MakeupPanel'),
  background: definition('background', '背景', '虚化、虚拟背景与上传', 'basic', ['背景', '杂乱', '场景'], loadBasic, 'BackgroundPanel'),
  effects: definition('effects', '特效', '动态特效、强度与触发方式', 'basic', ['氛围', '特效', '庆祝'], loadBasic, 'EffectsPanel'),
  'audience-poll': definition('audience-poll', '观众投票', '创建选项并查看实时结果', 'interaction', ['评论', '互动', '投票'], loadInteractive, 'PollPanel'),
  'live-goal': definition('live-goal', 'LIVE goal', '设定目标并展示达成进度', 'interaction', ['目标', '点赞', '冲刺'], loadInteractive, 'GoalPanel'),
  'audience-wishes': definition('audience-wishes', '观众心愿', '收集、展示和管理心愿', 'interaction', ['点播', '想看', '心愿'], loadInteractive, 'WishesPanel'),
  'like-ranking': definition('like-ranking', '点赞榜单', '按时间查看点赞排名变化', 'interaction', ['点赞', '榜单', '互动'], loadInteractive, 'LikeRankingPanel'),
  'gift-ranking': definition('gift-ranking', '送礼榜单', '按类型查看礼物价值排名', 'interaction', ['礼物', '贡献', '榜单'], loadInteractive, 'GiftRankingPanel'),
  'studio-template': definition('studio-template', '装修模板', '保存、加载和切换整套配置', 'overall', ['装修', '模板', '布局'], loadTemplate, 'TemplatePanel'),
}

function definition(
  id: AtomicComponentId,
  name: string,
  description: string,
  category: AtomicComponentDefinition['category'],
  keywords: readonly string[],
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
): AtomicComponentDefinition {
  return {
    id,
    name,
    description,
    category,
    keywords,
    preload: loader,
    component: lazy(async () => {
      const module = await loader()
      return { default: module[exportName] as ComponentType<AtomicPanelProps> }
    }),
  }
}

export const allAtomicComponentIds = Object.keys(atomicComponentRegistry) as AtomicComponentId[]

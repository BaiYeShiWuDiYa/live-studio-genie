import { z } from 'zod'
import { audioSettingsSchema, type AudioSettings } from '../../capabilities/audio/types'
import { visualSettingsSchema, type VisualSettings } from '../../capabilities/visual/types'
import {
  cameraEffectsSchema,
  getEnabledMakeupCount,
  type CameraEffects,
} from '../../capabilities/video/cameraEffects'
import { liveGoalConfigSchema, type LiveGoalConfig } from '../../capabilities/widgets/liveGoal'
import { pollConfigSchema, type PollConfig } from '../../capabilities/widgets/poll'
import { defineTool, ToolRegistry } from './toolRegistry'

export interface StudioToolContext {
  previewAudioSettings: (settings: AudioSettings) => void
  applyAudioSettings: (settings: AudioSettings) => void
  resetAudioPreview: () => void
  undoAudioSettings: () => void
  previewPoll: (config: PollConfig) => void
  publishPoll: (config: PollConfig) => void
  resetPollPreview: () => void
  undoPoll: () => void
  previewLiveGoal: (config: LiveGoalConfig) => void
  publishLiveGoal: (config: LiveGoalConfig) => void
  resetLiveGoalPreview: () => void
  undoLiveGoal: () => void
  previewVisualSettings: (settings: VisualSettings) => void
  applyVisualSettings: (settings: VisualSettings) => void
  resetVisualPreview: () => void
  undoVisualSettings: () => void
  previewCameraEffects: (settings: CameraEffects) => void
  applyCameraEffects: (settings: CameraEffects) => void
  resetCameraEffectsPreview: () => void
  undoCameraEffects: () => void
}

const visualInputSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  settings: visualSettingsSchema,
})

const audioInputSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  settings: audioSettingsSchema,
})

const pollInputSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  config: pollConfigSchema,
})

const liveGoalInputSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  config: liveGoalConfigSchema,
})

const cameraEffectsInputSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  settings: cameraEffectsSchema,
})

export const studioToolRegistry = new ToolRegistry<StudioToolContext>()
  .register(defineTool({
    name: 'studio.adjust_camera_effects',
    description: '预览或应用基础美颜和虚拟背景。',
    inputSchema: cameraEffectsInputSchema,
    requiresConfirmation: true,
    execute: ({ mode, settings }, context) => {
      if (mode === 'preview') {
        context.previewCameraEffects(settings)
      } else {
        context.applyCameraEffects(settings)
      }

      const backgroundLabel = {
        none: '原始背景',
        blur: '背景虚化',
        color: '纯色背景',
        image: '图片背景',
      }[settings.backgroundMode]
      const faceEffectLabel = {
        none: '无贴纸',
        sparkles: '星光',
        glasses: '科技眼镜',
        'heart-sticker': '爱心贴纸',
        'cheek-stars': '星星贴纸',
        'butterfly-sticker': '蝴蝶贴纸',
        'lightning-sticker': '闪电贴纸',
      }[settings.faceEffect]
      const makeupCount = getEnabledMakeupCount(settings)
      return {
        name: mode === 'preview' ? '正在预览美化效果' : '美化效果已应用',
        detail: `${backgroundLabel} · ${faceEffectLabel} · ${makeupCount} 项美妆`,
      }
    },
  }))
  .register(defineTool({
    name: 'studio.reset_camera_effects_preview',
    description: '取消尚未应用的美化效果预览。',
    inputSchema: z.object({}),
    execute: (_, context) => {
      context.resetCameraEffectsPreview()
      return { name: '已取消美化预览', detail: '摄像头已恢复为当前正式配置。' }
    },
  }))
  .register(defineTool({
    name: 'studio.undo_camera_effects',
    description: '撤回最近一次正式应用的美化效果。',
    inputSchema: z.object({}),
    requiresConfirmation: true,
    execute: (_, context) => {
      context.undoCameraEffects()
      return { name: '已撤回美化效果', detail: '摄像头已恢复到应用前的配置。' }
    },
  }))
  .register(defineTool({
    name: 'studio.adjust_visual',
    description: '预览或应用直播画面的亮度、对比度与暖色参数。',
    inputSchema: visualInputSchema,
    requiresConfirmation: true,
    execute: ({ mode, settings }, context) => {
      if (mode === 'preview') {
        context.previewVisualSettings(settings)
      } else {
        context.applyVisualSettings(settings)
      }

      return {
        name: mode === 'preview' ? '正在预览柔光氛围' : '柔光氛围已应用',
        detail: `亮度 ${toPercent(settings.brightness)}、对比度 ${toPercent(settings.contrast)}、暖色 +${Math.round(settings.warmth * 100)}`,
      }
    },
  }))
  .register(defineTool({
    name: 'studio.reset_visual_preview',
    description: '取消尚未应用的画面预览。',
    inputSchema: z.object({}),
    execute: (_, context) => {
      context.resetVisualPreview()
      return { name: '已取消预览', detail: '画面已恢复为当前正式配置。' }
    },
  }))
  .register(defineTool({
    name: 'studio.undo_visual',
    description: '撤回最近一次正式应用的画面调整。',
    inputSchema: z.object({}),
    requiresConfirmation: true,
    execute: (_, context) => {
      context.undoVisualSettings()
      return { name: '已撤回画面调整', detail: '画面已恢复到应用前的配置。' }
    },
  }))
  .register(defineTool({
    name: 'studio.adjust_audio',
    description: '预览或应用麦克风和背景音乐增益。',
    inputSchema: audioInputSchema,
    requiresConfirmation: true,
    execute: ({ mode, settings }, context) => {
      if (mode === 'preview') {
        context.previewAudioSettings(settings)
      } else {
        context.applyAudioSettings(settings)
      }

      return {
        name: mode === 'preview' ? '正在试听音频调整' : '音频调整已应用',
        detail: `麦克风 ${formatDb(settings.microphoneGainDb)}，BGM ${formatDb(settings.backgroundMusicGainDb)}`,
      }
    },
  }))
  .register(defineTool({
    name: 'studio.reset_audio_preview',
    description: '取消尚未应用的音频预览。',
    inputSchema: z.object({}),
    execute: (_, context) => {
      context.resetAudioPreview()
      return { name: '已取消音频预览', detail: '音频已恢复为当前正式配置。' }
    },
  }))
  .register(defineTool({
    name: 'studio.undo_audio',
    description: '撤回最近一次正式应用的音频调整。',
    inputSchema: z.object({}),
    requiresConfirmation: true,
    execute: (_, context) => {
      context.undoAudioSettings()
      return { name: '已撤回音频调整', detail: '音频已恢复到应用前的配置。' }
    },
  }))
  .register(defineTool({
    name: 'studio.configure_poll',
    description: '预览或发布直播间互动投票。',
    inputSchema: pollInputSchema,
    requiresConfirmation: true,
    execute: ({ mode, config }, context) => {
      if (mode === 'preview') {
        context.previewPoll(config)
      } else {
        context.publishPoll(config)
      }
      return {
        name: mode === 'preview' ? '正在预览互动投票' : '互动投票已上屏',
        detail: `${config.question} · ${config.durationSeconds} 秒`,
      }
    },
  }))
  .register(defineTool({
    name: 'studio.reset_poll_preview',
    description: '取消尚未发布的互动投票预览。',
    inputSchema: z.object({}),
    execute: (_, context) => {
      context.resetPollPreview()
      return { name: '已取消投票预览', detail: '直播画面已恢复。' }
    },
  }))
  .register(defineTool({
    name: 'studio.undo_poll',
    description: '撤回最近一次发布的互动投票。',
    inputSchema: z.object({}),
    requiresConfirmation: true,
    execute: (_, context) => {
      context.undoPoll()
      return { name: '互动投票已撤回', detail: '投票组件已从直播画面移除。' }
    },
  }))
  .register(defineTool({
    name: 'studio.configure_live_goal',
    description: '预览或发布直播间冲刺目标。',
    inputSchema: liveGoalInputSchema,
    requiresConfirmation: true,
    execute: ({ mode, config }, context) => {
      if (mode === 'preview') {
        context.previewLiveGoal(config)
      } else {
        context.publishLiveGoal(config)
      }
      return {
        name: mode === 'preview' ? '正在预览冲刺目标' : '冲刺目标已上屏',
        detail: `${config.label} · ${config.current.toLocaleString()} / ${config.target.toLocaleString()}`,
      }
    },
  }))
  .register(defineTool({
    name: 'studio.reset_live_goal_preview',
    description: '取消尚未发布的冲刺目标预览。',
    inputSchema: z.object({}),
    execute: (_, context) => {
      context.resetLiveGoalPreview()
      return { name: '已取消目标预览', detail: '直播画面已恢复。' }
    },
  }))
  .register(defineTool({
    name: 'studio.undo_live_goal',
    description: '撤回最近一次发布的冲刺目标。',
    inputSchema: z.object({}),
    requiresConfirmation: true,
    execute: (_, context) => {
      context.undoLiveGoal()
      return { name: '冲刺目标已撤回', detail: '目标组件已从直播画面移除。' }
    },
  }))

function toPercent(value: number): string {
  const percentage = Math.round((value - 1) * 100)
  return `${percentage >= 0 ? '+' : ''}${percentage}`
}

function formatDb(value: number): string {
  return `${value >= 0 ? '+' : ''}${value} dB`
}

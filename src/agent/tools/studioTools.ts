import { z } from 'zod'
import { visualSettingsSchema, type VisualSettings } from '../../capabilities/visual/types'
import { defineTool, ToolRegistry } from './toolRegistry'

export interface StudioToolContext {
  previewVisualSettings: (settings: VisualSettings) => void
  applyVisualSettings: (settings: VisualSettings) => void
  resetVisualPreview: () => void
  undoVisualSettings: () => void
}

const visualInputSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  settings: visualSettingsSchema,
})

export const studioToolRegistry = new ToolRegistry<StudioToolContext>()
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

function toPercent(value: number): string {
  const percentage = Math.round((value - 1) * 100)
  return `${percentage >= 0 ? '+' : ''}${percentage}`
}

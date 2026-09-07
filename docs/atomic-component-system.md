# 直播原子组件系统

## 架构

原子组件系统由四层组成：

1. `types.ts`：统一定义组件 ID、分类和运行参数。
2. `registry.ts`：可信组件注册表，负责元数据、懒加载和预加载。
3. `intentRecall.ts`：将输入框、评论和监控指标统一转换为组件意图。
4. `AtomicRecallCard.tsx`：在原有右栏组件区域按需渲染可信组件。

组件代码按基础面板、互动面板和装修模板拆分为三个异步 chunk。组件卡片出现时预加载，实际渲染时按需加载。

## 统一接口

```ts
interface AtomicPanelProps {
  audience: AudienceSnapshot
  onApplied?: (componentId: AtomicComponentId) => void
}

interface AtomicComponentDefinition {
  id: AtomicComponentId
  name: string
  description: string
  category: 'basic' | 'interaction' | 'overall'
  keywords: readonly string[]
  preload: () => Promise<unknown>
  component: LazyExoticComponent<ComponentType<AtomicPanelProps>>
}
```

`audience` 提供实时评论、礼物、在线人数和留存数据；`onApplied` 在组件应用或上屏后触发。视觉、音频、摄像头、投票和目标状态通过 `useStudioStore` 共享，因此面板可独立调用，也能组合使用。

## 已注册组件

| ID | 名称 | 能力 |
| --- | --- | --- |
| `lighting` | 补光 | 亮度、色温、补光模式、实时预览 |
| `microphone` | 麦克风 | 音量、降噪、音效、麦克风测试 |
| `beauty` | 美颜 | 磨皮、美白、瘦脸、预设 |
| `makeup` | 美妆 | 妆容预设、口红、腮红、眼妆 |
| `background` | 背景 | 虚化、虚拟背景、自定义上传 |
| `effects` | 特效 | 动态特效、强度、触发方式 |
| `audience-poll` | 观众投票 | 创建选项、发布、结果和票数 |
| `live-goal` | LIVE goal | 目标设置、进度、达成提示 |
| `audience-wishes` | 观众心愿 | 收集、展示、达成和管理 |
| `like-ranking` | 点赞榜单 | 时间筛选、点赞数和排名变化 |
| `gift-ranking` | 送礼榜单 | 礼物筛选、数量、价值和排名 |
| `studio-template` | 装修模板 | 保存、加载和切换整套配置 |

## 意图召回

`recallAtomicComponents` 接收统一请求：

```ts
interface IntentRecallRequest {
  source: 'input' | 'comment' | 'monitor'
  text?: string
  signalIds?: readonly LiveSignalId[]
}
```

- 监控指标：由 `signalIds` 召回一组可解决当前问题的原子组件。
- 评论区：结合评论热点文本和关联指标识别观众诉求。
- 输入框：识别主播自然语言中的一个或多个操作意图。
- 输出最多四个去重组件，按置信度排序。

右栏不展示场景模板。监控或评论触发时，每条建议和对应组件共享同一个建议编号，建议条目同时显示关联组件数量；相同组件被不同建议召回时分别保留，避免丢失对应关系。直接输入时隐藏建议区，仅展示本次输入召回的组件；后续产生新的监控或评论建议时自动恢复建议区。

### Few-shot 扩展

调用方可向第二个参数传入外部示例，不需要修改识别器：

```ts
const examples: IntentFewShotExample[] = [
  {
    input: '帮我接住刚才的高价值用户',
    componentIds: ['gift-ranking', 'audience-wishes'],
  },
]

recallAtomicComponents(
  { source: 'input', text: '接住刚才的高价值用户' },
  examples,
)
```

后续接入模型时，可将模型结构化输出归一化为同一个 `AtomicComponentId[]` 契约，右栏无需修改。

## 注册新组件

1. 实现接收 `AtomicPanelProps` 的 React 组件。
2. 在 `AtomicComponentId` 中加入稳定 ID。
3. 在 `atomicComponentRegistry` 注册名称、分类、关键词和动态导入函数。
4. 在关键词规则或 few-shot 配置中建立意图到组件 ID 的映射。

示例：

```ts
const loadCommerce = () => import('./panels/CommercePanels')

productCard: definition(
  'product-card',
  '商品卡',
  '选择并上屏直播商品',
  'interaction',
  ['商品', '带货'],
  loadCommerce,
  'ProductCardPanel',
)
```

所有外部配置应先通过 schema 校验后再进入注册组件；注册表之外的组件不会被动态渲染。

# LIVE Studio Genie

基于 React、TypeScript 和 Vite 的直播工作台 Demo。项目包含播前准备、直播监控、模拟 PK、本地摄像头预览，以及右侧 Genie Agent 对话能力。

## 环境要求

- Node.js `20+`
- npm `10+`
- 支持摄像头的浏览器。Chrome 或 Edge 推荐使用最新版。

检查本地环境：

```bash
node --version
npm --version
```

## 快速启动

在项目根目录执行：

```bash
npm install
npm run dev
```

终端会输出本地访问地址，默认是：

```text
http://localhost:5173
```

首次从欢迎页进入工作台时，浏览器会请求摄像头和麦克风权限。拒绝权限不会阻断 Demo，页面会自动切换到演示主播画面。

## 配置 Genie Agent

右侧 Genie 对话调用 `gpt-5.4-2026-03-05`。每位开发者都需要在项目根目录创建自己的 `.env.local` 文件：

```env
GENIE_MODEL_AK=你的模型访问密钥
GENIE_MODEL_BASE_URL=https://aidp-i18ntt-sg.tiktok-row.net
```

说明：

- `.env.local` 仅保存在本地，已经被 Git 忽略，禁止提交访问密钥。
- 在非办公网络环境中，如有需要可将域名改为：

```env
GENIE_MODEL_BASE_URL=https://aidp-i18ntt-sg.byteintl.net
```

- 未配置 `GENIE_MODEL_AK` 时，UI 和其他演示功能仍可运行；发送 Genie 对话时会显示配置错误提示。
- 修改 `.env.local` 后，重启 `npm run dev`，确保开发服务器重新加载环境变量。

## 常用命令

```bash
# 启动开发服务器
npm run dev

# 生成生产构建
npm run build

# 运行代码检查
npm run lint

# 本地预览生产构建
npm run preview
```

提交前至少执行：

```bash
npm run build
npm run lint
```

## 项目结构

```text
src/
  App.tsx              主工作台、播前流程、直播控制台与交互状态
  App.css              工作台视觉样式
  services/genie.ts    前端 Genie 请求封装
vite.config.ts         开发环境 Agent 同源代理，密钥仅在服务端读取
```

## 演示路径

1. 打开欢迎页，选择直播类型并生成工作台。
2. 允许摄像头权限，或使用自动降级的演示主播画面。
3. 在播前页面应用推荐方案，点击“开始直播”。
4. 用左侧“演示场景”切换画质、互动、排障和 PK。
5. 在右侧输入框向 Genie 询问针对当前直播状态的建议。

## 协作约定

- 不要提交 `.env.local`、密钥或本地调试文件。
- 提交信息采用简短格式，例如：`feat: refine genie chat ui`。
- 保持 Agent 请求经过 `vite.config.ts` 的同源代理，不能将 AK 暴露给浏览器端代码。

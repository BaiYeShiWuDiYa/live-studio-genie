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

右侧 Genie 对话调用 `gpt-5.4-2026-03-05`。每位开发者都需要在项目根目录创建自己的 `.env` 文件：

```env
GENIE_MODEL_AK=你的模型访问密钥
GENIE_MODEL_BASE_URL=https://aidp-i18ntt-sg.tiktok-row.net
```

说明：

- `.env` 仅保存在本地，已经被 Git 忽略，禁止提交访问密钥。
- 在非办公网络环境中，如有需要可将域名改为：

```env
GENIE_MODEL_BASE_URL=https://aidp-i18ntt-sg.byteintl.net
```

- 未配置 `GENIE_MODEL_AK` 时，UI 和其他演示功能仍可运行；发送 Genie 对话时会显示配置错误提示。
- 修改 `.env` 后，重启 `npm run dev`，确保开发服务器重新加载环境变量。

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

# 生成 Goofy Node 部署产物
npm run build:goofy

# 启动 Goofy 生产服务，默认监听 8080
npm start
```

提交前至少执行：

```bash
npm run build
npm run lint
```

## GitHub Pages 部署

仓库内置 `.github/workflows/deploy-pages.yml`。首次部署前，在 GitHub 仓库中打开：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

保存后，推送到 `main` 会自动构建并发布到：

```text
https://baiyeshiwudiya.github.io/live-studio-genie/
```

也可以在仓库的 `Actions` 页面手动运行 `Deploy to GitHub Pages`。

GitHub Pages 仅托管静态文件，不会运行 `vite.config.ts` 中的 Genie 代理，也不能安全保存 `GENIE_MODEL_AK`。Pages 版本可体验工作台、浏览器媒体能力和 Mock 场景；如需开放 Genie 对话，必须将 `/api/genie/chat` 单独部署到可信服务端，不能把 AK 写入前端变量或 GitHub Pages 构建配置。

## Goofy Deploy 部署

公司内完整体验使用 Goofy Deploy Node 项目，代码源配置为：

```text
仓库：https://code.byted.org/tiktok/live-studio-genie
分支：feat/live-studio-genie
Node.js：20.19+
SCM 构建命令：bash build.sh
SCM 产物目录：output
Goofy 启动入口：node bootstrap.js
本地启动命令：npm start
服务端口：PORT 环境变量，默认 8080
健康检查：/healthz
```

`build.sh` 使用 `bnpm.byted.org` 安装依赖，并生成自包含的 `output/`。该目录包含前端静态文件、Node 服务和运行时 `package.json`，不需要携带 `node_modules`。

Goofy Channel 创建后，通过运行时环境变量注入 AK。先预览，再确认写入：

```bash
chmod 600 .env
bytedcli goofy deploy update-channel-bff-env \
  --channel-id <channel_id> \
  --bff-env-file .env
bytedcli goofy deploy update-channel-bff-env \
  --channel-id <channel_id> \
  --bff-env-file .env \
  --yes
```

`.env` 禁止提交。`GENIE_MODEL_AK` 只在 Node 运行时读取，不会进入浏览器构建产物。
Goofy/FaaS 生产容器使用 `https://aidp-i18ntt-sg.byteintl.net`；`tiktok-row.net` 仅用于办公网络本地开发。

## 项目结构

```text
src/
  App.tsx              主工作台、播前流程、直播控制台与交互状态
  App.css              工作台视觉样式
  services/genie.ts    前端 Genie 请求封装
server/
  genieProxy.ts        开发与生产共用的 Genie 服务端代理
  index.ts             Goofy Node 服务、静态资源和健康检查
scripts/build-goofy.mjs
                       生成自包含的 output 部署产物
vite.config.ts         开发环境 Agent 同源代理
```

## 演示路径

1. 打开问题选择页，点击直播类型，或输入主题后按 Enter。
2. 允许摄像头权限，或使用自动降级的演示主播画面。
3. 在统一控制台右侧完成播前任务，并观察中间列的准备度。
4. 点击 `GO LIVE`，Gift、Comment、观众数据和实时诊断会在原布局中开始加载。
5. 在右侧选择实时建议、操作对应组件，或向 Genie 输入问题。

## 功能文档

- [功能实现状态与完整操作指南](docs/feature-status-and-usage-guide.md)
- [关播页展示数据与来源说明](docs/post-live-data-source-guide.md)
- [开发进展](docs/implementation-progress.md)

## 协作约定

- 不要提交 `.env`、密钥或本地调试文件。
- 提交信息采用简短格式，例如：`feat: refine genie chat ui`。
- 保持 Agent 请求经过同源服务端代理，不能将 AK 暴露给浏览器端代码。

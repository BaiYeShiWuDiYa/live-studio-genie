# Implementation Progress

## Completed

### Unified Pre-live and Live Console

- Added a question-first entry page with category shortcuts and free-text submission.
- Routes every entry choice into a unified three-column console instead of a separate setup page.
- Reused the live console layout during pre-live preparation to avoid visual and structural jumps.
- Keeps gift, comment, viewer-count, and entrant data unloaded and empty before the stream starts.
- Added pre-live camera, microphone, and network status without exposing audience metrics.
- Added four editable preparation tasks for layout, media quality, stream information, and interaction warm-up.
- Added a persistent preparation progress bar and direct `GO LIVE` action below the center preview.
- Switches the existing console in place from pre-live to live state and then loads audience, gift, comment, monitoring, recommendation, and widget data.
- Added ranked live diagnostics, one-to-one actionable suggestions, a one-minute append-only suggestion queue, and matching widget recall.
- Preserved camera effects, screen sharing, audio controls, polls, LIVE Goal, PK, Genie chat, preview, apply, and undo behavior.
- Verified category and text entry paths, empty pre-live audience regions, and the complete `GO LIVE` state transition in Chrome.

Validation:

```bash
npm run test   # 56 passed
npm run build
npm run lint
git diff --check
```

### React 18 and Creator UI

- Downgraded React and React DOM to `18.3.1`.
- Integrated the React 18 Creator UI snapshot and `ButtonV4`.
- Added the internal bnpm registry configuration.
- Added an esbuild CSS minifier fallback for Creator UI compatibility.

Commit: `7576fac feat: integrate creator ui`

### Realtime Media Monitoring

- Added Zustand state and Zod runtime validation.
- Added camera-frame brightness sampling with Canvas.
- Added microphone RMS and dB sampling with Web Audio.
- Connected the mute control to the real audio track.
- Added unit tests for media calculations.

Commit: `1a1dde8 feat: add realtime media monitoring`

### Screen Sharing

- Added browser window and screen capture through `getDisplayMedia`.
- Added lifecycle cleanup and native stop-sharing synchronization.
- Added camera picture-in-picture while sharing.

Commit: `a2e9cc8 feat: add screen sharing`

### Editable Studio Layout

- Added drag and resize controls for the camera picture-in-picture.
- Added layout locking and reset behavior.
- Persisted validated layout state in Zustand.

Commit: `6875140 feat: add editable studio layout`

### Tool Registry and Visual Adjustment

- Added a typed, allowlisted Tool Registry with Zod input validation.
- Added preview, apply, reset-preview, and undo tools for visual settings.
- Connected brightness, contrast, and warmth controls to the rendered video.
- Added tests for valid, invalid, and unknown tool execution.
- Verified the complete preview, apply, and undo flow in the browser.

Commit: `055b5bb feat: add studio tool registry`

### Schema-driven Gen-UI

- Added versioned Zod schemas for visual, poll, audio, and live-goal widgets.
- Added a trusted component registry keyed by allowlisted widget types.
- Migrated deterministic scene cards out of `App.tsx`.
- Added a safe fallback for invalid or unknown widget data.
- Added schema tests and verified scene-to-widget switching in the browser.

Commit: `c665147 feat: add schema driven gen ui`

### Validated Agent Widget Output

- Added an optional `<widget>JSON</widget>` protocol to Agent prompts.
- Strips protocol data from the chat message before rendering.
- Validates Agent widget output with the same allowlisted Zod schema.
- Keeps the deterministic scene widget when model output is absent or invalid.
- Routes validated widgets through the existing preview, apply, and undo flow.
- Verified a real model response and its generated visual settings in the browser.

Commit: `2822866 feat: support agent generated widgets`

### Web Audio Gain Processing

- Added a Web Audio `GainNode` and `MediaStreamDestination` processing pipeline.
- Connected microphone gain settings to the processed audio stream.
- Changed microphone monitoring to analyze the processed signal.
- Added Tool Registry preview, apply, reset, and undo actions for audio settings.
- Added signed dB controls and unit coverage for dB-to-linear conversion.
- Verified the audio widget preview, apply, and undo lifecycle in the browser.

Commit: `7f48fcc feat: add audio gain processing`

### Interactive Audience Poll

- Added validated poll configuration and runtime state.
- Added Tool Registry preview, publish, reset, and undo actions.
- Added a real countdown and automatic expiration.
- Added clickable vote options with live percentage updates.
- Verified preview restrictions, publishing, voting, countdown, and undo in the browser.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Dynamic LIVE Goal

- Added validated LIVE Goal configuration and runtime state.
- Added Tool Registry preview, publish, reset, and undo actions.
- Added automatic progress updates and manual simulated gift boosts.
- Added target completion, progress, and supporter feedback states.
- Verified preview restrictions, publishing, dynamic progress, completion, and undo in the browser.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Resilient Agent Requests

- Added caller cancellation and a 15-second timeout to Agent requests.
- Added explicit loading, cancelled, timeout, and error states.
- Added in-context cancel and retry controls without duplicating user messages.
- Cancels in-flight requests when the application unmounts.
- Added unit coverage for timeout and caller cancellation.
- Verified loading, successful recovery, and generated Widget output in the browser.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Web Audio Background Music

- Added a generated ambient chord loop as a real local BGM source.
- Added user-gesture playback and stop controls.
- Connected BGM settings to a dedicated Web Audio `GainNode`.
- Applied previewed and committed BGM dB changes to the playing source.
- Added safe output-level conversion tests and audio-context cleanup.
- Verified playback, gain preview, and stop behavior in the browser.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Camera Beauty and Virtual Background

- Added `@mediapipe/tasks-vision@0.10.14`, matching the proven LIVE Studio integration.
- Added a local official Selfie Segmenter model and lazy-loaded Vision runtime.
- Added Canvas-based skin softening, exposure, and warmth processing.
- Added real person segmentation for background blur and solid-color replacement.
- Added a validated camera-effects Tool and trusted Gen-UI widget.
- Added preview, apply, reset-preview, and undo state in Zustand.
- Verified blur, color replacement, apply, and undo with a real camera in Chrome.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Custom Backgrounds and Face Effects

- Added local PNG, JPEG, and WebP background upload with an 8 MB limit.
- Restricted background URLs to browser-generated Blob URLs.
- Added cover-mode image compositing behind the segmented person.
- Added the official Face Landmarker model and local-only landmark processing.
- Added face-tracked halo and sparkle effects rendered directly on Canvas.
- Verified image and face-effect controls, background segmentation, and no-face fallback in Chrome.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Face-tracked Makeup

- Added validated intensity and color settings for lipstick, blush, and eyeshadow.
- Reused the existing MediaPipe Face Landmarker instead of adding a second detector.
- Added mouth-interior exclusion for lipstick and face-relative placement for blush and eyeshadow.
- Added color swatches and realtime intensity controls to the camera-effects widget.
- Added MIT attribution for the adapted open-source landmark and compositing approach.
- Verified the full preview state and no-face fallback in Chrome.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Camera Effect Style Presets

- Added four selectable styles: Natural, Sweet Live, Stage Highlight, and Future Tech.
- Added a preset registry with validated complete settings and automatic active-style matching.
- Kept all preset values editable after selection so the result can become a custom style.
- Added coordinated lipstick, blush, eyeshadow, beauty, background, and prop settings per style.
- Added a face-tracked neon glasses prop for the Future Tech preset.
- Added a compact color-swatch selector and an independently scrollable Genie panel.
- Verified preset switching, complete parameter replacement, custom state, and panel layout in Chrome.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Independent Camera Effect Categories

- Split camera effects into Bundle, Beauty, Makeup, and Prop selectors.
- Added four beauty presets and five makeup presets.
- Kept background and detailed intensity controls independently editable.
- Added category-specific matching so custom changes do not report the wrong preset.
- Verified with unit coverage that beauty changes preserve makeup, props, and background.
- Browser interaction verification is deferred until the workstation is unlocked.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Face Framing Monitoring

- Added continuous Face Landmarker tracking while a camera source is active.
- Shared the latest landmarks with makeup and prop rendering to avoid duplicate inference.
- Added face coverage, centering, distance, and vertical placement analysis.
- Added a realtime `人像占比` metric to the quality diagnostics.
- Throttled metric publication independently from the smoother rendering cadence.
- Physical-camera verification is deferred until the workstation is unlocked.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Audience Event Adapter and Comment Insights

- Added a typed adapter contract for comments, gifts, and audience entry events.
- Added a deterministic mock adapter that can be replaced by Live IM without UI changes.
- Added rolling keyword classification for audio, visual, network, request, and positive feedback.
- Connected comments, gifts, viewer count, comment density, and recent entrants to adapter snapshots.
- Connected dominant comment insights to troubleshooting diagnostics.
- Browser interaction verification is deferred until the workstation is unlocked.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### Full Chrome Regression and Agent Parameter Normalization

- Verified the real camera, microphone level, brightness, and face-framing diagnostics.
- Verified independent beauty, makeup, and face-tracked prop switching.
- Verified local image upload, automatic image-background selection, and Canvas compositing.
- Verified tab sharing, camera picture-in-picture dragging, sharing stop, and layout persistence.
- Verified BGM playback, audio preview/apply, audience poll voting, and LIVE Goal completion.
- Verified dynamic comments, gifts, viewer counts, entrants, and comment keyword insights.
- Added deterministic normalization for explicit brightness, contrast, and warmth percentages in Agent visual widgets.
- Verified the real Agent flow renders requested values as brightness `+10`, contrast `+5`, and warmth `+3`.

Validation:

```bash
npm run test
npm run build
npm run lint
```

Result: 10 test files and 36 tests passed. Production build completed with the existing large-chunk warning.

### Scrollable Live Comments

- Added a fixed-height, keyboard-focusable live-comment viewport with an isolated scrollbar.
- Expanded deterministic mock snapshots to seven comments so overflow behavior is continuously testable.
- Verified dynamic comment updates and isolated scrolling in Chrome.

Validation:

```bash
npm run test
npm run build
npm run lint
```

### AI-generated Camera Effects

- Added live brightness, face-framing, and current camera-effect settings to the Agent context.
- Added a trusted `camera-effects` partial-update protocol that preserves unspecified active settings.
- Added deterministic parsing for beauty, makeup, and supported face-prop instructions.
- Added context-aware beauty and makeup recommendations based on lighting and the active prop.
- Added a trusted local fallback when the model answers with text but omits the requested camera widget.
- Added an `AI 人像效果` quick prompt and verified real Agent-generated camera controls in Chrome.

Validation:

```bash
npm run test
npm run build
npm run lint
```

Result: 10 test files and 40 tests passed. Production build completed with the existing large-chunk warning.

### Improved Face-tracked Glasses

- Rebuilt glasses geometry from eye corners, upper and lower eyelids, and temple landmarks.
- Expanded lens width and height so frames cover the full eye sockets instead of only the eyes.
- Increased lens width to 1.9 times the eye width with a temple-distance minimum and raised lens height to 72%.
- Added a curved bridge, rounded frames, and face-tracked temple arms.
- Added geometry tests for frame coverage, vertical placement, and missing-landmark fallback.

Validation:

```bash
npm run test
npm run build
npm run lint
```

Result: 11 test files and 42 tests passed. Production build completed with the existing large-chunk warning.

### Effect Library and Local Virtual Backgrounds

- Split camera controls into dedicated Bundle, Beauty, Makeup, Props, and Background tabs.
- Limited Beauty and Makeup tabs to their own presets and sliders while keeping all controls in Bundle.
- Removed local file upload and added four offline procedural backgrounds rendered directly by Canvas.
- Added contrast and saturation beauty controls backed by the camera processing filter chain.
- Added face-tracked eyeliner and nose highlight makeup controls.
- Removed halo and cat-ear props, replacing them with butterfly and lightning stickers.
- Matched the Genie recommendation scrollbar to the cyan studio scrollbar theme.
- Added opaque black sunglasses with dedicated lenses, frame, bridge, highlights, and tracked temple arms.

Validation:

```bash
npm run test
npm run build
npm run lint
```

Result: 11 test files and 44 tests passed. Chrome verification covered the new sliders, themed scrollbar, butterfly, lightning, and sunglasses tracking, and segmented virtual backgrounds.

### Refined Face Effects and Retouching

- Extended the shared tracked temple-arm geometry for both cyber glasses and black sunglasses.
- Rebuilt black sunglasses with tapered curved lenses, a heavier brow frame, a dedicated bridge, and softer reflections.
- Replaced the rigid eyeliner stroke with a tapered upper-lid fill and a short outer wing.
- Replaced the nose highlight line with soft nose-bridge, nose-tip, and cheek highlight regions.
- Added whitening, rosiness, and clarity controls across schemas, presets, Canvas rendering, Agent instructions, and deterministic parsing.

Validation:

```bash
npm run test
npm run build
npm run lint
git diff --check
```

Result: 11 test files and 44 tests passed. Production build completed with the existing large-chunk warning. Chrome verification covered the extended glasses geometry, revised sunglasses shape, and the new retouching controls.

### Face-aligned Glasses Arms

- Replaced radial temple-arm extension with an eye-axis projection that stays aligned with the face.
- Routed each arm through its tracked temple anchor before curving slightly down toward the top of the ear.
- Added asymmetric extension based on each visible face side so profile views shorten the far arm and extend the near arm.
- Removed the duplicated group rotation that exaggerated arm drift when the head rolled.
- Replaced the tapered sunglasses lenses with larger rectangular lenses and restrained rounded corners.
- Added geometry coverage for temple anchoring, limited vertical drift, and turned-face arm asymmetry.

Validation:

```bash
npm run test
npm run build
npm run lint
git diff --check
```

Result: 11 test files and 45 tests passed. Production build completed with the existing large-chunk warning. The automated browser loaded the updated controls, but camera-based profile verification remains manual because that browser session has camera permission denied.

### Chinese Feature Status and Usage Guide

- Added a Chinese status matrix for all requested monitoring and component capabilities.
- Separated real browser capabilities, deterministic Demo/Mock data, partial implementations, and missing capabilities.
- Documented the complete experience flow from onboarding and pre-live preparation through monitoring, beautification, screen sharing, polls, PK, LIVE Goal, and Genie.
- Added operating constraints, recommended competition demo order, and follow-up priorities.
- Linked the guide from the project README.

Validation:

```bash
npm run test
npm run build
npm run lint
git diff --check
```

### Local Artifact Ignore Rules

- Ignored generated PRD document extraction caches under `doc-fetch-resources/`.
- Ignored unreferenced local PRD screenshots under `prd-assets/`.
- Ignored the superseded foundation-capabilities research draft while keeping maintained project documentation tracked.
- Removed duplicate UTF-8 BOM bytes from the `App.css` working copy by restoring the tracked file.

Validation:

```bash
git check-ignore -v
git diff --check
```

### Centralized Runtime Configuration

- Added `src/config/studioRuntime.ts` as the single source for adjustable runtime and Demo values.
- Centralized audience refresh timing, comment history spacing, viewer counters, retention values, and scene phase duration.
- Centralized suggestion synchronization, media sampling, MediaPipe throttling, poll countdown, LIVE Goal, and BGM timing.
- Added a concise Chinese comment to every configuration field.
- Added coverage proving generated audience event timestamps follow the shared configuration.

Validation:

```bash
npm run test
npm run build
npm run lint
git diff --check
```

Result: 13 test files and 57 tests passed. Production build completed with the existing large-chunk warning.

### Configurable Audience Strategies

- Added a strategy selector to the TikTok icon in the shared pre-live/live top bar.
- Added the original normal, dim-light, low-audio, cold-interaction, network-lag, and PK-push Demo strategies.
- Applied strategy-specific visual and audio settings before going live for deterministic demonstrations.
- Added a configurable 15-second normal-comment warmup before strategy-specific feedback appears.
- Added a configurable 10-second recovery phase after accepting the matching AI suggestion, followed by normal comments.
- Moved expanded strategy comments and user names to `src/config/audienceComments.ts`.
- Rendered comments as a bottom-appended sliding window with rotating user names and live timestamps in an independently scrollable panel.
- Rebalanced metric label, progress, and value columns to prevent narrow-panel overflow.
- Replaced automatic tick-based scenario rotation with explicit strategy-driven comments, metrics, and diagnostics.
- Cleared pre-live suggestions on GO LIVE and recalled matching suggestions after the warmup.
- Added `docs/audience-comment-strategy.md` as the Chinese strategy and demonstration guide.
- 扩充评论策略指南，逐项记录六种策略的播前处理、问题评论、Genie 建议、采纳动作、恢复评论及 Demo 能力边界。

Validation:

```bash
npm run test
npm run build
npm run lint
git diff --check
```

Result: 13 test files and 63 tests passed. Browser regression verified bottom-appended comments, rotating user names and timestamps, 10-second recovery comments, and final return to normal comments.

### 最新主分支能力同步

- 播前准备任务收敛为布局、人像美化、直播信息与内容三类，并使用轻量状态提示替代阻断式通知。
- 直播监控和评论合并到统一 `LiveChatPanel`，播前展示设备状态，播中切换为实时指标、礼物和评论。
- 实时建议支持同一建议携带多个可操作组件，已应用组件独立移除，建议历史继续保留。
- 聊天陪伴画布支持文字源、目标源的内容、样式、位置编辑，并持久化到历史直播配置。
- 游戏直播新增竖屏和横屏布局，支持投屏画面与摄像头画中画拖动。
- 音乐直播新增四分之三舞台布局、自定义舞台背景和更完整的播前美化配置。

### AI 播后复盘与结束直播

- 播中顶部新增“结束直播”入口，并提供包含直播时长、当前观看和已采纳建议数的二次确认。
- 确认结束后停止摄像头、麦克风处理、游戏投屏和 BGM，冻结本场 Audience Snapshot。
- 新增播后复盘页，展示总观看、峰值在线、新增粉丝、评论、礼物、留存和直播表现指数。
- 根据正常场景和七个典型问题场景生成对应经营建议。
- 进入播后页后自动调用 Genie 生成深度总结；接口不可用时保留本地可复现的兜底分析。
- 新增开放式输入框与快捷问题，主播可描述本场感受，并携带整场数据上下文继续追问下一场优化。
- 新增 `postLiveReview` 数据聚合、建议生成、AI Prompt 和时长格式化测试。
- 新增直播会话监控聚合器，按 `updatedAt` 去重记录亮度、麦克风和人像构图的全部有效样本。
- 播后页新增整场真实监控区域，展示平均业务值、平均/最低评分、异常占比和有效样本数。
- 真实监控摘要已接入表现指数、经营建议、Genie 自动复盘和开放式追问上下文。
- 新增 `docs/post-live-data-source-guide.md`，完整区分关播页真实监控、真实会话状态、Mock、派生和 AI 生成数据。

### Typical Scenario Simulation

- Renamed the top-left strategy selector to “典型场景”.
- Replaced the previous demo choices with seven scenarios: dim screen, color cast, cluttered background, low audio, cold comments, reduced gifts, and reduced entrants.
- Added scenario-specific visual overlays, monitoring baselines, LIVE Chat pools, actionable suggestions, recovery feedback, and atomic component recall.
- Kept `normal` as the default live scenario and exposed it as the first selectable option.
- Added regression coverage for the seven-item catalog and reduced gift/entrant simulations.

Validation:

```bash
npm run test
npm run build
npm run lint
git diff --check
```

Result: 18 test files and 100 tests passed. Browser regression verified the end-live confirmation, responsive post-live review, automatic AI summary, contextual follow-up response, and no-device monitoring fallback.

Result: 16 test files and 93 tests passed. Production build completed with the existing large-chunk warning.

### Scenario Intent And Recall Optimization

- Added a single scenario model for recognizable symptoms, warning/critical thresholds, preferred components, friendly guidance, user utterances, and standard responses.
- Added independent color-accuracy and background-cleanliness monitoring signals.
- Added a dedicated color-adjustment atomic component with white-balance, color-temperature, and color-depth controls.
- Enforced scenario-specific recall priority, including the five-component entrant-recovery sequence.
- Generated seven structured few-shot samples directly from scenario configuration.
- Updated the visible recommendation cards to show actionable guidance instead of metric-only copy.
- Added coverage for all thresholds, component order, issue/recovery chat pools, and few-shot completeness.

Validation:

```bash
npm test
npm run build
npm run lint
git diff --check
```

Result: 16 test files and 102 tests passed. Production build completed with the existing large-chunk warning.

### Live-only Scenario Isolation

- Limited the seven typical scenarios to the live workspace.
- Restored the pre-live default to the normal scene with no scenario overlay or simulated data.
- Preserved pre-live visual and audio settings before going live and restored them when returning.
- Made live scenario selection immediate while keeping the pre-live task flow unchanged.

### Strict Scenario Right Rail

- Added a single scenario whitelist at every suggestion queue entry point.
- Limited each typical scene to one primary recommendation and its configured components.
- Suspended comment-analysis suggestions while a typical scene is active.
- Preserved the existing multi-signal and comment-analysis behavior in normal live mode.

### Selectable Normal Scene

- Added “正常场景” as the first live scene option and kept it as the automatic Go Live default.
- Added deterministic natural variation for comments, entrants, retention, viewer growth, and gifts.
- Added frequent low-value gifts, intermittent gift gaps, and occasional rare gifts with rotating audience names.
- Restored multi-signal monitoring and comment-driven recommendations whenever normal scene is active.
- Added regression coverage for the eight-option scene menu and normal audience distribution.

### Shared Controls And Atomic Component UX

- Rebuilt the shared range control with live fill progress, complete thumb travel, and correct negative-range handling.
- Made automatic, soft, and stage lighting modes immediately update the live preview.
- Added adjustable background blur, icon-only background/effect choices, and no-camera preview fallbacks.
- Added immediate studio-template preview for visual and camera-effect settings.
- Added editable audience wishes with save/cancel actions and a live canvas overlay.
- Connected LIVE goal, audience poll, and audience wishes canvas clicks to their right-rail configuration panels.
- Hid applied recommendation copy while preserving unrelated pending component actions.
- Reduced the right-rail width and suggestion-area ratio, unified recommendation styling, and preserved complete recommendation text.

Validation:

```bash
npm test
npm run build
npm run lint
git diff --check
```

Result: 19 test files and 114 tests passed. Production build completed with the existing large-chunk warning.

### Normal Mode Right Rail And Chat UX

- Replaced normal-mode immediate updates with one 10-second delta detector covering monitoring data, comments, and visual metrics.
- Inserted new suggestion copy at the top while appending matching components to the bottom of the component list.
- Transformed the entire right rail into a dedicated chat workspace as soon as the user enters a prompt, with an explicit return-to-workbench action.
- Kept AI replies, loading/error feedback, intent-matched atomic components, and model-generated widgets as inline chat messages without a separate component section.
- Prioritized explicit intent keywords over loose few-shot matches to prevent unrelated component recall.
- Kept local response fallback for unavailable model requests while using the server-side `.env` credential proxy for normal model interactions.
- Deferred component recall until after submission and combined the Prompt, current rendered camera frame, live metrics, and AI response.
- Upgraded normal-mode 10-second updates to authenticated AI analysis with `NO_ACTION` suppression, one active AI suggestion at a time, and direct rendering of the model-selected widget.
- Added validated JPEG frame forwarding through the server proxy without exposing the model credential to the browser.
- Standardized suggestion cards as title plus supporting copy and reduced the LIVE Chat comment-to-input gap.
- Added regression coverage for the detection interval, stable snapshots, and independent update sources.
- Made the left monitoring snapshot update every 10 seconds and expanded LIVE Chat comments to use all available vertical space while preserving user-controlled scrolling.
- Added selectable, draggable, keyboard-movable, and removable LIVE goal, audience wishes, and poll overlays with synchronized right-rail detail panels.

Validation:

```bash
npm test
npm run build
npm run lint
git diff --check
```

Result: 21 test files and 133 tests passed. Browser regression verified full-height chat layout, sanitized natural-language replies, confirmed history clearing, structured comment triggers, shared pre-live/live chat, 5-second drift-corrected background analysis, persistent multi-turn components, bounded drag movement, and widget deletion.

### Round-bound Genie Components

- Extended each assistant message to own the atomic components and validated Widgets generated during that response.
- Rendered each component group directly below its originating Genie reply instead of collecting all components after the latest message.
- Upgraded local chat persistence to version 2 and preserved per-round associations across page reloads.
- Added backward migration for version 1 sessions by attaching legacy unbound components to the latest assistant reply.
- Kept component refresh scoped to the selected message and widget index.

Validation:

```bash
npm test
npm run build
npm run lint
git diff --check
```

Result: 21 test files and 138 tests passed. Browser regression verified two model-generated rounds, correct user/assistant/component ordering, and the same associations after a full page reload.

### Focused Demo Scenarios

- Kept normal mode as the first menu item and reduced the dedicated demo set to image dimming, low audio, cold comments, and active comments.
- Kept the existing visual and audio adjustment strategies unchanged.
- Added an editable speaking-suggestion component for cold comment periods.
- Added high-density comment thresholds and audience-wishes recall for active comment periods.
- Kept legacy scenario definitions available for historical report compatibility while removing them from the demo selector.

Validation: 21 test files and 142 tests passed, with production build, lint, and browser checks for both new comment scenarios.

### Normal Comment Theme Rotation

- Rotated normal-mode mock comments through audio, visual, network, content-request, gift-engagement, and positive-feedback windows.
- Added gift-engagement analysis and LIVE Goal generation so normal mode can surface more than adjustment and poll components.
- Kept positive windows non-actionable to prevent continuous suggestion spam.

## Next

1. Add eyebrow controls and face-shape deformation.
2. Improve makeup edge fitting and skin-region rendering.
3. Split remaining studio orchestration out of `App.tsx`.
4. Reduce the Creator UI production bundle through code splitting.

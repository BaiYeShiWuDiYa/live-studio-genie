# Implementation Progress

## Completed

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

## Next

1. Add timeout and cancellation states for Agent-generated widgets.
2. Add a real background-music source before applying BGM gain.
3. Split remaining studio orchestration out of `App.tsx`.

# webview-performance-shield

Invisible performance guardrails for React, WebView, and hybrid mobile apps.

webview-performance-shield detects weak devices, monitors frame stability in real time, and automatically downgrades effects before animation lag, scroll jank, and UI stutter become visible. It is designed for the reality of low-end Android, embedded browsers, and React-heavy hybrid shells.

## Why it exists

Most animation systems assume a healthy browser, a stable GPU, and enough CPU headroom to hide sloppy rendering. Hybrid apps do not get that luxury. This package makes the runtime choose a cheaper visual strategy when the frame budget says it has to.

- Zero runtime dependencies
- ESM + CJS output
- Tree-shakable exports
- SSR-safe guards
- Vanilla JavaScript support
- React hooks on a separate subpath export
- WebView-aware heuristics for Android WebView, WKWebView, and embedded browsers

## Install

```bash
npm install webview-performance-shield
```

React hooks live on a subpath so vanilla consumers do not pay for React.

```ts
import {
	detectWeakDevice,
	optimizeAnimations,
	createFPSMonitor,
	preventScrollJank,
	adaptivePerformanceMode,
	createPerformanceHUD
} from "webview-performance-shield"

import {
	useFPSMonitor,
	useAdaptivePerformance,
	useReducedEffects
} from "webview-performance-shield/react"
```

## Core API

### Weak device detection

```ts
import { detectWeakDevice } from "webview-performance-shield"

const profile = detectWeakDevice()

console.log(profile)
// {
//   lowEnd: true,
//   recommendedMode: "low",
//   disableHeavyEffects: true,
//   reduceBlur: true,
//   reduceParticles: true,
//   ...runtime hints
// }
```

The detector combines:

- Low RAM via `navigator.deviceMemory`
- Weak CPU hints via `navigator.hardwareConcurrency`
- GPU tier inference via WebGL renderer detection
- Android WebView, WKWebView, and embedded browser heuristics
- Battery saver / reduced-motion hints
- Low refresh and unstable frame budget hints from runtime FPS telemetry
- Thermal throttling hints inferred from profile + instability patterns

### FPS monitor

```ts
import { createFPSMonitor } from "webview-performance-shield"

const fps = createFPSMonitor()

fps.onDrop((snapshot) => {
	console.log("FPS DROP DETECTED", snapshot.fps, snapshot.droppedFrames)
})

fps.start()
```

### Animation optimizer

```ts
import { detectWeakDevice, optimizeAnimations } from "webview-performance-shield"

const profile = detectWeakDevice()

const optimizer = optimizeAnimations({
	profile,
	watchMutations: true
})

optimizer.update(profile.recommendedMode)
```

It automatically applies:

- GPU transform hints
- Reduced blur / removed backdrop-filter on constrained devices
- Slower or paused particle systems
- Cheaper shadows and heavy effect suppression
- Animation duration scaling
- Mutation-aware retagging for newly mounted DOM nodes

### Scroll jank prevention

```ts
import { preventScrollJank } from "webview-performance-shield"

const scrollGuard = preventScrollJank({
	target: window,
	onScroll: ({ velocityY }) => {
		if (Math.abs(velocityY) > 20) {
			console.log("High scroll velocity detected")
		}
	}
})
```

This gives you passive listeners, RAF batching, wheel smoothing, and touch-friendly scheduling without bolting another utility layer into the app.

### Adaptive performance engine

```ts
import {
	adaptivePerformanceMode,
	createFPSMonitor,
	createPerformanceHUD
} from "webview-performance-shield"

const monitor = createFPSMonitor()
const adaptive = adaptivePerformanceMode({
	monitor,
	root: document.documentElement,
	onEvent: (event) => console.log(event.type, event.detail)
})

const hud = createPerformanceHUD({
	monitor,
	adaptive
})
```

Use the adaptive engine when you want the runtime to react to drops by downgrading in stages:

- Particles off
- Blur reduced or removed
- Shadows simplified
- Animation durations scaled down
- Repaint pressure reduced
- WebView-safe render batching hints applied

## React usage

```tsx
import {
	useAdaptivePerformance,
	useFPSMonitor,
	useReducedEffects
} from "webview-performance-shield/react"

export function Dashboard() {
	const fps = useFPSMonitor()
	const adaptive = useAdaptivePerformance()
	const reduced = useReducedEffects()

	return (
		<section>
			<p>FPS: {fps.fps.toFixed(1)}</p>
			<p>Mode: {adaptive.mode}</p>
			<p>Reduce particles: {String(reduced.reduceParticles)}</p>
		</section>
	)
}
```

The hooks are implemented on top of `useSyncExternalStore`, so they subscribe cleanly and are safe for SSR and concurrent rendering.

## WebView example

```ts
import {
	detectWeakDevice,
	adaptivePerformanceMode,
	optimizeAnimations,
	preventScrollJank
} from "webview-performance-shield"

const profile = detectWeakDevice()
const adaptive = adaptivePerformanceMode({ root: document.documentElement, profile })
const optimizer = optimizeAnimations({ profile, watchMutations: true })
const scroll = preventScrollJank({ target: window })

if (profile.webView.detected) {
	document.documentElement.dataset.webview = profile.webView.platform
}
```

## Before / After

### Before

```tsx
<div className='hero glass blur-xl shadow-2xl'>
	<ParticleField count={120} />
	<MotionSection transition={{ type: "spring", bounce: 0.35 }} />
</div>
```

### After

```tsx
const adaptive = useAdaptivePerformance()
const reduced = useReducedEffects()

<div className={adaptive.mode === "low" ? "hero hero-low" : "hero glass blur-xl shadow-2xl"}>
  {!reduced.reduceParticles ? <ParticleField count={48} /> : null}
  <MotionSection transition={{ duration: adaptive.effects.animationScale * 0.32 }} />
</div>
```

## Demo dashboard

The repository includes a Vite dashboard in `demo/` showing:

- Live FPS
- Device quality score
- Render load simulation
- Dropped frame count
- Adaptive optimization events
- Live FPS HUD
- Dropped frame heatmap

Run it locally:

```bash
npm install
npm run dev
```

Open the benchmark lab at `http://localhost:5173/benchmark.html` or launch it directly:

```bash
npm run benchmark
```

Build the library and the demo:

```bash
npm run build
```

## Lightweight tests

The repository now includes a lightweight browser-focused test slice built with Vitest + JSDOM.

It currently covers:

- WebView environment detection heuristics
- Weak-device scoring under constrained browser hints
- FPS monitor drop detection and cleanup behavior
- SSR-safe import and execution in a Node environment

Run the tests with:

```bash
npm test
```

Use watch mode during iteration:

```bash
npm run test:watch
```

## Benchmark section

This package is intended to be benchmarked on device classes that actually fail in production, not just a desktop Chrome trace.

The repo includes a repeatable browser benchmark harness in `demo/benchmark.html`. It runs fixed workload presets, captures FPS telemetry with the library's own monitor, records adaptive mode changes, and emits a JSON summary you can compare between devices or commits.

Recommended harness flow:

1. Start `npm run benchmark`.
2. Open the same preset on every target device.
3. Run the comparison suite without changing browser tabs during execution.
4. Export the JSON summary and diff the results across devices or branches.

Recommended benchmark matrix:

| Scenario                  | Measure                               | Target                                             |
| ------------------------- | ------------------------------------- | -------------------------------------------------- |
| Low-end Android WebView   | FPS floor under stress                | stays above 45 FPS                                 |
| Mid-tier hybrid app shell | Dropped frames during route animation | materially reduced vs baseline                     |
| Blur-heavy landing page   | Paint cost after downgrade            | cheaper than baseline after adaptive mode kicks in |
| Infinite scroll feed      | Wheel/touch latency                   | no visible listener-induced jank                   |

Suggested measurement procedure:

1. Open the demo dashboard or your app with remote Android debugging enabled.
2. Enable CPU throttling and network constraints in Chrome DevTools.
3. Compare baseline visuals vs `adaptivePerformanceMode` enabled.
4. Log FPS, dropped frames, and event counts over a 30 to 60 second interaction window.

Representative benchmark metrics to capture:

- Mean FPS
- P5 FPS floor
- Dropped frames per minute
- Long task count over 50ms
- Route transition duration
- Scroll velocity vs dropped frame spikes

## Android and WebView optimization notes

- Old Android WebViews are far less forgiving with blur, shadow layers, and large particle canvases.
- Embedded browsers often look like modern Chrome in the user agent, but their memory ceiling is lower and their tab lifecycle is harsher.
- `translateZ(0)` is used conservatively to bias toward compositor-friendly motion without forcing layout reads.
- The runtime prefers reducing visual density before fully pausing UX-critical motion.
- If your hybrid shell already has a native low-power toggle, pipe that signal into a manual `setMode("low")` override.

## Low-end device testing

Use this package on the devices that usually get ignored in PR previews:

1. Android Go or low-memory Samsung/Xiaomi devices.
2. A WebView wrapper with an older Chromium engine.
3. iPhone running a WKWebView inside a hybrid shell with a warm battery.
4. A throttled desktop browser only as a secondary sanity check.

Checklist:

- Watch the HUD while opening menus, scrolling, and navigating.
- Force stress until the mode drops from `high` to `medium` or `low`.
- Confirm heavy blur and particle effects collapse before user-visible stutter appears.
- Verify cleanup by mounting and unmounting adaptive controllers during route changes.
- Run the benchmark harness with the same preset and duration before and after code changes.

## Architecture

The implementation is built around a few non-negotiables:

- No runtime dependency chain
- Cleanup-first controllers to avoid leaks
- DOM reads and writes split through RAF batching
- Passive scroll, wheel, and touch listeners
- No forced layout loops in the hot path
- Runtime telemetry cached and reused by the detector
- React hooks isolated behind a subpath export

## Performance philosophy

The goal is not to preserve every flourish at all costs. The goal is to preserve perceived fluidity.

If the runtime has to choose between:

- a beautiful blur layer and a 38 FPS route transition
- or a flatter interface and a 56 FPS route transition

it should choose the second option before the user notices the first one failing.

## GIF placeholders

- `dashboard-live-hud.gif` placeholder: live FPS HUD with mode changes.
- `low-end-android-before-after.gif` placeholder: same scene before and after adaptive downgrade.
- `scroll-jank-heatmap.gif` placeholder: dropped frame heatmap reacting to scroll stress.

## Project structure

```text
webview-performance-shield/
├─ demo/
│  ├─ benchmark.html
│  ├─ index.html
│  ├─ src/
│  │  ├─ App.tsx
│  │  ├─ benchmark.css
│  │  └─ benchmark.ts
│  │  ├─ main.tsx
│  │  └─ styles.css
│  └─ vite.config.ts
├─ src/
│  ├─ adaptive.ts
│  ├─ animation-optimizer.ts
│  ├─ device.ts
│  ├─ fps-monitor.ts
│  ├─ index.ts
│  ├─ overlay.ts
│  ├─ react.ts
│  ├─ scroll-jank.ts
│  ├─ shared.ts
│  ├─ telemetry.ts
│  └─ types.ts
├─ LICENSE
├─ package.json
├─ tests/
│  ├─ device.test.ts
│  ├─ fps-monitor.test.ts
│  └─ ssr.test.ts
├─ tsconfig.json

├─ vitest.config.ts
└─ vite.config.ts
```

## Publish readiness

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run pack:check`

The package is configured with:

- export maps
- optional React peer dependencies
- `files` whitelist for npm publish
- dual ESM/CJS outputs
- declaration generation
- public publish access

import {
	adaptivePerformanceMode,
	createFPSMonitor,
	detectWeakDevice,
	preventScrollJank,
	type DeviceProfile,
	type OptimizationEvent,
	type PerformanceMode
} from "webview-performance-shield"
import "./benchmark.css"

interface BenchmarkPreset {
	id: string
	label: string
	description: string
	durationMs: number
	boxCount: number
	particleCount: number
	cpuCost: number
	scrollDistance: number
}

interface BenchmarkSummary {
	preset: string
	durationMs: number
	averageFPS: number
	p5FPS: number
	minFPS: number
	averageScore: number
	droppedFrames: number
	modeChanges: number
	finalMode: PerformanceMode
	deviceScore: number
	reasonCodes: string[]
	timestamp: string
}

const PRESETS: BenchmarkPreset[] = [
	{
		id: "android-go",
		label: "Android Go WebView",
		description: "Aggressive motion and DOM churn for low-end Android / embedded shells.",
		durationMs: 7000,
		boxCount: 22,
		particleCount: 48,
		cpuCost: 3400,
		scrollDistance: 920
	},
	{
		id: "mid-tier-shell",
		label: "Mid-tier Hybrid Shell",
		description:
			"Balanced workload for realistic route transitions and background effects.",
		durationMs: 6500,
		boxCount: 16,
		particleCount: 32,
		cpuCost: 2200,
		scrollDistance: 760
	},
	{
		id: "high-refresh-ui",
		label: "High-refresh UI Stress",
		description:
			"Checks whether the runtime keeps frame pacing stable under denser motion.",
		durationMs: 5500,
		boxCount: 14,
		particleCount: 20,
		cpuCost: 1600,
		scrollDistance: 540
	}
]

function getRequiredElement<T extends Element>(
	selector: string,
	parent: ParentNode = document
): T {
	const element = parent.querySelector<T>(selector)

	if (!element) {
		throw new Error(`Missing benchmark element: ${selector}`)
	}

	return element
}

const urlParams = new URLSearchParams(window.location.search)
const app = getRequiredElement<HTMLDivElement>("#app")

app.innerHTML = `
	<section class="bench-panel bench-hero">
		<span class="bench-tag">Benchmark Lab</span>
		<h1>Repeatable low-end device comparisons for real hybrid UI pain.</h1>
		<p>
			Run fixed workloads, collect FPS telemetry, track adaptive downgrades, and compare JSON summaries across devices or commits.
		</p>
	</section>

	<section class="bench-panel bench-meta">
		<div class="bench-actions">
			<label class="bench-control">
				<span class="bench-label">Preset</span>
				<select data-role="preset-select"></select>
			</label>

			<label class="bench-control">
				<span class="bench-label">Duration override (ms)</span>
				<input data-role="duration-input" type="number" min="2000" step="500" placeholder="optional" />
			</label>

			<div class="bench-control">
				<span class="bench-label">Run</span>
				<button class="bench-button" data-role="run-selected">Run selected preset</button>
			</div>
		</div>

		<div class="bench-actions">
			<div class="bench-control">
				<span class="bench-label">Comparison suite</span>
				<button class="bench-button" data-role="run-all">Run all presets</button>
			</div>

			<div class="bench-control">
				<span class="bench-label">Output</span>
				<button class="bench-copy" data-role="copy-json">Copy JSON summary</button>
			</div>

			<div class="bench-control">
				<span class="bench-label">Workflow</span>
				<p>Use the same preset, same device state, and the same browser build before comparing results.</p>
			</div>
		</div>
	</section>

	<section class="bench-preset-grid"></section>
	<section class="bench-status-grid"></section>
	<section class="bench-panel bench-scene" data-role="scene"></section>
	<section class="bench-panel bench-results"></section>
`

const presetSelect = getRequiredElement<HTMLSelectElement>(
	"[data-role='preset-select']",
	app
)
const durationInput = getRequiredElement<HTMLInputElement>(
	"[data-role='duration-input']",
	app
)
const runSelectedButton = getRequiredElement<HTMLButtonElement>(
	"[data-role='run-selected']",
	app
)
const runAllButton = getRequiredElement<HTMLButtonElement>("[data-role='run-all']", app)
const copyButton = getRequiredElement<HTMLButtonElement>("[data-role='copy-json']", app)
const presetGrid = getRequiredElement<HTMLElement>(".bench-preset-grid", app)
const statusGrid = getRequiredElement<HTMLElement>(".bench-status-grid", app)
const scene = getRequiredElement<HTMLElement>("[data-role='scene']", app)
const results = getRequiredElement<HTMLElement>(".bench-results", app)

const actualProfile = detectWeakDevice()
let lastResults: BenchmarkSummary[] = []
let activeRun = false

function average(values: number[]): number {
	if (values.length === 0) {
		return 0
	}

	return values.reduce((total, value) => total + value, 0) / values.length
}

function percentile(values: number[], target: number): number {
	if (values.length === 0) {
		return 0
	}

	const sorted = [...values].sort((left, right) => left - right)
	const index = Math.min(
		sorted.length - 1,
		Math.max(0, Math.floor(sorted.length * target))
	)
	return sorted[index]
}

function renderPresetCards(): void {
	presetSelect.innerHTML = PRESETS.map(
		(preset) => `<option value="${preset.id}">${preset.label}</option>`
	).join("")

	presetGrid.innerHTML = PRESETS.map(
		(preset) => `
			<article class="bench-card">
				<span class="bench-label">${preset.label}</span>
				<strong>${Math.round(preset.cpuCost / 100) / 10}k</strong>
				<p>${preset.description}</p>
				<p>${preset.boxCount} boxes · ${preset.particleCount} particles · ${preset.durationMs}ms</p>
			</article>
		`
	).join("")
}

function renderStatus(profile: DeviceProfile): void {
	statusGrid.innerHTML = `
		<article class="bench-card bench-metric">
			<span class="bench-label">Detected device</span>
			<strong>${profile.score}</strong>
			<p>${profile.lowEnd ? "low-end / guarded" : profile.recommendedMode + " mode default"}</p>
		</article>
		<article class="bench-card bench-metric">
			<span class="bench-label">WebView profile</span>
			<strong>${profile.webView.platform}</strong>
			<p>${profile.reasonCodes.join(" • ") || "healthy baseline"}</p>
		</article>
		<article class="bench-card bench-metric">
			<span class="bench-label">Repeatability tip</span>
			<strong>${urlParams.get("autorun") === "1" ? "autorun" : "manual"}</strong>
			<p>Keep brightness, battery mode, and browser tab focus stable between runs.</p>
		</article>
	`
}

function renderResults(rows: BenchmarkSummary[] = lastResults): void {
	const jsonPayload = JSON.stringify(
		{
			device: {
				score: actualProfile.score,
				recommendedMode: actualProfile.recommendedMode,
				webView: actualProfile.webView.platform,
				reasonCodes: actualProfile.reasonCodes
			},
			results: rows
		},
		null,
		2
	)

	results.innerHTML = `
		<div>
			<span class="bench-label">Benchmark results</span>
			<p>Compare the exported JSON across devices, throttling presets, or branches to catch performance regressions before shipping.</p>
		</div>
		<div class="bench-results-grid">
			<article class="bench-card">
				<span class="bench-label">Runs captured</span>
				<strong>${rows.length}</strong>
				<p>${rows.length === 0 ? "No data yet" : rows.map((row) => row.preset).join(" • ")}</p>
			</article>
			<article class="bench-card">
				<span class="bench-label">Lowest P5 FPS</span>
				<strong>${rows.length === 0 ? "0.0" : Math.min(...rows.map((row) => row.p5FPS)).toFixed(1)}</strong>
				<p>Lower numbers here usually indicate visible pacing issues.</p>
			</article>
			<article class="bench-card">
				<span class="bench-label">Mode changes</span>
				<strong>${rows.reduce((total, row) => total + row.modeChanges, 0)}</strong>
				<p>High counts show adaptive downgrades were actively shielding the UI.</p>
			</article>
		</div>
		<table class="bench-table">
			<thead>
				<tr>
					<th>Preset</th>
					<th>Avg FPS</th>
					<th>P5 FPS</th>
					<th>Dropped frames</th>
					<th>Final mode</th>
					<th>Avg score</th>
				</tr>
			</thead>
			<tbody>
				${
					rows
						.map(
							(row) => `
						<tr>
							<td>${row.preset}</td>
							<td>${row.averageFPS.toFixed(1)}</td>
							<td>${row.p5FPS.toFixed(1)}</td>
							<td>${row.droppedFrames}</td>
							<td>${row.finalMode}</td>
							<td>${row.averageScore.toFixed(1)}</td>
						</tr>
					`
						)
						.join("") || `<tr><td colspan="6">No benchmark run yet.</td></tr>`
				}
			</tbody>
		</table>
		<textarea class="bench-json" readonly>${jsonPayload}</textarea>
	`
}

function setSceneStatus(message: string): void {
	scene.innerHTML = `
		<div class="bench-scene-copy">
			<span class="bench-label">Scene status</span>
			<p>${message}</p>
		</div>
	`
}

function createScene(preset: BenchmarkPreset): {
	boxes: HTMLElement[]
	particles: HTMLElement[]
	scroller: HTMLElement
} {
	scene.innerHTML = `
		<div class="bench-scene-copy">
			<span class="bench-label">${preset.label}</span>
			<p>${preset.description}</p>
		</div>
	`

	const scroller = document.createElement("div")
	Object.assign(scroller.style, {
		position: "absolute",
		inset: "0",
		overflow: "auto",
		padding: "18px"
	})

	const surface = document.createElement("div")
	Object.assign(surface.style, {
		position: "relative",
		minHeight: `${preset.scrollDistance + 420}px`
	})

	const boxes = Array.from({ length: preset.boxCount }, (_, index) => {
		const box = document.createElement("div")
		box.className = "bench-box"
		box.dataset.animate = "true"
		box.dataset.heavyEffect = "true"
		box.style.left = `${(index % 5) * 16 + 6}%`
		box.style.top = `${Math.floor(index / 5) * 120 + 16}px`
		surface.appendChild(box)
		return box
	})

	const particles = Array.from({ length: preset.particleCount }, (_, index) => {
		const particle = document.createElement("span")
		particle.className = "bench-particle"
		particle.dataset.particleSystem = "true"
		particle.style.left = `${(index * 7) % 100}%`
		particle.style.top = `${(index * 19) % 88}%`
		surface.appendChild(particle)
		return particle
	})

	scroller.appendChild(surface)
	scene.appendChild(scroller)

	return { boxes, particles, scroller }
}

async function runPreset(
	preset: BenchmarkPreset,
	durationOverride?: number
): Promise<BenchmarkSummary> {
	const durationMs =
		durationOverride && durationOverride > 0 ? durationOverride : preset.durationMs
	const runtimeScene = createScene(preset)
	const monitor = createFPSMonitor({ lowFPSThreshold: 50, targetFPS: 60 })
	const adaptive = adaptivePerformanceMode({
		root: scene,
		monitor,
		autoStart: false
	})
	const scrollGuard = preventScrollJank({ target: runtimeScene.scroller })
	const fpsSamples: number[] = []
	const scoreSamples: number[] = []
	let modeChanges = 0
	let latestMode: PerformanceMode = adaptive.getState().mode
	let rafId = 0
	let frame = 0
	let sink = 0

	const unsubscribeMonitor = monitor.subscribe((snapshot) => {
		fpsSamples.push(snapshot.fps)
		scoreSamples.push(snapshot.score)
	})

	const unsubscribeEvents = adaptive.onEvent((event: OptimizationEvent) => {
		if (event.type === "mode-change") {
			modeChanges += 1
			latestMode = event.mode
		}
	})

	monitor.start()

	const startedAt = performance.now()

	await new Promise<void>((resolve) => {
		const loop = (now: number) => {
			const elapsed = now - startedAt

			if (elapsed >= durationMs) {
				resolve()
				return
			}

			const wave = Math.sin(frame / 11)
			const pulse = Math.cos(frame / 17)

			for (let index = 0; index < preset.cpuCost; index += 1) {
				sink += Math.sqrt(((index + frame) % 97) + (sink % 13))
			}

			runtimeScene.boxes.forEach((box, index) => {
				const x = Math.sin(frame / 8 + index) * 18 + index * 2
				const y = Math.cos(frame / 10 + index * 0.6) * 24
				const scale = 1 + Math.sin(frame / 18 + index) * 0.12
				box.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
				box.style.opacity = `${0.6 + ((wave + 1) / 2) * 0.35}`
			})

			runtimeScene.particles.forEach((particle, index) => {
				const x = ((frame * 0.8 + index * 13) % (scene.clientWidth + 40)) - 20
				const y = 40 + Math.sin(frame / 9 + index) * 90 + (index % 6) * 28
				particle.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${0.75 + ((pulse + 1) / 2) * 0.5})`
			})

			runtimeScene.scroller.scrollTop = (elapsed / durationMs) * preset.scrollDistance
			frame += 1
			rafId = window.requestAnimationFrame(loop)
		}

		rafId = window.requestAnimationFrame(loop)
	})

	window.cancelAnimationFrame(rafId)
	scrollGuard.flush()
	scrollGuard.dispose()
	monitor.stop()
	unsubscribeMonitor()
	unsubscribeEvents()

	const adaptiveState = adaptive.getState()
	adaptive.dispose()

	const summary: BenchmarkSummary = {
		preset: preset.label,
		durationMs,
		averageFPS: average(fpsSamples),
		p5FPS: percentile(fpsSamples, 0.05),
		minFPS: fpsSamples.length === 0 ? 0 : Math.min(...fpsSamples),
		averageScore: average(scoreSamples),
		droppedFrames: adaptiveState.droppedFrames,
		modeChanges,
		finalMode: latestMode,
		deviceScore: actualProfile.score,
		reasonCodes: actualProfile.reasonCodes,
		timestamp: new Date().toISOString()
	}

	setSceneStatus(
		`Completed ${preset.label}. Avg FPS ${summary.averageFPS.toFixed(1)}, P5 FPS ${summary.p5FPS.toFixed(1)}, final mode ${summary.finalMode}.`
	)
	return summary
}

async function runBenchmarks(presetIds: string[]): Promise<void> {
	if (activeRun) {
		return
	}

	activeRun = true
	runSelectedButton.disabled = true
	runAllButton.disabled = true
	copyButton.disabled = true
	setSceneStatus(
		"Running benchmark workload. Keep this tab focused for repeatable results."
	)

	const durationOverride = Number(durationInput.value)
	const summaries: BenchmarkSummary[] = []

	for (const presetId of presetIds) {
		const preset = PRESETS.find((entry) => entry.id === presetId)

		if (!preset) {
			continue
		}

		setSceneStatus(`Running ${preset.label}...`)
		const summary = await runPreset(
			preset,
			Number.isFinite(durationOverride) ? durationOverride : undefined
		)
		summaries.push(summary)
		renderResults(summaries)
	}

	lastResults = summaries
	runSelectedButton.disabled = false
	runAllButton.disabled = false
	copyButton.disabled = false
	activeRun = false
}

runSelectedButton.addEventListener("click", () => {
	void runBenchmarks([presetSelect.value])
})

runAllButton.addEventListener("click", () => {
	void runBenchmarks(PRESETS.map((preset) => preset.id))
})

copyButton.addEventListener("click", async () => {
	const payload = JSON.stringify(
		{
			device: actualProfile,
			results: lastResults
		},
		null,
		2
	)

	await navigator.clipboard.writeText(payload)
	copyButton.textContent = "Copied JSON"
	window.setTimeout(() => {
		copyButton.textContent = "Copy JSON summary"
	}, 1200)
})

renderPresetCards()
renderStatus(actualProfile)
renderResults([])
setSceneStatus("Ready. Pick a preset or run the full comparison suite.")

const presetParam = urlParams.get("preset")

if (presetParam && PRESETS.some((preset) => preset.id === presetParam)) {
	presetSelect.value = presetParam
}

if (urlParams.get("duration")) {
	durationInput.value = urlParams.get("duration") ?? ""
}

if (urlParams.get("autorun") === "1") {
	const presetIds = presetParam ? [presetParam] : PRESETS.map((preset) => preset.id)

	void runBenchmarks(presetIds)
}

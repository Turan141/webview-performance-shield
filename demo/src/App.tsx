import { useEffect, useRef, useState } from "react"
import {
	adaptivePerformanceMode,
	createFPSMonitor,
	createPerformanceHUD,
	detectWeakDevice,
	preventScrollJank,
	type AdaptivePerformanceController,
	type FPSMonitor,
	type OptimizationEvent
} from "webview-performance-shield"
import {
	useAdaptivePerformance,
	useFPSMonitor,
	useReducedEffects
} from "webview-performance-shield/react"

const PARTICLES = Array.from({ length: 32 }, (_, index) => index)

function useControllers(rootRef: React.RefObject<HTMLElement>) {
	const monitorRef = useRef<FPSMonitor | null>(null)
	const adaptiveRef = useRef<AdaptivePerformanceController | null>(null)

	if (typeof window !== "undefined" && !monitorRef.current) {
		monitorRef.current = createFPSMonitor({ targetFPS: 60 })
	}

	if (typeof window !== "undefined" && !adaptiveRef.current) {
		adaptiveRef.current = adaptivePerformanceMode({
			root: rootRef.current ?? undefined,
			monitor: monitorRef.current ?? undefined,
			autoStart: true
		})
	}

	useEffect(() => {
		const monitor = monitorRef.current
		const adaptive = adaptiveRef.current

		if (!monitor || !adaptive) {
			return undefined
		}

		monitor.start()

		return () => {
			adaptive.dispose()
			monitor.stop()
		}
	}, [])

	return {
		monitor: monitorRef.current,
		adaptive: adaptiveRef.current
	}
}

export function App() {
	const shellRef = useRef<HTMLElement>(null)
	const { monitor, adaptive } = useControllers(shellRef)
	const fps = useFPSMonitor({ monitor: monitor ?? undefined })
	const adaptiveState = useAdaptivePerformance({ controller: adaptive ?? undefined })
	const reducedEffects = useReducedEffects({ controller: adaptive ?? undefined })
	const [hudEnabled, setHudEnabled] = useState(true)
	const [stressLevel, setStressLevel] = useState(36)
	const [renderLoad, setRenderLoad] = useState(22)
	const [events, setEvents] = useState<OptimizationEvent[]>([])
	const [sceneTick, setSceneTick] = useState(0)
	const profile = adaptiveState.profile ?? detectWeakDevice()

	useEffect(() => {
		if (!adaptive) {
			return undefined
		}

		return adaptive.onEvent((event) => {
			setEvents((current) => [event, ...current].slice(0, 10))
		})
	}, [adaptive])

	useEffect(() => {
		if (!monitor) {
			return undefined
		}

		const scrollController = preventScrollJank({ target: window })
		return () => {
			scrollController.dispose()
		}
	}, [monitor])

	useEffect(() => {
		if (!monitor || !adaptive || !hudEnabled) {
			return undefined
		}

		const hud = createPerformanceHUD({
			monitor,
			adaptive,
			position: "bottom-right"
		})

		return () => {
			hud.destroy()
		}
	}, [adaptive, hudEnabled, monitor])

	useEffect(() => {
		if (typeof window === "undefined") {
			return undefined
		}

		let rafId = 0
		let frame = 0
		let sink = 0

		const run = () => {
			const started = performance.now()
			const loops = 300 + stressLevel * 420

			for (let index = 0; index < loops; index += 1) {
				sink += Math.sqrt(((index + frame) % 97) + (sink % 11))
			}

			frame += 1

			if (frame % 6 === 0) {
				const elapsed = performance.now() - started
				setRenderLoad(
					Math.min(100, Math.round((elapsed / 16.67) * 100 + stressLevel * 0.35))
				)
				setSceneTick((value) => (value + 1) % 1000)
			}

			rafId = window.requestAnimationFrame(run)
		}

		rafId = window.requestAnimationFrame(run)

		return () => {
			window.cancelAnimationFrame(rafId)
		}
	}, [stressLevel])

	const deviceBand =
		profile.score >= 80 ? "flagship" : profile.score >= 56 ? "balanced" : "shielded"

	return (
		<main className='app-shell' ref={shellRef}>
			<section className='hero-panel glass-panel' data-heavy-effect='true'>
				<div className='hero-copy'>
					<span className='eyebrow'>
						Framer Motion + WebView + low-end Android finally fixed
					</span>
					<h1>
						Invisible performance guardrails for hybrid apps that refuse to stutter.
					</h1>
					<p>
						webview-performance-shield watches device capability, frame budget, and
						runtime instability, then quietly downshifts effects before the UI turns into
						dropped frames.
					</p>
				</div>

				<div className='hero-actions'>
					<label className='toggle-card'>
						<span>Dev HUD</span>
						<input
							type='checkbox'
							checked={hudEnabled}
							onChange={(event) => setHudEnabled(event.target.checked)}
						/>
					</label>

					<label className='slider-card glass-panel' data-heavy-effect='true'>
						<span>Stress level</span>
						<strong>{stressLevel}%</strong>
						<input
							type='range'
							min='0'
							max='100'
							value={stressLevel}
							onChange={(event) => setStressLevel(Number(event.target.value))}
						/>
					</label>
				</div>

				<div className='hero-particles' data-particle-system='true'>
					{PARTICLES.map((particle) => (
						<span
							key={particle}
							className='particle'
							data-particle-system='true'
							style={{
								["--particle-index" as "--particle-index"]: String(particle),
								["--particle-phase" as "--particle-phase"]: String(sceneTick + particle)
							}}
						/>
					))}
				</div>
			</section>

			<section className='metrics-grid'>
				<article
					className='metric-card glass-panel'
					data-heavy-effect='true'
					data-animate
				>
					<span className='label'>Live FPS</span>
					<strong>{fps.fps.toFixed(1)}</strong>
					<p>{fps.averageFrameTime.toFixed(2)}ms average frame time</p>
				</article>

				<article
					className='metric-card glass-panel'
					data-heavy-effect='true'
					data-animate
				>
					<span className='label'>Device quality</span>
					<strong>{deviceBand}</strong>
					<p>{profile.reasonCodes.join(" • ") || "healthy render budget"}</p>
				</article>

				<article
					className='metric-card glass-panel'
					data-heavy-effect='true'
					data-animate
				>
					<span className='label'>Render load</span>
					<strong>{renderLoad}%</strong>
					<p>{adaptiveState.effects.renderBatching ? "raf batched" : "full fidelity"}</p>
				</article>

				<article
					className='metric-card glass-panel'
					data-heavy-effect='true'
					data-animate
				>
					<span className='label'>Dropped frames</span>
					<strong>{adaptiveState.droppedFrames}</strong>
					<p>{adaptiveState.eventCount} optimization events recorded</p>
				</article>
			</section>

			<section className='showcase-grid'>
				<article className='showcase-card glass-panel' data-heavy-effect='true'>
					<header>
						<span className='label'>Adaptive engine</span>
						<strong>{adaptiveState.mode}</strong>
					</header>

					<ul className='state-list'>
						<li>Particles: {reducedEffects.reduceParticles ? "disabled" : "active"}</li>
						<li>Blur: {reducedEffects.reduceBlur ? "reduced" : "full"}</li>
						<li>
							Heavy effects: {reducedEffects.disableHeavyEffects ? "shielded" : "allowed"}
						</li>
						<li>Score: {adaptiveState.score}</li>
					</ul>

					<div className='mode-buttons'>
						<button type='button' onClick={() => adaptive?.setMode("high")}>
							Force high
						</button>
						<button type='button' onClick={() => adaptive?.setMode("medium")}>
							Force medium
						</button>
						<button type='button' onClick={() => adaptive?.setMode("low")}>
							Force low
						</button>
					</div>
				</article>

				<article
					className='showcase-card event-card glass-panel'
					data-heavy-effect='true'
				>
					<header>
						<span className='label'>Optimization events</span>
						<strong>Live feed</strong>
					</header>

					<div className='event-list'>
						{events.length === 0 ? (
							<p>No events yet. Increase stress to force a downgrade.</p>
						) : null}
						{events.map((event) => (
							<div className='event-row' key={`${event.timestamp}-${event.detail}`}>
								<span>{event.type}</span>
								<strong>{event.mode}</strong>
								<p>{event.detail}</p>
							</div>
						))}
					</div>
				</article>

				<article
					className='showcase-card comparison-card glass-panel'
					data-heavy-effect='true'
				>
					<header>
						<span className='label'>WebView notes</span>
						<strong>{profile.webView.platform}</strong>
					</header>

					<p>
						GPU transforms only: {adaptiveState.effects.gpuTransformsOnly ? "on" : "off"}.
						Repaint pressure:{" "}
						{adaptiveState.effects.reducedRepaints ? "reduced" : "normal"}. Memory-safe
						scheduling: {adaptiveState.effects.memorySafeScheduling ? "enabled" : "idle"}.
					</p>

					<div className='status-pills'>
						<span>
							{profile.webView.detected ? "Embedded browser" : "Standard browser"}
						</span>
						<span>{profile.refreshRateEstimate}hz estimate</span>
						<span>{profile.gpuTier} GPU</span>
					</div>
				</article>
			</section>
		</main>
	)
}

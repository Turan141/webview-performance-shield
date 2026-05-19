import { updateRuntimeSignals } from "./telemetry"
import { average, clamp, createEmitter, isBrowser, standardDeviation } from "./shared"
import type { FPSMonitor, FPSMonitorOptions, FPSSnapshot } from "./types"

function createEmptySnapshot(lowFPSThreshold: number): FPSSnapshot {
	return {
		fps: 60,
		averageFrameTime: 16.67,
		droppedFrames: 0,
		totalFrames: 0,
		lowFPSThreshold,
		unstable: false,
		refreshRateEstimate: 60,
		score: 100,
		lastFrameTime: 0
	}
}

export function createFPSMonitor(options: FPSMonitorOptions = {}): FPSMonitor {
	const targetFPS = options.targetFPS ?? 60
	const sampleWindow = options.sampleWindow ?? 45
	const lowFPSThreshold = options.lowFPSThreshold ?? Math.max(45, targetFPS - 10)
	const dropThresholdMs = options.dropThresholdMs ?? 34
	const emitter = createEmitter<FPSSnapshot>()
	const dropEmitter = createEmitter<FPSSnapshot>()
	const frameTimes: number[] = []

	let rafId = 0
	let running = false
	let lastFrame = 0
	let droppedFrames = 0
	let totalFrames = 0
	let snapshot = createEmptySnapshot(lowFPSThreshold)

	const publish = (nextSnapshot: FPSSnapshot) => {
		snapshot = nextSnapshot
		updateRuntimeSignals({
			recentFPS: nextSnapshot.fps,
			refreshRateEstimate: nextSnapshot.refreshRateEstimate,
			droppedFrames: nextSnapshot.droppedFrames,
			fpsUnstable: nextSnapshot.unstable,
			score: nextSnapshot.score
		})
		emitter.emit(nextSnapshot)
	}

	const tick = (now: number) => {
		if (!running) {
			return
		}

		if (lastFrame !== 0) {
			const frameTime = now - lastFrame
			frameTimes.push(frameTime)

			if (frameTimes.length > sampleWindow) {
				frameTimes.shift()
			}

			totalFrames += 1

			const averageFrameTime = average(frameTimes) || 1000 / targetFPS
			const sortedSamples = [...frameTimes].sort((left, right) => left - right)
			const fastestFrame =
				sortedSamples[Math.max(0, Math.floor(sortedSamples.length * 0.15) - 1)] ??
				averageFrameTime
			const refreshRateEstimate = clamp(
				Math.round(1000 / Math.max(8, fastestFrame)),
				30,
				120
			)
			const fps = Number((1000 / Math.max(1, averageFrameTime)).toFixed(1))
			const unstable = frameTimes.length >= 10 && standardDeviation(frameTimes) > 4.5
			const idealFrameTime = 1000 / targetFPS

			if (frameTime > idealFrameTime * 1.5) {
				droppedFrames += Math.max(1, Math.round(frameTime / idealFrameTime) - 1)
			}

			const dropPenalty = (droppedFrames / Math.max(1, totalFrames)) * 180
			const lowFPSPenalty = Math.max(0, lowFPSThreshold - fps) * 2.2
			const instabilityPenalty = unstable ? 10 : 0
			const score = clamp(
				Math.round(100 - dropPenalty - lowFPSPenalty - instabilityPenalty),
				0,
				100
			)

			const nextSnapshot: FPSSnapshot = {
				fps,
				averageFrameTime: Number(averageFrameTime.toFixed(2)),
				droppedFrames,
				totalFrames,
				lowFPSThreshold,
				unstable,
				refreshRateEstimate,
				score,
				lastFrameTime: frameTime
			}

			publish(nextSnapshot)

			if (frameTime >= dropThresholdMs || fps < lowFPSThreshold) {
				dropEmitter.emit(nextSnapshot)
			}
		}

		lastFrame = now
		rafId = window.requestAnimationFrame(tick)
	}

	return {
		start(): void {
			if (!isBrowser || running) {
				return
			}

			running = true
			rafId = window.requestAnimationFrame(tick)
		},
		stop(): void {
			if (!isBrowser || !running) {
				return
			}

			running = false
			window.cancelAnimationFrame(rafId)
			rafId = 0
		},
		reset(): void {
			frameTimes.length = 0
			droppedFrames = 0
			totalFrames = 0
			lastFrame = 0
			snapshot = createEmptySnapshot(lowFPSThreshold)
			publish(snapshot)
		},
		onDrop(listener) {
			return dropEmitter.subscribe(listener)
		},
		subscribe(listener) {
			return emitter.subscribe(listener)
		},
		getSnapshot() {
			return snapshot
		},
		isRunning() {
			return running
		}
	}
}

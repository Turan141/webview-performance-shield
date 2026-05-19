import { detectWeakDevice } from "./device"
import { createFPSMonitor } from "./fps-monitor"
import { optimizeAnimations } from "./animation-optimizer"
import { clamp, createEmitter, safeNow } from "./shared"
import type {
	AdaptivePerformanceController,
	AdaptivePerformanceOptions,
	AdaptivePerformanceState,
	DeviceProfile,
	FPSSnapshot,
	OptimizationEvent,
	PerformanceMode
} from "./types"

const MODE_SEVERITY: Record<PerformanceMode, number> = {
	high: 0,
	medium: 1,
	low: 2
}

function severityToMode(severity: number): PerformanceMode {
	if (severity >= 2) {
		return "low"
	}

	if (severity >= 1) {
		return "medium"
	}

	return "high"
}

function mergeScore(profile: DeviceProfile, fps: FPSSnapshot): number {
	return clamp(Math.round(profile.score * 0.55 + fps.score * 0.45), 0, 100)
}

export function calculatePerformanceScore(
	profile: DeviceProfile,
	fps: FPSSnapshot
): number {
	return mergeScore(profile, fps)
}

export function adaptivePerformanceMode(
	options: AdaptivePerformanceOptions = {}
): AdaptivePerformanceController {
	const profile = options.profile ?? detectWeakDevice()
	const monitor =
		options.monitor ?? createFPSMonitor({ autoStart: options.autoStart !== false })
	const ownsMonitor = !options.monitor
	const optimizer = optimizeAnimations({
		root: options.root,
		initialMode: profile.recommendedMode,
		profile,
		watchMutations: true
	})
	const stateEmitter = createEmitter<AdaptivePerformanceState>()
	const eventEmitter = createEmitter<OptimizationEvent>()

	let eventCount = 0
	let runtimePenalty = 0
	let snapshot = monitor.getSnapshot()
	let manualSeverity: number | null = null

	const baseSeverity = MODE_SEVERITY[profile.recommendedMode]

	const publishEvent = (
		type: OptimizationEvent["type"],
		detail: string,
		mode: PerformanceMode
	) => {
		const event: OptimizationEvent = {
			type,
			timestamp: safeNow(),
			mode,
			score: mergeScore(profile, snapshot),
			detail
		}
		eventCount += 1
		eventEmitter.emit(event)
		options.onEvent?.(event)
	}

	const buildState = (): AdaptivePerformanceState => {
		const severity = manualSeverity ?? clamp(baseSeverity + runtimePenalty, 0, 2)
		const mode = severityToMode(severity)
		const effects = optimizer.update(mode)

		return {
			mode,
			profile,
			fps: snapshot,
			effects,
			score: mergeScore(profile, snapshot),
			droppedFrames: snapshot.droppedFrames,
			eventCount
		}
	}

	let state = buildState()

	const publishState = () => {
		state = buildState()
		stateEmitter.emit(state)
	}

	publishEvent(
		"profile",
		`profile score ${profile.score} (${profile.reasonCodes.join(", ") || "balanced"})`,
		state.mode
	)
	publishState()

	const unsubscribeDrop = monitor.onDrop((nextSnapshot) => {
		snapshot = nextSnapshot
		runtimePenalty = clamp(runtimePenalty + (nextSnapshot.fps < 40 ? 2 : 1), 0, 2)
		const nextMode = severityToMode(
			manualSeverity ?? clamp(baseSeverity + runtimePenalty, 0, 2)
		)
		publishEvent(
			"drop",
			`fps ${nextSnapshot.fps.toFixed(1)} with ${nextSnapshot.droppedFrames} dropped frames`,
			nextMode
		)
		publishState()
	})

	const unsubscribe = monitor.subscribe((nextSnapshot) => {
		const previousMode = state.mode
		snapshot = nextSnapshot

		if (
			!nextSnapshot.unstable &&
			nextSnapshot.fps >= Math.max(nextSnapshot.lowFPSThreshold + 4, 54) &&
			runtimePenalty > 0
		) {
			runtimePenalty = clamp(runtimePenalty - 1, 0, 2)
			const nextMode = severityToMode(
				manualSeverity ?? clamp(baseSeverity + runtimePenalty, 0, 2)
			)
			publishEvent(
				"recover",
				`fps stabilized at ${nextSnapshot.fps.toFixed(1)}`,
				nextMode
			)
		}

		publishState()

		if (state.mode !== previousMode) {
			publishEvent("mode-change", `switched to ${state.mode} mode`, state.mode)
			publishState()
		}
	})

	if (ownsMonitor && options.autoStart !== false) {
		monitor.start()
	}

	return {
		getState() {
			return state
		},
		subscribe(listener) {
			return stateEmitter.subscribe(listener)
		},
		onEvent(listener) {
			return eventEmitter.subscribe(listener)
		},
		setMode(mode) {
			manualSeverity = MODE_SEVERITY[mode]
			publishEvent("mode-change", `manual override -> ${mode}`, mode)
			publishState()
		},
		dispose() {
			unsubscribe()
			unsubscribeDrop()
			optimizer.dispose()

			if (ownsMonitor) {
				monitor.stop()
			}
		}
	}
}

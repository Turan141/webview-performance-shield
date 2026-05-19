import { useEffect, useRef, useSyncExternalStore } from "react"
import { adaptivePerformanceMode } from "./adaptive"
import { detectWeakDevice } from "./device"
import { createFPSMonitor } from "./fps-monitor"
import type {
	AdaptivePerformanceController,
	AdaptivePerformanceOptions,
	AdaptivePerformanceState,
	DeviceProfile,
	FPSMonitor,
	FPSMonitorOptions,
	FPSSnapshot
} from "./types"

export interface UseFPSMonitorOptions extends FPSMonitorOptions {
	monitor?: FPSMonitor
}

export interface UseAdaptivePerformanceOptions extends AdaptivePerformanceOptions {
	controller?: AdaptivePerformanceController
}

const SERVER_PROFILE: DeviceProfile = {
	lowEnd: false,
	recommendedMode: "high",
	disableHeavyEffects: false,
	reduceBlur: false,
	reduceParticles: false,
	batterySaver: false,
	thermalThrottlingHint: false,
	fpsUnstable: false,
	refreshRateEstimate: 60,
	memoryGB: null,
	cpuCores: null,
	gpuTier: "unknown",
	webView: {
		detected: false,
		platform: "browser",
		limited: false,
		embedded: false
	},
	score: 100,
	reasonCodes: []
}

const SERVER_FPS: FPSSnapshot = {
	fps: 60,
	averageFrameTime: 16.67,
	droppedFrames: 0,
	totalFrames: 0,
	lowFPSThreshold: 50,
	unstable: false,
	refreshRateEstimate: 60,
	score: 100,
	lastFrameTime: 0
}

const SERVER_ADAPTIVE: AdaptivePerformanceState = {
	mode: "high",
	profile: SERVER_PROFILE,
	fps: SERVER_FPS,
	effects: {
		mode: "high",
		animationScale: 1,
		blurLevel: 1,
		particlesEnabled: true,
		heavyEffectsEnabled: true,
		shadowQuality: "full",
		gpuTransformsOnly: false,
		renderBatching: false,
		reducedRepaints: false,
		memorySafeScheduling: false
	},
	score: 100,
	droppedFrames: 0,
	eventCount: 0
}

function useStableMonitor(options: UseFPSMonitorOptions = {}): FPSMonitor | null {
	const monitorRef = useRef<FPSMonitor | null>(options.monitor ?? null)

	if (!monitorRef.current && typeof window !== "undefined") {
		monitorRef.current = createFPSMonitor(options)
	}

	return monitorRef.current
}

function useStableController(
	options: UseAdaptivePerformanceOptions = {}
): AdaptivePerformanceController | null {
	const controllerRef = useRef<AdaptivePerformanceController | null>(
		options.controller ?? null
	)

	if (!controllerRef.current && typeof window !== "undefined") {
		controllerRef.current = adaptivePerformanceMode(options)
	}

	return controllerRef.current
}

export function useFPSMonitor(options: UseFPSMonitorOptions = {}): FPSSnapshot {
	const monitor = useStableMonitor(options)

	useEffect(() => {
		if (!monitor || options.monitor) {
			return undefined
		}

		monitor.start()
		return () => {
			monitor.stop()
		}
	}, [monitor, options.monitor])

	return useSyncExternalStore(
		(onStoreChange) =>
			monitor ? monitor.subscribe(() => onStoreChange()) : () => undefined,
		() => monitor?.getSnapshot() ?? SERVER_FPS,
		() => SERVER_FPS
	)
}

export function useAdaptivePerformance(
	options: UseAdaptivePerformanceOptions = {}
): AdaptivePerformanceState {
	const controller = useStableController(options)

	useEffect(() => {
		if (!controller || options.controller) {
			return undefined
		}

		return () => {
			controller.dispose()
		}
	}, [controller, options.controller])

	return useSyncExternalStore(
		(onStoreChange) =>
			controller ? controller.subscribe(() => onStoreChange()) : () => undefined,
		() => controller?.getState() ?? SERVER_ADAPTIVE,
		() => SERVER_ADAPTIVE
	)
}

export function useReducedEffects(options: UseAdaptivePerformanceOptions = {}) {
	const adaptiveState = useAdaptivePerformance(options)
	const profile = adaptiveState.profile ?? detectWeakDevice()

	return {
		disableHeavyEffects:
			!adaptiveState.effects.heavyEffectsEnabled || profile.disableHeavyEffects,
		reduceBlur: adaptiveState.effects.blurLevel < 0.8 || profile.reduceBlur,
		reduceParticles: !adaptiveState.effects.particlesEnabled || profile.reduceParticles,
		mode: adaptiveState.mode,
		score: adaptiveState.score
	}
}

export type { AdaptivePerformanceState, DeviceProfile, FPSSnapshot }

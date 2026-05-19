export { adaptivePerformanceMode, calculatePerformanceScore } from "./adaptive"
export { optimizeAnimations, resolveOptimizationState } from "./animation-optimizer"
export { detectWeakDevice, detectWebViewEnvironment } from "./device"
export { createFPSMonitor } from "./fps-monitor"
export { createPerformanceHUD } from "./overlay"
export { preventScrollJank } from "./scroll-jank"

export type {
	AdaptivePerformanceController,
	AdaptivePerformanceOptions,
	AdaptivePerformanceState,
	AnimationOptimizer,
	AnimationOptimizerOptions,
	DeviceProfile,
	FPSMonitor,
	FPSMonitorOptions,
	FPSSnapshot,
	OptimizationEvent,
	OptimizationState,
	PerformanceHUDController,
	PerformanceHUDOptions,
	PerformanceMode,
	ScrollJankController,
	ScrollJankOptions
} from "./types"

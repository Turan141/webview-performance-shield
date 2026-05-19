export type PerformanceMode = "low" | "medium" | "high"
export type ShadowQuality = "off" | "low" | "medium" | "full"
export type GPUTier = "weak" | "moderate" | "strong" | "unknown"
export type WebViewPlatform =
	| "browser"
	| "android-webview"
	| "ios-wkwebview"
	| "embedded-browser"
export type HUDPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface WebViewInfo {
	detected: boolean
	platform: WebViewPlatform
	limited: boolean
	embedded: boolean
}

export interface DeviceProfile {
	lowEnd: boolean
	recommendedMode: PerformanceMode
	disableHeavyEffects: boolean
	reduceBlur: boolean
	reduceParticles: boolean
	batterySaver: boolean
	thermalThrottlingHint: boolean
	fpsUnstable: boolean
	refreshRateEstimate: number
	memoryGB: number | null
	cpuCores: number | null
	gpuTier: GPUTier
	webView: WebViewInfo
	score: number
	reasonCodes: string[]
}

export interface FPSSnapshot {
	fps: number
	averageFrameTime: number
	droppedFrames: number
	totalFrames: number
	lowFPSThreshold: number
	unstable: boolean
	refreshRateEstimate: number
	score: number
	lastFrameTime: number
}

export interface FPSMonitorOptions {
	sampleWindow?: number
	dropThresholdMs?: number
	lowFPSThreshold?: number
	autoStart?: boolean
	targetFPS?: number
}

export interface FPSMonitor {
	start(): void
	stop(): void
	reset(): void
	onDrop(listener: (snapshot: FPSSnapshot) => void): () => void
	subscribe(listener: (snapshot: FPSSnapshot) => void): () => void
	getSnapshot(): FPSSnapshot
	isRunning(): boolean
}

export interface OptimizationState {
	mode: PerformanceMode
	animationScale: number
	blurLevel: number
	particlesEnabled: boolean
	heavyEffectsEnabled: boolean
	shadowQuality: ShadowQuality
	gpuTransformsOnly: boolean
	renderBatching: boolean
	reducedRepaints: boolean
	memorySafeScheduling: boolean
}

export interface AnimationOptimizerOptions {
	root?: HTMLElement | Document
	initialMode?: PerformanceMode
	profile?: DeviceProfile
	watchMutations?: boolean
	particleSelector?: string
	heavySelector?: string
	animatedSelector?: string
}

export interface AnimationOptimizer {
	update(next: Partial<OptimizationState> | PerformanceMode): OptimizationState
	refresh(): void
	getState(): OptimizationState
	dispose(): void
}

export interface ScrollJankOptions {
	target?: Window | HTMLElement
	smoothFactor?: number
	wheelThrottleMs?: number
	onScroll?: (event: {
		x: number
		y: number
		velocityX: number
		velocityY: number
	}) => void
	onWheel?: (event: {
		deltaX: number
		deltaY: number
		smoothedX: number
		smoothedY: number
	}) => void
}

export interface ScrollJankController {
	flush(): void
	dispose(): void
}

export interface OptimizationEvent {
	type: "profile" | "drop" | "recover" | "mode-change"
	timestamp: number
	mode: PerformanceMode
	score: number
	detail: string
}

export interface AdaptivePerformanceState {
	mode: PerformanceMode
	profile: DeviceProfile
	fps: FPSSnapshot
	effects: OptimizationState
	score: number
	droppedFrames: number
	eventCount: number
}

export interface AdaptivePerformanceOptions {
	root?: HTMLElement | Document
	monitor?: FPSMonitor
	profile?: DeviceProfile
	autoStart?: boolean
	onEvent?: (event: OptimizationEvent) => void
}

export interface AdaptivePerformanceController {
	getState(): AdaptivePerformanceState
	subscribe(listener: (state: AdaptivePerformanceState) => void): () => void
	onEvent(listener: (event: OptimizationEvent) => void): () => void
	setMode(mode: PerformanceMode): void
	dispose(): void
}

export interface PerformanceHUDOptions {
	monitor: FPSMonitor
	adaptive?: AdaptivePerformanceController
	position?: HUDPosition
	root?: HTMLElement
	theme?: "glass" | "ink"
}

export interface PerformanceHUDController {
	element: HTMLElement | null
	setVisible(visible: boolean): void
	destroy(): void
}

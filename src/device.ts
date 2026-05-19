import { getRuntimeSignals } from "./telemetry"
import { clamp, hasNavigator, isBrowser } from "./shared"
import type { DeviceProfile, GPUTier, WebViewInfo } from "./types"

const LOW_GPU_PATTERNS = [
	/swiftshader/i,
	/llvmpipe/i,
	/mali-4/i,
	/powervr sgx/i,
	/adreno \(tm\) 3/i,
	/videocore/i
]
const MID_GPU_PATTERNS = [
	/adreno \(tm\) [45]/i,
	/mali-g5/i,
	/apple a1[0-2]/i,
	/intel iris/i,
	/uhd graphics/i
]

function getUserAgent(userAgent?: string): string {
	return userAgent ?? (hasNavigator ? navigator.userAgent : "")
}

function getDeviceMemory(): number | null {
	if (!hasNavigator) {
		return null
	}

	const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
	return typeof memory === "number" ? memory : null
}

function getHardwareConcurrency(): number | null {
	if (!hasNavigator || typeof navigator.hardwareConcurrency !== "number") {
		return null
	}

	return navigator.hardwareConcurrency
}

function getBatterySaverHint(): boolean {
	if (!hasNavigator) {
		return false
	}

	const connection = navigator as Navigator & {
		connection?: {
			effectiveType?: string
			saveData?: boolean
		}
	}

	const reducedMotion =
		isBrowser && typeof window.matchMedia === "function"
			? window.matchMedia("(prefers-reduced-motion: reduce)").matches
			: false

	return Boolean(connection.connection?.saveData) || reducedMotion
}

function getNetworkPressure(): string | null {
	if (!hasNavigator) {
		return null
	}

	const connection = navigator as Navigator & {
		connection?: {
			effectiveType?: string
		}
	}

	return connection.connection?.effectiveType ?? null
}

function detectAndroidVersion(userAgent: string): number | null {
	const match = userAgent.match(/Android\s([0-9.]+)/i)
	return match ? Number.parseFloat(match[1]) : null
}

export function detectWebViewEnvironment(userAgent?: string): WebViewInfo {
	const ua = getUserAgent(userAgent)
	const isAndroid = /Android/i.test(ua)
	const isIOS = /iPhone|iPad|iPod/i.test(ua)
	const embedded =
		/FBAN|FBAV|Instagram|Line\//i.test(ua) ||
		/MicroMessenger|Snapchat|TikTok|LinkedInApp/i.test(ua)
	const androidWebView =
		isAndroid &&
		(/; wv\)/i.test(ua) || /Version\/[0-9.]+\s+Chrome\/[0-9.]+\s+Mobile/i.test(ua))
	const iosWKWebView = isIOS && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua)
	const androidVersion = detectAndroidVersion(ua)
	const limited = Boolean(
		embedded ||
		androidWebView ||
		iosWKWebView ||
		(androidVersion !== null && androidVersion <= 9)
	)

	return {
		detected: androidWebView || iosWKWebView || embedded,
		platform: androidWebView
			? "android-webview"
			: iosWKWebView
				? "ios-wkwebview"
				: embedded
					? "embedded-browser"
					: "browser",
		limited,
		embedded
	}
}

function detectGPUTier(): GPUTier {
	if (!isBrowser) {
		return "unknown"
	}

	try {
		const canvas = document.createElement("canvas")
		const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")

		if (!gl || !(gl instanceof WebGLRenderingContext)) {
			return "weak"
		}

		const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as {
			UNMASKED_RENDERER_WEBGL: number
		} | null
		const rawRenderer = debugInfo
			? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "")
			: String(gl.getParameter(gl.RENDERER) ?? "")

		if (LOW_GPU_PATTERNS.some((pattern) => pattern.test(rawRenderer))) {
			return "weak"
		}

		if (MID_GPU_PATTERNS.some((pattern) => pattern.test(rawRenderer))) {
			return "moderate"
		}

		return rawRenderer ? "strong" : "unknown"
	} catch {
		return "unknown"
	}
}

export function detectWeakDevice(): DeviceProfile {
	const runtimeSignals = getRuntimeSignals()
	const memoryGB = getDeviceMemory()
	const cpuCores = getHardwareConcurrency()
	const gpuTier = detectGPUTier()
	const webView = detectWebViewEnvironment()
	const batterySaver = getBatterySaverHint()
	const networkPressure = getNetworkPressure()
	const refreshRateEstimate = runtimeSignals.refreshRateEstimate || 60
	const fpsUnstable = runtimeSignals.fpsUnstable || runtimeSignals.recentFPS < 48
	const reasonCodes: string[] = []

	let score = 100

	if (memoryGB !== null && memoryGB <= 2) {
		score -= 28
		reasonCodes.push("low_ram")
	} else if (memoryGB !== null && memoryGB < 4) {
		score -= 14
		reasonCodes.push("limited_ram")
	}

	if (cpuCores !== null && cpuCores <= 2) {
		score -= 26
		reasonCodes.push("weak_cpu")
	} else if (cpuCores !== null && cpuCores <= 4) {
		score -= 12
		reasonCodes.push("limited_cpu")
	}

	if (gpuTier === "weak") {
		score -= 24
		reasonCodes.push("weak_gpu")
	} else if (gpuTier === "moderate") {
		score -= 10
		reasonCodes.push("moderate_gpu")
	}

	if (webView.limited) {
		score -= 14
		reasonCodes.push("webview_constraints")
	}

	if (batterySaver) {
		score -= 10
		reasonCodes.push("battery_saver")
	}

	if (networkPressure === "slow-2g" || networkPressure === "2g") {
		score -= 12
		reasonCodes.push("slow_network_profile")
	} else if (networkPressure === "3g") {
		score -= 6
		reasonCodes.push("mobile_network_profile")
	}

	if (refreshRateEstimate <= 50) {
		score -= 12
		reasonCodes.push("low_refresh_rate")
	} else if (refreshRateEstimate <= 60) {
		score -= 4
		reasonCodes.push("standard_refresh_budget")
	}

	if (fpsUnstable) {
		score -= 12
		reasonCodes.push("fps_instability")
	}

	const thermalThrottlingHint =
		(batterySaver && webView.limited) || (fpsUnstable && score < 70)

	if (thermalThrottlingHint) {
		score -= 8
		reasonCodes.push("thermal_throttling_hint")
	}

	score = clamp(score, 0, 100)

	const lowEnd =
		score < 55 ||
		(memoryGB !== null && memoryGB <= 2) ||
		(cpuCores !== null && cpuCores <= 2)
	const recommendedMode = score < 55 ? "low" : score < 78 ? "medium" : "high"
	const disableHeavyEffects =
		lowEnd || webView.limited || gpuTier === "weak" || batterySaver
	const reduceBlur = disableHeavyEffects || webView.detected
	const reduceParticles =
		lowEnd ||
		fpsUnstable ||
		refreshRateEstimate <= 60 ||
		(memoryGB !== null && memoryGB < 4)

	return {
		lowEnd,
		recommendedMode,
		disableHeavyEffects,
		reduceBlur,
		reduceParticles,
		batterySaver,
		thermalThrottlingHint,
		fpsUnstable,
		refreshRateEstimate,
		memoryGB,
		cpuCores,
		gpuTier,
		webView,
		score,
		reasonCodes
	}
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { detectWeakDevice, detectWebViewEnvironment } from "../src/index"
import { updateRuntimeSignals } from "../src/telemetry"

function defineNavigatorValue<Key extends keyof Navigator>(
	key: Key,
	value: Navigator[Key]
) {
	Object.defineProperty(window.navigator, key, {
		configurable: true,
		value
	})
}

describe("device detection", () => {
	beforeEach(() => {
		updateRuntimeSignals({
			recentFPS: 60,
			refreshRateEstimate: 60,
			droppedFrames: 0,
			fpsUnstable: false,
			score: 100
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("detects Android WebView user agents", () => {
		const profile = detectWebViewEnvironment(
			"Mozilla/5.0 (Linux; Android 12; Pixel 4 Build/SP1A.210812.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36"
		)

		expect(profile.detected).toBe(true)
		expect(profile.platform).toBe("android-webview")
		expect(profile.limited).toBe(true)
	})

	it("downgrades constrained devices into low mode", () => {
		defineNavigatorValue("hardwareConcurrency", 2)
		defineNavigatorValue("deviceMemory", 2 as never)
		defineNavigatorValue(
			"userAgent",
			"Mozilla/5.0 (Linux; Android 9; Moto G Build/PQ2A; wv)"
		)
		defineNavigatorValue("connection", { effectiveType: "3g", saveData: true } as never)
		vi.spyOn(window, "matchMedia").mockImplementation(
			(query: string) =>
				({
					matches: query.includes("prefers-reduced-motion"),
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn()
				}) as MediaQueryList
		)
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
		updateRuntimeSignals({
			recentFPS: 42,
			refreshRateEstimate: 50,
			fpsUnstable: true,
			droppedFrames: 24,
			score: 54
		})

		const profile = detectWeakDevice()

		expect(profile.lowEnd).toBe(true)
		expect(profile.recommendedMode).toBe("low")
		expect(profile.disableHeavyEffects).toBe(true)
		expect(profile.reasonCodes).toEqual(
			expect.arrayContaining([
				"low_ram",
				"weak_cpu",
				"battery_saver",
				"webview_constraints",
				"fps_instability"
			])
		)
	})
})

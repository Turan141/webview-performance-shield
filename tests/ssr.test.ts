/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest"

describe("ssr safety", () => {
	it("imports and evaluates detectWeakDevice without browser globals", async () => {
		vi.resetModules()
		vi.stubGlobal("navigator", undefined)

		const { detectWeakDevice } = await import("../src/index")
		const profile = detectWeakDevice()

		expect(profile.lowEnd).toBe(false)
		expect(profile.webView.platform).toBe("browser")
		expect(profile.memoryGB).toBeNull()
		expect(profile.cpuCores).toBeNull()

		vi.unstubAllGlobals()
	})
})

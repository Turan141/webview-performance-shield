import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFPSMonitor } from "../src/index"

describe("fps monitor", () => {
	let frameTime = 0
	let rafId = 0
	let queue = new Map<number, FrameRequestCallback>()

	const stepFrame = (delta: number) => {
		frameTime += delta
		const next = queue.entries().next().value as
			| [number, FrameRequestCallback]
			| undefined

		if (!next) {
			throw new Error("No animation frame queued")
		}

		queue.delete(next[0])
		next[1](frameTime)
	}

	beforeEach(() => {
		frameTime = 0
		rafId = 0
		queue = new Map()

		const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
			rafId += 1
			queue.set(rafId, callback)
			return rafId
		})
		const cancelAnimationFrameMock = vi.fn((id: number) => {
			queue.delete(id)
		})

		vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock)
		vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock)
		window.requestAnimationFrame = requestAnimationFrameMock
		window.cancelAnimationFrame = cancelAnimationFrameMock
	})

	it("emits drop events for slow frames", () => {
		const monitor = createFPSMonitor({ lowFPSThreshold: 55, dropThresholdMs: 34 })
		const dropSpy = vi.fn()

		monitor.onDrop(dropSpy)
		monitor.start()

		stepFrame(16)
		stepFrame(16)
		stepFrame(48)

		const snapshot = monitor.getSnapshot()

		expect(dropSpy).toHaveBeenCalled()
		expect(snapshot.droppedFrames).toBeGreaterThan(0)
		expect(snapshot.lastFrameTime).toBe(48)
		monitor.stop()
	})

	it("stops scheduling frames after stop is called", () => {
		const monitor = createFPSMonitor()

		monitor.start()
		stepFrame(16)
		monitor.stop()

		expect(monitor.isRunning()).toBe(false)
		expect(queue.size).toBe(0)
	})
})

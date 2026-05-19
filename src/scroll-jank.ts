import { createFrameBatcher, getScrollPosition, isBrowser } from "./shared"
import type { ScrollJankController, ScrollJankOptions } from "./types"

export function preventScrollJank(options: ScrollJankOptions = {}): ScrollJankController {
	if (!isBrowser) {
		return {
			flush() {},
			dispose() {}
		}
	}

	const target = options.target ?? window
	const smoothFactor = options.smoothFactor ?? 0.22
	const batcher = createFrameBatcher()
	let pendingScroll = false
	let pendingWheel = false
	let lastPosition = getScrollPosition(target)
	let lastTimestamp = performance.now()
	let wheelDeltaX = 0
	let wheelDeltaY = 0
	let smoothedX = 0
	let smoothedY = 0

	const flushScroll = () => {
		pendingScroll = false
		const currentPosition = getScrollPosition(target)
		const now = performance.now()
		const elapsed = Math.max(1, now - lastTimestamp)
		const velocityX = ((currentPosition.x - lastPosition.x) / elapsed) * 16.67
		const velocityY = ((currentPosition.y - lastPosition.y) / elapsed) * 16.67

		lastTimestamp = now
		lastPosition = currentPosition
		options.onScroll?.({
			x: currentPosition.x,
			y: currentPosition.y,
			velocityX,
			velocityY
		})
	}

	const flushWheel = () => {
		pendingWheel = false
		smoothedX += (wheelDeltaX - smoothedX) * smoothFactor
		smoothedY += (wheelDeltaY - smoothedY) * smoothFactor
		options.onWheel?.({
			deltaX: wheelDeltaX,
			deltaY: wheelDeltaY,
			smoothedX,
			smoothedY
		})

		wheelDeltaX = 0
		wheelDeltaY = 0
	}

	const handleScroll = () => {
		if (pendingScroll) {
			return
		}

		pendingScroll = true
		batcher.write(flushScroll)
	}

	const handleWheel = (event: WheelEvent) => {
		wheelDeltaX += event.deltaX
		wheelDeltaY += event.deltaY

		if (pendingWheel) {
			return
		}

		pendingWheel = true
		batcher.write(flushWheel)
	}

	const handleTouchMove = () => {
		if (pendingScroll) {
			return
		}

		pendingScroll = true
		batcher.write(flushScroll)
	}

	target.addEventListener("scroll", handleScroll, { passive: true })
	target.addEventListener("wheel", handleWheel, { passive: true })
	target.addEventListener("touchstart", handleTouchMove, { passive: true })
	target.addEventListener("touchmove", handleTouchMove, { passive: true })

	return {
		flush() {
			batcher.flush()
		},
		dispose() {
			target.removeEventListener("scroll", handleScroll)
			target.removeEventListener("wheel", handleWheel)
			target.removeEventListener("touchstart", handleTouchMove)
			target.removeEventListener("touchmove", handleTouchMove)
			batcher.dispose()
		}
	}
}

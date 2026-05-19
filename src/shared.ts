export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined"
export const hasNavigator = typeof navigator !== "undefined"

export type Unsubscribe = () => void

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

export function average(values: number[]): number {
	if (values.length === 0) {
		return 0
	}

	return values.reduce((total, value) => total + value, 0) / values.length
}

export function standardDeviation(values: number[]): number {
	if (values.length === 0) {
		return 0
	}

	const mean = average(values)
	const variance = average(values.map((value) => (value - mean) ** 2))
	return Math.sqrt(variance)
}

export function safeNow(): number {
	if (typeof performance !== "undefined" && typeof performance.now === "function") {
		return performance.now()
	}

	return Date.now()
}

export function createEmitter<T>() {
	const listeners = new Set<(value: T) => void>()

	return {
		emit(value: T): void {
			for (const listener of listeners) {
				listener(value)
			}
		},
		subscribe(listener: (value: T) => void): Unsubscribe {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		clear(): void {
			listeners.clear()
		}
	}
}

export function createFrameBatcher() {
	const readQueue: Array<() => void> = []
	const writeQueue: Array<() => void> = []
	let rafId = 0

	const flush = () => {
		rafId = 0

		const reads = readQueue.splice(0, readQueue.length)
		const writes = writeQueue.splice(0, writeQueue.length)

		for (const read of reads) {
			read()
		}

		for (const write of writes) {
			write()
		}
	}

	const schedule = () => {
		if (!isBrowser || rafId !== 0) {
			return
		}

		rafId = window.requestAnimationFrame(flush)
	}

	return {
		read(task: () => void): void {
			readQueue.push(task)
			schedule()
		},
		write(task: () => void): void {
			writeQueue.push(task)
			schedule()
		},
		flush(): void {
			if (rafId !== 0 && isBrowser) {
				window.cancelAnimationFrame(rafId)
			}

			flush()
		},
		dispose(): void {
			if (rafId !== 0 && isBrowser) {
				window.cancelAnimationFrame(rafId)
			}

			rafId = 0
			readQueue.length = 0
			writeQueue.length = 0
		}
	}
}

export function parseTimeToken(token: string): number {
	const normalized = token.trim()

	if (normalized.endsWith("ms")) {
		return Number.parseFloat(normalized)
	}

	if (normalized.endsWith("s")) {
		return Number.parseFloat(normalized) * 1000
	}

	const numeric = Number.parseFloat(normalized)
	return Number.isFinite(numeric) ? numeric : 0
}

export function scaleDurationList(value: string, scale: number): string {
	return value
		.split(",")
		.map((token) => {
			const milliseconds = parseTimeToken(token)
			const nextValue = Math.max(0, milliseconds * scale)
			return nextValue >= 1000
				? `${(nextValue / 1000).toFixed(2)}s`
				: `${Math.round(nextValue)}ms`
		})
		.join(", ")
}

export function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
	return Array.from(new Set(elements))
}

export function ensureTranslateZ(transform: string): string {
	if (!transform || transform === "none") {
		return "translateZ(0)"
	}

	if (/translateZ|translate3d/i.test(transform)) {
		return transform
	}

	return `${transform} translateZ(0)`
}

export function simplifyShadow(): string {
	return "0 6px 20px rgba(15, 23, 42, 0.16)"
}

export function isDocumentRoot(value: Document | HTMLElement): value is Document {
	return typeof Document !== "undefined" && value instanceof Document
}

export function isWindowTarget(value: Window | HTMLElement): value is Window {
	return typeof Window !== "undefined" && value instanceof Window
}

export function getScrollPosition(target: Window | HTMLElement): {
	x: number
	y: number
} {
	if (isWindowTarget(target)) {
		return {
			x: window.scrollX,
			y: window.scrollY
		}
	}

	return {
		x: target.scrollLeft,
		y: target.scrollTop
	}
}

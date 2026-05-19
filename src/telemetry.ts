export interface RuntimeSignals {
	refreshRateEstimate: number
	recentFPS: number
	droppedFrames: number
	fpsUnstable: boolean
	score: number
}

let runtimeSignals: RuntimeSignals = {
	refreshRateEstimate: 60,
	recentFPS: 60,
	droppedFrames: 0,
	fpsUnstable: false,
	score: 100
}

export function getRuntimeSignals(): RuntimeSignals {
	return runtimeSignals
}

export function updateRuntimeSignals(nextSignals: Partial<RuntimeSignals>): void {
	runtimeSignals = {
		...runtimeSignals,
		...nextSignals
	}
}

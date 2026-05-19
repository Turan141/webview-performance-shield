import { isBrowser } from "./shared"
import type {
	AdaptivePerformanceController,
	HUDPosition,
	PerformanceHUDController,
	PerformanceHUDOptions
} from "./types"

const POSITION_STYLES: Record<HUDPosition, Partial<CSSStyleDeclaration>> = {
	"top-left": { top: "16px", left: "16px" },
	"top-right": { top: "16px", right: "16px" },
	"bottom-left": { bottom: "16px", left: "16px" },
	"bottom-right": { bottom: "16px", right: "16px" }
}

function applyPosition(element: HTMLElement, position: HUDPosition): void {
	const styles = POSITION_STYLES[position]
	Object.assign(element.style, {
		top: "",
		left: "",
		right: "",
		bottom: ""
	})
	Object.assign(element.style, styles)
}

function getMode(adaptive?: AdaptivePerformanceController): string {
	return adaptive?.getState().mode ?? "monitor"
}

export function createPerformanceHUD(
	options: PerformanceHUDOptions
): PerformanceHUDController {
	if (!isBrowser) {
		return {
			element: null,
			setVisible() {},
			destroy() {}
		}
	}

	const root = options.root ?? document.body
	const container = document.createElement("aside")
	const metrics = document.createElement("div")
	const footer = document.createElement("div")
	const heatmap = document.createElement("div")
	const heatValues: number[] = []
	const theme = options.theme ?? "glass"

	Object.assign(container.style, {
		position: "fixed",
		zIndex: "2147483647",
		width: "240px",
		padding: "14px 14px 12px",
		borderRadius: "18px",
		border:
			theme === "glass"
				? "1px solid rgba(255,255,255,0.18)"
				: "1px solid rgba(15,23,42,0.18)",
		background:
			theme === "glass"
				? "linear-gradient(180deg, rgba(15,23,42,0.84), rgba(15,23,42,0.68))"
				: "rgba(248, 250, 252, 0.92)",
		color: theme === "glass" ? "#f8fafc" : "#0f172a",
		boxShadow: "0 20px 40px rgba(15, 23, 42, 0.22)",
		backdropFilter: "blur(12px)",
		fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
		pointerEvents: "none",
		display: "grid",
		gap: "10px"
	})

	applyPosition(container, options.position ?? "bottom-right")

	Object.assign(metrics.style, {
		display: "grid",
		gap: "6px",
		fontSize: "12px",
		lineHeight: "1.5"
	})

	Object.assign(footer.style, {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		fontSize: "11px",
		opacity: "0.75"
	})

	Object.assign(heatmap.style, {
		display: "grid",
		gridAutoFlow: "column",
		gridAutoColumns: "1fr",
		gap: "2px",
		height: "42px",
		alignItems: "end"
	})

	container.append(metrics, heatmap, footer)
	root.appendChild(container)

	const render = () => {
		const snapshot = options.monitor.getSnapshot()
		const adaptiveState = options.adaptive?.getState()

		metrics.innerHTML = [
			`<strong style="font-size:13px; letter-spacing:0.02em;">WVPS HUD</strong>`,
			`<span>FPS <strong>${snapshot.fps.toFixed(1)}</strong> · score <strong>${snapshot.score}</strong></span>`,
			`<span>mode <strong>${getMode(options.adaptive)}</strong> · refresh <strong>${snapshot.refreshRateEstimate}hz</strong></span>`,
			`<span>dropped <strong>${snapshot.droppedFrames}</strong> · unstable <strong>${snapshot.unstable ? "yes" : "no"}</strong></span>`,
			adaptiveState
				? `<span>adaptive score <strong>${adaptiveState.score}</strong> · events <strong>${adaptiveState.eventCount}</strong></span>`
				: ""
		].join("")

		const severity = Math.min(100, Math.max(6, 100 - snapshot.score))
		heatValues.push(severity)

		if (heatValues.length > 36) {
			heatValues.shift()
		}

		heatmap.innerHTML = heatValues
			.map((value) => {
				const hue = Math.max(0, 120 - value * 1.2)
				return `<span style="height:${Math.max(10, value)}%; border-radius:999px; background:hsl(${hue}deg 82% 56%);"></span>`
			})
			.join("")

		footer.innerHTML = `<span>${snapshot.averageFrameTime.toFixed(2)}ms avg</span><span>webview-performance-shield</span>`
	}

	const unsubscribeFPS = options.monitor.subscribe(render)
	const unsubscribeAdaptive = options.adaptive?.subscribe(render) ?? (() => undefined)
	render()

	return {
		element: container,
		setVisible(visible) {
			container.style.display = visible ? "grid" : "none"
		},
		destroy() {
			unsubscribeFPS()
			unsubscribeAdaptive()
			container.remove()
		}
	}
}

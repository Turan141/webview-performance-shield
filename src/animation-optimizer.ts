import { detectWeakDevice } from "./device"
import {
	createFrameBatcher,
	ensureTranslateZ,
	isBrowser,
	isDocumentRoot,
	scaleDurationList,
	simplifyShadow,
	uniqueElements
} from "./shared"
import type {
	AnimationOptimizer,
	AnimationOptimizerOptions,
	DeviceProfile,
	OptimizationState,
	PerformanceMode,
	ShadowQuality
} from "./types"

const DEFAULT_PARTICLE_SELECTOR = [
	"[data-particle-system]",
	"[data-particles]",
	".particle",
	".particles",
	"canvas[data-effects='particles']"
].join(", ")

const DEFAULT_ANIMATED_SELECTOR = [
	"[data-animate]",
	"[style*='animation']",
	"[style*='transition']",
	".animate",
	".motion-safe"
].join(", ")

const DEFAULT_HEAVY_SELECTOR = [
	"[data-heavy-effect]",
	"[style*='backdrop-filter']",
	"[style*='filter']",
	"[style*='box-shadow']",
	".glass",
	".blur"
].join(", ")

const STYLE_ID = "wvps-styles"

interface OriginalStyleState {
	animationDuration: string
	transitionDuration: string
	filter: string
	backdropFilter: string
	webkitBackdropFilter: string
	boxShadow: string
	willChange: string
	transform: string
	animationPlayState: string
	backfaceVisibility: string
}

function ensureOptimizerStyles(): void {
	if (!isBrowser || document.getElementById(STYLE_ID)) {
		return
	}

	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = `
    [data-wvps-root="true"] {
      --wvps-animation-scale: 1;
      --wvps-blur-level: 1;
      --wvps-shadow-level: 1;
      --wvps-particle-opacity: 1;
    }

    [data-wvps-root="true"][data-wvps-particles="off"] [data-wvps-particle="true"] {
      opacity: 0.18 !important;
      animation-play-state: paused !important;
    }

    [data-wvps-root="true"][data-wvps-blur="reduced"] [data-wvps-blur-target="true"] {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      filter: none !important;
    }

    [data-wvps-root="true"][data-wvps-mode="low"] [data-wvps-shadow-target="true"] {
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12) !important;
    }

    [data-wvps-root="true"][data-wvps-mode="low"] [data-wvps-animatable="true"] {
      will-change: transform, opacity;
    }
  `
	document.head.appendChild(style)
}

function getRootNode(root?: HTMLElement | Document): Document | HTMLElement {
	if (!isBrowser) {
		return {} as Document
	}

	return root ?? document
}

function getContainer(rootNode: Document | HTMLElement): HTMLElement | null {
	if (!isBrowser) {
		return null
	}

	return isDocumentRoot(rootNode) ? rootNode.documentElement : rootNode
}

function mapModeToState(
	mode: PerformanceMode,
	profile: DeviceProfile
): OptimizationState {
	const gpuTransformsOnly = profile.webView.detected || profile.gpuTier !== "strong"
	const renderBatching = profile.webView.detected || profile.lowEnd
	const reducedRepaints = profile.webView.detected || mode !== "high"
	const memorySafeScheduling = profile.lowEnd || profile.webView.detected
	const modeShadowMap: Record<PerformanceMode, ShadowQuality> = {
		high: profile.disableHeavyEffects ? "medium" : "full",
		medium: "medium",
		low: profile.disableHeavyEffects ? "off" : "low"
	}

	return {
		mode,
		animationScale: mode === "high" ? 1 : mode === "medium" ? 0.9 : 0.76,
		blurLevel: mode === "high" ? 1 : mode === "medium" ? 0.55 : 0.15,
		particlesEnabled: mode === "high" && !profile.reduceParticles,
		heavyEffectsEnabled: mode === "high" && !profile.disableHeavyEffects,
		shadowQuality: modeShadowMap[mode],
		gpuTransformsOnly,
		renderBatching,
		reducedRepaints,
		memorySafeScheduling
	}
}

function captureOriginalStyle(
	element: HTMLElement,
	originalStyles: WeakMap<HTMLElement, OriginalStyleState>
): OriginalStyleState {
	const existing = originalStyles.get(element)

	if (existing) {
		return existing
	}

	const snapshot: OriginalStyleState = {
		animationDuration: element.style.animationDuration,
		transitionDuration: element.style.transitionDuration,
		filter: element.style.filter,
		backdropFilter: element.style.backdropFilter,
		webkitBackdropFilter: element.style.webkitBackdropFilter,
		boxShadow: element.style.boxShadow,
		willChange: element.style.willChange,
		transform: element.style.transform,
		animationPlayState: element.style.animationPlayState,
		backfaceVisibility: element.style.backfaceVisibility
	}

	originalStyles.set(element, snapshot)
	return snapshot
}

function markTargets(targets: HTMLElement[], key: string): void {
	for (const target of targets) {
		target.dataset[key] = "true"
	}
}

export function resolveOptimizationState(
	mode: PerformanceMode,
	profile = detectWeakDevice()
): OptimizationState {
	return mapModeToState(mode, profile)
}

export function optimizeAnimations(
	options: AnimationOptimizerOptions = {}
): AnimationOptimizer {
	const rootNode = getRootNode(options.root)
	const container = getContainer(rootNode)
	const profile = options.profile ?? detectWeakDevice()
	const batcher = createFrameBatcher()
	const originalStyles = new WeakMap<HTMLElement, OriginalStyleState>()
	const particleSelector = options.particleSelector ?? DEFAULT_PARTICLE_SELECTOR
	const animatedSelector = options.animatedSelector ?? DEFAULT_ANIMATED_SELECTOR
	const heavySelector = options.heavySelector ?? DEFAULT_HEAVY_SELECTOR
	let state = mapModeToState(options.initialMode ?? profile.recommendedMode, profile)
	let mutationObserver: MutationObserver | null = null

	const applyToTargets = () => {
		if (!container || !isBrowser) {
			return
		}

		const particleTargets = uniqueElements(
			Array.from(container.querySelectorAll<HTMLElement>(particleSelector))
		)
		const animatedTargets = uniqueElements(
			Array.from(container.querySelectorAll<HTMLElement>(animatedSelector))
		)
		const heavyTargets = uniqueElements(
			Array.from(container.querySelectorAll<HTMLElement>(heavySelector))
		)
		const allTargets = uniqueElements([
			...particleTargets,
			...animatedTargets,
			...heavyTargets
		])
		const computedStyles = new Map<HTMLElement, CSSStyleDeclaration>()

		markTargets(particleTargets, "wvpsParticle")
		markTargets(animatedTargets, "wvpsAnimatable")
		markTargets(heavyTargets, "wvpsBlurTarget")
		markTargets(heavyTargets, "wvpsShadowTarget")

		batcher.read(() => {
			for (const element of allTargets) {
				computedStyles.set(element, window.getComputedStyle(element))
			}

			batcher.write(() => {
				container.dataset.wvpsRoot = "true"
				container.dataset.wvpsMode = state.mode
				container.dataset.wvpsBlur = state.blurLevel < 0.8 ? "reduced" : "full"
				container.dataset.wvpsParticles = state.particlesEnabled ? "on" : "off"
				container.style.setProperty(
					"--wvps-animation-scale",
					String(state.animationScale)
				)
				container.style.setProperty("--wvps-blur-level", String(state.blurLevel))

				for (const element of allTargets) {
					const original = captureOriginalStyle(element, originalStyles)
					const computedStyle = computedStyles.get(element)

					if (!computedStyle) {
						continue
					}

					element.style.willChange = "transform, opacity"

					if (state.gpuTransformsOnly) {
						element.style.backfaceVisibility = "hidden"
						element.style.transform = ensureTranslateZ(
							original.transform || computedStyle.transform
						)
					} else {
						element.style.backfaceVisibility = original.backfaceVisibility
						element.style.transform = original.transform
					}

					const animationDuration =
						original.animationDuration || computedStyle.animationDuration
					const transitionDuration =
						original.transitionDuration || computedStyle.transitionDuration

					if (animationDuration && animationDuration !== "0s") {
						element.style.animationDuration = scaleDurationList(
							animationDuration,
							state.animationScale
						)
					} else {
						element.style.animationDuration = original.animationDuration
					}

					if (transitionDuration && transitionDuration !== "0s") {
						element.style.transitionDuration = scaleDurationList(
							transitionDuration,
							state.animationScale
						)
					} else {
						element.style.transitionDuration = original.transitionDuration
					}

					if (!state.particlesEnabled && particleTargets.includes(element)) {
						element.style.animationPlayState = "paused"
					} else {
						element.style.animationPlayState = original.animationPlayState
					}

					if (state.blurLevel < 0.8 || !state.heavyEffectsEnabled) {
						if (computedStyle.filter.includes("blur")) {
							element.style.filter = "none"
						} else {
							element.style.filter = original.filter
						}

						if (
							computedStyle.backdropFilter !== "none" ||
							computedStyle.webkitBackdropFilter !== "none"
						) {
							element.style.backdropFilter = "none"
							element.style.webkitBackdropFilter = "none"
						} else {
							element.style.backdropFilter = original.backdropFilter
							element.style.webkitBackdropFilter = original.webkitBackdropFilter
						}
					} else {
						element.style.filter = original.filter
						element.style.backdropFilter = original.backdropFilter
						element.style.webkitBackdropFilter = original.webkitBackdropFilter
					}

					if (state.shadowQuality === "off") {
						element.style.boxShadow = "none"
					} else if (state.shadowQuality === "low") {
						if (computedStyle.boxShadow !== "none") {
							element.style.boxShadow = simplifyShadow()
						} else {
							element.style.boxShadow = original.boxShadow
						}
					} else {
						element.style.boxShadow = original.boxShadow
					}
				}
			})
		})
	}

	if (isBrowser) {
		ensureOptimizerStyles()
		applyToTargets()

		if (options.watchMutations !== false && container) {
			mutationObserver = new MutationObserver(() => {
				applyToTargets()
			})

			mutationObserver.observe(container, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: [
					"class",
					"style",
					"data-animate",
					"data-particles",
					"data-heavy-effect"
				]
			})
		}
	}

	return {
		update(next) {
			state =
				typeof next === "string" ? mapModeToState(next, profile) : { ...state, ...next }
			applyToTargets()
			return state
		},
		refresh() {
			applyToTargets()
		},
		getState() {
			return state
		},
		dispose() {
			mutationObserver?.disconnect()
			batcher.dispose()
		}
	}
}

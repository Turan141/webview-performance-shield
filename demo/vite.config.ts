import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const demoRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
	root: demoRoot,
	plugins: [react()],
	resolve: {
		alias: {
			"webview-performance-shield/react": resolve(demoRoot, "../src/react.ts"),
			"webview-performance-shield": resolve(demoRoot, "../src/index.ts")
		}
	},
	build: {
		outDir: "dist",
		rollupOptions: {
			input: {
				main: resolve(demoRoot, "index.html"),
				benchmark: resolve(demoRoot, "benchmark.html")
			}
		}
	}
})

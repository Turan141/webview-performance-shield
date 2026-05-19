import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	root: __dirname,
	plugins: [react()],
	resolve: {
		alias: {
			"webview-performance-shield/react": resolve(__dirname, "../src/react.ts"),
			"webview-performance-shield": resolve(__dirname, "../src/index.ts")
		}
	},
	build: {
		outDir: "dist"
	}
})

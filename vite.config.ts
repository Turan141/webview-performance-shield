import { resolve } from "node:path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
	build: {
		target: "es2019",
		sourcemap: true,
		minify: "esbuild",
		emptyOutDir: true,
		lib: {
			entry: {
				index: resolve(__dirname, "src/index.ts"),
				react: resolve(__dirname, "src/react.ts")
			},
			formats: ["es", "cjs"],
			fileName: (format, entryName) =>
				format === "es" ? `${entryName}.js` : `${entryName}.cjs`
		},
		rollupOptions: {
			external: ["react", "react-dom"],
			output: {
				exports: "named"
			}
		}
	},
	plugins: [
		dts({
			include: ["src"],
			outDir: "dist",
			insertTypesEntry: true,
			rollupTypes: true,
			exclude: ["demo/**"]
		})
	]
})

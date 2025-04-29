import { resolve } from "path";
import { defineConfig, UserConfig } from "vite";
import dts from "vite-plugin-dts";

const config: UserConfig = (() => {
    const common: Partial<UserConfig["build"]> = {
        rollupOptions: {
            external: ["vue", "pusher-js"],
            output: {
                globals: {
                    vue: "Vue",
                    "pusher-js": "Pusher",
                },
            },
        },
        outDir: resolve(__dirname, "dist"),
        sourcemap: true,
        minify: true,
    };

    if (process.env.FORMAT === "iife") {
        return {
            build: {
                lib: {
                    entry: resolve(__dirname, "src/vue.ts"),
                    name: "EchoVue",
                    formats: ["iife"],
                    fileName: () => "echo-vue.iife.js",
                },
                emptyOutDir: false, // Don't empty the output directory for the second build
                ...common,
            },
        };
    }

    return {
        plugins: [dts()],
        build: {
            lib: {
                entry: resolve(__dirname, "src/vue.ts"),
                formats: ["es", "cjs"],
                fileName: (format, entryName) => {
                    return `${entryName}.${format === "es" ? "js" : "common.js"}`;
                },
            },
            emptyOutDir: true,
            ...common,
        },
    };
})();

export default defineConfig(config);

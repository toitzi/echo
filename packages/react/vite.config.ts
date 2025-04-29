import { resolve } from "path";
import { defineConfig, UserConfig } from "vite";
import dts from "vite-plugin-dts";

const rollupOptions = {
    external: ["react", "pusher-js"],
    output: {
        globals: {
            react: "React",
            "pusher-js": "Pusher",
        },
    },
};

let config: UserConfig;

if (process.env.FORMAT === "iife") {
    config = {
        build: {
            lib: {
                entry: resolve(__dirname, "src/react.ts"),
                name: "EchoReact",
                formats: ["iife"],
                fileName: () => "echo-react.iife.js",
            },
            rollupOptions,
            outDir: resolve(__dirname, "dist"),
            emptyOutDir: false, // Don't empty the output directory for the second build
            sourcemap: true,
            minify: true,
        },
    };
} else {
    config = {
        plugins: [dts()],
        build: {
            lib: {
                entry: resolve(__dirname, "src/react.ts"),
                formats: ["es", "cjs"],
                fileName: (format, entryName) => {
                    return `${entryName}.${format === "es" ? "js" : "common.js"}`;
                },
            },
            rollupOptions,
            outDir: resolve(__dirname, "dist"),
            emptyOutDir: true,
            sourcemap: true,
            minify: true,
        },
    };
}

export default defineConfig(config);

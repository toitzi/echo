import { resolve } from "path";
import { defineConfig, UserConfig } from "vite";
import dts from "vite-plugin-dts";

const rollupOptions = {
    external: ["pusher-js", "socket.io-client"],
    output: {
        globals: {
            "pusher-js": "Pusher",
            "socket.io-client": "io",
        },
    },
};

let config: UserConfig;

if (process.env.FORMAT === "iife") {
    config = {
        build: {
            lib: {
                entry: resolve(__dirname, "src/echo.ts"),
                name: "Echo",
                formats: ["iife"],
                fileName: () => "echo.iife.js",
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
                entry: resolve(__dirname, "src/echo.ts"),
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

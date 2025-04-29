import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
    {
        input: "./src/echo.ts",
        output: [
            { file: "./dist/echo.js", format: "esm" },
            { file: "./dist/echo.common.js", format: "cjs" },
        ],
        plugins: [
            resolve(),
            typescript({
                tsconfig: "./tsconfig.json", // Ensures Rollup aligns with your TS settings
            }),
            babel({
                babelHelpers: "bundled",
                extensions: [".ts"],
                exclude: "node_modules/**",
                presets: ["@babel/preset-env"],
                plugins: [
                    "@babel/plugin-transform-numeric-separator",
                    "@babel/plugin-transform-export-namespace-from",
                    ["@babel/plugin-proposal-decorators", { legacy: true }],
                    "@babel/plugin-proposal-function-sent",
                    "@babel/plugin-proposal-throw-expressions",
                    "@babel/plugin-transform-object-assign",
                ],
            }),
        ],
        external: ["jquery", "axios", "vue", "@hotwired/turbo", "tslib"], // Compatible packages not included in the bundle
    },
    {
        input: "./src/index.iife.ts",
        output: [{ file: "./dist/echo.iife.js", format: "iife", name: "Echo" }],
        plugins: [
            resolve(),
            typescript({
                tsconfig: "./tsconfig.json",
            }),
            babel({
                babelHelpers: "bundled",
                extensions: [".ts"],
                exclude: "node_modules/**",
            }),
        ],
        external: ["jquery", "axios", "vue", "@hotwired/turbo", "tslib"], // Compatible packages not included in the bundle
    },
    // React build configuration
    // {
    //     input: "./src/react.ts",
    //     output: [
    //         { file: "./dist/react.js", format: "esm" },
    //         { file: "./dist/react.common.js", format: "cjs" },
    //     ],
    //     plugins: [
    //         resolve(),
    //         typescript({
    //             tsconfig: "./tsconfig.json",
    //         }),
    //         babel({
    //             babelHelpers: "bundled",
    //             extensions: [".ts"],
    //             exclude: "node_modules/**",
    //         }),
    //     ],
    //     external: ["react", "pusher-js"], // React and pusher-js should be external dependencies
    // },
    // // Vue build configuration
    // {
    //     input: "./src/vue.ts",
    //     output: [
    //         { file: "./dist/vue.js", format: "esm" },
    //         { file: "./dist/vue.common.js", format: "cjs" },
    //     ],
    //     plugins: [
    //         resolve(),
    //         typescript({
    //             tsconfig: "./tsconfig.json",
    //         }),
    //         babel({
    //             babelHelpers: "bundled",
    //             extensions: [".ts"],
    //             exclude: "node_modules/**",
    //         }),
    //     ],
    //     external: ["vue", "pusher-js"], // Vue and pusher-js should be external dependencies
    // },
];

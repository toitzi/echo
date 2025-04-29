import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
    {
        input: "./src/vue.ts",
        output: [
            { file: "./dist/vue.js", format: "esm" },
            { file: "./dist/vue.common.js", format: "cjs" },
        ],
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
        external: ["vue", "pusher-js"], // Vue and pusher-js should be external dependencies
    },
];

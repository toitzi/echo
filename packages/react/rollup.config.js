import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
    {
        input: "./src/react.ts",
        output: [
            { file: "./dist/react.js", format: "esm" },
            { file: "./dist/react.common.js", format: "cjs" },
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
        external: ["react", "pusher-js"], // React and pusher-js should be external dependencies
    },
];

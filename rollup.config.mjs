import babel from "@rollup/plugin-babel"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import terser from "@rollup/plugin-terser"

export default [
  {
    input: "src/js/index.js",
    output: {
      file: "site/_includes/index.js",
      format: "esm",
    },
    plugins: [
      resolve(),
      babel(),
      commonjs(),
      ...(process.env.NODE_ENV === "production" ? [terser()] : []),
    ],
  },
]

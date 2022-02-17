import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/server/index.ts",
  plugins: [typescript()],
  external: [
    "react",
    "react-dom",
    "remix",
    "source-map",
    "fs/promises",
    "axios",
  ],
  output: [
    {
      file: "dist/server/remix-crash.umd.js",
      name: "RemixCrash",
      format: "umd",
      globals: {
        remix: "Remix",
        "source-map": "SourceMap",
        "fs/promises": "FSPromises",
        axios: "Axios",
      },
    },
    {
      file: "dist/server/remix-crash.es.js",
      format: "esm",
      globals: {
        remix: "Remix",
        "source-map": "SourceMap",
        "fs/promises": "FSPromises",
        axios: "Axios",
      },
    },
  ],
};

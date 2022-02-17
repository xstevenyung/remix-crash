import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    define:
      mode === "production"
        ? { "process.env.NODE_ENV": "process.env.NODE_ENV" }
        : {},
    build: {
      emptyOutDir: false,
      outDir: "dist/client",
      lib: {
        entry: path.resolve(__dirname, "src/client/index.ts"),
        name: "RemixCrash",
        fileName: (format) => `remix-crash.${format}.js`,
      },
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: [
          "react",
          "react-dom",
          "remix",
          "source-map",
          "fs/promises",
          "axios",
        ],
        output: {
          // Provide global variables to use in the UMD build
          // for externalized deps
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
            remix: "Remix",
            "source-map": "SourceMap",
            "fs/promises": "FSPromises",
            axios: "Axios",
          },
        },
      },
    },
  };
});

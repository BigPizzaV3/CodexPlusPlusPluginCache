import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    target: "es2022",
    outDir: "mcp",
    emptyOutDir: false,
    rollupOptions: {
      input: "mcp-inline.html",
    },
  },
});

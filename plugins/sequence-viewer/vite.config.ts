import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { PluginOption } from "vite";
import { defineConfig } from "vitest/config";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  define: {
    __STORYBOOK__: "false",
    __WINDOW_TYPE__: JSON.stringify("electron"),
  },
  build: {
    chunkSizeWarningLimit: 1_000,
    emptyOutDir: true,
    outDir: "dist",
    rolldownOptions: {
      output: {
        assetFileNames: "views/[name][extname]",
        chunkFileNames: "views/[name].js",
        entryFileNames: "views/[name].js",
      },
    },
  },
  plugins: [react() as PluginOption, tailwindcss()],
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./src/test-setup.ts"],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri dev server must listen on a fixed port
  server: {
    port: 5173,
    strictPort: true,
  },
  // Tauri uses the `TAURI_PLATFORM` env var; prevent Vite from clearing the
  // screen so Tauri's logs remain visible
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri uses Chromium on Linux — we can target modern JS
    target: ["es2021", "chrome100"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});

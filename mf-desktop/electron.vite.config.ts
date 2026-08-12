import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload.ts"),
        },
      },
    },
  },
  renderer: {
    root: ".",
    server: {
      // Bind IPv4 so Electron / Playwright can use http://127.0.0.1:5173
      host: "127.0.0.1",
      port: 5173,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve("src"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});

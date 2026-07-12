import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  build: {
    emptyOutDir: true,
    outDir: "dist-pages",
    rollupOptions: {
      input: "index.html",
    },
  },
  plugins: [react()],
});

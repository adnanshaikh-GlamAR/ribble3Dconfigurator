import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The configurator is served behind the load balancer at this prefix.
  // GITHUB_PAGES_BASE overrides it for the GitHub Pages workflow.
  base: process.env.GITHUB_PAGES_BASE ?? "/tryon/ribble/",
  build: {
    emptyOutDir: true,
    outDir: "dist-pages",
    rollupOptions: {
      input: "index.html",
    },
  },
  plugins: [react()],
});

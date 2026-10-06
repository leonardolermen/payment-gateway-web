import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/test/setup.ts"],
    css: false,
    // Fixed so the http tests can name absolute URLs for MSW regardless of the local .env.
    env: { VITE_API_URL: "http://localhost:8080" },
  },
});

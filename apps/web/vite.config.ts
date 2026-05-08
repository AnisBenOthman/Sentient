import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const nestjsStub = path.resolve(__dirname, "src/lib/nestjs-stub.ts");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // @sentient/shared re-exports NestJS guards (server-only).
      // Stub them so the browser bundle resolves without errors.
      "@nestjs/common": nestjsStub,
      "@nestjs/core": nestjsStub,
      "@nestjs/config": nestjsStub,
      // jsonwebtoken uses Node.js crypto — stub it too (guards never run in browser)
      "jsonwebtoken": nestjsStub,
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

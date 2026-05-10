import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { Plugin } from "vite";

const nestjsStub = path.resolve(__dirname, "src/lib/nestjs-stub.ts");

// Logs every page navigation and API call hitting the Vite dev server.
// Skips internal Vite paths (/@vite, /@fs, HMR websocket) and static assets.
const SKIP = /\.(js|ts|jsx|tsx|css|png|svg|ico|woff2?|ttf|map|json)$/;
function requestLogger(): Plugin {
  return {
    name: "request-logger",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        if (url.startsWith("/@") || url.startsWith("/node_modules") || SKIP.test(url)) {
          return next();
        }
        const start = Date.now();
        res.on("finish", () => {
          const ms = Date.now() - start;
          const status = res.statusCode;
          const color = status < 300 ? "\x1b[32m" : status < 400 ? "\x1b[33m" : "\x1b[31m";
          console.log(`\x1b[2m[localhost:3000]\x1b[0m ${color}${req.method} ${url} ${status}\x1b[0m \x1b[2m${ms}ms\x1b[0m`);
        });
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), requestLogger()],
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
        rewrite: (apiPath) => apiPath.replace(/^\/api/, ""),
        configure(proxy) {
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log(`[proxy] → ${req.method} ${req.url}`);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(`[proxy] ← ${proxyRes.statusCode} ${req.url}`);
          });
          proxy.on("error", (err, req) => {
            console.error(`[proxy] ✗ ${req.url} — ${err.message}`);
          });
        },
      },
    },
  },
  optimizeDeps: {
    include: ["@sentient/shared"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { Plugin } from "vite";

const nestjsStub = path.resolve(__dirname, "src/lib/nestjs-stub.ts");

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
      "@nestjs/common": nestjsStub,
      "@nestjs/core": nestjsStub,
      "@nestjs/config": nestjsStub,
      "jsonwebtoken": nestjsStub,
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://localhost:3004",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log(`[proxy:gateway] -> ${req.method} ${req.url}`);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(`[proxy:gateway] <- ${proxyRes.statusCode} ${req.url}`);
          });
          proxy.on("error", (err, req) => {
            console.error(`[proxy:gateway] x ${req.url} - ${err.message}`);
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
    commonjsOptions: {
      // WHY: @sentient/shared builds to CommonJS (tsconfig.base.json pins
      // `module: "commonjs"` for the NestJS services), and its barrels re-export
      // through tslib's `__exportStar`, which Rollup cannot analyse statically.
      // `optimizeDeps.include` above covers dev, where esbuild pre-bundles it to
      // ESM — but that does not apply to `vite build`. There, Rollup resolves the
      // pnpm symlink (apps/web/node_modules/@sentient/shared) to its real path,
      // packages/shared/dist, which falls outside this option's default
      // [/node_modules/] and so never reaches the CommonJS plugin. Every *value*
      // import of a shared enum then fails to build ("PerformanceRating is not
      // exported by packages/shared/dist/index.js") while type-only imports,
      // erased at compile time, keep working — which is why `tsc --noEmit` stays
      // clean and only the production build breaks.
      include: [/node_modules/, /packages[\\/]shared[\\/]dist/],
    },
  },
});

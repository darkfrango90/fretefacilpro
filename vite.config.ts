import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { cp, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Vite-plugin-pwa writes sw.js + workbox-*.js into Vite's resolved outDir (dist/),
 * but Nitro serves static assets from dist/client/. This plugin moves the SW
 * artifacts to dist/client/ after the build so they are served from the site root.
 */
function relocateSwToClientPlugin() {
  return {
    name: "relocate-sw",
    apply: "build" as const,
    enforce: "post" as const,
    async closeBundle() {
      const root = process.cwd();
      const from = join(root, "dist");
      const to = join(root, "dist", "client");
      if (!existsSync(from) || !existsSync(to)) return;
      const entries = await readdir(from);
      for (const name of entries) {
        if (name === "sw.js" || /^workbox-[\w-]+\.js(\.map)?$/.test(name)) {
          const src = join(from, name);
          const dst = join(to, name);
          await cp(src, dst, { force: true });
          await rm(src, { force: true });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      server: { entry: "src/server.ts" },
    }),
    viteReact(),
    tailwindcss(),
    VitePWA({
      // Generated SW writes to the client build (dist/client) alongside other assets.
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null, // our guarded wrapper registers manually
      filename: "sw.js",
      manifest: false, // we ship public/manifest.webmanifest manually
      devOptions: { enabled: false }, // never run SW in dev
      workbox: {
        // Disable Workbox's default cache-first navigation route to index.html.
        // It was intercepting page refreshes before our NetworkFirst rule and
        // could leave Android Chrome stuck on a blank/loading screen.
        navigateFallback: null,
        // Keep install light on Android/mobile data. The dedicated
        // offline.html + entry-csr chunk is injected into the precache by
        // scripts/build-csr-shell.mjs after build. Do not precache every
        // route JS chunk here, or first access can spend a long time
        // downloading dozens of files before the app feels responsive.
        globPatterns: ["**/*.{css,html,svg,png,jpg,jpeg,webp,woff,woff2,ico,json}"],
        // Avoid precaching server build artifacts and source maps.
        globIgnores: ["**/server/**", "**/*.map"],
        // TanStack Start emits client assets into dist/client/ but Vite's outDir
        // is dist/, so the generated precache manifest URLs are prefixed with
        // "client/". The site serves dist/client/ as the web root, so strip the
        // prefix to align precache URLs with public paths (/assets/..., /icons/...).
        modifyURLPrefix: { "client/": "" },
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Auto-aplica nova versão na ativação para evitar estado híbrido
        // (versão antiga em cache + bundle novo) que causava React #418.
        skipWaiting: true,
        // Never cache backend / API / auth / storage calls — data must come from
        // Dexie offline-first layer or the network when online.
        navigationPreload: false,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin &&
              request.mode === "navigate" &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/_build/") &&
              !url.pathname.startsWith("/__l5e/") &&
              !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
              precacheFallback: { fallbackURL: "/offline.html" },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") ||
              url.hostname.endsWith(".supabase.in"),
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            // Hashed JS/CSS chunks from the client build. Cache-first avoids
            // revalidating every chunk on weak Android connections.
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ["script", "style", "worker"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === "font",
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
    relocateSwToClientPlugin(),
  ],
});

// Post-build step: bundles src/entry-csr.tsx into dist/client/assets/ with a
// content hash, then emits dist/client/offline.html that loads it. Runs after
// `vite build` so it stays out of TanStack Start's single-entry constraint.
//
// Why: the main TanStack Start client bundle calls hydrateRoot() and depends
// on SSR-injected dehydrated router state. The offline shell has no SSR state,
// so attempting to hydrate from it throws "Invariant failed". The CSR entry
// mounts the app via createRoot() + <RouterProvider />, with no hydration.

import { build } from "esbuild";
import { loadEnv } from "vite";
import { readdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = process.cwd();
const CLIENT_DIR = join(ROOT, "dist", "client");
const ASSETS_DIR = join(CLIENT_DIR, "assets");
const MODE = process.env.MODE || process.env.NODE_ENV || "production";
const ENV = loadEnv(MODE, ROOT, "");

if (!existsSync(CLIENT_DIR)) {
  console.error("[csr-shell] dist/client not found — run `vite build` first.");
  process.exit(1);
}

// Stub CSS / url-suffixed imports so esbuild doesn't try to process them.
// Styles ship via the main client build's CSS asset, loaded by offline.html
// through a <link rel="stylesheet"> tag.
const stubCssPlugin = {
  name: "stub-css",
  setup(b) {
    b.onResolve({ filter: /\.css(\?.*)?$/ }, (args) => ({
      path: args.path,
      namespace: "stub-css",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub-css" }, () => ({
      contents: "export default '';",
      loader: "js",
    }));
  },
};

// Replicate Vite's import.meta.env.* substitution for VITE_* vars + standard
// flags. esbuild doesn't read .env files or inject these on its own, so the
// CSR bundle would otherwise see `undefined` and crash when the Supabase
// client reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
//
// loadEnv(..., "") matches Vite's env loading source (.env files + build env),
// then process.env wins for variables injected directly by the deploy runtime.
function buildDefine() {
  const loadedEnv = { ...ENV, ...process.env };
  const viteEnv = {
    MODE,
    PROD: MODE === "production",
    DEV: MODE !== "production",
    SSR: false,
    BASE_URL: "/",
  };

  for (const [k, v] of Object.entries(loadedEnv)) {
    if (k.startsWith("VITE_") && v !== undefined) {
      viteEnv[k] = v;
    }
  }

  const def = {
    "process.env.NODE_ENV": JSON.stringify(MODE === "production" ? "production" : "development"),
    // Defines the whole object too, so any import.meta.env access is safe in
    // the standalone CSR bundle even if a variable is missing.
    "import.meta.env": JSON.stringify(viteEnv),
    "import.meta.env.MODE": JSON.stringify(viteEnv.MODE),
    "import.meta.env.PROD": String(viteEnv.PROD),
    "import.meta.env.DEV": String(viteEnv.DEV),
    "import.meta.env.SSR": String(viteEnv.SSR),
    "import.meta.env.BASE_URL": JSON.stringify(viteEnv.BASE_URL),
  };

  for (const [k, v] of Object.entries(viteEnv)) {
    if (k.startsWith("VITE_")) {
      def[`import.meta.env.${k}`] = JSON.stringify(v);
    }
  }
  return def;
}

console.log(`[csr-shell] modo Vite: ${MODE}`);
console.log(`[csr-shell] VITE_SUPABASE_URL: ${ENV.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL ? "definida" : "AUSENTE"}`);
console.log(`[csr-shell] VITE_SUPABASE_PUBLISHABLE_KEY: ${ENV.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "definida" : "AUSENTE"}`);

// Bundle the CSR entry.
const result = await build({
  entryPoints: [join(ROOT, "src/entry-csr.tsx")],
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: true,
  sourcemap: false,
  write: false,
  outfile: join(ROOT, "dist/client/assets/entry-csr.js"),
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl" },
  define: buildDefine(),
  tsconfig: join(ROOT, "tsconfig.json"),
  plugins: [stubCssPlugin],
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs"],
  alias: { "@": join(ROOT, "src") },
});

const jsOutput = result.outputFiles.find((f) => f.path.endsWith(".js"));
if (!jsOutput) throw new Error("[csr-shell] esbuild produced no JS output");

const hash = createHash("sha256").update(jsOutput.contents).digest("hex").slice(0, 8);
const csrFileName = `assets/entry-csr-${hash}.js`;
await writeFile(join(CLIENT_DIR, csrFileName), jsOutput.contents);

// Pick up the CSS asset emitted by the main client build (Tailwind output).
const assetFiles = await readdir(ASSETS_DIR);
const cssFiles = assetFiles.filter((f) => f.endsWith(".css"));
const cssLinks = cssFiles.map((f) => `  <link rel="stylesheet" href="/assets/${f}">`).join("\n");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Frete Facil PRO</title>
  <meta name="theme-color" content="#1B2A4A">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Frete Fácil PRO">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <link rel="icon" href="/favicon.ico">
${cssLinks}
  <style>
    #app-loading{position:fixed;inset:0;z-index:9999;background:#0b1530;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;transition:opacity .3s}
    #app-loading-spinner{width:40px;height:40px;border:3px solid rgba(245,124,0,.25);border-top-color:#F57C00;border-radius:50%;animation:agl-spin .8s linear infinite}
    #app-loading-text{color:rgba(255,255,255,.5);font-family:sans-serif;font-size:13px;letter-spacing:.05em}
    @keyframes agl-spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div id="app-loading">
    <div id="app-loading-spinner"></div>
    <div id="app-loading-text">Carregando…</div>
  </div>
  <div id="app"></div>
  <script type="module" src="/${csrFileName}"></script>
</body>
</html>
`;

await writeFile(join(CLIENT_DIR, "offline.html"), html);
await writeFile(join(CLIENT_DIR, "index.html"), html);

// Patch the precache manifest in the service worker so /offline.html is
// served from cache (it was emitted AFTER vite-plugin-pwa generated sw.js).
const swPath = join(CLIENT_DIR, "sw.js");
if (existsSync(swPath)) {
  const sw = await readFile(swPath, "utf8");
  const offlineHash = createHash("md5").update(html).digest("hex");
  const csrHash = createHash("md5").update(jsOutput.contents).digest("hex");

  // Inject our two assets into the first precacheAndRoute([...]) call.
  const injection =
    `{"revision":"${offlineHash}","url":"offline.html"},` +
    `{"revision":"${csrHash}","url":"${csrFileName}"},`;
  const patched = sw.replace(/precacheAndRoute\(\[/, `precacheAndRoute([${injection}`);
  if (patched !== sw) {
    await writeFile(swPath, patched);
    console.log(`[csr-shell] precache patched with offline.html + ${csrFileName}`);
  } else {
    console.warn("[csr-shell] could not patch sw.js precacheAndRoute — offline.html may not be cached");
  }
}

console.log(`[csr-shell] emitted dist/client/${csrFileName} + offline.html`);

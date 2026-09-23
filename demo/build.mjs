// Builds the demo into demo/dist as a static site with relative paths:
// the desktop (index.html), the one-window pages the native demo app
// loads, their scripts and the stylesheets. The scripts are IIFE
// bundles for classic <script src> tags, because the native app loads
// the pages from file:// URLs, where module scripts are blocked.
//
//   node demo/build.mjs           build
//   node demo/build.mjs --serve   build, then serve demo/dist locally
import * as esbuild from "esbuild";
import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const demo = dirname(fileURLToPath(import.meta.url));
const root = dirname(demo);
const dist = join(demo, "dist");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

await rm(dist, { recursive: true, force: true });
await mkdir(dist);
await esbuild.build({
  entryPoints: [join(demo, "desktop.ts"), join(demo, "page.ts")],
  outdir: dist,
  bundle: true,
  format: "iife",
  // WKWebView on macOS 12, the oldest system the native host supports.
  target: "safari15",
  define: { OSMIUM_VERSION: JSON.stringify(pkg.version) },
  logLevel: "warning",
});
const pages = (await readdir(demo)).filter((f) => f.endsWith(".html"));
await Promise.all([
  ...pages.map((f) => copyFile(join(demo, f), join(dist, f))),
  copyFile(join(demo, "demo.css"), join(dist, "demo.css")),
  copyFile(join(root, "osmium.css"), join(dist, "osmium.css")),
]);

if (process.argv.includes("--serve")) {
  const ctx = await esbuild.context({});
  const { port } = await ctx.serve({ servedir: dist });
  console.log(`Osmium UI demo: http://localhost:${port}/`);
}

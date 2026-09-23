// One demo window per page, for the native demo app: each of
// controls.html, finder.html, panel.html and about.html holds one
// .osm-page-window naming its window in data-window. hostWindow sends
// the window's gestures to the native shell (the "osmium" message
// handler OsmiumWindowHost registers); in a browser tab the window
// fills the tab.
import { hostWindow } from "../src/index.js";
import type { HostedWindow } from "../src/index.js";
import { registerDemoSprites } from "./icons.js";
import { registerPatterns } from "./patterns.js";
import { windowSpec } from "./windows.js";

const win = document.querySelector<HTMLElement>(".osm-page-window");
const spec = windowSpec(win?.dataset.window ?? "");
if (!win || !spec) throw new Error("page has no known .osm-page-window");
registerDemoSprites();
registerPatterns();
if (spec.info) win.classList.add("osm-info");

const content = win.querySelector<HTMLElement>(":scope > .osm-content");
if (!content) throw new Error("page window has no .osm-content");
let hosted: HostedWindow | undefined;
const built = spec.build(content, {
  close: () => hosted?.close(),
  // The page is the window, so keys only arrive while it is active.
  isActive: () => true,
});
const minus1 = (s: { w: number; h: number }) => ({ w: s.w - 1, h: s.h - 1 });
hosted = hostWindow(win, {
  title: spec.title,
  ...(spec.zoom ? { zoom: { standard: spec.size } } : {}),
  // The in-tab resize bounds the drawn window, without its shadow.
  ...(spec.min ? { grow: { min: minus1(spec.min) } } : {}),
});
built.focus?.();

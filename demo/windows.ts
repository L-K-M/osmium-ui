// The demo's windows. Each one's content is built by its own module
// from a WindowSpec, so the same code fills a window on the desktop
// page (index.html, desktop.ts) and its one-window page for the native
// demo app (controls.html and friends, page.ts).
import type { Size } from "../src/index.js";
import { buildAbout } from "./about.js";
import { buildControls } from "./controls.js";
import { buildFinder } from "./finder.js";
import { buildPanel } from "./panel.js";
import type { Pattern } from "./patterns.js";

export type WindowId = "controls" | "finder" | "panel" | "about";

/** What the window's host (the desktop or a one-window page) offers
 * its content. */
export interface WindowEnv {
  /** Close the window, as its close box would. */
  close(): void;
  /** Whether the window is the active one. Page-wide keys (a dialog's
   * Return and Escape) act only then. */
  isActive(): boolean;
  /** Open (or bring forward) another demo window; absent where a page
   * holds a single window. */
  open?(id: WindowId): void;
  /** Paint the desktop; absent where there is no desktop. */
  setDesktop?(pattern: Pattern): void;
}

export interface WindowContent {
  /** Give the keyboard to the window's main control, if it has one
   * (called when the window activates). */
  focus?(): void;
  /** The size the zoom box zooms to from `current` (both the drawn
   * window, without its shadow): the Finder fits its items. */
  standardSize?(current: Size): Size;
}

export interface WindowSpec {
  readonly id: WindowId;
  readonly title: string;
  /** The native window's content size: the drawn window plus its 1px
   * drop shadow, as OsmiumWindowSpec counts it. */
  readonly size: Size;
  /** Smallest size of a resizable window (counted the same way). */
  readonly min?: Size;
  readonly zoom?: boolean;
  /** Drawn as an information window (Get Info), whose text dims when
   * the window is inactive. */
  readonly info?: boolean;
  build(content: HTMLElement, env: WindowEnv): WindowContent;
}

export const WINDOWS: readonly WindowSpec[] = [
  { id: "controls", title: "Controls", size: { w: 461, h: 331 },
    build: buildControls },
  { id: "finder", title: "Osmium HD", size: { w: 501, h: 321 },
    min: { w: 301, h: 181 }, zoom: true, build: buildFinder },
  { id: "panel", title: "Control Panel", size: { w: 521, h: 381 },
    build: buildPanel },
  { id: "about", title: "About Osmium UI", size: { w: 341, h: 221 },
    info: true, build: buildAbout },
];

export function windowSpec(id: string): WindowSpec | undefined {
  return WINDOWS.find((w) => w.id === id);
}

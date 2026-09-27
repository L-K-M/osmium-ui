// The demo's windows. Each one's content is built by its own module
// from a WindowSpec, so the same code fills a window on the desktop
// page (index.html, desktop.ts) and its one-window page for the native
// demo app (controls.html and friends, page.ts).
import type {
  BalloonTrigger, Menu, OsmiumWindow, Size,
} from "../src/index.js";
import { buildAbout } from "./about.js";
import { buildAlerts } from "./alerts.js";
import { buildAppearance } from "./appearance.js";
import { buildControls } from "./controls.js";
import { buildEditor } from "./editor.js";
import type { DocumentId } from "./documents.js";
import { buildFinder } from "./finder.js";
import { buildPanel } from "./panel.js";
import { buildSharing } from "./sharing.js";
import type { Pattern } from "./patterns.js";

export type WindowId =
  "controls" | "finder" | "panel" | "appearance" | "about" | "sharing"
  | "alerts" | "editor";

/** What the window's host (the desktop or a one-window page) offers
 * its content. */
export interface WindowEnv {
  /** Close the window, as its close box would. */
  close(): void;
  /** Whether the window is the active one. Page-wide keys (a dialog's
   * Return and Escape) act only then. */
  isActive(): boolean;
  /** Open (or bring forward) another demo window, and for an
   * application's window, open `doc` in it; absent where a page holds
   * a single window (the native app opens the window, ignoring `doc`). */
  open?(id: WindowId, doc?: DocumentId): void;
  /** Show this window and bring it to the front: an application's
   * document window, once it has a document. Absent in a one-window
   * page, which is always shown. */
  show?(): void;
  /** The window's application quits: its window is closed already, and
   * the Finder comes forward. Absent in a one-window page. */
  quit?(): void;
  /** Paint the desktop; absent where there is no desktop. */
  setDesktop?(pattern: Pattern): void;
  /** When the window's help balloons open: with Balloon Help, on the
   * desktop, whose Help menu turns it on; on hover in a one-window page,
   * which has no Help menu. */
  readonly balloons: BalloonTrigger;
  /** The drawn window, for alerts to name as their parent (undefined
   * until a one-window page has mounted it). */
  window(): OsmiumWindow | undefined;
}

export interface WindowContent {
  /** Give the keyboard to the window's main control, if it has one
   * (called when the window activates). */
  focus?(): void;
  /** The size the zoom box zooms to from `current` (both the drawn
   * window, without its shadow): the Finder fits its items. */
  standardSize?(current: Size): Size;
  /** The close box, when the window decides for itself whether to
   * close (a document with unsaved changes asks first); it calls
   * env.close() when it does. Without it the close box closes. */
  requestClose?(): void;
  /** The application that owns the window, for a window that isn't
   * the Finder's. While it is in front the menu bar shows its menus,
   * and it stays in front with no window open until the reader clicks
   * elsewhere, as a Mac OS 8 application does. */
  readonly app?: WindowApp;
}

export interface WindowApp {
  readonly name: string;
  /** The Apple menu's "About <name>…". */
  about(): void;
  /** The menus after the Apple menu. */
  menus(): readonly Menu[];
  /** Open `doc` (or a new document, or nothing when one is open
   * already and no `doc` is asked for), from a desktop icon, the
   * Finder or another menu. */
  launch(doc?: DocumentId): void;
}

export interface WindowSpec {
  readonly id: WindowId;
  readonly title: string;
  /** The native window's content size: the drawn window plus its 1px
   * drop shadow, as OsmiumWindowSpec counts it. */
  readonly size: Size;
  /** Smallest size of a resizable window (counted the same way). */
  readonly min?: Size;
  /** The size the zoom box zooms to (counted the same way), when it
   * differs from `size`. */
  readonly standard?: Size;
  readonly zoom?: boolean;
  /** Drawn as an information window (Get Info), whose text dims when
   * the window is inactive. */
  readonly info?: boolean;
  build(content: HTMLElement, env: WindowEnv): WindowContent;
}

export const WINDOWS: readonly WindowSpec[] = [
  { id: "controls", title: "Controls", size: { w: 461, h: 331 },
    build: buildControls },
  // Zoomed, the Finder shows all 26 items (finder.ts standardSize).
  { id: "finder", title: "Osmium HD", size: { w: 501, h: 321 },
    min: { w: 301, h: 181 }, standard: { w: 501, h: 580 }, zoom: true,
    build: buildFinder },
  { id: "panel", title: "Control Panel", size: { w: 521, h: 381 },
    build: buildPanel },
  { id: "appearance", title: "Appearance", size: { w: 461, h: 221 },
    build: buildAppearance },
  { id: "about", title: "About Osmium UI", size: { w: 341, h: 221 },
    info: true, build: buildAbout },
  { id: "sharing", title: "File Sharing", size: { w: 381, h: 331 },
    build: buildSharing },
  { id: "alerts", title: "Alerts", size: { w: 441, h: 241 },
    build: buildAlerts },
  // Foolscap's document window; zoomed, it fills the desktop
  // (editor.ts standardSize).
  { id: "editor", title: "untitled", size: { w: 481, h: 341 },
    min: { w: 201, h: 121 }, zoom: true, build: buildEditor },
];

export function windowSpec(id: string): WindowSpec | undefined {
  return WINDOWS.find((w) => w.id === id);
}

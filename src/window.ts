// A Mac OS 8 document window around an element: titlebar with close /
// zoom / collapse boxes, centered title, pinstripes, optional grow box,
// active/inactive states. Looks come from osmium.css; this module
// builds the chrome, keeps the title centered the way the Window
// Manager does, and tracks box presses like the Control Manager (the
// box highlights while the mouse is down over it; releasing outside
// cancels). What a box *does* is the host's business — see the
// callbacks — because only the native shell can close or move a window.
import { trackPress } from "./controls.js";
import { installOsmium } from "./install.js";

/** What makes a window active (drawn with its boxes and stripes). */
export type Activation =
  /** The page's focus: one window per page, as the native host has it. */
  | "page"
  /** The caller, through setActive (several windows in one page). */
  | "manual";

export interface WindowOptions {
  title: string;
  /** Defaults to "page". */
  activation?: Activation;
  /** Each box is drawn only when its handler is given. */
  onClose?: () => void;
  onZoom?: () => void;
  onCollapse?: () => void;
  /** pointerdown on the grow box; omit for a fixed-size window. */
  onGrow?: (e: PointerEvent) => void;
  /** pointerdown on the titlebar outside the boxes. */
  onDrag?: (e: PointerEvent) => void;
}

export interface OsmiumWindow {
  readonly element: HTMLElement;
  readonly content: HTMLElement;
  setTitle(text: string): void;
  setShaded(on: boolean): void;
  /** Draw the window active or inactive (with "manual" activation). */
  setActive(on: boolean): void;
}

/** Where the Window Manager starts a title: centered on the whole
 * window, rounding left, whatever boxes sit on either side. */
export function titleLeft(windowWidth: number, titleWidth: number): number {
  return Math.floor((windowWidth - titleWidth) / 2);
}

function part(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

/** Turn `el` into an Osmium window. Its `.osm-content` child (created
 * around the existing children if missing) becomes the content area. */
export function mountWindow(el: HTMLElement,
                            opts: WindowOptions): OsmiumWindow {
  el.classList.add("osm-window");
  let content = el.querySelector<HTMLElement>(":scope > .osm-content");
  if (!content) {
    content = part("div", "osm-content");
    content.append(...Array.from(el.childNodes));
    el.append(content);
  }

  const bar = part("div", "osm-titlebar");
  const title = part("span", "osm-title");
  title.textContent = opts.title;
  const chrome: HTMLElement[] = [
    bar, part("div", "osm-stripes osm-stripes-l"), title,
    part("div", "osm-stripes osm-stripes-r"),
  ];
  const boxes: [string, string, (() => void) | undefined][] = [
    ["osm-close", "Close", opts.onClose],
    ["osm-zoom", "Zoom", opts.onZoom],
    ["osm-collapse", "Collapse", opts.onCollapse],
  ];
  for (const [cls, label, action] of boxes) {
    if (!action) continue;
    const box = part("button", `osm-box ${cls}`);
    box.setAttribute("aria-label", label);
    box.tabIndex = -1; // OS 8 boxes take no keyboard focus
    trackPress(box, action);
    chrome.push(box);
  }
  el.classList.toggle("osm-no-zoom", !opts.onZoom);
  el.prepend(...chrome);

  const { onDrag, onGrow } = opts;
  if (onDrag) {
    bar.addEventListener("pointerdown", (e) => {
      if (e.button === 0) onDrag(e);
    });
  }
  if (onGrow) {
    const grow = part("div", "osm-grow");
    grow.setAttribute("role", "separator");
    grow.setAttribute("aria-label", "Resize window");
    grow.addEventListener("pointerdown", (e) => {
      if (e.button === 0) onGrow(e);
    });
    el.append(grow);
  }

  // Title position and the stripes' parting both need the measured
  // string width, which is only right once the bitmap fonts are in.
  const layout = () => {
    const adv = Math.round(title.getBoundingClientRect().width);
    el.style.setProperty("--osm-title-x",
                         `${titleLeft(el.offsetWidth, adv)}px`);
    el.style.setProperty("--osm-title-w", `${adv}px`);
  };
  new ResizeObserver(layout).observe(el);
  installOsmium()
    .catch((err: unknown) => {
      console.error("Osmium fonts unavailable; using fallbacks", err);
    })
    .finally(layout);

  const setActive = (on: boolean) =>
    el.classList.toggle("osm-inactive", !on);
  if ((opts.activation ?? "page") === "page") {
    // Active while the page has focus: the native shell gives every
    // Osmium window its own page, so page focus is window focus.
    const syncFocus = () => setActive(document.hasFocus());
    window.addEventListener("focus", syncFocus);
    window.addEventListener("blur", syncFocus);
    syncFocus();
  }

  return {
    element: el,
    content,
    setTitle(text) { title.textContent = text; layout(); },
    setShaded(on) { el.classList.toggle("osm-shaded", on); },
    setActive,
  };
}

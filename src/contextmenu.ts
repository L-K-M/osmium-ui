// Mac OS 8 contextual menus (Control-click, right-click, the menu
// key): a menu at a point, drawn and keyed like the menu bar's menus
// (menu.ts), placed and tracked as Mac OS 8.0's Finder 8.0 does it.
//
// Measured in Mac OS 8.0 (Infinite Mac, 640 x 480, Finder 8.0: items
// in icon and list views, empty window space, the desktop, the Trash):
//
//   placement   the menu's outline has its top-left pixel on the hot
//               spot (the menu's content starts 1px right of and below
//               it, as the Mac OS 8 HIG words it). If the content would
//               run past the screen's right edge, the menu flips: the
//               outline's right column lands 1px left of the hot spot.
//               Either way (flipped at hot spot x 638 and 639 too) it
//               is then pushed left and up to leave 3 columns right of
//               and 5 rows below the outline (its shadow and 2 or 4
//               more). It never flips upward.
//   look        a menu bar menu's: outline, bevel, shadow, 16px items,
//               6px separators, text 19px in, the widest item plus
//               29px wide, and the accent highlight, which on the first
//               and last items takes over the bevel row (osmium.css).
//   tracking    the menu opens during the press. Released after about
//               half a second, the press chooses the item under the
//               pointer (11 of 11 trials) or, off the items, closes the
//               menu (closed at 550 ms). Released sooner off the items,
//               it leaves the menu open, "sticky" (open at 520 ms). A
//               click outside an open menu only closes it, a menu bar
//               title included; a click in it chooses the item under
//               the pointer or, on a separator, closes it.
//
// Not settled: a press released over an item within the half second.
// In 47 emulator trials it chose the item 22 times and left the menu
// open with the item highlighted 25 times, with no trend in the time on
// the item or since the press, even when the menu was seen up with the
// item highlighted before the release. Emulated input arrives late
// (releases on arrival were taken where the pointer had just been), so
// Mac OS 8.0's rule is unknown. Here such a release chooses, as the
// longer presses did.
//
// Here the half second runs from the menu's opening, which the press's
// contextmenu event starts; a right-click whose contextmenu event comes
// on release (Windows) leaves the menu open. Not Mac OS 8.0 (which
// takes no keys in an open menu, Escape included): the menu bar menus'
// keys work (the arrow keys, Return, Space, Escape, Tab), and so does
// typing an item's first letter, which only contextual menus take.
// Focus stays on the list, which names the highlighted item to
// assistive tech. Not captured, so guessed: a menu that would pass the
// left or top edge is kept inside the viewport, and one taller than it
// scrolls with a scroll bar and no shadow. Mac OS 8.5 draws the menu
// 4px wider, its text 2px further in; this is 8.0's.
import { swallowClick } from "./controls.js";
import { openMenuList } from "./menu.js";
import type { MenuList } from "./menu.js";
import type { MenuEntry } from "./menubar.js";
import { closeWhenModal, isModal } from "./modal.js";

export interface ContextMenuOptions {
  /** The menu's accessible name. */
  readonly label?: string;
  /** Called once when the menu closes, after a chosen item's action. */
  onClose?(chosen: boolean): void;
}

export interface OsmiumContextMenu {
  readonly element: HTMLElement;
  readonly open: boolean;
  /** Close without choosing (onClose(false)); nothing if closed. */
  close(): void;
}

/** A client point. */
export interface MenuPoint {
  readonly x: number;
  readonly y: number;
}

/** A press released sooner than this after the menu opened, away from
 * any item, leaves the menu open. Mac OS 8.0 kept it open after a
 * 520 ms press and closed it after 550 ms; 32 ticks, the default
 * double-click time, is assumed to be the limit. */
export const STICKY_MS = 533;
/** Columns kept free right of the outline, and rows below it (the
 * shadow's and 2 or 4 more): Mac OS 8.0 pushed menus back to leave
 * exactly these on a 640 x 480 screen. */
export const EDGE_RIGHT = 3;
export const EDGE_BOTTOM = 5;

/** Where a menu whose outline is `w` x `h` goes for hot spot `at` in a
 * `vw` x `vh` viewport: the outline's left and top. Pure. */
export function placeContextMenu(at: MenuPoint, w: number, h: number,
                                 vw: number, vh: number): MenuPoint {
  const x = Math.round(at.x), y = Math.round(at.y);
  // The content (inside the outline) would pass the right edge: flip.
  let left = x + w - 1 > vw ? x - w : x;
  left = Math.max(0, Math.min(left, vw - EDGE_RIGHT - w));
  const top = Math.max(0, Math.min(y, vh - EDGE_BOTTOM - h));
  return { x: left, y: top };
}

/** The open contextual menu's close, so a new one replaces it. */
let current: (() => void) | null = null;

/** Show a Mac OS 8 contextual menu with its top-left corner at (x, y)
 * in client coordinates (flipped or pushed back to fit, as Mac OS 8
 * does). Items as in menu bar menus (MenuEntry: title, action or
 * dimmed, checked); keys are not drawn. Call it from the triggering
 * press (a contextmenu event, say) so a press-drag-release chooses.
 * A contextual menu already open closes first. While an alert is up
 * (showAlert), nothing opens: the handle is closed and onClose(false)
 * is called in a microtask. */
export function showContextMenu(at: MenuPoint,
                                entries: readonly MenuEntry[],
                                opts: ContextMenuOptions = {}):
                                OsmiumContextMenu {
  current?.();
  if (isModal()) {
    queueMicrotask(() => opts.onClose?.(false));
    return closedMenu();
  }

  const returnFocus = document.activeElement;
  const menu: MenuList = openMenuList(entries, opts.label ?? "",
                                      "osm-pulldown osm-contextmenu", "none");
  const el = menu.element;
  el.style.left = "0px";
  el.style.top = "0px";
  const w = el.offsetWidth, h = el.offsetHeight;
  // The fixed-position viewport, without the page's scroll bars.
  const root = document.documentElement;
  const vw = root.clientWidth || window.innerWidth;
  const vh = root.clientHeight || window.innerHeight;
  const pos = placeContextMenu(at, w, h, vw, vh);
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  // Taller than the viewport (not captured): scroll, keeping the rows
  // below free. The scroll box clips the shadow, and it mustn't scroll
  // sideways for it.
  if (h > vh - EDGE_BOTTOM - pos.y) {
    el.style.maxHeight = `${Math.max(0, vh - EDGE_BOTTOM - pos.y)}px`;
    el.style.overflowX = "hidden";
    el.style.overflowY = "auto";
  }
  el.focus({ preventScroll: true });

  const openedAt = performance.now();
  let open = true;
  // Until a new press starts, the next release ends the press that
  // opened the menu (none comes if it opened on release or by key).
  let opening = true;
  const unwatchModal = closeWhenModal(() => close(false));

  /** Take the menu down, give focus back, run the chosen item's
   * `action` (if any), then report. */
  function close(chosen: boolean, action?: () => void): void {
    if (!open) return;
    open = false;
    const hadFocus = el.contains(document.activeElement);
    menu.remove();
    unwatchModal();
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("blur", onBlur);
    if (current === dismiss) current = null;
    if (hadFocus && returnFocus instanceof HTMLElement &&
        returnFocus.isConnected)
      returnFocus.focus({ preventScroll: true });
    else if (hadFocus) (document.activeElement as HTMLElement | null)?.blur();
    try {
      action?.();
    } finally {
      opts.onClose?.(chosen);
    }
  }
  const dismiss = () => close(false);
  const onBlur = dismiss;
  current = dismiss;

  function choose(i: number): void {
    menu.choose(i, (action) => close(true, action));
  }

  // The pointer highlights the item under it, pressed or not.
  function onMove(e: PointerEvent): void {
    menu.highlight(menu.itemAt(e.clientX, e.clientY));
  }

  // A press outside closes the menu and does nothing else (the page
  // under it gets neither the press, its click nor its contextmenu). A
  // press in the menu is the menu's; its release decides.
  function onDown(e: PointerEvent): void {
    opening = false;
    e.preventDefault();
    e.stopPropagation();
    if (el.contains(e.target as Node)) return;
    close(false);
    swallowClick();
    // Only a right-click or Control-click has a contextmenu event to
    // come; armed for any other, it would eat the menu key's next one.
    if (e.button === 2 || e.ctrlKey) swallowContextMenu();
  }

  function onUp(e: PointerEvent): void {
    const i = menu.itemAt(e.clientX, e.clientY);
    const first = opening;
    opening = false;
    swallowClick();
    if (menu.enabled(i)) { choose(i); return; }
    // The opening press, released off the items: a click (or a touch)
    // leaves the menu open, a longer press closes it.
    if (first && (e.pointerType !== "mouse" ||
                  performance.now() - openedAt < STICKY_MS)) return;
    close(false);
  }

  // Right-clicks on the menu bring up neither the browser's own menu
  // nor, through the page's listeners, a new contextual menu.
  function onContextMenu(e: Event): void {
    if (!el.contains(e.target as Node)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // Keys, as in menu bar menus, plus an item's first letter.
  function onKey(e: KeyboardEvent): void {
    if (e.key === "ArrowDown") menu.step(1);
    else if (e.key === "ArrowUp") menu.step(-1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // No submenus: nothing to move to, and nothing under the menu
      // may take the key.
    } else if (e.key === "Enter" || e.key === " ") {
      if (menu.highlighted >= 0 && !e.repeat) choose(menu.highlighted);
    } else if (e.key === "Escape" || e.key === "Tab") close(false);
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey)
      typeSelect(e.key);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  /** Highlight the next item that can be chosen whose title starts with
   * `ch`, after the highlighted one, wrapping. */
  function typeSelect(ch: string): void {
    const n = entries.length;
    const k = ch.toLowerCase();
    for (let d = 1; d <= n; d++) {
      const i = (menu.highlighted + d + n) % n;
      const entry = entries[i];
      if (!menu.enabled(i) || typeof entry !== "object") continue;
      if (entry.title.toLowerCase().startsWith(k)) {
        menu.highlight(i);
        return;
      }
    }
  }

  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("blur", onBlur);

  return {
    element: el,
    get open() { return open; },
    close: dismiss,
  };
}

/** The handle showContextMenu returns when nothing opened. */
function closedMenu(): OsmiumContextMenu {
  const element = document.createElement("ul");
  element.className = "osm-menu osm-pulldown osm-contextmenu";
  return { element, open: false, close() {} };
}

/** Swallow the contextmenu event of the current press (a right-click
 * that closed a menu must not open another, or the browser's). */
function swallowContextMenu(): void {
  const eat = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
    done();
  };
  // A key held since before the press repeats; it isn't a new one.
  const onKey = (ev: KeyboardEvent) => { if (!ev.repeat) done(); };
  const done = () => {
    document.removeEventListener("contextmenu", eat, true);
    document.removeEventListener("pointerdown", done, true);
    document.removeEventListener("keydown", onKey, true);
  };
  document.addEventListener("contextmenu", eat, true);
  // A press without one (a Control-click on Windows or Linux) mustn't
  // eat the next press's, nor the menu key's, which follows a keydown.
  setTimeout(() => {
    document.addEventListener("pointerdown", done, true);
    document.addEventListener("keydown", onKey, true);
  });
}

// A Mac OS 8 menu bar for the desktop demo: Charcoal titles on the
// Platinum bar, pull-down menus drawn like the kit's pop-up menus
// (.osm-menu), and a clock. Menus are "sticky" as in Mac OS 8: a click
// on a title leaves its menu open, a press-drag-release chooses, and
// while a menu is open, moving over another title switches to it.
//
// Geometry, from Mac OS 8.0 screenshots: titles are spaced 13px apart
// (pen to pen minus advance); a title's highlight runs 9px either side
// of its text, rows 0..18 of the 20px bar; its menu hangs from the
// highlight's left edge, its top outline on the bar's bottom line.
import { installOsmium } from "../src/index.js";
import { el, swallowClick } from "./dom.js";
import { sprite } from "./icons.js";
import type { SpriteName } from "./icons.js";

export interface MenuItem {
  readonly title: string;
  /** Omitted: the item is drawn dimmed and can't be chosen. */
  readonly action?: () => void;
}

/** An item, or null for a separator line. */
export type MenuEntry = MenuItem | null;

export interface Menu {
  /** The title text, or its accessible name when `icon` is given. */
  readonly title: string;
  readonly icon?: SpriteName;
  /** Built each time the menu opens, so items reflect current state. */
  items(): readonly MenuEntry[];
}

/** Where the first title's text starts, and the gap between titles. */
const FIRST_PEN = 14;
const TITLE_GAP = 13;
/** Highlight margin either side of a title. */
const TITLE_PAD = 9;
/** Icon titles are 16px wide. */
const ICON_W = 16;
/** The bar's bottom line, where menus hang from. */
const MENU_TOP = 19;

export function mountMenuBar(bar: HTMLElement, menus: readonly Menu[]): void {
  bar.classList.add("mb");
  bar.setAttribute("role", "menubar");
  const titles = menus.map((m) => {
    const t = el("button", "mb-title");
    t.type = "button";
    t.setAttribute("role", "menuitem");
    t.setAttribute("aria-haspopup", "menu");
    t.setAttribute("aria-expanded", "false");
    t.tabIndex = -1;
    if (m.icon) {
      const icon = el("span", "mb-icon");
      icon.style.backgroundImage = sprite(m.icon);
      t.append(icon);
      t.setAttribute("aria-label", m.title);
    } else {
      t.textContent = m.title;
    }
    bar.append(t);
    return t;
  });
  titles[0]!.tabIndex = 0;
  const clock = el("div", "mb-clock");
  bar.append(clock);

  // Titles sit at measured pens, so the layout waits for the fonts.
  const layout = () => {
    let pen = FIRST_PEN;
    menus.forEach((m, i) => {
      const t = titles[i]!;
      const w = m.icon ? ICON_W : textWidth(t);
      t.style.left = `${pen - TITLE_PAD}px`;
      t.style.width = `${w + 2 * TITLE_PAD}px`;
      pen += w + TITLE_GAP;
    });
  };
  layout();
  void installOsmium().catch(() => {}).finally(layout);

  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString("en-US",
      { hour: "numeric", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 10_000);

  // ---- the open menu ----------------------------------------------------
  let open = -1;
  let list: HTMLElement | null = null;
  let entries: readonly MenuEntry[] = [];
  let hi = -1;
  // Where the keyboard goes back to when the menu closes.
  let returnFocus: Element | null = null;

  function itemEls(): HTMLElement[] {
    return list ? Array.from(list.children) as HTMLElement[] : [];
  }

  function highlight(i: number): void {
    hi = i;
    itemEls().forEach((li, k) => li.classList.toggle("osm-highlight", k === i));
  }

  function enabled(i: number): boolean {
    return !!entries[i]?.action;
  }

  function show(i: number): void {
    if (i === open) return;
    hide();
    open = i;
    const t = titles[i]!;
    t.classList.add("mb-open");
    t.setAttribute("aria-expanded", "true");
    entries = menus[i]!.items();
    list = el("ul", "osm-menu mb-menu");
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", menus[i]!.title);
    list.tabIndex = -1;
    for (const e of entries) {
      const li = el("li", e ? "osm-menu-item" : "mb-separator");
      if (!e) {
        li.setAttribute("role", "separator");
      } else {
        li.textContent = e.title;
        li.setAttribute("role", "menuitem");
        if (!e.action) li.setAttribute("aria-disabled", "true");
      }
      list.append(li);
    }
    list.style.left = t.style.left;
    list.style.top = `${MENU_TOP}px`;
    document.body.append(list);
    list.focus({ preventScroll: true });
    hi = -1;
  }

  function hide(): void {
    if (open < 0) return;
    titles[open]!.classList.remove("mb-open");
    titles[open]!.setAttribute("aria-expanded", "false");
    list?.remove();
    list = null;
    open = -1;
    hi = -1;
  }

  function close(): void {
    const hadFocus = list?.contains(document.activeElement) ?? false;
    hide();
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("blur", close);
    if (hadFocus && returnFocus instanceof HTMLElement) returnFocus.focus();
    else if (hadFocus) (document.activeElement as HTMLElement | null)?.blur();
    returnFocus = null;
  }

  function start(i: number): void {
    returnFocus = document.activeElement;
    show(i);
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("blur", close);
  }

  /** Blink the chosen item once, close the menu, then act. */
  function choose(i: number): void {
    const e = entries[i];
    const m = list;
    if (!e?.action || !m) return;
    const action = e.action;
    highlight(-1);
    setTimeout(() => { if (list === m) highlight(i); }, 50);
    setTimeout(() => {
      if (list !== m) return;
      close();
      action();
    }, 100);
  }

  function titleAt(x: number, y: number): number {
    return titles.findIndex((t) => inside(t, x, y));
  }

  function itemAt(x: number, y: number): number {
    if (!list || !inside(list, x, y)) return -1;
    return itemEls().findIndex((li) => inside(li, x, y));
  }

  // Pointer tracking while a menu is open: over the bar, the title
  // under the pointer takes over; over the menu, items highlight.
  function track(x: number, y: number): void {
    const t = titleAt(x, y);
    if (t >= 0 && t !== open) show(t);
    const i = itemAt(x, y);
    highlight(enabled(i) ? i : -1);
  }

  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const i = titleAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    if (open === i) { close(); return; }
    if (open < 0) start(i); else show(i);
    const x0 = e.clientX, y0 = e.clientY;
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      if (ev.type === "pointercancel") return;
      // A click leaves the menu open; a drag chooses where it ends.
      const moved = Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3;
      if (!moved || titleAt(ev.clientX, ev.clientY) >= 0) return;
      const k = itemAt(ev.clientX, ev.clientY);
      if (enabled(k)) choose(k); else close();
    };
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  });

  // An open menu follows the pointer, pressed or not (sticky menus).
  document.addEventListener("pointermove", (e) => {
    if (open >= 0) track(e.clientX, e.clientY);
  });

  // A press anywhere but on a title or in the menu closes the menu and
  // does nothing else; one inside the menu chooses on release.
  function onOutside(e: PointerEvent): void {
    if (titleAt(e.clientX, e.clientY) >= 0) return; // the bar's own
    if (list?.contains(e.target as Node)) {
      e.preventDefault();
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointerup", up, true);
        const k = itemAt(ev.clientX, ev.clientY);
        if (enabled(k)) choose(k);
      };
      window.addEventListener("pointerup", up, true);
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    close();
    swallowClick();
  }

  // Keyboard: arrows move through items and menus, Return chooses,
  // Escape closes. A focused title opens its menu with Return, Space
  // or Down Arrow.
  document.addEventListener("keydown", (e) => {
    if (open < 0) return;
    const n = entries.length;
    const step = (d: number) => {
      for (let k = 1; k <= n; k++) {
        const i = ((hi < 0 ? (d > 0 ? -1 : n) : hi) + d * k + n * 2) % n;
        if (enabled(i)) { highlight(i); return; }
      }
    };
    if (e.key === "ArrowDown") step(1);
    else if (e.key === "ArrowUp") step(-1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const d = e.key === "ArrowLeft" ? -1 : 1;
      show((open + d + menus.length) % menus.length);
      step(1);
    } else if (e.key === "Enter" || e.key === " ") {
      if (hi >= 0 && !e.repeat) choose(hi);
    } else if (e.key === "Escape" || e.key === "Tab") close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  titles.forEach((t, i) => t.addEventListener("keydown", (e) => {
    if (open >= 0 || !["Enter", " ", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    start(i);
    const n = entries.length;
    for (let k = 0; k < n; k++) if (enabled(k)) { highlight(k); break; }
  }));
}

function inside(e: Element, x: number, y: number): boolean {
  const r = e.getBoundingClientRect();
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
}

/** Advance width of an element's text in its own font. */
function textWidth(e: HTMLElement): number {
  const ctx = (measure ??= document.createElement("canvas")).getContext("2d");
  if (!ctx) return e.scrollWidth;
  const cs = getComputedStyle(e);
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return Math.round(ctx.measureText(e.textContent ?? "").width);
}
let measure: HTMLCanvasElement | undefined;


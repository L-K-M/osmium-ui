// The Mac OS 8 menu bar: Charcoal titles on the Platinum bar, and
// pull-down menus drawn like the pop-up menus (.osm-menu), with dimmed
// items and separators. Menus are "sticky" as in Mac OS 8: a click on
// a title leaves its menu open, a press-drag-release chooses, and while
// a menu is open, moving over another title switches to it. From the
// keyboard, Return, Space or Down Arrow on a title opens its menu; the
// arrow keys move through items and menus, Return chooses and Escape
// closes.
//
// Geometry, from Mac OS 8.0 screenshots: titles are spaced 13px apart
// (pen to pen minus advance); a title's highlight runs 9px either side
// of its text, rows 0..18 of the 20px bar; its menu hangs from the
// highlight's left edge, its top outline on the bar's bottom line.
import {
  MENU_SEPARATOR, inside, menuSeparator, part, swallowClick, textWidth,
} from "./controls.js";
import type { MenuSeparator } from "./controls.js";
import { installOsmium } from "./install.js";

export interface MenuItem {
  readonly title: string;
  /** Omitted: the item is drawn dimmed and can't be chosen. */
  readonly action?: () => void;
}

/** An item, or MENU_SEPARATOR for a dividing line. */
export type MenuEntry = MenuItem | MenuSeparator;

export interface Menu {
  /** The title text, or its accessible name when `icon` is given. */
  readonly title: string;
  /** A 16 x 16 sprite registered with registerSprites, drawn instead of
   * the title text (the Apple menu's apple, say). */
  readonly icon?: string;
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

/** Make `bar` (styled .osm-menubar, 20px tall; place it along the top
 * of the page) a menu bar with `menus`, left to right. Anything else
 * appended to the bar, a clock say, is the app's to place. */
export function mountMenuBar(bar: HTMLElement, menus: readonly Menu[]): void {
  bar.classList.add("osm-menubar");
  bar.setAttribute("role", "menubar");
  const titles = menus.map((m) => {
    const t = part("button", "osm-menubar-title") as HTMLButtonElement;
    t.type = "button";
    t.setAttribute("role", "menuitem");
    t.setAttribute("aria-haspopup", "menu");
    t.setAttribute("aria-expanded", "false");
    t.tabIndex = -1;
    if (m.icon) {
      const icon = part("span", "osm-menubar-icon");
      icon.style.backgroundImage = `var(--osm-sprite-${m.icon})`;
      t.append(icon);
      t.setAttribute("aria-label", m.title);
    } else {
      t.textContent = m.title;
    }
    bar.append(t);
    return t;
  });
  if (titles[0]) titles[0].tabIndex = 0;

  // Titles sit at measured pens, so the layout waits for the fonts.
  const layout = () => {
    let pen = FIRST_PEN;
    menus.forEach((m, i) => {
      const t = titles[i]!;
      const w = m.icon ? ICON_W : textWidth(t.textContent ?? "", t);
      t.style.left = `${pen - TITLE_PAD}px`;
      t.style.width = `${w + 2 * TITLE_PAD}px`;
      pen += w + TITLE_GAP;
    });
  };
  layout();
  void installOsmium().catch(() => {}).finally(layout);

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
    const e = entries[i];
    return e !== undefined && e !== MENU_SEPARATOR && !!e.action;
  }

  function show(i: number): void {
    if (i === open) return;
    hide();
    open = i;
    const t = titles[i]!;
    t.classList.add("osm-open");
    t.setAttribute("aria-expanded", "true");
    entries = menus[i]!.items();
    list = part("ul", "osm-menu");
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", menus[i]!.title);
    list.tabIndex = -1;
    for (const e of entries) {
      if (e === MENU_SEPARATOR) {
        list.append(menuSeparator());
        continue;
      }
      const li = part("li", "osm-menu-item");
      li.textContent = e.title;
      li.setAttribute("role", "menuitem");
      if (!e.action) li.setAttribute("aria-disabled", "true");
      list.append(li);
    }
    document.body.append(list);
    // Hung from the title's highlight, kept on screen with its shadow.
    const r = t.getBoundingClientRect();
    const left = Math.max(0, Math.min(Math.round(r.left),
                                      window.innerWidth - list.offsetWidth - 2));
    list.style.left = `${left}px`;
    list.style.top = `${Math.round(bar.getBoundingClientRect().top) + MENU_TOP}px`;
    list.focus({ preventScroll: true });
    hi = -1;
  }

  function hide(): void {
    if (open < 0) return;
    titles[open]!.classList.remove("osm-open");
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
    if (!enabled(i) || !m || e === undefined || e === MENU_SEPARATOR) return;
    const action = e.action!;
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

  // Keyboard, while a menu is open: arrows move through items and
  // menus, Return chooses, Escape closes.
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

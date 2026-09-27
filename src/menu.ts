// An open Mac OS 8 menu's list, shared by the menu bar's pull-down
// menus (menubar.ts) and contextual menus (contextmenu.ts): items drawn
// like the pop-up menus' (.osm-menu.osm-pulldown), with dimmed items,
// check marks, separators and keyboard equivalents, the highlight, the
// arrow keys' stepping and the blink that chooses an item. Where the
// list goes and how presses open and close it are the caller's.
import { MENU_SEPARATOR, inside, menuSeparator, part } from "./controls.js";
import type { MenuEntry, MenuItem } from "./menubar.js";

/** How an item's keyboard equivalent is shown. */
export type KeyDisplay =
  /** Drawn after the command key symbol; assistive tech reads it as
   * Meta+key (aria-keyshortcuts). */
  | "meta"
  /** Drawn the same; read as Control+key. */
  | "control"
  /** Neither drawn nor announced: Mac OS 8 draws contextual menus
   * without keys (the Finder's Get Info has none there). */
  | "none";

export interface MenuList {
  /** The ul (.osm-menu.osm-pulldown), appended to <body>. */
  readonly element: HTMLElement;
  readonly entries: readonly MenuEntry[];
  /** The highlighted entry, -1 for none. */
  readonly highlighted: number;
  /** Whether entry `i` is an item that can be chosen. */
  enabled(i: number): boolean;
  /** Highlight entry `i` if it can be chosen, else none. */
  highlight(i: number): void;
  /** Highlight the next item that can be chosen, down (1) or up (-1)
   * from the highlighted one, wrapping around. */
  step(d: 1 | -1): void;
  /** The entry under client point (x, y), separators included; -1
   * outside the menu. */
  itemAt(x: number, y: number): number;
  /** Blink item `i` once, then call `done` with its action (the caller
   * closes the menu and acts). Nothing happens if `i` can't be chosen,
   * and `done` isn't called if the list is removed first. */
  choose(i: number, done: (action: () => void) => void): void;
  /** Take the list out of the page. */
  remove(): void;
}

/** The chosen item's blink: off, then on again at half time, then the
 * menu goes. */
const BLINK_MS = 100;

/** Build the menu for `entries` as a ul with `classes` (added to
 * .osm-menu), named `label`, and append it to <body>. It isn't
 * placed or focused. */
export function openMenuList(entries: readonly MenuEntry[], label: string,
                             classes: string, keys: KeyDisplay): MenuList {
  const list = part("ul", `osm-menu ${classes}`);
  list.setAttribute("role", "menu");
  if (label) list.setAttribute("aria-label", label);
  list.tabIndex = -1;
  for (const e of entries)
    list.append(e === MENU_SEPARATOR ? menuSeparator() : itemElement(e, keys));
  document.body.append(list);
  let hi = -1;
  let gone = false;

  const itemEls = () => Array.from(list.children) as HTMLElement[];

  function enabled(i: number): boolean {
    const e = entries[i];
    return e !== undefined && e !== MENU_SEPARATOR && !!e.action;
  }

  function highlight(i: number): void {
    hi = enabled(i) ? i : -1;
    itemEls().forEach((li, k) => li.classList.toggle("osm-highlight", k === hi));
  }

  return {
    element: list,
    entries,
    get highlighted() { return hi; },
    enabled,
    highlight,
    step(d) {
      const n = entries.length;
      for (let k = 1; k <= n; k++) {
        const i = ((hi < 0 ? (d > 0 ? -1 : n) : hi) + d * k + n * 2) % n;
        if (enabled(i)) { highlight(i); return; }
      }
    },
    itemAt(x, y) {
      if (gone || !inside(list, x, y)) return -1;
      return itemEls().findIndex((li) => inside(li, x, y));
    },
    choose(i, done) {
      const e = entries[i];
      if (gone || !enabled(i) || e === undefined || e === MENU_SEPARATOR)
        return;
      const action = e.action!;
      highlight(-1);
      setTimeout(() => { if (!gone) highlight(i); }, BLINK_MS / 2);
      setTimeout(() => { if (!gone) done(action); }, BLINK_MS);
    },
    remove() {
      gone = true;
      list.remove();
    },
  };
}

function itemElement(e: MenuItem, keys: KeyDisplay): HTMLElement {
  const li = part("li", "osm-menu-item");
  li.textContent = e.title;
  li.setAttribute("role", e.checked === undefined ? "menuitem"
                                                  : "menuitemcheckbox");
  if (e.checked !== undefined)
    li.setAttribute("aria-checked", String(e.checked));
  if (!e.action) li.setAttribute("aria-disabled", "true");
  if (e.key && keys !== "none") {
    // The symbol and letter are drawn; assistive tech reads the
    // shortcut from aria-keyshortcuts instead.
    li.classList.add("osm-has-key");
    const key = part("span", "osm-menu-key");
    key.textContent = `⌘${e.key.toUpperCase()}`;
    key.setAttribute("aria-hidden", "true");
    li.append(key);
    const modifier = keys === "meta" ? "Meta" : "Control";
    li.setAttribute("aria-keyshortcuts", `${modifier}+${e.key.toUpperCase()}`);
  }
  return li;
}

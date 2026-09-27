// The Mac OS 8 menu bar: Charcoal titles on the Platinum bar, and
// pull-down menus drawn like the pop-up menus (.osm-menu), with dimmed
// items, check marks, separators and keyboard equivalents. Menus are
// "sticky" as in Mac OS 8: a click on a title leaves its menu open, a
// press-drag-release chooses, and while a menu is open, moving over
// another title switches to it. From the keyboard, Return, Space or
// Down Arrow on a title opens its menu; the arrow keys move through
// items and menus, Return chooses and Escape closes. A keyboard
// equivalent (Command, or Control where there is no Command key, plus
// the item's key) chooses its item without opening the menu, the menu's
// title flashing as MenuKey's HiliteMenu makes it. The open menu's
// list (items, highlight, arrow-key stepping, the chosen item's blink)
// is menu.ts's, shared with contextual menus (contextmenu.ts).
//
// Geometry, from Mac OS 8.0 screenshots: titles are spaced 13px apart
// (pen to pen minus advance); a title's highlight runs 9px either side
// of its text, rows 0..18 of the 20px bar; its menu hangs from the
// highlight's left edge, its top outline on the bar's bottom line.
// Keyboard equivalents, from SimpleText 1.4's File, Edit and Help menus
// in Mac OS 8.0: the command key symbol's ink starts 31px left of the
// menu's right black line and the key letter's pen 21px left of it, and
// an item with a key needs its text width plus 61px of menu (outline
// included), 32px more than one without (text plus 29px).
import {
  MENU_SEPARATOR, inside, part, swallowClick, textWidth,
} from "./controls.js";
import type { MenuSeparator } from "./controls.js";
import { installOsmium } from "./install.js";
import { openMenuList } from "./menu.js";
import type { MenuList } from "./menu.js";
import { closeWhenModal, isMenuOpen, isModal } from "./modal.js";

/** What a keyboard equivalent does to the browser's own handling of the
 * keystroke. */
export type KeyDispatch =
  /** Cancel it and run the item's action (the default). */
  | "action"
  /** Leave the keystroke to the browser and don't run the action; the
   * menu title still flashes. For Cut, Copy and Paste while a text field
   * has the keyboard: the browser's own clipboard commands need no
   * clipboard permission, which a script's do. */
  | "browser";

export interface MenuItem {
  readonly title: string;
  /** Omitted: the item is drawn dimmed and can't be chosen. */
  readonly action?: () => void;
  /** A keyboard equivalent: one character, drawn after the command key
   * symbol at the menu's right edge (also where Control is the
   * modifier; aria-keyshortcuts names the real one). Letters match either case, without
   * Shift. Only an enabled item takes its key; a dimmed one leaves the
   * keystroke to the browser. */
  readonly key?: string;
  /** What the key does; defaults to "action". */
  readonly keyDispatch?: KeyDispatch;
  /** Drawn with a check mark (a Font menu's current font, say). */
  readonly checked?: boolean;
}

/** An item, or MENU_SEPARATOR for a dividing line. */
export type MenuEntry = MenuItem | MenuSeparator;

export interface Menu {
  /** The title text, or its accessible name when `icon` is given. */
  readonly title: string;
  /** A 16 x 16 sprite registered with registerSprites, drawn instead of
   * the title text (the Apple menu's apple, say). */
  readonly icon?: string;
  /** Built each time the menu opens or a key equivalent is typed, so
   * items reflect current state. */
  items(): readonly MenuEntry[];
}

/** Which modifier makes a keyboard equivalent. */
export type CommandKey =
  /** Command on Apple platforms, Control elsewhere. */
  | "auto"
  /** Command (metaKey): a WKWebView app, say. */
  | "meta"
  /** Control (ctrlKey). */
  | "control";

export interface MenuBarOptions {
  /** Defaults to "auto". */
  readonly commandKey?: CommandKey;
}

export interface OsmiumMenuBar {
  readonly element: HTMLElement;
  /** Replace the menus (an application's own while its window is in
   * front, say). An open menu closes first. */
  setMenus(menus: readonly Menu[]): void;
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
/** How long a title stays highlighted after its key equivalent. */
const KEY_FLASH_MS = 100;
/** KeyboardEvent.keyCode of a keydown an input method is handling. */
const IME_KEY_CODE = 229;

/** The modifier "auto" stands for on a platform (navigator.platform). */
export function commandModifier(platform: string): "meta" | "control" {
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "meta" : "control";
}

/** Whether a modal <dialog> (showModal) is open that doesn't hold
 * `el`: the page outside it is inert to the reader, though document
 * listeners still hear its keys. Engines without :modal (Safari before
 * 15.6) can't tell such a dialog from one shown with show(), and count
 * none. */
function underModalDialog(el: Element): boolean {
  for (const d of Array.from(document.querySelectorAll("dialog[open]"))) {
    if (d.contains(el)) continue;
    try {
      if (d.matches(":modal")) return true;
    } catch {
      // :modal unsupported: see above.
    }
  }
  return false;
}

/** The element a key event is aimed at, if it is one. */
function keyTarget(e: KeyboardEvent): Element | null {
  return e.target instanceof Element ? e.target : null;
}

/** Whether keydown `e` types key equivalent `key` with `modifier`: that
 * modifier alone (Shift too for a character that needs it, never for a
 * letter), and the key in either case. */
export function typesKey(e: KeyboardEvent, key: string,
                         modifier: "meta" | "control"): boolean {
  const meta = modifier === "meta";
  if (e.altKey || e.metaKey !== meta || e.ctrlKey === meta) return false;
  if (e.key.length !== 1) return false;
  const letter = e.key.toLowerCase() !== e.key.toUpperCase();
  if (letter && e.shiftKey) return false;
  return e.key.toLowerCase() === key.toLowerCase();
}

/** Make `bar` (styled .osm-menubar, 20px tall; place it along the top
 * of the page) a menu bar with `menus`, left to right. Anything else
 * appended to the bar, a clock say, is the app's to place. Removing
 * the bar from the page ends it; mount a fresh element to show one
 * again. Keyboard equivalents act while the bar is in the page, no
 * alert is up (showAlert), no pop-up or menu bar menu is open, no
 * modal <dialog> without the bar in it is open (showModal) and the
 * bar isn't inert (under an app's own modal dialog, say). */
export function mountMenuBar(bar: HTMLElement, initial: readonly Menu[],
                             options: MenuBarOptions = {}): OsmiumMenuBar {
  const commandKey = options.commandKey ?? "auto";
  if (!["auto", "meta", "control"].includes(commandKey))
    throw new RangeError(`command key ${JSON.stringify(commandKey)} must be ` +
                         '"auto", "meta" or "control"');
  const modifier = commandKey === "auto"
    ? commandModifier(navigator.platform) : commandKey;
  bar.classList.add("osm-menubar");
  bar.setAttribute("role", "menubar");

  let menus: readonly Menu[] = [];
  let titles: HTMLButtonElement[] = [];

  function build(next: readonly Menu[]): void {
    for (const t of titles) t.remove();
    menus = next;
    titles = menus.map((m, i) => {
      const t = part("button", "osm-menubar-title") as HTMLButtonElement;
      t.type = "button";
      t.setAttribute("role", "menuitem");
      t.setAttribute("aria-haspopup", "menu");
      t.setAttribute("aria-expanded", "false");
      t.tabIndex = i === 0 ? 0 : -1;
      if (m.icon) {
        const icon = part("span", "osm-menubar-icon");
        icon.style.backgroundImage = `var(--osm-sprite-${m.icon})`;
        t.append(icon);
        t.setAttribute("aria-label", m.title);
      } else {
        t.textContent = m.title;
      }
      t.addEventListener("keydown", (e) => {
        if (open >= 0 || !["Enter", " ", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        start(i);
        menu?.step(1);
      });
      return t;
    });
    // Before anything else the app appended (a clock), which it places.
    bar.prepend(...titles);
    layout();
  }

  // Titles sit at measured pens, so the layout waits for the fonts.
  function layout(): void {
    let pen = FIRST_PEN;
    menus.forEach((m, i) => {
      const t = titles[i]!;
      const w = m.icon ? ICON_W : textWidth(t.textContent ?? "", t);
      t.style.left = `${pen - TITLE_PAD}px`;
      t.style.width = `${w + 2 * TITLE_PAD}px`;
      pen += w + TITLE_GAP;
    });
  }

  // ---- the open menu ----------------------------------------------------
  let open = -1;
  let menu: MenuList | null = null;
  // Where the keyboard goes back to when the menu closes.
  let returnFocus: Element | null = null;
  // Unregisters close from the alerts' menu closing (modal.ts).
  let unwatchModal: (() => void) | null = null;

  build(initial);
  void installOsmium().catch(() => {}).finally(layout);

  function show(i: number): void {
    if (i === open) return;
    hide();
    open = i;
    const t = titles[i]!;
    t.classList.add("osm-open");
    t.setAttribute("aria-expanded", "true");
    menu = openMenuList(menus[i]!.items(), menus[i]!.title, "osm-pulldown",
                        modifier);
    const list = menu.element;
    // Hung from the title's highlight, kept on screen with its shadow.
    const r = t.getBoundingClientRect();
    const left = Math.max(0, Math.min(Math.round(r.left),
                                      window.innerWidth - list.offsetWidth - 2));
    list.style.left = `${left}px`;
    list.style.top = `${Math.round(bar.getBoundingClientRect().top) + MENU_TOP}px`;
    list.focus({ preventScroll: true });
  }

  function hide(): void {
    if (open < 0) return;
    titles[open]?.classList.remove("osm-open");
    titles[open]?.setAttribute("aria-expanded", "false");
    menu?.remove();
    menu = null;
    open = -1;
  }

  function close(): void {
    const hadFocus = menu?.element.contains(document.activeElement) ?? false;
    hide();
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("blur", close);
    unwatchModal?.();
    unwatchModal = null;
    if (hadFocus && returnFocus instanceof HTMLElement) returnFocus.focus();
    else if (hadFocus) (document.activeElement as HTMLElement | null)?.blur();
    returnFocus = null;
  }

  function start(i: number): void {
    returnFocus = document.activeElement;
    show(i);
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("blur", close);
    unwatchModal ??= closeWhenModal(close);
  }

  /** Blink the chosen item once, close the menu, then act. */
  function choose(i: number): void {
    menu?.choose(i, (action) => {
      close();
      action();
    });
  }

  function titleAt(x: number, y: number): number {
    return titles.findIndex((t) => inside(t, x, y));
  }

  function itemAt(x: number, y: number): number {
    return menu?.itemAt(x, y) ?? -1;
  }

  function enabled(i: number): boolean {
    return menu?.enabled(i) ?? false;
  }

  // Pointer tracking while a menu is open: over the bar, the title
  // under the pointer takes over; over the menu, items highlight.
  function track(x: number, y: number): void {
    const t = titleAt(x, y);
    if (t >= 0 && t !== open) show(t);
    menu?.highlight(itemAt(x, y));
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

  // The bar's pointer and key tracking is the document's: a bar taken
  // out of the page closes its open menu and drops those listeners at
  // the next pointer move or key press, for good. To show a menu bar
  // again, mount a fresh element.
  const gone = new AbortController();
  function detached(): boolean {
    if (bar.isConnected) return false;
    close();
    gone.abort();
    return true;
  }

  // An open menu follows the pointer, pressed or not (sticky menus).
  document.addEventListener("pointermove", (e) => {
    if (!detached() && open >= 0) track(e.clientX, e.clientY);
  }, { signal: gone.signal });

  // A press anywhere but on a title or in the menu closes the menu and
  // does nothing else; one inside the menu chooses on release.
  function onOutside(e: PointerEvent): void {
    if (titleAt(e.clientX, e.clientY) >= 0) return; // the bar's own
    if (menu?.element.contains(e.target as Node)) {
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
    if (detached() || open < 0 || !menu) return;
    if (e.key === "ArrowDown") menu.step(1);
    else if (e.key === "ArrowUp") menu.step(-1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const d = e.key === "ArrowLeft" ? -1 : 1;
      show((open + d + menus.length) % menus.length);
      menu.step(1);
    } else if (e.key === "Enter" || e.key === " ") {
      if (menu.highlighted >= 0 && !e.repeat) choose(menu.highlighted);
    } else if (e.key === "Escape" || e.key === "Tab") close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true, signal: gone.signal });

  // ---- keyboard equivalents ---------------------------------------------
  // In the bubble phase, after the target's own handlers: a keystroke a
  // control already handled (preventDefault) is left alone, and so is
  // any key no enabled item claims, which keeps the browser's shortcuts
  // and a text field's editing keys working. The action runs within the
  // keystroke's user activation, which clipboard access needs.
  let flashing: { title: HTMLElement; timer: ReturnType<typeof setTimeout> }
    | null = null;
  function flash(i: number): void {
    if (flashing) {
      clearTimeout(flashing.timer);
      if (titles[open] !== flashing.title)
        flashing.title.classList.remove("osm-open");
    }
    const title = titles[i]!;
    title.classList.add("osm-open");
    flashing = {
      title,
      timer: setTimeout(() => {
        if (titles[open] !== title) title.classList.remove("osm-open");
        flashing = null;
      }, KEY_FLASH_MS),
    };
  }

  document.addEventListener("keydown", (e) => {
    if (detached() || open >= 0 || e.defaultPrevented || e.repeat) return;
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.isComposing || e.keyCode === IME_KEY_CODE) return;
    // No item can take a named key (typesKey wants one character), so
    // Control-Left and the like build no menus.
    if (e.key.length !== 1) return;
    if (isModal() || bar.closest("[inert]") || underModalDialog(bar)) return;
    // An open menu (a pop-up's, or another bar's) takes no key
    // equivalents, as Mac OS menus don't while tracking: an action
    // could hide the menu's window and leave the menu behind.
    if (isMenuOpen() || keyTarget(e)?.closest(".osm-menu")) return;
    for (let i = 0; i < menus.length; i++) {
      for (const entry of menus[i]!.items()) {
        if (entry === MENU_SEPARATOR || !entry.key || !entry.action) continue;
        if (!typesKey(e, entry.key, modifier)) continue;
        flash(i);
        if ((entry.keyDispatch ?? "action") === "browser") return;
        e.preventDefault();
        entry.action();
        return;
      }
    }
  }, { signal: gone.signal });

  return {
    element: bar,
    setMenus(next) {
      close();
      build(next);
    },
  };
}

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showAlert } from "./alert.js";
import type { OsmiumAlert } from "./alert.js";
import {
  EDGE_BOTTOM, EDGE_RIGHT, STICKY_MS, placeContextMenu, showContextMenu,
} from "./contextmenu.js";
import type { OsmiumContextMenu } from "./contextmenu.js";
import { MENU_SEPARATOR } from "./controls.js";
import { mountMenuBar } from "./menubar.js";
import type { MenuEntry } from "./menubar.js";
import { isMenuOpen } from "./modal.js";

/** Choosing blinks the item, then closes the menu (100 ms). */
const blink = () => new Promise((r) => setTimeout(r, 150));
const wait = () => new Promise((r) => setTimeout(r, 0));

const key = (el: EventTarget, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", {
    key: k, bubbles: true, cancelable: true, ...init,
  }));

function pointer(type: string, x: number, y: number,
                 target: EventTarget = document.body,
                 init: PointerEventInit = {}): PointerEvent {
  const e = new PointerEvent(type, {
    clientX: x, clientY: y, bubbles: true, cancelable: true,
    pointerType: "mouse", pointerId: 1, button: 0, ...init,
  });
  target.dispatchEvent(e);
  return e;
}

// ---- a layout for happy-dom, which has none ------------------------------
// The menu's outline is MENU_W wide (the Finder's item menu, "Move To
// Trash" plus 29) and as tall as its entries: 16px items, 6px
// separators, 1px outline top and bottom. Items sit inside the outline.
const MENU_W = 118;
const entryH = (li: Element) =>
  li.classList.contains("osm-menu-separator") ? 6 : 16;
const isMenu = (el: Element) => el.classList.contains("osm-contextmenu");
function menuRect(m: HTMLElement) {
  const h = Array.from(m.children).reduce((s, li) => s + entryH(li), 2);
  return { left: parseFloat(m.style.left) || 0,
           top: parseFloat(m.style.top) || 0, width: MENU_W, height: h };
}
function fakeLayout(): void {
  const proto = HTMLElement.prototype;
  vi.spyOn(proto, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement) { return isMenu(this) ? MENU_W : 0; });
  vi.spyOn(proto, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement) { return isMenu(this) ? menuRect(this).height : 0; });
  vi.spyOn(proto, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement) {
    let r = { left: 0, top: 0, width: 0, height: 0 };
    const m = this.parentElement;
    if (isMenu(this)) r = menuRect(this);
    else if (m && isMenu(m)) {
      const outer = menuRect(m);
      let top = outer.top + 1;
      for (const li of Array.from(m.children)) {
        if (li === this) break;
        top += entryH(li);
      }
      r = { left: outer.left + 1, top, width: MENU_W - 2,
            height: entryH(this) };
    }
    return { ...r, x: r.left, y: r.top, right: r.left + r.width,
             bottom: r.top + r.height, toJSON() { return r; } } as DOMRect;
  });
}

// The Finder 8.0 item menu's layout (Label, a submenu, left out), with
// Move To Trash dimmed: entry tops inside the outline are 0, 16, 22,
// 38, 54, 60, 76, 92.
let done: string[];
function entries(): MenuEntry[] {
  return [
    { title: "Help", action: () => done.push("help") },
    MENU_SEPARATOR,
    { title: "Open", action: () => done.push("open") },
    { title: "Move To Trash" },
    MENU_SEPARATOR,
    { title: "Get Info", action: () => done.push("info"), key: "I" },
    { title: "Duplicate", action: () => done.push("dup"), checked: true },
    { title: "Make Alias", action: () => done.push("alias") },
  ];
}

/** Client y of the middle of entry `i` for a menu whose outline top is
 * at `top`. */
const TOPS = [0, 16, 22, 38, 54, 60, 76, 92];
const rowY = (top: number, i: number) => top + 1 + TOPS[i]! + 3;

let now = 1000;
let menus: OsmiumContextMenu[] = [];
let closes: boolean[];
function show(x = 270, y = 282,
              list: MenuEntry[] = entries()): OsmiumContextMenu {
  const m = showContextMenu({ x, y }, list, {
    label: "Games",
    onClose: (chosen) => { closes.push(chosen); done.push(`close:${chosen}`); },
  });
  menus.push(m);
  return m;
}
const el = () => document.querySelector<HTMLElement>(".osm-contextmenu");
const lit = () => el()?.querySelector(".osm-highlight")?.textContent;

beforeEach(() => {
  document.body.textContent = "";
  Object.defineProperty(window, "innerWidth", { value: 640, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 480, configurable: true });
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  fakeLayout();
  done = [];
  closes = [];
});

afterEach(async () => {
  for (const m of menus) m.close();
  menus = [];
  await wait();
  vi.restoreAllMocks();
});

describe("placeContextMenu", () => {
  // Every case is a Mac OS 8.0 capture (640 x 480): the hot spot, the
  // outline's size, and where the outline's top-left pixel landed.
  it.each([
    ["icon, screen middle", 355, 113, 118, 142, 355, 113],
    ["list row", 270, 282, 118, 142, 270, 282],
    ["desktop, last unmoved", 418, 30, 219, 132, 418, 30],
    ["desktop, pushed left", 421, 30, 219, 132, 418, 30],
    ["desktop, pushed left most", 422, 30, 219, 132, 418, 30],
    ["desktop, flipped", 423, 30, 219, 132, 204, 30],
    ["desktop, right edge", 630, 30, 219, 132, 411, 30],
    ["desktop, flipped, last unmoved", 637, 30, 219, 132, 418, 30],
    ["desktop, flipped and pushed left", 638, 30, 219, 132, 418, 30],
    ["desktop, flipped and pushed left most", 639, 30, 219, 132, 418, 30],
    ["window space, pushed left", 518, 113, 121, 165, 516, 113],
    ["icon, pushed left", 523, 113, 118, 142, 519, 113],
    ["icon, flipped", 524, 113, 118, 142, 406, 113],
    ["Trash, flipped and pushed up", 591, 445, 97, 94, 494, 381],
    ["desktop, pushed up", 288, 420, 219, 132, 288, 343],
  ])("%s", (_name, x, y, w, h, left, top) => {
    expect(placeContextMenu({ x, y }, w, h, 640, 480))
      .toEqual({ x: left, y: top });
  });

  it("leaves the measured room right of and below the outline", () => {
    const p = placeContextMenu({ x: 639, y: 479 }, 100, 50, 640, 480);
    expect(640 - (p.x + 100)).toBe(EDGE_RIGHT);
    expect(480 - (p.y + 50)).toBe(EDGE_BOTTOM);
  });

  it("stays in a viewport too small for it", () => {
    expect(placeContextMenu({ x: 50, y: 50 }, 300, 600, 200, 400))
      .toEqual({ x: 0, y: 0 });
  });
});

describe("showContextMenu", () => {
  it("draws a menu bar menu's items, without keys", () => {
    const m = show();
    const menu = el()!;
    expect(m.element).toBe(menu);
    expect(menu.parentElement).toBe(document.body);
    expect(menu.tagName).toBe("UL");
    expect(menu.className).toBe("osm-menu osm-pulldown osm-contextmenu");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.getAttribute("aria-label")).toBe("Games");
    const lis = Array.from(menu.children);
    expect(lis.map((li) => li.getAttribute("role"))).toEqual([
      "menuitem", "separator", "menuitem", "menuitem", "separator",
      "menuitem", "menuitemcheckbox", "menuitem",
    ]);
    expect(lis[3]!.getAttribute("aria-disabled")).toBe("true");
    expect(lis[6]!.getAttribute("aria-checked")).toBe("true");
    // Get Info's ⌘I is the menu bar's to draw.
    expect(lis[5]!.textContent).toBe("Get Info");
    expect(lis[5]!.hasAttribute("aria-keyshortcuts")).toBe(false);
    expect(menu.querySelector(".osm-menu-key")).toBeNull();
    expect(document.activeElement).toBe(menu);
    expect(m.open).toBe(true);
  });

  it("puts the outline's corner on the hot spot, or flips it", () => {
    show(270, 282);
    expect([el()!.style.left, el()!.style.top]).toEqual(["270px", "282px"]);
    menus[0]!.close();
    show(600, 450);
    // Flipped (600 + 117 > 640) and pushed up to leave 5 rows.
    expect(el()!.style.left).toBe(`${600 - MENU_W}px`);
    expect(el()!.style.top).toBe(`${480 - 5 - 110}px`);
  });

  it("scrolls when taller than the viewport", () => {
    Object.defineProperty(window, "innerHeight", { value: 100 });
    show(10, 10);
    expect(el()!.style.top).toBe("0px");
    expect(el()!.style.maxHeight).toBe(`${100 - EDGE_BOTTOM}px`);
    expect(el()!.style.overflowY).toBe("auto");
    expect(el()!.style.overflowX).toBe("hidden");
  });

  it("fits the viewport without the page's scroll bar", () => {
    Object.defineProperty(document.documentElement, "clientWidth",
                          { value: 625, configurable: true });
    try {
      // At 640 it would stay at 506; within 625 it is pushed back.
      show(506, 10);
      expect(el()!.style.left).toBe(`${625 - EDGE_RIGHT - MENU_W}px`);
    } finally {
      delete (document.documentElement as { clientWidth?: number })
        .clientWidth;
    }
  });

  it("stays open after a click, and chooses with the next", async () => {
    show();
    now += STICKY_MS - 1;
    pointer("pointerup", 270, 282);
    expect(el()).not.toBeNull();
    // The pointer highlights what it is over, nothing on a separator.
    pointer("pointermove", 300, rowY(282, 2));
    expect(lit()).toBe("Open");
    pointer("pointermove", 300, rowY(282, 1));
    expect(lit()).toBeUndefined();
    const item = el()!.children[2]!;
    const down = pointer("pointerdown", 300, rowY(282, 2), item);
    expect(down.defaultPrevented).toBe(true);
    pointer("pointerup", 300, rowY(282, 2), item);
    await blink();
    expect(done).toEqual(["open", "close:true"]);
    expect(el()).toBeNull();
  });

  it("closes when a longer press is released off the items", () => {
    show();
    now += STICKY_MS;
    pointer("pointerup", 270, 282);
    expect(el()).toBeNull();
    expect(closes).toEqual([false]);
  });

  // Mac OS 8.0 chose in 11 of 11 releases over an item after the half
  // second, and in 22 of 47 sooner ones (the rest left the menu open);
  // Osmium always chooses.
  it("chooses where a press-drag-release ends, however quick", async () => {
    show();
    pointer("pointermove", 300, rowY(282, 5));
    expect(lit()).toBe("Get Info");
    now += 10;
    pointer("pointerup", 300, rowY(282, 5));
    // The blink: off, then on, then gone.
    expect(lit()).toBeUndefined();
    await blink();
    expect(done).toEqual(["info", "close:true"]);
  });

  it("doesn't choose a dimmed item", async () => {
    show();
    pointer("pointermove", 300, rowY(282, 3));
    expect(lit()).toBeUndefined();
    now += STICKY_MS + 100;
    pointer("pointerup", 300, rowY(282, 3));
    await blink();
    expect(done).toEqual(["close:false"]);
  });

  it("closes on a click on a separator once open", () => {
    show();
    pointer("pointerup", 270, 282); // sticky
    const sep = el()!.children[1]!;
    pointer("pointerdown", 300, rowY(282, 1), sep);
    pointer("pointerup", 300, rowY(282, 1), sep);
    expect(el()).toBeNull();
    expect(closes).toEqual([false]);
  });

  it("takes a click outside for itself", () => {
    const under = document.createElement("button");
    document.body.append(under);
    let pressed = 0, clicked = 0, native = 0;
    under.addEventListener("pointerdown", () => pressed++);
    under.addEventListener("click", () => clicked++);
    document.addEventListener("contextmenu", () => native++);
    show();
    pointer("pointerup", 270, 282);
    const down = pointer("pointerdown", 10, 10, under, { button: 2 });
    expect(down.defaultPrevented).toBe(true);
    const ctx = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    under.dispatchEvent(ctx);
    under.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect([pressed, clicked, native]).toEqual([0, 0, 0]);
    expect(ctx.defaultPrevented).toBe(true);
    expect(el()).toBeNull();
    expect(closes).toEqual([false]);
  });

  it("lets the menu key through after a left click closed it", () => {
    let native = 0;
    document.addEventListener("contextmenu", () => native++);
    show();
    pointer("pointerup", 270, 282);
    pointer("pointerdown", 10, 10);
    pointer("pointerup", 10, 10);
    expect(el()).toBeNull();
    // The menu key (or Shift-F10), with no press in between.
    const ctx = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ctx);
    expect(native).toBe(1);
    expect(ctx.defaultPrevented).toBe(false);
  });

  it("keeps right-clicks on it from the page", () => {
    let native = 0;
    document.addEventListener("contextmenu", () => native++);
    show();
    const ctx = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el()!.children[2]!.dispatchEvent(ctx);
    expect(ctx.defaultPrevented).toBe(true);
    expect(native).toBe(0);
    expect(el()).not.toBeNull();
  });

  it("works from the keyboard and gives focus back", async () => {
    const row = document.createElement("div");
    row.tabIndex = 0;
    document.body.append(row);
    row.focus();
    show();
    key(document.activeElement!, "ArrowDown");
    expect(lit()).toBe("Help");
    const menu = el()!;
    expect(document.activeElement).toBe(menu);
    expect(menu.getAttribute("aria-activedescendant"))
      .toBe(menu.children[0]!.id);
    key(document.activeElement!, "ArrowDown");
    expect(lit()).toBe("Open"); // past the separator
    expect(document.getElementById(
      menu.getAttribute("aria-activedescendant")!)?.textContent).toBe("Open");
    key(document.activeElement!, "ArrowDown");
    expect(lit()).toBe("Get Info"); // past Move To Trash, dimmed
    key(document.activeElement!, "ArrowUp");
    expect(lit()).toBe("Open");
    key(document.activeElement!, "m"); // Move To Trash is dimmed
    expect(lit()).toBe("Make Alias");
    key(document.activeElement!, "Escape");
    expect(el()).toBeNull();
    expect(document.activeElement).toBe(row);
    expect(closes).toEqual([false]);

    show();
    key(document.activeElement!, "g");
    key(document.activeElement!, "Enter");
    await blink();
    expect(done).toEqual(["close:false", "info", "close:true"]);
    expect(document.activeElement).toBe(row);
  });

  it("keeps the keys it takes from the page", () => {
    let seen = 0;
    document.addEventListener("keydown", () => seen++);
    show();
    for (const k of ["ArrowDown", "ArrowLeft", "ArrowRight", "a", "Escape"])
      key(document.activeElement!, k);
    expect(seen).toBe(0);
  });

  it("calls onClose once, after the action", async () => {
    const order: string[] = [];
    showContextMenu({ x: 0, y: 0 }, [
      { title: "Help", action: () => order.push("action") },
    ], { onClose: (chosen) => order.push(`close:${chosen}`) });
    key(document.activeElement!, "ArrowDown");
    key(document.activeElement!, "Enter");
    key(document.activeElement!, "Enter");
    await blink();
    expect(order).toEqual(["action", "close:true"]);
  });

  it("is closed by an alert, like other menus", async () => {
    const m = show();
    expect(isMenuOpen()).toBe(true);
    const alert: OsmiumAlert = showAlert({ kind: "note", message: "Hello" });
    expect(m.open).toBe(false);
    expect(el()).toBeNull();
    expect(closes).toEqual([false]);
    expect(isMenuOpen()).toBe(false);
    // Nothing opens under an alert.
    const later = show();
    expect(later.open).toBe(false);
    expect(el()).toBeNull();
    await wait();
    expect(closes).toEqual([false, false]);
    alert.close();
  });

  it("replaces an open contextual menu", () => {
    const first = show();
    const second = show(10, 10);
    expect(first.open).toBe(false);
    expect(second.open).toBe(true);
    expect(document.querySelectorAll(".osm-contextmenu").length).toBe(1);
    expect(closes).toEqual([false]);
  });

  it("closes when the window loses focus", () => {
    show();
    window.dispatchEvent(new Event("blur"));
    expect(el()).toBeNull();
  });

  it("holds off the menu bar's key equivalents", () => {
    const bar = document.createElement("div");
    document.body.append(bar);
    let quit = 0;
    mountMenuBar(bar, [{ title: "File", items: () => [
      { title: "Quit", key: "Q", action: () => quit++ },
    ] }], { commandKey: "meta" });
    show();
    key(document.body, "q", { metaKey: true });
    expect(quit).toBe(0);
    menus[0]!.close();
    key(document.body, "q", { metaKey: true });
    expect(quit).toBe(1);
  });
});

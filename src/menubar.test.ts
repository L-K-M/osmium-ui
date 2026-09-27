// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MENU_SEPARATOR, mountPopup } from "./controls.js";
import { commandModifier, mountMenuBar } from "./menubar.js";
import type { OsmiumMenuBar } from "./menubar.js";

const key = (el: EventTarget, k: string) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

/** Choosing blinks the item, then closes the menu (100 ms). */
const blink = () => new Promise((r) => setTimeout(r, 150));

describe("mountMenuBar", () => {
  let bar: HTMLElement;
  let done: string[];

  beforeEach(() => {
    document.body.textContent = "";
    bar = document.createElement("div");
    document.body.append(bar);
    done = [];
    mountMenuBar(bar, [
      { title: "File", items: () => [
        { title: "Open", action: () => done.push("open") },
        MENU_SEPARATOR,
        { title: "Print" }, // dimmed
        { title: "Quit", action: () => done.push("quit") },
      ] },
      { title: "Edit", items: () => [
        { title: "Undo", action: () => done.push("undo") },
      ] },
    ]);
  });

  const titles = () => Array.from(bar.querySelectorAll(".osm-menubar-title"));
  const menu = () => document.querySelector(".osm-menu");
  const lit = () => menu()?.querySelector(".osm-highlight")?.textContent;

  it("draws titles, items, dimmed items and separators", () => {
    expect(bar.getAttribute("role")).toBe("menubar");
    expect(titles().map((t) => t.textContent)).toEqual(["File", "Edit"]);
    key(titles()[0]!, "Enter");
    const lis = Array.from(menu()!.children);
    expect(lis.map((li) => li.getAttribute("role")))
      .toEqual(["menuitem", "separator", "menuitem", "menuitem"]);
    expect(lis[2]!.getAttribute("aria-disabled")).toBe("true");
    expect(titles()[0]!.classList.contains("osm-open")).toBe(true);
    // An open menu keeps the keyboard, even from the next test's bar.
    key(document, "Escape");
  });

  it("moves past separators and dimmed items, then chooses", async () => {
    key(titles()[0]!, "Enter");
    expect(lit()).toBe("Open");
    key(document, "ArrowDown");
    expect(lit()).toBe("Quit");
    key(document, "ArrowDown");
    expect(lit()).toBe("Open");
    key(document, "ArrowUp");
    key(document, "Enter");
    await blink();
    expect(done).toEqual(["quit"]);
    expect(menu()).toBeNull();
  });

  it("closes its menu and lets keys be once the bar is gone", () => {
    key(titles()[0]!, "Enter");
    bar.remove();
    const e = new KeyboardEvent("keydown", {
      key: "ArrowDown", bubbles: true, cancelable: true,
    });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it("switches menus with the side arrows and closes on Escape", () => {
    key(titles()[0]!, "ArrowDown");
    key(document, "ArrowRight");
    expect(menu()!.getAttribute("aria-label")).toBe("Edit");
    expect(lit()).toBe("Undo");
    key(document, "Escape");
    expect(menu()).toBeNull();
    expect(titles()[1]!.classList.contains("osm-open")).toBe(false);
  });
});

describe("menu bar keyboard equivalents", () => {
  let bar: HTMLElement;
  let mb: OsmiumMenuBar;
  let done: string[];
  let pasteOn: boolean;

  /** A keydown as the browser sends it, cancelable. */
  const press = (k: string, mods: KeyboardEventInit = { ctrlKey: true },
                 target: EventTarget = document.body) => {
    const e = new KeyboardEvent("keydown", {
      key: k, bubbles: true, cancelable: true, ...mods,
    });
    target.dispatchEvent(e);
    return e;
  };

  beforeEach(() => {
    document.body.textContent = "";
    document.documentElement.className = "";
    bar = document.createElement("div");
    document.body.append(bar);
    done = [];
    pasteOn = true;
    mb = mountMenuBar(bar, [
      { title: "File", items: () => [
        { title: "Save", key: "S", action: () => done.push("save") },
        { title: "Print", key: "P" }, // dimmed: claims nothing
      ] },
      { title: "Edit", items: () => [
        { title: "Undo", key: "Z", action: () => done.push("undo") },
        { title: "Paste", key: "V", keyDispatch: "browser",
          ...(pasteOn ? { action: () => done.push("paste") } : {}) },
        { title: "Wrap", checked: true, action: () => {} },
      ] },
    ], { commandKey: "control" });
  });

  afterEach(() => vi.restoreAllMocks());

  const titles = () =>
    Array.from(bar.querySelectorAll<HTMLElement>(".osm-menubar-title"));

  it("returns a handle on the bar", () => {
    expect(mb.element).toBe(bar);
  });

  it("draws the key after the command key symbol and names it", () => {
    key(titles()[1]!, "Enter");
    const undo = document.querySelector(".osm-menu-item")!;
    expect(undo.classList.contains("osm-has-key")).toBe(true);
    expect(undo.querySelector(".osm-menu-key")!.textContent).toBe("\u2318Z");
    expect(undo.querySelector(".osm-menu-key")!.getAttribute("aria-hidden"))
      .toBe("true");
    expect(undo.getAttribute("aria-keyshortcuts")).toBe("Control+Z");
    const wrap = document.querySelectorAll(".osm-menu-item")[2]!;
    expect(wrap.getAttribute("role")).toBe("menuitemcheckbox");
    expect(wrap.getAttribute("aria-checked")).toBe("true");
    key(document, "Escape");
  });

  it("runs an enabled item's action and cancels the keystroke", () => {
    const e = press("s");
    expect(done).toEqual(["save"]);
    expect(e.defaultPrevented).toBe(true);
    // The menu's title flashes.
    expect(titles()[0]!.classList.contains("osm-open")).toBe(true);
  });

  it("matches letters in either case but not with Shift or Option", () => {
    press("Z");
    expect(done).toEqual(["undo"]);
    expect(press("Z", { ctrlKey: true, shiftKey: true }).defaultPrevented)
      .toBe(false);
    expect(press("z", { ctrlKey: true, altKey: true }).defaultPrevented)
      .toBe(false);
    expect(press("z", { metaKey: true }).defaultPrevented).toBe(false);
    expect(press("z", {}).defaultPrevented).toBe(false);
    expect(done).toEqual(["undo"]);
  });

  it("leaves unclaimed keys and dimmed items' keys to the browser", () => {
    expect(press("p").defaultPrevented).toBe(false);
    expect(press("t").defaultPrevented).toBe(false);
    expect(done).toEqual([]);
  });

  it("leaves a browser-dispatched key to the browser", () => {
    const e = press("v");
    expect(e.defaultPrevented).toBe(false);
    expect(done).toEqual([]);
    expect(titles()[1]!.classList.contains("osm-open")).toBe(true);
  });

  it("skips keys a control handled, alerts and an inert bar", () => {
    const field = document.createElement("textarea");
    document.body.append(field);
    field.addEventListener("keydown", (e) => e.preventDefault(), { once: true });
    press("s", { ctrlKey: true }, field);
    document.documentElement.classList.add("osm-modal");
    press("s");
    document.documentElement.classList.remove("osm-modal");
    bar.setAttribute("inert", "");
    press("s");
    expect(done).toEqual([]);
    bar.removeAttribute("inert");
    press("s", { ctrlKey: true }, field);
    expect(done).toEqual(["save"]);
  });

  it("leaves keys alone while a pop-up menu is open", () => {
    const btn = document.createElement("button");
    document.body.append(btn);
    mountPopup(btn, { items: ["One", "Two"], selected: 0, onChange: () => {} });
    key(btn, " ");
    const menu = document.querySelector<HTMLElement>(".osm-menu")!;
    expect(menu).not.toBeNull();
    // Aimed at the menu, which has the keyboard, or anywhere else: an
    // action (closing the pop-up's window, say) would leave it behind.
    expect(press("s", { ctrlKey: true }, menu).defaultPrevented).toBe(false);
    expect(press("s").defaultPrevented).toBe(false);
    expect(done).toEqual([]);
    expect(titles()[0]!.classList.contains("osm-open")).toBe(false);
    key(menu, "Escape");
    expect(document.querySelector(".osm-menu")).toBeNull();
    press("s");
    expect(done).toEqual(["save"]);
  });

  it("skips keys under a native modal dialog, but not inside one", () => {
    const dialog = document.createElement("dialog");
    const field = document.createElement("input");
    dialog.append(field);
    document.body.append(dialog);
    // happy-dom doesn't match :modal; browsers do after showModal().
    let modal = false;
    const matches = dialog.matches.bind(dialog);
    vi.spyOn(dialog, "matches").mockImplementation(
      (sel: string) => (sel === ":modal" ? modal : matches(sel)));
    // A dialog shown without showModal blocks nothing.
    dialog.show();
    press("s", { ctrlKey: true }, field);
    expect(done).toEqual(["save"]);
    dialog.close();
    dialog.showModal();
    modal = true;
    expect(press("s", { ctrlKey: true }, field).defaultPrevented).toBe(false);
    expect(press("s").defaultPrevented).toBe(false);
    expect(done).toEqual(["save"]);
    // A menu bar in the dialog is the dialog's own.
    dialog.append(bar);
    press("s", { ctrlKey: true }, field);
    expect(done).toEqual(["save", "save"]);
  });

  it("leaves keys aimed inside a menu alone", () => {
    const menu = document.createElement("ul");
    menu.className = "osm-menu";
    const item = document.createElement("li");
    menu.append(item);
    document.body.append(menu);
    expect(press("s", { ctrlKey: true }, item).defaultPrevented).toBe(false);
    expect(done).toEqual([]);
  });

  it("replaces its menus, and their keys, with setMenus", () => {
    mb.setMenus([{ title: "Help", items: () => [
      { title: "Guide", key: "?", action: () => done.push("guide") },
    ] }]);
    expect(titles().map((t) => t.textContent)).toEqual(["Help"]);
    expect(titles()[0]!.tabIndex).toBe(0);
    press("s");
    // A character typed with Shift matches as typed.
    press("?", { ctrlKey: true, shiftKey: true });
    expect(done).toEqual(["guide"]);
  });

  it("closes an open menu when its menus are replaced", () => {
    key(titles()[0]!, "Enter");
    expect(document.querySelector(".osm-menu")).not.toBeNull();
    mb.setMenus([{ title: "Help", items: () => [] }]);
    expect(document.querySelector(".osm-menu")).toBeNull();
  });

  it("rejects an unknown command key", () => {
    expect(() => mountMenuBar(document.createElement("div"), [],
      { commandKey: "hyper" as never })).toThrow(/command key/);
  });
});

describe("commandModifier", () => {
  it("is Command on Apple platforms and Control elsewhere", () => {
    expect(commandModifier("MacIntel")).toBe("meta");
    expect(commandModifier("iPad")).toBe("meta");
    expect(commandModifier("Win32")).toBe("control");
    expect(commandModifier("Linux x86_64")).toBe("control");
  });
});

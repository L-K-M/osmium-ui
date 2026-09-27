// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MENU_SEPARATOR, mountPopup } from "./controls.js";
import type { Popup } from "./controls.js";
import { isMenuOpen } from "./modal.js";

const key = (el: Element, k: string) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

/** Choosing blinks the item, then closes the menu (100 ms). */
const blink = () => new Promise((r) => setTimeout(r, 150));

const menu = () => document.querySelector(".osm-menu")!;
const lit = () => document.querySelector(".osm-menu .osm-highlight")
  ?.textContent;

function press(target: EventTarget, type: string, y: number): void {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, button: 0, pointerId: 1,
    clientX: 5, clientY: y,
  }));
}

describe("mountPopup", () => {
  let btn: HTMLButtonElement;
  let chosen: number[];
  let popup: Popup;

  beforeEach(() => {
    document.body.textContent = "";
    btn = document.createElement("button");
    document.body.append(btn);
    chosen = [];
    popup = mountPopup(btn, {
      items: ["Mac Standard", MENU_SEPARATOR, "Uncorrected", "Linear"],
      selected: 0,
      onChange: (i) => chosen.push(i),
    });
  });
  // A menu left open would take the next test's presses.
  afterEach(() => popup.destroy());

  it("draws a separator as a divider, not an option", () => {
    key(btn, "ArrowDown");
    const lis = Array.from(menu().children);
    expect(lis.map((li) => li.getAttribute("role")))
      .toEqual(["option", "separator", "option", "option"]);
    expect(lis[1]!.className).toBe("osm-menu-separator");
    expect(lis[1]!.textContent).toBe("");
  });

  it("skips separators with the arrow keys", async () => {
    key(btn, "ArrowDown"); // opens on the current item
    key(menu(), "ArrowDown");
    expect(menu().children[2]!.classList.contains("osm-highlight")).toBe(true);
    key(menu(), "ArrowUp");
    expect(menu().children[0]!.classList.contains("osm-highlight")).toBe(true);
    key(menu(), "ArrowDown");
    key(menu(), "Enter");
    await blink();
    expect(chosen).toEqual([2]);
    expect(btn.textContent).toBe("Uncorrected");
  });

  it("goes to the first and last items, not a separator", () => {
    key(btn, "ArrowDown");
    key(menu(), "End");
    expect(menu().children[3]!.classList.contains("osm-highlight")).toBe(true);
    key(menu(), "Home");
    expect(menu().children[0]!.classList.contains("osm-highlight")).toBe(true);
  });
});

describe("dimmed items", () => {
  let btn: HTMLButtonElement;
  let chosen: number[];
  let popup: Popup;

  beforeEach(() => {
    document.body.textContent = "";
    Element.prototype.setPointerCapture ??= () => {};
    btn = document.createElement("button");
    document.body.append(btn);
    chosen = [];
    popup = mountPopup(btn, {
      items: ["Ethernet", { title: "AirPort", disabled: true },
              { title: "Bluetooth" }, MENU_SEPARATOR,
              { title: "Wi-Fi", disabled: true }],
      selected: 0,
      onChange: (i) => chosen.push(i),
    });
  });
  afterEach(() => {
    popup.destroy();
    vi.restoreAllMocks();
  });

  it("draws them dimmed, and enabled items as before", () => {
    // Opened by a press: nothing highlighted.
    press(btn, "pointerdown", 5);
    press(window, "pointerup", 5);
    const lis = Array.from(menu().children);
    expect(lis.map((li) => li.textContent))
      .toEqual(["Ethernet", "AirPort", "Bluetooth", "", "Wi-Fi"]);
    expect(lis.map((li) => li.getAttribute("aria-disabled")))
      .toEqual([null, "true", null, null, "true"]);
    // An item object that isn't disabled is a string item's twin.
    expect(lis[2]!.className).toBe(lis[0]!.className);
    expect(lis[2]!.getAttributeNames()).toEqual(lis[0]!.getAttributeNames());
    key(menu(), "Escape");
  });

  it("skips them with the arrow keys, Home, End and type-select", () => {
    key(btn, "ArrowDown"); // opens on the current item
    expect(lit()).toBe("Ethernet");
    key(menu(), "ArrowDown");
    expect(lit()).toBe("Bluetooth");
    key(menu(), "ArrowDown"); // only dimmed items below: stays
    expect(lit()).toBe("Bluetooth");
    key(menu(), "Home");
    expect(lit()).toBe("Ethernet");
    key(menu(), "End");
    expect(lit()).toBe("Bluetooth");
    key(menu(), "ArrowUp");
    expect(lit()).toBe("Ethernet");
    key(menu(), "a"); // AirPort
    key(menu(), "w"); // Wi-Fi
    expect(lit()).toBe("Ethernet");
    key(menu(), "b");
    expect(lit()).toBe("Bluetooth");
    key(menu(), "Escape");
  });

  it("can't be highlighted or chosen with the pointer", async () => {
    // happy-dom lays nothing out: the menu at the origin, 16px items
    // and a 6px separator, in order.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("osm-menu"))
          return new DOMRect(0, 0, 100, 70);
        if (!this.parentElement?.classList.contains("osm-menu"))
          return new DOMRect(0, 0, 0, 0);
        const i = Array.from(this.parentElement.children).indexOf(this);
        return new DOMRect(0, [0, 16, 32, 48, 54][i]!, 100, i === 3 ? 6 : 16);
      });
    // A click opens the menu and leaves it open.
    press(btn, "pointerdown", 5);
    press(window, "pointerup", 5);
    press(menu(), "pointermove", 20); // AirPort
    expect(lit()).toBeUndefined();
    press(menu(), "pointerdown", 20);
    press(menu(), "pointerup", 20);
    await blink();
    expect(chosen).toEqual([]);
    expect(document.querySelector(".osm-menu")).not.toBeNull();
    press(menu(), "pointermove", 40); // Bluetooth
    expect(lit()).toBe("Bluetooth");

    // A drag that ends on one closes the menu without choosing.
    press(btn, "pointerdown", 5); // closes the open menu
    press(btn, "pointerdown", 5);
    press(window, "pointermove", 60); // Wi-Fi
    expect(lit()).toBeUndefined();
    press(window, "pointerup", 60);
    await blink();
    expect(document.querySelector(".osm-menu")).toBeNull();
    expect(chosen).toEqual([]);
  });

  it("can be the current item, shown and checked but not chosen", async () => {
    popup.setItems([{ title: "No interfaces found", disabled: true }], 0);
    expect(btn.textContent).toBe("No interfaces found");
    key(btn, "ArrowDown");
    const li = menu().children[0]!;
    expect(li.getAttribute("aria-selected")).toBe("true");
    expect(li.getAttribute("aria-disabled")).toBe("true");
    expect(lit()).toBeUndefined();
    key(menu(), "ArrowDown");
    key(menu(), "Enter");
    await blink();
    expect(document.querySelector(".osm-menu")).not.toBeNull();
    expect(lit()).toBeUndefined();
    expect(chosen).toEqual([]);
    key(menu(), "Escape");
  });

  it("steps from a dimmed current item opened by key", () => {
    popup.setItems(["Bay 1", "Bay 2", { title: "Bay 3", disabled: true },
                    "Bay 4"], 2);
    key(btn, "ArrowDown");
    expect(lit()).toBeUndefined();
    key(menu(), "ArrowDown");
    expect(lit()).toBe("Bay 4");
    key(menu(), "Escape");
    key(btn, "ArrowDown");
    key(menu(), "ArrowUp");
    expect(lit()).toBe("Bay 2");
    key(menu(), "Escape");
    key(btn, "ArrowDown");
    key(menu(), "b");
    expect(lit()).toBe("Bay 4");
    key(menu(), "Escape");
    // Nothing that way: the first item, as before.
    popup.setItems([{ title: "No interfaces found", disabled: true },
                    "Ethernet"], 0);
    key(btn, "ArrowDown");
    key(menu(), "ArrowUp");
    expect(lit()).toBe("Ethernet");
    key(menu(), "Escape");
  });
});

const captures = (o: unknown) => typeof o === "boolean" ? o
  : !!(o as AddEventListenerOptions | undefined)?.capture;

describe("destroy", () => {
  let btn: HTMLButtonElement;
  let popup: Popup;

  beforeEach(() => {
    document.body.textContent = "";
    Element.prototype.setPointerCapture ??= () => {};
    btn = document.createElement("button");
    document.body.append(btn);
    popup = mountPopup(btn, {
      items: ["Mac Standard", MENU_SEPARATOR, "Uncorrected"], selected: 0,
      onChange: () => {},
    });
  });
  afterEach(() => {
    popup.destroy(); // a second destroy() does nothing
    vi.restoreAllMocks();
  });

  it("closes an open menu and stops opening it", () => {
    key(btn, "ArrowDown");
    expect(isMenuOpen()).toBe(true);
    popup.destroy();
    expect(document.querySelector(".osm-menu")).toBeNull();
    expect(isMenuOpen()).toBe(false);
    expect(btn.hasAttribute("aria-haspopup")).toBe(false);
    expect(btn.hasAttribute("aria-expanded")).toBe(false);
    expect(btn.textContent).toBe("Mac Standard");
    key(btn, "ArrowDown");
    press(btn, "pointerdown", 5);
    btn.click();
    expect(document.querySelector(".osm-menu")).toBeNull();
    expect(() => popup.setSelected(2)).toThrow(/destroyed/);
    expect(() => popup.setItems(["One"], 0)).toThrow(/destroyed/);
    expect(popup.selected).toBe(0);
    popup.destroy(); // again: nothing to do
  });

  it("takes back the accessible name its label gave the button", () => {
    popup.destroy();
    const labelled = mountPopup(btn, {
      items: ["A", "B"], selected: 0, label: "Unit", onChange: () => {},
    });
    expect(btn.getAttribute("aria-label")).toBe("Unit A");
    labelled.destroy();
    expect(btn.hasAttribute("aria-label")).toBe(false);
  });

  it("removes every listener it added to the page, mid-press", () => {
    const spies = [window, document].map((t) => ({
      add: vi.spyOn(t, "addEventListener"),
      remove: vi.spyOn(t, "removeEventListener"),
    }));
    press(btn, "pointerdown", 5); // the menu opens; the press goes on
    const added = spies.flatMap((s) => s.add.mock.calls);
    expect(added.map((c) => c[0])).toEqual(expect.arrayContaining([
      "pointerdown", "blur", "pointerup", "pointercancel", "pointermove",
    ]));
    popup.destroy();
    const left = spies.flatMap(({ add, remove }) => add.mock.calls.filter(
      ([type, fn, o]) =>
        !(o as AddEventListenerOptions | undefined)?.signal?.aborted &&
        !remove.mock.calls.some(([t2, fn2, o2]) =>
          t2 === type && fn2 === fn && captures(o2) === captures(o))));
    expect(left).toEqual([]);
  });
});

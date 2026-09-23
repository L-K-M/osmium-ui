// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { MENU_SEPARATOR } from "./controls.js";
import { mountMenuBar } from "./menubar.js";

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

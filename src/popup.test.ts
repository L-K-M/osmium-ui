// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { MENU_SEPARATOR, mountPopup } from "./controls.js";

const key = (el: Element, k: string) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

/** Choosing blinks the item, then closes the menu (100 ms). */
const blink = () => new Promise((r) => setTimeout(r, 150));

describe("mountPopup", () => {
  let btn: HTMLButtonElement;
  let chosen: number[];

  beforeEach(() => {
    document.body.textContent = "";
    btn = document.createElement("button");
    document.body.append(btn);
    chosen = [];
    mountPopup(btn, {
      items: ["Mac Standard", MENU_SEPARATOR, "Uncorrected", "Linear"],
      selected: 0,
      onChange: (i) => chosen.push(i),
    });
  });

  const menu = () => document.querySelector(".osm-menu")!;

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

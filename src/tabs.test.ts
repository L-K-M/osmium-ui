// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { mountTabs } from "./tabs.js";

const TITLES = ["Themes", "Appearance", "Fonts"];

const key = (el: Element, k: string) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

/** A mouse press on `el` and its release at (x, y). happy-dom lays
 * nothing out, so each tab gets a 60 x 21 box at the origin. */
function press(el: HTMLElement, x: number, y: number): void {
  el.getBoundingClientRect = () => new DOMRect(0, 0, 60, 21);
  const at = (type: string, cx: number, cy: number) =>
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, button: 0, pointerId: 1, pointerType: "mouse",
      clientX: cx, clientY: cy,
    }));
  at("pointerdown", 10, 10);
  at("pointerup", x, y);
}

function markup(tabs: number, panels: number): HTMLElement {
  const host = document.createElement("div");
  const list = document.createElement("div");
  list.className = "osm-tablist";
  for (const t of TITLES.slice(0, tabs)) {
    const b = document.createElement("button");
    b.className = "osm-tab";
    b.textContent = t;
    list.append(b);
  }
  const pane = document.createElement("div");
  pane.className = "osm-tab-pane";
  for (let i = 0; i < panels; i++) pane.append(document.createElement("div"));
  host.append(list, pane);
  document.body.append(host);
  return host;
}

describe("mountTabs", () => {
  let host: HTMLElement;
  let chosen: number[];
  const tabs = () => Array.from(host.querySelectorAll<HTMLElement>(".osm-tab"));
  const panels = () =>
    Array.from(host.querySelector(".osm-tab-pane")!.children) as HTMLElement[];

  beforeEach(() => {
    document.body.textContent = "";
    // happy-dom has no pointer capture; trackPress only needs it to exist.
    Element.prototype.setPointerCapture ??= () => {};
    host = markup(3, 3);
    chosen = [];
  });

  const mount = (selected = 1) => mountTabs(host, {
    selected, label: "Appearance", onChange: (i) => chosen.push(i),
  });

  it("pairs each tab with its panel", () => {
    mount();
    expect(host.querySelector(".osm-tablist")!.getAttribute("role"))
      .toBe("tablist");
    tabs().forEach((t, i) => {
      const p = panels()[i]!;
      expect(t.getAttribute("role")).toBe("tab");
      expect(p.getAttribute("role")).toBe("tabpanel");
      expect(t.getAttribute("aria-controls")).toBe(p.id);
      expect(p.getAttribute("aria-labelledby")).toBe(t.id);
    });
  });

  it("shows only the front tab's panel, and makes it the one tab stop", () => {
    const t = mount();
    expect(t.selected).toBe(1);
    expect(tabs().map((b) => b.getAttribute("aria-selected")))
      .toEqual(["false", "true", "false"]);
    expect(tabs().map((b) => b.tabIndex)).toEqual([-1, 0, -1]);
    expect(panels().map((p) => p.hidden)).toEqual([true, false, true]);
    expect(chosen).toEqual([]); // the initial tab isn't a change
  });

  it("brings a tab to the front on a release over it", () => {
    mount();
    press(tabs()[2]!, 20, 10);
    expect(chosen).toEqual([2]);
    expect(panels().map((p) => p.hidden)).toEqual([true, true, false]);
  });

  it("cancels a press released outside the tab", () => {
    mount();
    press(tabs()[2]!, 20, 40);
    expect(chosen).toEqual([]);
    expect(tabs()[1]!.getAttribute("aria-selected")).toBe("true");
  });

  it("follows keyboard activation", () => {
    mount();
    tabs()[0]!.click(); // detail 0: Space or Return on the tab
    expect(chosen).toEqual([0]);
  });

  it("moves with the arrow keys, wrapping, and Home and End", () => {
    mount(0);
    const list = host.querySelector(".osm-tablist")!;
    key(tabs()[0]!, "ArrowLeft");
    expect(chosen).toEqual([2]);
    expect(document.activeElement).toBe(tabs()[2]);
    key(tabs()[2]!, "ArrowRight");
    key(tabs()[0]!, "ArrowRight");
    key(list, "End");
    key(list, "Home");
    expect(chosen).toEqual([2, 0, 1, 2, 0]);
  });

  it("selects from code, quietly if asked", () => {
    const t = mount();
    t.select(0, false);
    expect(t.selected).toBe(0);
    expect(chosen).toEqual([]);
    t.select(0);
    expect(chosen).toEqual([]); // already in front
    t.select(2);
    expect(chosen).toEqual([2]);
    expect(() => t.select(3)).toThrow(RangeError);
  });

  it("rejects tabs and panels that don't pair up", () => {
    host = markup(3, 2);
    expect(() => mount(0)).toThrow("3 tabs for 2 panels");
    host = markup(0, 0);
    expect(() => mount(0)).toThrow("0 tabs for 0 panels");
    host = markup(2, 2);
    expect(() => mount(2)).toThrow(RangeError);
  });
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountList } from "./controls.js";

const ROW_H = 16;

/** A press and release at `y` in the list's view. happy-dom lays
 * nothing out, so the view sits at the origin. */
function tap(view: Element, y: number, pointerType = "touch"): void {
  for (const type of ["pointerdown", "pointerup"]) {
    view.dispatchEvent(new PointerEvent(type, {
      bubbles: true, button: 0, pointerId: 1, pointerType,
      clientX: 10, clientY: y,
    }));
  }
}

const settle = () => new Promise((r) => setTimeout(r, 150));

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const picked: number[] = [];
  const list = mountList(host, {
    rowHeight: ROW_H, label: "Items", onSelect: (i) => picked.push(i),
  });
  list.setRows(Array.from({ length: 20 }, (_, i) => {
    const r = document.createElement("div");
    r.textContent = `Item ${i}`;
    return r;
  }));
  const view = host.querySelector(".osm-list-view")!;
  return { list, view, picked };
}

describe("mountList", () => {
  beforeEach(() => {
    document.body.textContent = "";
    // happy-dom has no pointer capture; the list only needs it to exist.
    Element.prototype.setPointerCapture ??= () => {};
  });

  it("selects a tapped row", async () => {
    const { list, view, picked } = mount();
    await settle();
    tap(view, 2 * ROW_H + 4);
    expect(picked).toEqual([2]);
    expect(list.selected).toBe(2);
  });

  it("treats a tap that stops a scroll as only stopping it", async () => {
    const { list, view, picked } = mount();
    await settle();
    // A flick: the view scrolls every frame and is still scrolling when
    // the finger lands.
    view.dispatchEvent(new Event("scroll"));
    view.dispatchEvent(new Event("scroll"));
    tap(view, 4 * ROW_H + 4);
    expect(picked).toEqual([]);
    expect(list.selected).toBe(-1);

    // Once the list has come to rest, taps select again.
    await settle();
    tap(view, 4 * ROW_H + 4);
    expect(picked).toEqual([4]);
  });

  it("lets a tap through after a single scroll, such as a reveal", async () => {
    const { view, picked } = mount();
    await settle();
    view.dispatchEvent(new Event("scroll"));
    tap(view, 5 * ROW_H + 4);
    expect(picked).toEqual([5]);
  });

  it("still selects on a mouse press while the list scrolls", async () => {
    const { view, picked } = mount();
    await settle();
    view.dispatchEvent(new Event("scroll"));
    view.dispatchEvent(new Event("scroll"));
    tap(view, 3 * ROW_H + 4, "mouse");
    expect(picked).toEqual([3]);
  });
});

describe("mountList's destroy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("destroys its scroll bars, stops observing and cleans the host", () => {
    // Every ResizeObserver the list makes, and whether it was let go.
    const made: { targets: Node[]; disconnected: boolean }[] = [];
    vi.stubGlobal("ResizeObserver", class {
      private readonly rec = { targets: [] as Node[], disconnected: false };
      constructor() { made.push(this.rec); }
      observe(target: Node) { this.rec.targets.push(target); }
      unobserve() {}
      disconnect() { this.rec.disconnected = true; }
    });
    document.body.textContent = "";
    const host = document.createElement("div");
    document.body.append(host);
    const picked: number[] = [];
    const list = mountList(host, {
      rowHeight: ROW_H, label: "Items", onSelect: (i) => picked.push(i),
      scrollbars: "both",
    });
    list.setEmpty("No items"); // centered: observed too
    list.setRows([document.createElement("div"),
                  document.createElement("div")]);
    // Two scroll bars and the placeholder.
    expect(made).toHaveLength(3);

    list.destroy();
    expect(made.every((o) => o.disconnected)).toBe(true);
    expect(host.children.length).toBe(0);
    expect(host.className).toBe("");
    for (const name of ["role", "aria-label", "tabindex"])
      expect(host.hasAttribute(name)).toBe(false);
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(picked).toEqual([]);
    expect(() => list.setRows([])).toThrow(/destroyed/);
    expect(() => list.select(1)).toThrow(/destroyed/);
    expect(() => list.setEmpty("")).toThrow(/destroyed/);
    list.destroy(); // again: nothing to do
  });
});

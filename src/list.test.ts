// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
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
    // A flick: the view is still scrolling when the finger lands.
    view.dispatchEvent(new Event("scroll"));
    tap(view, 4 * ROW_H + 4);
    expect(picked).toEqual([]);
    expect(list.selected).toBe(-1);

    // Once the list has come to rest, taps select again.
    await settle();
    tap(view, 4 * ROW_H + 4);
    expect(picked).toEqual([4]);
  });

  it("still selects on a mouse press while the list scrolls", async () => {
    const { view, picked } = mount();
    await settle();
    view.dispatchEvent(new Event("scroll"));
    tap(view, 3 * ROW_H + 4, "mouse");
    expect(picked).toEqual([3]);
  });
});

// @vitest-environment happy-dom
// hostWindow's activation modes and its teardown, with mountWindow's.
// happy-dom has no real focus or layout: document.hasFocus() is stubbed
// where the page's focus matters, and ResizeObserver is replaced by a
// stub that records what it observes and whether it was disconnected.
import {
  afterEach, beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";
import { showAlert } from "./alert.js";
import type { OsmiumAlert } from "./alert.js";
import { hostWindow } from "./host.js";
import type { HostOptions, HostedWindow, WindowOp } from "./host.js";
import { installOsmium } from "./install.js";
import { MODAL_CHANGE, isModal, onModalChange } from "./modal.js";
import { mountWindow } from "./window.js";

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const inactive = (el: Element) => el.classList.contains("osm-inactive");

let hosted: HostedWindow[] = [];
function host(opts: Partial<HostOptions> = {}) {
  const el = document.createElement("div");
  document.body.append(el);
  const ops: WindowOp[] = [];
  const h = hostWindow(el, {
    title: "Report", post: (op) => ops.push(op), ...opts,
  });
  hosted.push(h);
  return { el, ops, hosted: h };
}

async function dismiss(a: OsmiumAlert): Promise<void> {
  a.close();
  await a.result;
}

/** Every ResizeObserver made from now on: what it observed, and whether
 * it was disconnected. */
function countObservers() {
  const made: { targets: Node[]; disconnected: boolean }[] = [];
  vi.stubGlobal("ResizeObserver", class {
    private readonly rec = { targets: [] as Node[], disconnected: false };
    constructor() { made.push(this.rec); }
    observe(target: Node) { this.rec.targets.push(target); }
    unobserve() {}
    disconnect() { this.rec.disconnected = true; }
  });
  return made;
}

const captures = (o: unknown) => typeof o === "boolean" ? o
  : !!(o as AddEventListenerOptions | undefined)?.capture;

/** Listeners added to window and document from now on. `left()` names
 * the ones still on: neither removed (same type, listener and capture)
 * nor dropped by an aborted signal. */
function watchListeners() {
  const spies = [window, document].map((t) => ({
    add: vi.spyOn(t, "addEventListener"),
    remove: vi.spyOn(t, "removeEventListener"),
  }));
  return {
    added: () => spies.flatMap((s) => s.add.mock.calls.map((c) => c[0])),
    left: () => spies.flatMap(({ add, remove }) => add.mock.calls
      .filter(([type, fn, o]) =>
        !(o as AddEventListenerOptions | undefined)?.signal?.aborted &&
        !remove.mock.calls.some(([t2, fn2, o2]) =>
          t2 === type && fn2 === fn && captures(o2) === captures(o)))
      .map((c) => c[0])),
  };
}

beforeAll(async () => {
  // Its keyboard tracking listens on document once for the whole page,
  // not per window: get it done before any counting.
  await installOsmium().catch(() => {});
});

beforeEach(() => {
  document.body.textContent = "";
  // mountWindow reports happy-dom's missing FontFace.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const h of hosted) h.destroy();
  hosted = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hostWindow activation", () => {
  it("follows the page's focus by default", () => {
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { el } = host();
    expect(inactive(el)).toBe(false);
    hasFocus.mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    expect(inactive(el)).toBe(true);
    hasFocus.mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    expect(inactive(el)).toBe(false);
  });

  it("leaves it to setActive with \"manual\"", () => {
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { el, hosted: h } = host({ activation: "manual" });
    expect(inactive(el)).toBe(false);
    window.dispatchEvent(new Event("blur"));
    expect(inactive(el)).toBe(false);
    h.window.setActive(false);
    hasFocus.mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    expect(inactive(el)).toBe(true);
    h.window.setActive(true);
    expect(inactive(el)).toBe(false);
  });

  it("still draws a \"manual\" window inactive behind its alerts", async () => {
    const { el, hosted: h } = host({ activation: "manual" });
    // An alert about something else leaves it alone.
    const other = showAlert({ kind: "note", message: "Elsewhere" });
    expect(inactive(el)).toBe(false);
    await dismiss(other);

    const a = showAlert({ kind: "note", message: "One", parent: h.window });
    expect(inactive(el)).toBe(true);
    window.dispatchEvent(new Event("focus"));
    expect(inactive(el)).toBe(true);
    await dismiss(a);
    expect(inactive(el)).toBe(false);

    // Inactive before the alert: inactive after it.
    h.window.setActive(false);
    const b = showAlert({ kind: "note", message: "Two", parent: h.window });
    await dismiss(b);
    expect(inactive(el)).toBe(true);
  });

  it("runs one grow at a time in a browser tab", () => {
    const { el } = host({ native: false, grow: { min: { w: 100, h: 50 } } });
    const listeners = watchListeners();
    const grip = el.querySelector(".osm-grow")!;
    for (const pointerId of [1, 2]) {
      grip.dispatchEvent(new PointerEvent(
        "pointerdown", { bubbles: true, button: 0, pointerId }));
    }
    expect(listeners.left()).toEqual(
      ["pointermove", "pointerup", "pointercancel"]);
    window.dispatchEvent(new PointerEvent(
      "pointermove", { pointerId: 1, clientX: 300, clientY: 200 }));
    expect(el.style.width).toBe("");
    window.dispatchEvent(new PointerEvent(
      "pointermove", { pointerId: 2, clientX: 300, clientY: 200 }));
    expect(el.style.width).toBe("300px");
  });

  it("follows the app's state across an alert with onModalChange", async () => {
    // The README's pattern for a native window's key state.
    const { el, hosted: h } = host({ activation: "manual" });
    let key = true;
    const sync = () => h.window.setActive(key && !isModal());
    const unsubscribe = onModalChange(sync);
    const a = showAlert({ kind: "note", message: "One", parent: h.window });
    key = false; // the native window resigns key under the alert
    sync();
    await dismiss(a);
    // The alert reactivated it; sync had the last word.
    expect(inactive(el)).toBe(true);
    key = true;
    sync();
    expect(inactive(el)).toBe(false);
    unsubscribe();
  });
});

describe("destroy", () => {
  it("removes every listener and observer the hosted window added", () => {
    const observers = countObservers();
    const listeners = watchListeners();
    const { el, hosted: h } = host({
      native: false, grow: { min: { w: 100, h: 50 } },
    });
    // A grow in a browser tab, still in progress.
    el.querySelector(".osm-grow")!.dispatchEvent(new PointerEvent(
      "pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    expect(listeners.added()).toEqual(expect.arrayContaining([
      "keydown", "resize", "focus", "blur", MODAL_CHANGE,
      "pointermove", "pointerup", "pointercancel",
    ]));
    expect(observers.length).toBeGreaterThan(0);

    h.destroy();
    expect(listeners.left()).toEqual([]);
    expect(observers.every((o) => o.disconnected)).toBe(true);
    h.destroy(); // again: nothing to do
  });

  it("lets a window be hosted and destroyed again and again", () => {
    const observers = countObservers();
    const listeners = watchListeners();
    for (let i = 0; i < 3; i++) {
      const { hosted: h } = host({ activation: i % 2 ? "manual" : "page" });
      h.destroy();
    }
    expect(listeners.added().length).toBeGreaterThan(0);
    expect(listeners.left()).toEqual([]);
    expect(observers).toHaveLength(3);
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  it("no longer closes on Escape, even one pressed just before", async () => {
    const listeners = watchListeners();
    const { ops, hosted: h } = host();
    document.body.dispatchEvent(new KeyboardEvent(
      "keydown", { key: "Escape", bubbles: true }));
    h.destroy();
    expect(listeners.left()).toEqual([]);
    document.body.dispatchEvent(new KeyboardEvent(
      "keydown", { key: "Escape", bubbles: true }));
    await wait();
    expect(ops.some((o) => o.op === "winClose")).toBe(false);
  });

  it("leaves the boxes, titlebar and grow box inert", () => {
    const { el, ops, hosted: h } = host({
      zoom: { standard: { w: 640, h: 480 } }, grow: { min: { w: 100, h: 50 } },
    });
    h.destroy();
    ops.length = 0;
    for (const box of [".osm-close", ".osm-zoom", ".osm-collapse"]) {
      el.querySelector(box)!.dispatchEvent(
        new MouseEvent("click", { detail: 0 }));
    }
    for (const part of [".osm-titlebar", ".osm-grow"]) {
      el.querySelector(part)!.dispatchEvent(new PointerEvent(
        "pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    }
    expect(ops).toEqual([]);
    expect(h.shaded).toBe(false);
  });

  it("makes close() and setShaded() do nothing", () => {
    const { ops, hosted: h } = host();
    h.destroy();
    ops.length = 0;
    h.setShaded(true);
    h.close();
    expect(ops).toEqual([]);
    expect(h.shaded).toBe(false);
  });

  it("stops following the page's focus and alerts", async () => {
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { el, hosted: h } = host();
    h.destroy();
    hasFocus.mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    expect(inactive(el)).toBe(false);
    await dismiss(showAlert({ kind: "note", message: "One" }));
    expect(inactive(el)).toBe(false);
  });

  it("works on mountWindow's own windows", () => {
    const observers = countObservers();
    const listeners = watchListeners();
    const el = document.createElement("div");
    document.body.append(el);
    const win = mountWindow(el, { title: "Settings" });
    expect(observers).toHaveLength(1);
    expect(observers[0]!.targets).toEqual([el]);
    win.destroy();
    expect(listeners.added()).toHaveLength(3);
    expect(listeners.left()).toEqual([]);
    expect(observers[0]!.disconnected).toBe(true);
    // The chrome stays and still draws.
    win.setActive(false);
    expect(inactive(el)).toBe(true);
    expect(el.querySelector(".osm-titlebar")).not.toBeNull();
  });
});

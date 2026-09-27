// @vitest-environment happy-dom
// happy-dom lays nothing out and draws nothing: line counts come out as
// one line, canvas text measurement as zero, and nothing is hit-tested
// (a press on the modal layer can't be shown to miss what is under it).
// The layout numbers are checked through alertLayout directly, and the
// pixels against Mac OS 8.0 captures in a real browser (see the
// CHANGELOG).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertLayout, alertPosition, showAlert } from "./alert.js";
import type { AlertOptions, OsmiumAlert } from "./alert.js";
import { MENU_SEPARATOR, bindDialogKeys, mountPopup } from "./controls.js";
import { hostWindow } from "./host.js";
import type { WindowOp } from "./host.js";
import { mountMenuBar } from "./menubar.js";
import { mountWindow } from "./window.js";

const FLASH = 150; // past the 8-tick (133 ms) flash
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
/** The alert shows once installOsmium settles (it fails in happy-dom,
 * which has no FontFace; the alert carries on regardless). */
const revealed = () => wait();

function key(target: EventTarget, k: string,
             init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent("keydown", {
    key: k, bubbles: true, cancelable: true, ...init,
  });
  target.dispatchEvent(e);
  return e;
}

const html = () => document.documentElement;
const layers = () => document.querySelectorAll(".osm-modal-layer");
const button = (a: OsmiumAlert, which: string) =>
  a.element.querySelector<HTMLButtonElement>(`[data-alert-button="${which}"]`)!;

let open: OsmiumAlert[] = [];
function show(opts: Partial<AlertOptions> = {}): OsmiumAlert {
  const a = showAlert({ kind: "caution", message: "Empty the Trash?", ...opts });
  open.push(a);
  return a;
}

beforeEach(() => {
  document.body.textContent = "";
  // happy-dom has no pointer capture; the press tracking only needs it
  // to exist.
  Element.prototype.setPointerCapture ??= () => {};
});

afterEach(async () => {
  for (const a of open) a.close();
  open = [];
  await wait();
  vi.restoreAllMocks();
});

describe("alertLayout", () => {
  // The Mac OS 8.0 Finder's alerts: 374 x 104, measured, and rebuilt
  // from these numbers with 0 differing pixels.
  it("reproduces the Finder's stop alert", () => {
    expect(alertLayout({
      messageLines: 2, explanationLines: 0, modality: "modal",
      buttons: [{ which: "ok", width: 59 }],
    })).toEqual({
      width: 374, height: 104,
      port: { x: 3, y: 3, w: 368, h: 98 },
      icon: { x: 20, y: 10 },
      message: { x: 75, y: 7, w: 283 },
      explanation: null,
      buttons: [{ which: "ok", x: 299, y: 68, w: 59 }],
    });
  });

  it("reproduces the Finder's Empty Trash alert", () => {
    const l = alertLayout({
      messageLines: 3, explanationLines: 0, modality: "modal",
      buttons: [{ which: "cancel", width: 59 }, { which: "ok", width: 59 }],
    });
    expect(l.height).toBe(104);
    expect(l.buttons).toEqual([
      { which: "cancel", x: 227, y: 68, w: 59 },
      { which: "ok", x: 299, y: 68, w: 59 },
    ]);
  });

  it("grows 16px a message line past three", () => {
    const l = alertLayout({
      messageLines: 5, explanationLines: 0, modality: "modal",
      buttons: [{ which: "ok", width: 59 }],
    });
    expect(l.buttons[0]!.y).toBe(100);
    expect(l.height).toBe(136);
  });

  it("puts the explanation 6px under the message", () => {
    const ok = [{ which: "ok" as const, width: 59 }];
    const short = alertLayout({
      messageLines: 1, explanationLines: 2, modality: "modal", buttons: ok,
    });
    expect(short.explanation).toEqual({ y: 29 });
    expect(short.buttons[0]!.y).toBe(68);
    const long = alertLayout({
      messageLines: 3, explanationLines: 3, modality: "modal", buttons: ok,
    });
    expect(long.explanation).toEqual({ y: 61 });
    expect(long.buttons[0]!.y).toBe(113);
  });

  it("widens for long titles, with other at the text's left edge", () => {
    const l = alertLayout({
      messageLines: 1, explanationLines: 0, modality: "modal",
      buttons: [{ which: "other", width: 124 }, { which: "cancel", width: 59 },
                { which: "ok", width: 114 }],
    });
    expect(l.port.w).toBe(408);
    expect(l.width).toBe(414);
    expect(l.message.w).toBe(323);
    expect(l.buttons.map((b) => [b.which, b.x]))
      .toEqual([["other", 75], ["cancel", 212], ["ok", 284]]);
  });

  it("adds the movable alert's title bar", () => {
    const l = alertLayout({
      messageLines: 2, explanationLines: 0, modality: "movable",
      buttons: [{ which: "ok", width: 59 }],
    });
    expect(l.height).toBe(125);
    expect(l.port).toEqual({ x: 3, y: 24, w: 368, h: 98 });
  });
});

describe("alertPosition", () => {
  const screen = { x: 0, y: 20, w: 640, h: 460 };
  const vp = { w: 640, h: 480, top: 20 };

  // Mac OS 8.0 on a 640 x 480 screen: the Stickies, Process Manager and
  // AppleCD Audio Player alerts' outline boxes.
  it("centers alerts a fifth of the way down, shadow included", () => {
    expect(alertPosition({ w: 304, h: 160 }, screen, "screen", vp))
      .toEqual({ x: 167, y: 79 });
    expect(alertPosition({ w: 302, h: 162 }, screen, "screen", vp))
      .toEqual({ x: 168, y: 79 });
    expect(alertPosition({ w: 326, h: 187 }, screen, "screen", vp))
      .toEqual({ x: 156, y: 74 });
  });

  it("pins an alert that doesn't fit to the top left, under the menu bar", () => {
    expect(alertPosition({ w: 374, h: 104 }, { x: 0, y: 20, w: 300, h: 80 },
                         "screen", { w: 300, h: 100, top: 20 }))
      .toEqual({ x: 0, y: 20 });
  });

  it("keeps the parent's title bar in view", () => {
    expect(alertPosition({ w: 374, h: 104 }, { x: 50, y: 40, w: 400, h: 120 },
                         "parent", vp)).toEqual({ x: 62, y: 61 });
  });
});

describe("showAlert", () => {
  it("is an alertdialog labeled by its message", async () => {
    const a = show({ explanation: "This can't be undone." });
    const box = a.element;
    expect(box.getAttribute("role")).toBe("alertdialog");
    expect(box.getAttribute("aria-modal")).toBe("true");
    const msg = document.getElementById(box.getAttribute("aria-labelledby")!);
    expect(msg?.textContent).toBe("Empty the Trash?");
    const exp = document.getElementById(box.getAttribute("aria-describedby")!);
    expect(exp?.textContent).toBe("This can't be undone.");
    const icon = box.querySelector(".osm-alert-icon")!;
    expect(icon.getAttribute("role")).toBe("img");
    expect(icon.getAttribute("aria-label")).toBe("Caution");
    expect((icon as HTMLElement).style.getPropertyValue("--osm-icon"))
      .toBe("var(--osm-sprite-alert-caution)");
    a.close();
    expect(show().element.hasAttribute("aria-describedby")).toBe(false);
  });

  it("stays hidden until laid out, then takes the focus", async () => {
    const a = show();
    expect(a.element.style.visibility).toBe("hidden");
    expect(document.activeElement).not.toBe(a.element);
    await revealed();
    expect(a.element.style.visibility).toBe("");
    expect(document.activeElement).toBe(a.element);
    expect(a.element.style.width).toBe("374px");
  });

  it("orders its buttons other, cancel, OK and rings the default", () => {
    const three = { ok: "Save", cancel: "Cancel", other: "Don't Save" };
    const slots = (a: OsmiumAlert) => Array.from(
      a.element.querySelectorAll<HTMLElement>(".osm-button"),
      (b) => [b.dataset["alertButton"], b.classList.contains("osm-default")]);
    expect(slots(show({ buttons: three })))
      .toEqual([["other", false], ["cancel", false], ["ok", true]]);
    expect(slots(show({ buttons: three, defaultButton: "cancel" })))
      .toEqual([["other", false], ["cancel", true], ["ok", false]]);
    expect(slots(show({ defaultButton: "none" }))).toEqual([["ok", false]]);
  });

  it("draws a plain alert's icon only when given one", () => {
    expect(show({ kind: "plain" }).element.querySelector(".osm-alert-icon"))
      .toBeNull();
    const icon = show({ kind: "plain", icon: "icon-app" }).element
      .querySelector<HTMLElement>(".osm-alert-icon")!;
    expect(icon.style.getPropertyValue("--osm-icon"))
      .toBe("var(--osm-sprite-icon-app)");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("throws for programming errors, before touching the page", () => {
    expect(() => show({ kind: "stop", icon: "icon-app" })).toThrow(/plain/);
    expect(() => show({ position: "parent" })).toThrow(/parent window/);
    expect(() => show({ defaultButton: "cancel" })).toThrow(/defaultButton/);
    expect(() => show({ cancelButton: "other" })).toThrow(/cancelButton/);
    expect(document.body.children.length).toBe(0);
    expect(html().classList.contains("osm-modal")).toBe(false);
  });

  it("presses the default button on Return, flashing it", async () => {
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    expect(html().classList.contains("osm-modal")).toBe(true);
    const e = key(a.element, "Enter");
    expect(e.defaultPrevented).toBe(true);
    expect(button(a, "ok").classList.contains("osm-pressed")).toBe(true);
    expect(await a.result).toBe("ok");
    expect(a.element.isConnected).toBe(false);
    expect(layers().length).toBe(0);
    expect(html().classList.contains("osm-modal")).toBe(false);
  });

  it("presses Cancel on Escape and Command-period, even from OK", async () => {
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    button(a, "ok").focus();
    key(button(a, "ok"), "Escape");
    expect(await a.result).toBe("cancel");
    const b = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    key(b.element, ".", { metaKey: true });
    expect(await b.result).toBe("cancel");
  });

  it("leaves an Escape a help balloon took to the balloon", async () => {
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    // balloon.ts closes an open balloon on window capture and prevents
    // the key's default; the alert then leaves that Escape alone.
    const claim = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener("keydown", claim, true);
    key(a.element, "Escape");
    window.removeEventListener("keydown", claim, true);
    await wait(FLASH);
    expect(a.element.isConnected).toBe(true);
    key(a.element, "Escape");
    expect(await a.result).toBe("cancel");
  });

  it("rejects unknown kinds, modalities and positions", () => {
    const untyped = (o: object) => () => show(o as Partial<AlertOptions>);
    expect(untyped({ kind: "error" })).toThrow(TypeError);
    expect(untyped({ modality: "modeless" })).toThrow(TypeError);
    expect(untyped({ position: "center" })).toThrow(TypeError);
  });

  it("swallows Escape when it has no cancel button", async () => {
    const a = show();
    await revealed();
    expect(key(a.element, "Escape").defaultPrevented).toBe(true);
    await wait(FLASH);
    expect(a.element.isConnected).toBe(true);
  });

  it("leaves Return on a focused button to the button", async () => {
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    button(a, "cancel").focus();
    expect(key(button(a, "cancel"), "Enter").defaultPrevented).toBe(false);
    expect(button(a, "ok").classList.contains("osm-pressed")).toBe(false);
    button(a, "cancel").click(); // its native activation: detail 0
    expect(await a.result).toBe("cancel");
  });

  it("ends on a button's click", async () => {
    const a = show({ buttons: { other: "Don't Save" } });
    await revealed();
    button(a, "other").click();
    expect(await a.result).toBe("other");
  });

  it("keeps Tab and Shift-Tab among its buttons", async () => {
    const a = show({ buttons: { cancel: "Cancel", other: "Don't Save" } });
    await revealed();
    key(a.element, "Tab");
    expect(document.activeElement).toBe(button(a, "other"));
    key(document.activeElement!, "Tab");
    key(document.activeElement!, "Tab");
    expect(document.activeElement).toBe(button(a, "ok"));
    key(document.activeElement!, "Tab");
    expect(document.activeElement).toBe(button(a, "other"));
    key(document.activeElement!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(button(a, "ok"));
  });

  it("brings Tab back in when the focus fell out (to body)", async () => {
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    key(document.body, "Tab");
    expect(document.activeElement).toBe(button(a, "cancel"));
  });

  it("keeps a press's outcome while its button flashes", async () => {
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    key(a.element, "Enter");
    a.close();
    key(a.element, "Escape");
    expect(await a.result).toBe("ok");
  });

  it("leaves the function keys to the browser", async () => {
    show();
    await revealed();
    expect(key(document.body, "F5").defaultPrevented).toBe(false);
    expect(key(document.body, "a").defaultPrevented).toBe(true);
  });

  it("gives the focus back afterwards", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const a = show();
    await revealed();
    a.close();
    await a.result;
    expect(document.activeElement).toBe(input);
  });

  it("blocks the rest of the page and lets it go again", async () => {
    const page = document.createElement("div");
    const blocked = document.createElement("div");
    blocked.inert = true;
    document.body.append(page, blocked);
    const a = show();
    expect(page.inert).toBe(true);
    expect(a.element.inert).toBe(false);
    // Added while the alert is up.
    const late = document.createElement("div");
    document.body.append(late);
    await revealed();
    expect(late.inert).toBe(true);
    a.close();
    await a.result;
    expect(page.inert).toBe(false);
    expect(late.inert).toBe(false);
    expect(blocked.inert).toBe(true);
  });

  it("stops keys aimed at the page", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    const seen = vi.fn();
    input.addEventListener("keydown", seen);
    show();
    await revealed();
    const e = key(input, "a");
    expect(seen).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it("keeps keys aimed at it from the page's own listeners", async () => {
    const seen: string[] = [];
    const log = (e: Event) => seen.push(`${e.type}:${(e as KeyboardEvent).key}`);
    for (const type of ["keydown", "keyup", "keypress"]) {
      window.addEventListener(type, log);
      document.addEventListener(type, log);
    }
    const a = show({ buttons: { cancel: "Cancel" } });
    await revealed();
    expect(document.activeElement).toBe(a.element);
    for (const k of ["a", "Delete", "ArrowDown"]) key(a.element, k);
    a.element.dispatchEvent(new KeyboardEvent("keyup", {
      key: "a", bubbles: true, cancelable: true,
    }));
    key(button(a, "ok"), "Enter");
    expect(seen).toEqual([]);
    a.close();
    await a.result;
    key(document.body, "a");
    expect(seen).toEqual(["keydown:a", "keydown:a"]);
    for (const type of ["keydown", "keyup", "keypress"]) {
      window.removeEventListener(type, log);
      document.removeEventListener(type, log);
    }
  });

  it("scrolls nothing under it", async () => {
    const a = show();
    await revealed();
    for (const k of [" ", "PageDown", "End", "ArrowDown"])
      expect(key(a.element, k).defaultPrevented).toBe(true);
    // Space presses a focused button, natively: its default stays.
    expect(key(button(a, "ok"), " ").defaultPrevented).toBe(false);
    for (const target of [a.element, layers()[0]!]) {
      const wheel = new WheelEvent("wheel", {
        bubbles: true, cancelable: true, deltaY: 500,
      });
      target.dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(true);
    }
  });

  it("beeps for presses outside it", async () => {
    const onBeep = vi.fn();
    const a = show({ onBeep });
    await revealed();
    const e = new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, button: 0,
    });
    layers()[0]!.dispatchEvent(e);
    expect(onBeep).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    expect(a.element.isConnected).toBe(true);
  });

  it("closes from code", async () => {
    const a = show();
    a.close();
    expect(await a.result).toBe("dismissed");
    a.close(); // ended: nothing happens
    const b = show({ buttons: { cancel: "Cancel" } });
    expect(() => b.close("other")).toThrow(/no "other" button/);
    b.close("cancel");
    expect(button(b, "cancel").classList.contains("osm-pressed")).toBe(true);
    expect(await b.result).toBe("cancel");
  });

  it("stacks: the top alert takes the keys, closing in either order", async () => {
    for (const lowerFirst of [false, true]) {
      const page = document.createElement("div");
      const input = document.createElement("input");
      page.append(input);
      document.body.append(page);
      input.focus();
      // Each alert shows before the next opens, so the upper one takes
      // the focus from the lower one.
      const lower = show({ buttons: { cancel: "Cancel" } });
      await revealed();
      expect(document.activeElement).toBe(lower.element);
      const upper = show({ buttons: { cancel: "Cancel" } });
      await revealed();
      expect(document.activeElement).toBe(upper.element);
      expect(upper.element.classList.contains("osm-top")).toBe(true);
      expect(lower.element.classList.contains("osm-top")).toBe(false);
      expect(lower.element.inert).toBe(true);
      expect(Number(upper.element.style.zIndex))
        .toBeGreaterThan(Number(lower.element.style.zIndex));

      const first = lowerFirst ? lower : upper;
      const second = lowerFirst ? upper : lower;
      first.close("ok");
      await first.result;
      expect(html().classList.contains("osm-modal")).toBe(true);
      expect(page.inert).toBe(true);
      expect(second.element.classList.contains("osm-top")).toBe(true);
      expect(second.element.inert).toBe(false);
      expect(document.activeElement).toBe(second.element);
      key(second.element, "Escape");
      expect(await second.result).toBe("cancel");
      expect(html().classList.contains("osm-modal")).toBe(false);
      expect(page.inert).toBe(false);
      // Back where it was before the first alert, whichever closed
      // first (closing the lower one hands its focus to the upper).
      expect(document.activeElement).toBe(input);
      page.remove();
    }
  });

  it("closes an open pop-up menu and menu bar menu as it opens", () => {
    const pop = document.createElement("button");
    const bar = document.createElement("div");
    document.body.append(pop, bar);
    mountPopup(pop, { items: ["One", MENU_SEPARATOR, "Two"], selected: 0,
                      onChange: () => {} });
    mountMenuBar(bar, [{ title: "File", items: () => [{ title: "Quit" }] }]);
    key(pop, "ArrowDown");
    expect(document.querySelectorAll(".osm-menu").length).toBe(1);
    show().close();
    expect(document.querySelectorAll(".osm-menu").length).toBe(0);
    key(bar.querySelector(".osm-menubar-title")!, "Enter");
    expect(document.querySelectorAll(".osm-menu").length).toBe(1);
    show();
    expect(document.querySelectorAll(".osm-menu").length).toBe(0);
  });

  it("drags a movable alert by its title bar, kept under the menu bar", async () => {
    // happy-dom lays nothing out: give the menu bar its 20px.
    const menubar = document.createElement("div");
    menubar.className = "osm-menubar";
    menubar.getBoundingClientRect = () => new DOMRect(0, 0, 1024, 20);
    document.body.append(menubar);
    const a = show({ modality: "movable" });
    await revealed();
    const bar = a.element.querySelector(".osm-alert-titlebar")!;
    expect(a.element.classList.contains("osm-movable")).toBe(true);
    expect(bar.querySelector(".osm-stripes-all")).not.toBeNull();
    a.element.style.left = "100px";
    a.element.style.top = "80px";
    // happy-dom's viewport is 1024 x 768.
    const at = (type: string, x: number, y: number) =>
      bar.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, button: 0, pointerId: 1,
        clientX: x, clientY: y,
      }));
    at("pointerdown", 110, 90);
    at("pointermove", 140, 70);
    expect([a.element.style.left, a.element.style.top]).toEqual(["130px", "60px"]);
    at("pointermove", 0, 0);
    expect([a.element.style.left, a.element.style.top]).toEqual(["0px", "20px"]);
    at("pointerup", 0, 0);
  });
});

describe("alerts and windows", () => {
  // mountWindow reports happy-dom's missing FontFace.
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });

  it("draw the parent window inactive while up", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    const win = mountWindow(el, { title: "Report", activation: "manual" });
    win.setActive(true);
    const a = show({ parent: win, position: "parent" });
    const b = show({ parent: win });
    expect(el.classList.contains("osm-inactive")).toBe(true);
    a.close();
    await a.result;
    expect(el.classList.contains("osm-inactive")).toBe(true);
    b.close();
    await b.result;
    expect(el.classList.contains("osm-inactive")).toBe(false);

    win.setActive(false);
    const c = show({ parent: win });
    c.close();
    await c.result;
    expect(el.classList.contains("osm-inactive")).toBe(true);
  });

  it("draw a page-activated window inactive while up", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const el = document.createElement("div");
    document.body.append(el);
    mountWindow(el, { title: "Report" });
    expect(el.classList.contains("osm-inactive")).toBe(false);
    const a = show();
    expect(el.classList.contains("osm-inactive")).toBe(true);
    a.close();
    await a.result;
    expect(el.classList.contains("osm-inactive")).toBe(false);
  });

  it("keep Escape from closing a hosted window", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    const ops: WindowOp[] = [];
    hostWindow(el, { title: "Report", post: (op) => ops.push(op) });
    const a = show();
    await revealed();
    key(a.element, "Escape");
    await wait(FLASH);
    expect(ops.some((o) => o.op === "winClose")).toBe(false);
    a.close();
    await a.result;
    key(document.body, "Escape");
    await wait();
    expect(ops.some((o) => o.op === "winClose")).toBe(true);
  });
});

describe("bindDialogKeys", () => {
  function dialog() {
    const ok = document.createElement("button");
    document.body.append(ok);
    // happy-dom gives no element a box; the key handler skips hidden
    // (boxless) buttons.
    ok.getClientRects = () => [new DOMRect(0, 0, 59, 20)] as unknown as DOMRectList;
    const pressed = vi.fn();
    const unbind = bindDialogKeys(ok, null, { ok: pressed });
    return { pressed, unbind };
  }

  it("stops when unbound", async () => {
    const { pressed, unbind } = dialog();
    key(document.body, "Enter");
    await wait(FLASH);
    expect(pressed).toHaveBeenCalledTimes(1);
    unbind();
    key(document.body, "Enter");
    await wait(FLASH);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it("stands down while an alert is up", async () => {
    const { pressed, unbind } = dialog();
    const a = show();
    await revealed();
    // Straight to window: past the modal key routing on document, as a
    // key would get there if that routing ever let it through.
    key(window, "Enter");
    await wait(FLASH);
    expect(pressed).not.toHaveBeenCalled();
    key(a.element, "Enter");
    expect(await a.result).toBe("ok");
    expect(pressed).not.toHaveBeenCalled();
    key(document.body, "Enter");
    await wait(FLASH);
    expect(pressed).toHaveBeenCalledTimes(1);
    unbind();
  });
});

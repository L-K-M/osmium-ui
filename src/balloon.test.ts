// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BALLOON_REST_MS, TAILS, anchorTip, attachBalloon, balloonHelp,
  balloonMenuItem, balloonTextBox, geneva9Advance, onBalloonHelpChange,
  placeBalloon, setBalloonHelp, tipOffset, variantOrder, wrapBalloonText,
} from "./balloon.js";
import type { BalloonVariant, OsmiumBalloon, Rect } from "./balloon.js";
import { bindDialogKeys } from "./controls.js";
import { CONTROL_SPRITES } from "./controlsprites.js";
import { spriteSvg } from "./sprites.js";

const VARIANTS = Object.keys(TAILS) as BalloonVariant[];

/** Geneva 9 advances; every test string is in the strike. */
const noFallback = (run: string): number => {
  throw new Error(`"${run}" isn't in the strike`);
};
const g9 = (s: string) => geneva9Advance(s, noFallback);
const g9Box = (text: string, maxWidth = 1000) => {
  const b = balloonTextBox((w) => wrapBalloonText(text, w, g9).length * 12,
                           maxWidth);
  return { width: b.width, lines: wrapBalloonText(text, b.width, g9) };
};

describe("balloon sprites", () => {
  it("have a 14 x 14 body and the eight tails at their measured sizes", () => {
    expect(CONTROL_SPRITES["balloon"]!.length).toBe(14);
    expect(CONTROL_SPRITES["balloon"]!.every((r) => r.length === 14)).toBe(true);
    for (const v of VARIANTS) {
      const rows = CONTROL_SPRITES[`balloon-${v}`]!;
      expect(rows.length, v).toBe(TAILS[v].h);
      expect(rows.every((r) => r.length === TAILS[v].w), v).toBe(true);
      expect(() => spriteSvg(rows)).not.toThrow();
      // The tip pixel is black, inside the overlay.
      const [tx, ty] = TAILS[v].tip;
      expect(rows[ty - TAILS[v].y]![tx - TAILS[v].x], v).toBe("0");
    }
  });

  it("are placed by osmium.css where balloon.ts expects the tails", () => {
    const css = readFileSync(join(process.cwd(), "osmium.css"), "utf8");
    // Border 6 7 7 6: the padding box starts 6px in from the border
    // box's top-left and ends 7px in from its right and bottom.
    for (const [w, h] of [[121, 72], [200, 145]] as const) {
      for (const v of VARIANTS) {
        const rule = new RegExp(`\\.osm-balloon-${v}::before \\{([^}]*)\\}`)
          .exec(css)?.[1];
        expect(rule, v).toBeDefined();
        const px = (p: string) => {
          const m = new RegExp(`(?:^|[\\s;])${p}: (-?\\d+)px`).exec(rule!);
          return m ? Number(m[1]) : null;
        };
        const t = TAILS[v];
        expect(px("width"), v).toBe(t.w);
        expect(px("height"), v).toBe(t.h);
        const left = px("left"), right = px("right");
        const top = px("top"), bottom = px("bottom");
        const x = left !== null ? 6 + left : w + 1 - 7 - right! - t.w;
        const y = top !== null ? 6 + top : h + 1 - 7 - bottom! - t.h;
        const cx = t.corner[0] === "l" ? 0 : w - 1;
        const cy = t.corner[1] === "t" ? 0 : h - 1;
        expect({ x, y }, v).toEqual({ x: cx + t.x, y: cy + t.y });
      }
    }
  });
});

describe("geneva9Advance", () => {
  it("sums the strike's advances", () => {
    expect(g9("Help menu")).toBe(45);
    expect(g9("Use this menu to get")).toBe(91);
    expect(g9("This is the window’s title")).toBe(115);
  });

  it("measures characters the strike lacks with the fallback", () => {
    const runs: string[] = [];
    const w = geneva9Advance("a→→b😀", (run) => { runs.push(run); return 7; });
    expect(runs).toEqual(["→→", "😀"]);
    expect(w).toBe(g9("ab") + 14);
  });
});

describe("wrapBalloonText", () => {
  it("fits a line only if it is at most the width less one", () => {
    const line = "title bar and drag the window.";
    expect(g9(line)).toBe(135);
    expect(wrapBalloonText(line, 135, g9).length).toBe(2);
    expect(wrapBalloonText(line, 136, g9)).toEqual([line]);
  });

  it("keeps paragraphs and blank lines, and trailing spaces off the measure", () => {
    expect(wrapBalloonText("Close box\n\nTo close this window, click here.",
                           97, g9))
      .toEqual(["Close box", "", "To close this", "window, click here."]);
  });

  it("breaks a word wider than the line by character", () => {
    const lines = wrapBalloonText("Supercalifragilistic", 30, g9);
    expect(lines.join("")).toBe("Supercalifragilistic");
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(g9(l)).toBeLessThanOrEqual(29);
  });
});

describe("balloonTextBox", () => {
  // The 11 fully read Mac OS 8.0 balloons: text width and line breaks.
  const MEASURED: readonly [string, number, number][] = [
    ["Help menu\n\nUse this menu to get information that helps you use " +
     "your computer.", 116, 5],
    ["BitDepths\n\nUse this control strip module to change the bit depth " +
     "of a monitor.", 116, 5],
    ["Title bar\n\nThis is the window’s title bar.  To move the window, " +
     "position the pointer in the title bar and drag the window.", 116, 7],
    ["Trash\n\nTo discard an item, eject a disk, or remove a hard disk or " +
     "shared disk icon from your desktop, drag it to the Trash. To " +
     "permanently remove items in the Trash, choose Empty Trash from the " +
     "Special menu.\n\nThis icon's name cannot be changed.", 174, 10],
    ["This is an inactive window.  To make this window active, click in it.",
     97, 4],
    ["Close box\n\nTo close this window, click here.", 97, 4],
    ["This window belongs to the application “Stickies”.  To make this " +
     "window active, click in it.", 97, 5],
    ["Application menu\n\nUse this menu to switch from one application " +
     "program to another when more than one program is open.", 135, 6],
    ["File menu\n\nUse this menu to perform operations with disks, files, " +
     "folders, windows, and printers.", 116, 6],
    ["Hard disk\n\nA hard disk is a device that stores large numbers of " +
     "files and folders.\n\nChange the icon's name by clicking the name " +
     "and typing.", 135, 8],
    ["Edit menu\n\nUse this menu to undo an action, work with text and " +
     "graphics, or set Finder preferences.", 116, 6],
  ];
  for (const [text, width, lines] of MEASURED) {
    it(`sizes "${text.slice(0, 24).replace(/\n/g, " ")}…" ${width} wide`, () => {
      const b = g9Box(text);
      expect(b.width).toBe(width);
      expect(b.lines.length).toBe(lines);
    });
  }

  it("breaks the measured lines", () => {
    expect(g9Box(MEASURED[0]![0]).lines).toEqual([
      "Help menu", "", "Use this menu to get", "information that helps",
      "you use your computer.",
    ]);
    expect(g9Box(MEASURED[2]![0]).lines).toEqual([
      "Title bar", "", "This is the window’s title", "bar.  To move the",
      "window, position the", "pointer in the title bar",
      "and drag the window.",
    ]);
  });

  // Hide Balloons' own balloon (System 7.5.3, Mac OS 8.5 and 9.0) is 58
  // wide in 3 lines; the search gives 38. Unexplained, so not modeled.
  it.fails("reproduces the 'Turns Balloon help off.' menu balloon", () => {
    expect(g9Box("Turns Balloon help off.").width).toBe(58);
  });

  it("uses golden widths, floor(1.618 x 12k), with 232 not 233", () => {
    const widths = new Set<number>();
    balloonTextBox((w) => { widths.add(w); return Infinity; }, 240);
    expect([...widths]).toEqual(
      [19, 38, 58, 77, 97, 116, 135, 155, 174, 194, 213, 232, 240]);
  });

  it("caps the width at maxWidth and grows the height instead", () => {
    const text = MEASURED[3]![0];
    const b = g9Box(text, 100);
    expect(b.width).toBe(100);
    expect(b.lines.length).toBeGreaterThan(10);
  });

  it("ends even when nothing ever fits, measuring each width once", () => {
    const calls: number[] = [];
    const b = balloonTextBox((w) => { calls.push(w); return 1e9; }, 50);
    expect(b).toEqual({ width: 50, height: 1e9 });
    expect(new Set(calls).size).toBe(calls.length);
  });
});

describe("placement", () => {
  const screen: Rect = { left: 0, top: 0, right: 640, bottom: 480 };
  const at = (x: number, y: number, w = 40, h = 20): Rect =>
    ({ left: x, top: y, right: x + w, bottom: y + h });
  const place = (r: Rect, avoid: Rect[] = [], w = 121, h = 72,
                 v: BalloonVariant = "left-top") =>
    placeBalloon(w, h, v, (c) => anchorTip(r, c, { x: 10, y: 10 }), screen,
                 avoid);

  it("tries the mirrors, then the adjacent side", () => {
    expect(variantOrder("left-top")).toEqual([
      "left-top", "right-top", "left-bottom", "right-bottom",
      "top-left", "top-right", "bottom-left", "bottom-right",
    ]);
    expect(variantOrder("bottom-left")[0]).toBe("bottom-left");
    expect(new Set(variantOrder("top-right")).size).toBe(8);
  });

  it("puts the tip where the captures have it", () => {
    const w = 121, h = 72;
    expect(VARIANTS.map((v) => tipOffset(v, w, h))).toEqual([
      { x: -16, y: 1 }, { x: 1, y: -17 }, { x: w - 1, y: -16 },
      { x: w + 17, y: 1 }, { x: w + 18, y: h }, { x: w, y: h + 17 },
      { x: 0, y: h + 18 }, { x: -17, y: h },
    ]);
  });

  it("anchors the tip 10px in from the target's right and bottom", () => {
    const p = place(at(100, 100));
    expect(p).toEqual({ variant: "left-top", left: 130 + 16, top: 110 - 1,
                        clip: 0 });
  });

  it("flips near the edges, moving the tip across the target", () => {
    expect(place(at(560, 100)).variant).toBe("right-top");
    expect(place(at(560, 440)).variant).toBe("right-bottom");
    expect(place(at(20, 440)).variant).toBe("left-bottom");
    const p = place(at(560, 100));
    // The tip moved to 10px in from the target's left.
    const tip = tipOffset("right-top", 121, 72);
    expect(p.left + tip.x).toBe(570);
  });

  it("keeps clear of a menu bar's rectangle only", () => {
    const bar = { left: 0, top: 0, right: 640, bottom: 20 };
    // Just under the bar, a balloon above the target fits the screen
    // but would cover the bar.
    const target = at(100, 95);
    expect(placeBalloon(121, 72, "bottom-left",
                        (v) => anchorTip(target, v, { x: 10, y: 10 }),
                        screen, []).variant).toBe("bottom-left");
    expect(placeBalloon(121, 72, "bottom-left",
                        (v) => anchorTip(target, v, { x: 10, y: 10 }),
                        screen, [bar]).variant).not.toMatch(/^bottom/);
    // A bar elsewhere doesn't push balloons below its bottom edge.
    const low = { left: 0, top: 400, right: 200, bottom: 420 };
    expect(place(at(300, 100), [low]).variant).toBe("left-top");
  });

  it("clamps into bounds and clips when nothing fits", () => {
    const small: Rect = { left: 0, top: 0, right: 200, bottom: 100 };
    const r = at(80, 40);
    const p = placeBalloon(121, 120, "left-top",
                           (v) => anchorTip(r, v, { x: 10, y: 10 }), small);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.clip).toBeGreaterThan(0);
  });
});

// ---- the DOM side ---------------------------------------------------------
// happy-dom lays nothing out and hit-tests nothing: targets get stubbed
// rectangles and document.elementFromPoint a stub. What layout decides
// (rich content's height, the real hit test, canvas measuring of
// fallback glyphs) is checked in a real browser instead (see the
// README's note on verification).

function rect(el: Element, x: number, y: number, w: number, h: number): void {
  el.getBoundingClientRect = () => new DOMRect(x, y, w, h);
  el.getClientRects = () => [new DOMRect(x, y, w, h)] as unknown as DOMRectList;
}

const pointer = (type: string, target: EventTarget, x: number, y: number,
                 pointerType = "mouse") =>
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerType, clientX: x, clientY: y, pointerId: 1,
  }));

let hit: Element | null = null;
let handles: OsmiumBalloon[] = [];
const attach: typeof attachBalloon = (t, o) => {
  const b = attachBalloon(t, o);
  handles.push(b);
  return b;
};

function target(tag = "button", x = 100, y = 100): HTMLElement {
  const t = document.createElement(tag);
  document.body.append(t);
  rect(t, x, y, 60, 20);
  return t;
}

/** The pointer arrives on `t` at (x, y) and stays. */
function arrive(t: Element, x = 110, y = 110): void {
  hit = t;
  pointer("pointerover", t, x, y);
  pointer("pointermove", t, x, y);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.textContent = "";
  document.documentElement.className = "";
  hit = null;
  document.elementFromPoint = () => hit;
});

afterEach(() => {
  for (const b of handles) b.detach();
  handles = [];
  setBalloonHelp("hidden");
  vi.useRealTimers();
});

describe("Balloon Help state", () => {
  it("starts hidden and notifies once per change", () => {
    expect(balloonHelp()).toBe("hidden");
    const seen: string[] = [];
    const off = onBalloonHelpChange((s) => seen.push(s));
    setBalloonHelp("shown");
    setBalloonHelp("shown");
    setBalloonHelp("hidden");
    off();
    setBalloonHelp("shown");
    expect(seen).toEqual(["shown", "hidden"]);
  });

  it("titles and toggles the Help menu item", () => {
    expect(balloonMenuItem().title).toBe("Show Balloons");
    balloonMenuItem().action!();
    expect(balloonHelp()).toBe("shown");
    expect(balloonMenuItem().title).toBe("Hide Balloons");
    balloonMenuItem().action!();
    expect(balloonHelp()).toBe("hidden");
  });

  it("runs every listener even when one throws, reporting it after", () => {
    const later: (() => void)[] = [];
    const spy = vi.spyOn(globalThis, "queueMicrotask")
      .mockImplementation((f) => { later.push(f); });
    const seen: string[] = [];
    const offs = [
      onBalloonHelpChange(() => { throw new Error("boom"); }),
      onBalloonHelpChange((s) => seen.push(s)),
    ];
    setBalloonHelp("shown");
    spy.mockRestore();
    offs.forEach((f) => f());
    expect(seen).toEqual(["shown"]);
    expect(later).toHaveLength(1);
    expect(later[0]!).toThrow("boom");
  });
});

describe("attachBalloon", () => {
  it("describes the target with a hidden tooltip, until detached", () => {
    const t = target();
    t.setAttribute("aria-describedby", "note");
    const b = attach(t, { content: "Beep button\n\nPlays the alert sound." });
    expect(b.element.getAttribute("role")).toBe("tooltip");
    expect(b.element.hidden).toBe(true);
    expect(b.element.parentElement).toBe(document.body);
    expect(t.getAttribute("aria-describedby")).toBe(`note ${b.element.id}`);
    expect(b.element.textContent).toBe("Beep button\n\nPlays the alert sound.");
    b.detach();
    expect(t.getAttribute("aria-describedby")).toBe("note");
    expect(b.element.isConnected).toBe(false);
    const u = target();
    attach(u, { content: "x" }).detach();
    expect(u.hasAttribute("aria-describedby")).toBe(false);
  });

  it("refuses a second balloon and bad options", () => {
    const t = target();
    attach(t, { content: "x" });
    expect(() => attachBalloon(t, { content: "y" })).toThrow(/already/);
    const u = target();
    expect(() => attachBalloon(u, { content: "x", delay: -1 }))
      .toThrow(RangeError);
    expect(() => attachBalloon(u, { content: "x", maxWidth: 0 }))
      .toThrow(RangeError);
    expect(() => attachBalloon(u, {
      content: "x", variant: "middle" as BalloonVariant,
    })).toThrow(TypeError);
    for (const anchor of [{ x: NaN, y: 10 }, { x: 10, y: -1 },
                          { x: Infinity, y: 0 }])
      expect(() => attachBalloon(u, { content: "x", anchor }))
        .toThrow(RangeError);
    expect(u.hasAttribute("aria-describedby")).toBe(false);
  });

  it("draws the lines the model broke, at the model's width", () => {
    const t = target();
    const b = attach(t, { content: "Close box\n\nTo close this window, click here." });
    b.show();
    expect(b.open).toBe(true);
    expect(b.element.hidden).toBe(false);
    const text = b.element.querySelector(".osm-balloon-text")!;
    expect(text.classList.contains("osm-balloon-plain")).toBe(true);
    expect(text.textContent)
      .toBe("Close box\n\nTo close this\nwindow, click here.");
    expect(b.element.style.width).toBe(`${97 + 25}px`);
    expect(b.element.classList.contains("osm-balloon-left-top")).toBe(true);
    // Tip 10px in from the target's right and bottom (160, 120).
    expect(b.element.style.left).toBe(`${150 + 16}px`);
    expect(b.element.style.top).toBe(`${110 - 1}px`);
    b.hide();
    expect(b.open).toBe(false);
  });

  it("copies Node content on each showing, without its ids", () => {
    const frag = document.createDocumentFragment();
    const p = document.createElement("p");
    p.id = "help-title";
    p.innerHTML = "<strong id='x'>Wake</strong>";
    frag.append(p);
    const b = attach(target(), { content: frag });
    b.show();
    b.hide();
    b.show();
    expect(frag.firstChild).toBe(p);
    expect(b.element.querySelectorAll("[id]")).toHaveLength(0);
    expect(b.element.querySelector("strong")!.textContent).toBe("Wake");
    expect(document.querySelectorAll("#help-title")).toHaveLength(0);
  });

  it("calls a content function each time it opens", () => {
    const t = target() as HTMLButtonElement;
    let calls = 0;
    const b = attach(t, { content: () => {
      calls++;
      return t.disabled ? "Dimmed" : "Enabled";
    } });
    const before = calls;
    t.disabled = true;
    b.show();
    expect(b.element.textContent).toBe("Dimmed");
    b.hide();
    b.show();
    expect(calls).toBe(before + 2);
  });

  it("keeps a content function's description current while closed", async () => {
    // Balloon Help hidden and nothing tracking: the description still
    // follows the target, for screen readers.
    const t = target() as HTMLButtonElement;
    t.disabled = true;
    const b = attach(t, { content: () => t.disabled
      ? "Wake\n\nNot available during a scan."
      : "Wake\n\nSends a wake-up packet." });
    expect(b.element.textContent).toBe("Wake\n\nNot available during a scan.");
    t.disabled = false;
    await Promise.resolve(); // MutationObserver records are delivered
    expect(b.element.textContent).toBe("Wake\n\nSends a wake-up packet.");
    // A property change with no attribute behind it: caught on focus.
    let label = "first";
    const u = target();
    const c = attach(u, { content: () => label });
    label = "second";
    u.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(c.element.textContent).toBe("second");
    // Stops once detached.
    c.detach();
    label = "third";
    u.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(c.element.textContent).toBe("second");
  });

  it("re-lays out an open balloon after the click it invites", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    document.body.append(box);
    rect(box, 100, 100, 12, 12);
    const b = attach(box, { content: () => box.checked
      ? "Checked. To turn sound off, click here."
      : "Unchecked. To turn sound on, click here." });
    b.show();
    box.click(); // fires input and change
    expect(b.open).toBe(true);
    expect(b.element.textContent).toContain("Unchecked");
  });

  it("doesn't open empty messages or off-screen targets", () => {
    const b = attach(target(), { content: "  " });
    b.show();
    expect(b.open).toBe(false);
    const far = target("button", -500, -500);
    const c = attach(far, { content: "Help" });
    c.show();
    expect(c.open).toBe(false);
  });

  it("detaches a target that left the page when it next opens", () => {
    const t = target();
    const b = attach(t, { content: "Help" });
    t.remove();
    b.show();
    expect(b.open).toBe(false);
    expect(b.element.isConnected).toBe(false);
    expect(() => attach(t, { content: "again" })).not.toThrow();
  });

  it("re-lays out an open balloon when its content changes", () => {
    const b = attach(target(), { content: "Help" });
    b.show();
    b.setContent("Close box\n\nTo close this window, click here.");
    expect(b.open).toBe(true);
    expect(b.element.style.width).toBe(`${97 + 25}px`);
  });
});

describe("pointer tracking", () => {
  it("does nothing while Balloon Help is hidden", () => {
    const t = target();
    const b = attach(t, { content: "Help" });
    arrive(t);
    expect(vi.getTimerCount()).toBe(0); // no tracking at all
    vi.advanceTimersByTime(1000);
    expect(b.open).toBe(false);
  });

  it("opens after the pointer rests a tenth of a second", () => {
    setBalloonHelp("shown");
    const t = target();
    const b = attach(t, { content: "Help" });
    arrive(t);
    vi.advanceTimersByTime(BALLOON_REST_MS - 1);
    expect(b.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(b.open).toBe(true);
  });

  it("restarts the rest on every move, and then stays put", () => {
    setBalloonHelp("shown");
    const t = target();
    const b = attach(t, { content: "Help", tip: "pointer" });
    arrive(t);
    vi.advanceTimersByTime(50);
    pointer("pointermove", t, 112, 111);
    vi.advanceTimersByTime(99);
    expect(b.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(b.open).toBe(true);
    // The tip one pixel right of and below the rest point.
    const tip = tipOffset("left-top", 1, 1); // the same at any size
    const { left, top } = b.element.style;
    expect([parseInt(left) + tip.x, parseInt(top) + tip.y]).toEqual([113, 112]);
    pointer("pointermove", t, 140, 115);
    vi.advanceTimersByTime(500);
    expect(b.element.style.left).toBe(left);
    expect(b.element.style.top).toBe(top);
  });

  it("closes the moment the pointer leaves the target", () => {
    setBalloonHelp("shown");
    const t = target();
    const b = attach(t, { content: "Help" });
    arrive(t);
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
    hit = document.body;
    pointer("pointerover", document.body, 300, 300);
    pointer("pointermove", document.body, 300, 300);
    expect(b.open).toBe(false);
  });

  it("stays open over its own balloon while still inside the target", () => {
    setBalloonHelp("shown");
    const t = target("div", 0, 0);
    rect(t, 0, 0, 400, 300);
    const b = attach(t, { content: "Help" });
    arrive(t, 50, 50);
    vi.advanceTimersByTime(100);
    // The balloon ignores the pointer, so a move over it is a move over
    // whatever is underneath: here, the target.
    pointer("pointermove", t, 395, 295);
    expect(b.open).toBe(true);
  });

  it("opens 'hover' balloons after their delay with Balloon Help hidden", () => {
    const t = target();
    const b = attach(t, { content: "Copy this value", trigger: "hover",
                          delay: 250 });
    arrive(t);
    vi.advanceTimersByTime(249);
    expect(b.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(b.open).toBe(true);
    // Hiding Balloon Help leaves a hovered "hover" balloon open.
    setBalloonHelp("shown");
    setBalloonHelp("hidden");
    expect(b.open).toBe(true);
  });

  it("closes 'balloon-help' balloons when Balloon Help is hidden", () => {
    setBalloonHelp("shown");
    const t = target();
    const b = attach(t, { content: "Help" });
    arrive(t);
    vi.advanceTimersByTime(100);
    setBalloonHelp("hidden");
    expect(b.open).toBe(false);
  });

  it("opens on a disabled button", () => {
    setBalloonHelp("shown");
    const t = target() as HTMLButtonElement;
    t.disabled = true;
    const b = attach(t, { content: () => "Wake\n\nNot available right now." });
    arrive(t);
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
  });

  it("opens when tracking starts with the pointer already on the target", () => {
    const t = target();
    const b = attach(t, { content: "Help" });
    arrive(t); // not tracked: Balloon Help is hidden
    setBalloonHelp("shown");
    pointer("pointermove", t, 112, 111); // no pointerover this time
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
  });

  it("stays put when the pointer crosses onto a child of the target", () => {
    setBalloonHelp("shown");
    const t = target();
    const child = document.createElement("span");
    t.append(child);
    rect(child, 130, 105, 20, 10);
    let calls = 0;
    const b = attach(t, { tip: "pointer", content: () => `Help ${++calls}` });
    arrive(t);
    vi.advanceTimersByTime(100);
    const { left, top } = b.element.style;
    const opened = calls;
    hit = child;
    pointer("pointerover", child, 140, 110);
    pointer("pointermove", child, 140, 110);
    vi.advanceTimersByTime(500);
    expect(b.open).toBe(true);
    expect([b.element.style.left, b.element.style.top]).toEqual([left, top]);
    expect(calls).toBe(opened);
  });

  it("counts a control's <label> as part of the control", () => {
    setBalloonHelp("shown");
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    label.append(box, "Sound");
    document.body.append(label);
    rect(label, 100, 100, 80, 16);
    rect(box, 100, 102, 12, 12);
    const b = attach(box, { content: "Sound checkbox" });
    expect(box.getAttribute("aria-describedby")).toBe(b.element.id);
    arrive(label, 150, 108); // over the title, not the box
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
    pointer("pointermove", label, 170, 110); // still on the label
    expect(b.open).toBe(true);
    hit = document.body;
    pointer("pointerover", document.body, 300, 300);
    pointer("pointermove", document.body, 300, 300);
    expect(b.open).toBe(false);
  });

  it("prefers the innermost target and ignores touch", () => {
    setBalloonHelp("shown");
    const outer = target("div");
    const inner = document.createElement("span");
    outer.append(inner);
    rect(inner, 100, 100, 20, 20);
    const a = attach(outer, { content: "Outer" });
    const b = attach(inner, { content: "Inner" });
    hit = inner;
    pointer("pointerover", inner, 105, 105, "touch");
    vi.advanceTimersByTime(500);
    expect(a.open || b.open).toBe(false);
    arrive(inner, 105, 105);
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
    expect(a.open).toBe(false);
  });

  it("closes when something around the target scrolls, not elsewhere", () => {
    setBalloonHelp("shown");
    const scroller = document.createElement("div");
    const other = document.createElement("div");
    document.body.append(scroller, other);
    const t = target();
    scroller.append(t);
    const b = attach(t, { content: "Help" });
    arrive(t);
    vi.advanceTimersByTime(100);
    other.dispatchEvent(new Event("scroll"));
    expect(b.open).toBe(true);
    scroller.dispatchEvent(new Event("scroll"));
    expect(b.open).toBe(false);
    arrive(t);
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event("blur"));
    expect(b.open).toBe(false);
  });

  it("keeps one balloon open at a time", () => {
    const a = attach(target(), { content: "A" });
    const b = attach(target("button", 300, 100), { content: "B" });
    a.show();
    b.show();
    expect(a.open).toBe(false);
    expect(b.open).toBe(true);
  });
});

describe("keyboard", () => {
  const focusOn = (el: HTMLElement) => {
    el.focus();
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  };

  it("opens on focus only while the keyboard is driving", () => {
    setBalloonHelp("shown");
    const t = target();
    const b = attach(t, { content: "Help" });
    focusOn(t);
    vi.advanceTimersByTime(500);
    expect(b.open).toBe(false);
    t.blur();
    document.documentElement.classList.add("osm-kbd");
    focusOn(t);
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
    // The pointer moving elsewhere leaves a focus balloon alone.
    pointer("pointermove", document.body, 400, 400);
    expect(b.open).toBe(true);
    t.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(b.open).toBe(false);
  });

  it("closes on Escape without cancelling the dialog, then lets it cancel", () => {
    setBalloonHelp("shown");
    document.documentElement.classList.add("osm-kbd");
    // A checkbox: bindDialogKeys ignores keys typed on buttons anyway.
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    label.append(box);
    document.body.append(label);
    rect(label, 100, 100, 80, 16);
    const cancelBtn = document.createElement("button");
    document.body.append(cancelBtn);
    rect(cancelBtn, 300, 300, 60, 20);
    let cancelled = 0;
    bindDialogKeys(null, cancelBtn, { cancel: () => cancelled++ });
    const b = attach(label, { content: "Sound\n\nPlays sounds." });
    let seenByOthers = 0;
    const later = () => seenByOthers++;
    window.addEventListener("keydown", later);

    focusOn(box);
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
    const esc = () => {
      const e = new KeyboardEvent("keydown", {
        key: "Escape", bubbles: true, cancelable: true,
      });
      box.dispatchEvent(e);
      return e;
    };
    expect(esc().defaultPrevented).toBe(true);
    expect(b.open).toBe(false);
    expect(seenByOthers).toBe(1); // not stopped
    vi.advanceTimersByTime(200);
    expect(cancelled).toBe(0);
    // Dismissed: the same target doesn't reopen until focus moves on.
    focusOn(box);
    vi.advanceTimersByTime(200);
    expect(b.open).toBe(false);
    expect(esc().defaultPrevented).toBe(true); // bindDialogKeys flashes Cancel
    vi.advanceTimersByTime(200);
    expect(cancelled).toBe(1);
    window.removeEventListener("keydown", later);
  });

  it("leaves Escape to a text field elsewhere, and to an IME", () => {
    const field = document.createElement("input");
    field.type = "search";
    document.body.append(field);
    const t = target();
    const b = attach(t, { content: "Copy", trigger: "hover", delay: 100 });
    arrive(t);
    vi.advanceTimersByTime(100);
    expect(b.open).toBe(true);
    const esc = (init: KeyboardEventInit = {}) => {
      const e = new KeyboardEvent("keydown", {
        key: "Escape", bubbles: true, cancelable: true, ...init,
      });
      field.dispatchEvent(e);
      return e;
    };
    expect(esc({ isComposing: true }).defaultPrevented).toBe(false);
    expect(b.open).toBe(true);
    // Closes the balloon, but the field still clears.
    expect(esc().defaultPrevented).toBe(false);
    expect(b.open).toBe(false);
  });
});

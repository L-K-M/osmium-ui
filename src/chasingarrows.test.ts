// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARROWS_FRAME_MS, mountChasingArrows } from "./chasingarrows.js";
import { CONTROL_SPRITES } from "./controlsprites.js";
import { spriteSvg } from "./sprites.js";

/** The eight frame images of Mac OS 8.0's Appearance Extension CDEF 7
 * "Chasing Arrows", 32 bytes each, copied from resource bytes 0x778,
 * 0x7b8, ... (every 64 bytes; the 32 after each image repeat it). */
const CDEF7_FRAMES =
  "0100018003c00d801100100820042004200420041008008801b003c001800080" +
  "0000004003e00cf0108010002000200420040004000801080f3007c002000000" +
  "0000000003c80c3810381008200000000000000410081c081c3013c000000000" +
  "0000000003c00c30100a000e001c000420003800700050080c3003c000000000" +
  "0000000003c00430000800082004701ff80e2004100010000c2003c000000000" +
  "0000000001c000301008300870043804201c200e100c10080c00038000000000" +
  "0000000000403c30180818082004200420042004101810180c3c020000000000" +
  "00000c0007000e1012081008200420042004200410081048087000e000300000";

/** Frame k's rows from the CDEF bytes: set bits `ink`, clear bits '.'. */
function cdefFrame(k: number, ink: string): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    const at = (k * 32 + y * 2) * 2;
    const word = parseInt(CDEF7_FRAMES.slice(at, at + 4), 16);
    let row = "";
    for (let x = 0; x < 16; x++) row += (word >> (15 - x)) & 1 ? ink : ".";
    rows.push(row);
  }
  return rows;
}

const sheetFrame = (sheet: readonly string[], k: number): string[] =>
  sheet.map((r) => r.slice(16 * k, 16 * k + 16));

describe("chasing arrows sprites", () => {
  it("are CDEF 7's eight frames side by side, black and 88", () => {
    const active = CONTROL_SPRITES["arrows"]!;
    const inactive = CONTROL_SPRITES["arrows-inactive"]!;
    for (const sheet of [active, inactive]) {
      expect(sheet.length).toBe(16);
      expect(sheet.every((r) => r.length === 128)).toBe(true);
      expect(() => spriteSvg(sheet)).not.toThrow();
    }
    for (let k = 0; k < 8; k++) {
      expect(sheetFrame(active, k), `frame ${k}`).toEqual(cdefFrame(k, "0"));
      expect(sheetFrame(inactive, k), `frame ${k}`)
        .toEqual(cdefFrame(k, "8"));
    }
  });
});

describe("chasing arrows stylesheet", () => {
  const css = readFileSync(join(__dirname, "..", "osmium.css"), "utf8");

  it("shows frame k at x = -16k, in 88 when inactive", () => {
    expect(css).toMatch(/\.osm-arrows\[data-frame\] \{\s*background: var\(--osm-sprite-arrows\) no-repeat;/);
    expect(css).toMatch(/\.osm-inactive \.osm-arrows\[data-frame\] \{\s*background-image: var\(--osm-sprite-arrows-inactive\);/);
    for (let k = 1; k < 8; k++) {
      expect(css).toContain(
        `.osm-arrows[data-frame="${k}"] { background-position: -${16 * k}px 0; }`);
    }
  });

  it("puts arrows in a placard where the Finder puts them", () => {
    expect(css).toContain(
      ".osm-placard > .osm-arrows { position: absolute; left: 4px; top: 2px; }");
  });
});

/** A matchMedia stand-in for prefers-reduced-motion. */
function fakeMotion(reduce: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: reduce,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  };
  vi.stubGlobal("matchMedia", (q: string) => {
    expect(q).toBe("(prefers-reduced-motion: reduce)");
    return mql;
  });
  return {
    listeners,
    set(on: boolean) {
      mql.matches = on;
      for (const f of [...listeners]) f();
    },
  };
}

describe("mountChasingArrows", () => {
  let span: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    span = document.createElement("span");
    document.body.append(span);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  const frame = () => span.dataset["frame"];

  it("steps every 6 ticks, the Finder's pace, in whole milliseconds", () => {
    // 6 ticks are 99.75 ms; browsers would truncate that to 99.
    expect(ARROWS_FRAME_MS).toBe(100);
  });

  it("marks the span up and starts stopped and blank", () => {
    fakeMotion(false);
    const a = mountChasingArrows(span);
    expect(span.classList.contains("osm-arrows")).toBe(true);
    expect(span.getAttribute("role")).toBe("img");
    expect(span.getAttribute("aria-label")).toBe("Working");
    expect(a.running).toBe(false);
    expect(frame()).toBeUndefined();
    expect(span.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps a role and label already given", () => {
    fakeMotion(false);
    span.setAttribute("role", "presentation");
    span.setAttribute("aria-label", "Calculating");
    mountChasingArrows(span);
    expect(span.getAttribute("role")).toBe("presentation");
    expect(span.getAttribute("aria-label")).toBe("Calculating");
  });

  it("turns through frames 0 to 7 and round again", () => {
    fakeMotion(false);
    const a = mountChasingArrows(span);
    a.start();
    expect(a.running).toBe(true);
    expect(span.hasAttribute("aria-hidden")).toBe(false);
    const seen = [frame()];
    for (let i = 0; i < 9; i++) {
      vi.advanceTimersByTime(ARROWS_FRAME_MS);
      seen.push(frame());
    }
    expect(seen).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "0", "1"]);
  });

  it("holds each frame for the whole interval", () => {
    fakeMotion(false);
    mountChasingArrows(span).start();
    vi.advanceTimersByTime(ARROWS_FRAME_MS - 1);
    expect(frame()).toBe("0");
    vi.advanceTimersByTime(1);
    expect(frame()).toBe("1");
  });

  it("goes blank on stop and starts again from frame 0", () => {
    fakeMotion(false);
    const a = mountChasingArrows(span);
    a.start();
    vi.advanceTimersByTime(3 * ARROWS_FRAME_MS);
    expect(frame()).toBe("3");
    a.stop();
    expect(a.running).toBe(false);
    expect(frame()).toBeUndefined();
    expect(span.getAttribute("aria-hidden")).toBe("true");
    vi.advanceTimersByTime(10 * ARROWS_FRAME_MS);
    expect(frame()).toBeUndefined();
    a.start();
    expect(frame()).toBe("0");
  });

  it("ignores start while running and stop while stopped", () => {
    fakeMotion(false);
    const a = mountChasingArrows(span);
    a.stop();
    expect(frame()).toBeUndefined();
    a.start();
    vi.advanceTimersByTime(2 * ARROWS_FRAME_MS);
    a.start();
    expect(frame()).toBe("2");
    vi.advanceTimersByTime(ARROWS_FRAME_MS);
    expect(frame()).toBe("3");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("holds frame 0 under prefers-reduced-motion", () => {
    fakeMotion(true);
    const a = mountChasingArrows(span);
    a.start();
    expect(a.running).toBe(true);
    expect(frame()).toBe("0");
    vi.advanceTimersByTime(20 * ARROWS_FRAME_MS);
    expect(frame()).toBe("0");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("follows prefers-reduced-motion changes while running", () => {
    const motion = fakeMotion(false);
    const a = mountChasingArrows(span);
    a.start();
    vi.advanceTimersByTime(5 * ARROWS_FRAME_MS);
    expect(frame()).toBe("5");
    motion.set(true);
    expect(frame()).toBe("0");
    vi.advanceTimersByTime(5 * ARROWS_FRAME_MS);
    expect(frame()).toBe("0");
    motion.set(false);
    vi.advanceTimersByTime(ARROWS_FRAME_MS);
    expect(frame()).toBe("1");
    // A change while stopped leaves the arrows blank.
    a.stop();
    motion.set(true);
    motion.set(false);
    expect(frame()).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("works without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const a = mountChasingArrows(span);
    a.start();
    vi.advanceTimersByTime(ARROWS_FRAME_MS);
    expect(frame()).toBe("1");
  });

  it("refuses a second mount until destroyed", () => {
    fakeMotion(false);
    const a = mountChasingArrows(span);
    expect(() => mountChasingArrows(span)).toThrow(/has chasing arrows/);
    a.destroy();
    expect(() => mountChasingArrows(span)).not.toThrow();
  });

  it("destroy stops, drops the listener and refuses to start", () => {
    const motion = fakeMotion(false);
    const a = mountChasingArrows(span);
    a.start();
    expect(motion.listeners.size).toBe(1);
    a.destroy();
    expect(a.running).toBe(false);
    expect(frame()).toBeUndefined();
    expect(motion.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => a.start()).toThrow(/destroyed/);
    a.stop();
    a.destroy();
    expect(span.classList.contains("osm-arrows")).toBe(true);
    expect(span.getAttribute("aria-label")).toBe("Working");
    expect(span.getAttribute("aria-hidden")).toBe("true");
  });
});

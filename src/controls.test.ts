import { describe, expect, it } from "vitest";
import {
  MENU_SEPARATOR, centeredOffset, entryTop, menuTop, thumbStart,
} from "./controls.js";

describe("centeredOffset", () => {
  // [width, title advance, title x] from Mac OS 8.0: Open dialog push
  // buttons ("Desktop", "Cancel", 80px) and Monitors & Sound's bevel
  // button captions ("Monitor", "Sound" under 40px buttons).
  it("places push-button titles the Control Manager way", () => {
    expect(centeredOffset(80, 51)).toBe(14);
    expect(centeredOffset(80, 42)).toBe(19);
  });
  it("rounds bevel button captions up", () => {
    expect(centeredOffset(40, 35, true)).toBe(3);
    expect(centeredOffset(40, 26, true)).toBe(7);
  });
  it("never starts before the box", () => {
    expect(centeredOffset(20, 60)).toBe(0);
  });
});

describe("thumbStart", () => {
  // The thumb's black top line sits on the up arrow's separator (row
  // 15) at the top, and its bottom line on the down arrow's separator
  // (row h - 16) at the bottom: the Keyboard panel's 66px list bar.
  it("travels between the arrows' separators", () => {
    expect(thumbStart(66, 0)).toBe(15);
    expect(thumbStart(66, 1)).toBe(66 - 16 - 16);
    expect(thumbStart(66, 7 / 19)).toBe(22);
  });
  it("clamps out-of-range fractions", () => {
    expect(thumbStart(100, -1)).toBe(15);
    expect(thumbStart(100, 2)).toBe(thumbStart(100, 1));
  });
});

describe("menuTop", () => {
  it("puts the current item over the button", () => {
    expect(menuTop(123, 0, 1 * 16 + 2, 600)).toBe(123);
    expect(menuTop(200, 3 * 16, 7 * 16 + 2, 600)).toBe(200 - 3 * 16);
  });
  it("keeps the menu on screen", () => {
    expect(menuTop(20, 5 * 16, 7 * 16 + 2, 600)).toBe(0);
    expect(menuTop(590, 0, 7 * 16 + 2, 600)).toBe(600 - (7 * 16 + 2) - 2);
  });
  it("lines up an item below a separator", () => {
    // 16 + 6 + 16 + 16, and the 2px outline.
    const entries = ["About", MENU_SEPARATOR, "Chooser", "Key Caps"];
    const h = entryTop(entries, entries.length) + 2;
    expect(menuTop(200, entryTop(entries, 2), h, 600)).toBe(200 - 22);
    expect(menuTop(590, entryTop(entries, 0), h, 600)).toBe(600 - 56 - 2);
  });
});

describe("entryTop", () => {
  // Items are 16px, separators 6px, as in Mac OS 8.0's Apple menu.
  const entries = ["About", MENU_SEPARATOR, "Chooser", "Key Caps"];
  it("adds up the entries above", () => {
    expect(entryTop(entries, 0)).toBe(0);
    expect(entryTop(entries, 2)).toBe(22);
    expect(entryTop(entries, 3)).toBe(38);
  });
  it("stops at the end", () => {
    expect(entryTop(entries, 99)).toBe(54);
  });
});

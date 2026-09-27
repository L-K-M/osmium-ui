// @vitest-environment happy-dom
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AppearanceModule from "./appearance.js";
import type * as InstallModule from "./install.js";
import { allSprites, spriteSvg, spriteUrl } from "./sprites.js";

// Apple's tables as the research transcribed them (data/ramps.json:
// Mac OS 8.1 Appearance 'clut' 200-218; Mac OS 8.6 Apple platinum
// 'clut' 200-220 in 'tvar' 128 order), A0 to A7.
const ACCENTS_80: readonly [string, string][] = [
  ["Aquamarine", "ccffff 66ffcc 00cc99 009999 006666 003333 002200 000000"],
  ["Copper", "ffffcc ffcc99 ff9966 cc6633 993300 660000 220000 000000"],
  ["Crimson", "ffcccc ff9999 ff6666 cc3333 990000 770000 440000 000000"],
  ["Emerald", "ccffcc 66ff99 33cc66 339966 006633 004400 002200 000000"],
  ["French Blue", "eeeeee ccccff 9999cc 666699 333366 000022 000011 000000"],
  ["Gold", "ffff99 ffff00 cccc00 999900 666600 333300 111111 000000"],
  ["Ivy", "ccffcc 99cc99 669966 336633 003300 002200 001100 000000"],
  ["Lavender", "eeeeee ccccff 9999ff 6666cc 333399 000088 000055 000000"],
  ["Lime", "ffffcc ccff66 99cc66 669900 336600 004400 003300 000000"],
  ["Magenta", "ffccff ff99ff cc66cc 993399 660066 330033 220000 000000"],
  ["Nutmeg", "ffffcc ffcc99 cc9966 996633 663300 220000 110000 000000"],
  ["Olive", "ffffcc cccc99 999966 666633 333300 002200 001100 000000"],
  ["Plum", "ffccff cc99cc 996699 663366 330033 220000 110000 000000"],
  ["Rose", "eeeeee ffcccc cc9999 996666 663333 440000 220000 000000"],
  ["Sapphire", "eeeeee 99ccff 6699ff 3366ff 0033cc 000099 000055 000000"],
  ["Silver", "eeeeee cccccc aaaaaa 777777 555555 333333 222222 000000"],
  ["Teal", "eeeeee 99cccc 669999 336666 003333 002200 001100 000000"],
  ["Turquoise", "ccffff 66ffff 00ccff 0099cc 006699 003366 000022 000000"],
];
const VARIATIONS_85: readonly [string, string][] = [
  ["Azul", "afc9ff 93b6ea 7599d0 6686b7 4a6999 30467d 293c6a 000000"],
  ["Bondi", "c8f8e9 67dacd 5ab9ad 308f91 0d716a 00454b 003333 000000"],
  ["Copper", "ffffcc ffcc99 ff9966 cc6633 993300 660000 220000 000000"],
  ["Crimson", "ffcccc ff9999 ff6666 cc3333 990000 770000 440000 000000"],
  ["Emerald", "ccffcc 66ff99 33cc66 339966 006633 004400 002200 000000"],
  ["French Blue", "ccccff b0b0ea 8585bc 666699 51517c 333366 26264d 000000"],
  ["Gold", "ffff99 ffff00 cccc00 999900 666600 333300 111111 000000"],
  ["Ivy", "ccffcc 99cc99 669966 336633 003300 002200 001100 000000"],
  ["Lavender", "eeeeee ccccff 9999ff 6666cc 333399 000088 000055 000000"],
  ["Magenta", "ffccff ff99ff cc66cc 993399 660066 330033 220000 000000"],
  ["Nutmeg", "fed9b3 ecb277 cc9966 996633 663300 451f18 220000 000000"],
  ["Pistachio", "edffb7 dbfd75 cded6d b5e040 99cc3e 669900 336600 000000"],
  ["Plum", "ffccff dea4de be80be 996699 663366 4a0a4a 330033 000000"],
  ["Poppy", "ffc05c fe9c02 fe8502 f46f19 fe4200 e14200 a43000 000000"],
  ["Rose", "ffdcdc efc8c8 cc9999 996666 794242 541f1f 350000 000000"],
  ["Sapphire", "eeeeee 99ccff 6699ff 3366ff 0033cc 000099 000055 000000"],
  ["Silver", "eeeeee cccccc aaaaaa 777777 555555 333333 222222 000000"],
  ["Sunny", "fffee6 fef491 f5db61 e6c144 ccab3b aa8f35 887126 000000"],
  ["Teal", "b9eeee 99cccc 669999 477979 336666 074c4c 003333 000000"],
  ["Turquoise", "ccffff 66ffff 00ccff 0099cc 006699 003366 000022 000000"],
];
// MENU / 'rgb ' -4048 (8.0/8.1) and 'hlit' 3000 (8.5/8.6).
const HIGHLIGHTS_80: readonly [string, string][] = [
  ["Purple", "#ccccff"], ["Yellow", "#ffff00"], ["Green", "#99ff00"],
  ["Turquoise", "#33ffff"], ["Red", "#ee0000"], ["Pink", "#ff99ff"],
  ["Blue", "#99ccff"], ["Gray", "#bbbbbb"],
];
const HIGHLIGHTS_85: readonly [string, string][] = [
  ["Azul", "#99ccff"], ["Bondi", "#99ffff"], ["Green", "#ccff66"],
  ["Plum", "#ffccff"], ["Poppy", "#ffcc66"], ["Purple", "#ccccff"],
  ["Teal", "#ccffff"], ["Yellow", "#ffff99"], ["Gray", "#cccccc"],
];

const ACCENT_SPRITES = [
  "fill", "fill-left", "fill-right", "slider-thumb", "slider-thumb-pressed",
  "scroll-thumb", "scroll-thumb-pressed", "scroll-hthumb",
  "scroll-hthumb-pressed",
];

const ramp = (s: string) => s.split(" ").map((c) => "#" + c);
const prop = (name: string) =>
  document.documentElement.style.getPropertyValue(name);
const accentProps = () =>
  Array.from({ length: 8 }, (_, i) => prop(`--osm-accent-${i}`));
const spriteRows = (name: string) =>
  allSprites().find(([n]) => n === name)![1];

/** WCAG 2 relative luminance and contrast, computed independently of
 * appearance.ts. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Each test gets a fresh module (its state is the page's appearance and
// the follow-sprite registry) and a bare <html>.
let A: typeof AppearanceModule;
let I: typeof InstallModule;
beforeEach(async () => {
  vi.resetModules();
  document.documentElement.removeAttribute("style");
  document.head.innerHTML = "";
  A = await import("./appearance.js");
  I = await import("./install.js");
});

describe("Apple's tables", () => {
  it("carries every 8.0 accent and 8.5 variation verbatim", () => {
    for (const [name, colors] of ACCENTS_80) {
      A.setAppearance({ accent: { release: "8.0", name: name as never } });
      expect(accentProps(), name).toEqual(ramp(colors));
    }
    for (const [name, colors] of VARIATIONS_85) {
      A.setAppearance({ accent: { release: "8.5", name: name as never } });
      expect(accentProps(), name).toEqual(ramp(colors));
    }
  });

  it("lists the 8.5 menus in Apple's order", () => {
    expect(A.VARIATIONS_85).toEqual(VARIATIONS_85.map(([n]) => n));
    expect(A.VARIATIONS_85[8]).toBe("Lavender");
    expect(A.HIGHLIGHTS_85).toEqual(HIGHLIGHTS_85.map(([n]) => n));
    expect(Object.isFrozen(A.VARIATIONS_85)).toBe(true);
  });

  it("carries both highlight lists verbatim", () => {
    for (const [release, list] of [["8.0", HIGHLIGHTS_80],
                                   ["8.5", HIGHLIGHTS_85]] as const) {
      for (const [name, color] of list) {
        A.setAppearance({ highlight: { release, name } as never });
        expect(prop("--osm-highlight"), name).toBe(color);
        expect(prop("--osm-highlight-text"), name).toBe("#000000");
      }
    }
  });

  it("leaves out Black & White accents, whose tables are empty", () => {
    for (const release of ["8.0", "8.5"] as const)
      expect(() => A.setAppearance({
        accent: { release, name: "Black & White" } as never,
      })).toThrow(RangeError);
    // 8.5 dropped Lime; 8.0 had no Sunny.
    expect(() => A.setAppearance({
      accent: { release: "8.5", name: "Lime" as never },
    })).toThrow(/unknown Mac OS 8.5 variation "Lime"/);
    expect(() => A.setAppearance({
      accent: { release: "8.0", name: "Sunny" as never },
    })).toThrow(RangeError);
  });
});

describe("the default appearance", () => {
  it("is Lavender with the Purple highlight", () => {
    expect(A.getAppearance()).toEqual({
      accent: { release: "8.0", name: "Lavender" },
      highlight: { release: "8.0", name: "Purple" },
    });
  });

  it("matches osmium.css's :root", () => {
    const css = readFileSync(join(process.cwd(), "osmium.css"), "utf8");
    const root = css.slice(css.indexOf(":root {"), css.indexOf("\n}\n"));
    A.setAppearance(A.getAppearance());
    for (const name of [...Array.from({ length: 8 }, (_, i) =>
      `--osm-accent-${i}`), "--osm-highlight", "--osm-highlight-text",
                        "--osm-focus-ring"])
      expect(root, name).toContain(`${name}: ${prop(name)};`);
    expect(prop("--osm-highlight")).toBe("#ccccff");
    expect(prop("--osm-highlight-text")).toBe("#000000");
  });

  it("draws every built-in sprite byte for byte as before", () => {
    // SHA-256 of every built-in sprite's SVG, captured on main before
    // the accent keys w and h replaced gray e and white f.
    const all = allSprites().map(([n, r]) => n + "\n" + spriteSvg(r))
      .join("\n");
    expect(createHash("sha256").update(all).digest("hex")).toBe(
      "f84e839f62a575f967f7f46f180e7418df7895d21b02d7bb0beb2bd8c0aadf21");
  });

  it("redraws the accent sprites exactly as installOsmium draws them", () => {
    A.setAppearance({ accent: { release: "8.0", name: "Lavender" } });
    for (const name of ACCENT_SPRITES)
      expect(prop(`--osm-sprite-${name}`), name)
        .toBe(spriteUrl(spriteRows(name)));
  });
});

describe("setAppearance", () => {
  it("sets the accent's properties and redraws its sprites", () => {
    A.setAppearance({ accent: { release: "8.0", name: "Gold" } });
    expect(prop("--osm-accent-4")).toBe("#666600");
    // The highlight keeps its value.
    expect(prop("--osm-highlight")).toBe("#ccccff");
    for (const name of ACCENT_SPRITES) {
      const url = prop(`--osm-sprite-${name}`);
      expect(url, name).toMatch(/^url\("data:image\/svg\+xml,/);
      expect(url, name).not.toContain("9999ff");
    }
    // The thumb's face is Gold's A2, its gleam A0.
    const thumb = decodeURIComponent(prop("--osm-sprite-scroll-thumb"));
    expect(thumb).toContain('fill="#cccc00"');
    expect(thumb).toContain('fill="#ffff99"');
    expect(thumb).not.toContain("#eeeeee");
    // Icons keep their colors.
    expect(prop("--osm-sprite-alert-note")).toBe("");
  });

  it("draws the progress bar's center white for 8.0, A0 for 8.5", () => {
    const center = () =>
      decodeURIComponent(prop("--osm-sprite-fill")).match(
        /fill="(#[0-9a-f]{6})" d="M0 4h1v1H0z"/)?.[1];
    A.setAppearance({ accent: { release: "8.0", name: "Gold" } });
    expect(center()).toBe("#ffffff");
    A.setAppearance({ accent: { release: "8.5", name: "Sunny" } });
    expect(center()).toBe("#fffee6");
    A.setAppearance({ accent: { color: "#007aff" } });
    expect(center()).toBe("#ffffff");
  });

  it("inverts only a Black & White highlight", () => {
    A.setAppearance({ highlight: "black-white" });
    expect([prop("--osm-highlight"), prop("--osm-highlight-text")])
      .toEqual(["#000000", "#ffffff"]);
    A.setAppearance({ highlight: { color: "#123" } });
    expect([prop("--osm-highlight"), prop("--osm-highlight-text")])
      .toEqual(["#112233", "#000000"]);
    // A host's uppercase color, as Lantenna reads them.
    A.setAppearance({ highlight: { color: "#B3D7FF" } });
    expect(prop("--osm-highlight")).toBe("#b3d7ff");
    expect(A.getAppearance().highlight).toEqual({ color: "#b3d7ff" });
    // Other… black is Black & White.
    A.setAppearance({ highlight: { color: "#000" } });
    expect(prop("--osm-highlight-text")).toBe("#ffffff");
  });

  it("rejects malformed arguments with a TypeError", () => {
    const bad: unknown[] = [
      null, 42, "Gold", [], { accentColor: "#fff" },
      { accent: "Gold" }, { accent: { color: 0xff } },
      { accent: { release: "8.0", name: 3 } },
      { highlight: "Purple" }, { highlight: null },
    ];
    for (const arg of bad)
      expect(() => A.setAppearance(arg as never), JSON.stringify(arg))
        .toThrow(TypeError);
  });

  it("rejects unknown names and malformed colors with a RangeError", () => {
    for (const color of ["blue", "#12345", "", "rgb(0,0,0)", "#ggg"]) {
      expect(() => A.setAppearance({ accent: { color } }))
        .toThrow(/#rgb or #rrggbb/);
      expect(() => A.setAppearance({ highlight: { color } }))
        .toThrow(RangeError);
    }
    const bad: unknown[] = [
      { accent: { release: "9.0", name: "Lavender" } },
      { accent: { release: "8.0", name: "toString" } },
      { highlight: { release: "8.0", name: "Black & White" } },
      { highlight: { release: "8.5", name: "Red" } },
    ];
    for (const arg of bad)
      expect(() => A.setAppearance(arg as never), JSON.stringify(arg))
        .toThrow(RangeError);
  });

  it("changes nothing when any part is invalid", () => {
    A.setAppearance({ accent: { release: "8.0", name: "Magenta" },
                      highlight: "black-white" });
    const before = document.documentElement.getAttribute("style");
    const appearance = A.getAppearance();
    expect(() => A.setAppearance({
      accent: { release: "8.0", name: "Gold" },
      highlight: { color: "nope" },
    })).toThrow(RangeError);
    expect(document.documentElement.getAttribute("style")).toBe(before);
    expect(A.getAppearance()).toBe(appearance);
  });

  it("restores the defaults", () => {
    const initial = A.getAppearance();
    A.setAppearance({ accent: { release: "8.5", name: "Poppy" },
                      highlight: "black-white" });
    A.setAppearance(initial);
    expect(prop("--osm-accent-3")).toBe("#6666cc");
    expect(prop("--osm-highlight-text")).toBe("#000000");
    expect(prop("--osm-sprite-fill")).toBe(spriteUrl(spriteRows("fill")));
  });
});

describe("focus rings", () => {
  it("use the first entry from A3 on that reaches 3:1 on the face", () => {
    for (const [release, list] of [["8.0", ACCENTS_80],
                                   ["8.5", VARIATIONS_85]] as const) {
      for (const [name, colors] of list) {
        A.setAppearance({ accent: { release, name } as never });
        const r = ramp(colors);
        const expected = r.slice(3).find((c) =>
          contrast(c, "#dddddd") >= 3);
        expect(prop("--osm-focus-ring"), name).toBe(expected);
      }
    }
  });

  it("keep Apple's A3 where it is visible, as in Lavender", () => {
    const ring = (release: "8.0" | "8.5", name: string) => {
      A.setAppearance({ accent: { release, name } as never });
      return prop("--osm-focus-ring");
    };
    expect(ring("8.0", "Lavender")).toBe("#6666cc");
    expect(ring("8.0", "Gold")).toBe("#666600"); // A4
    expect(ring("8.5", "Pistachio")).toBe("#336600"); // A6
    expect(ring("8.5", "Sunny")).toBe("#887126"); // A6
    A.setAppearance({ accent: { color: "#ffffff" } });
    expect(prop("--osm-focus-ring")).toBe("#000000"); // A7
  });
});

describe("derived accents", () => {
  it("build a ramp around the color, which becomes A3", () => {
    const derived = (color: string) => {
      A.setAppearance({ accent: { color } });
      return accentProps();
    };
    expect(derived("#007aff")).toEqual(ramp(
      "eaf2ff bbd7ff 74adff 007aff 0053b1 003373 001d47 000000"));
    // Lavender's A3 does not give Lavender back: named tables are
    // Apple's own.
    expect(derived("#6666cc")).toEqual(ramp(
      "dee2ff bcc2ff 8e92fc 6666cc 413c99 25196d 110741 000000"));
    expect(derived("#989898")).toEqual(ramp(
      "fafafa e1e1e1 bebebe 989898 6d6d6d 4b4b4b 323232 000000"));
    expect(derived("#07F")[3]).toBe("#0077ff");
    expect(derived("#000000")).toEqual(ramp(
      "3c3c3c 262626 090909 000000 000000 000000 000000 000000"));
  });

  it("darken from A0 to A7", () => {
    for (const color of ["#007aff", "#e0383e", "#ffc600", "#336633"]) {
      A.setAppearance({ accent: { color } });
      const lum = accentProps().map(luminance);
      for (let i = 1; i < 8; i++)
        expect(lum[i]!, `${color} A${i}`).toBeLessThan(lum[i - 1]!);
    }
  });
});

describe("nearestAccent", () => {
  it("snaps macOS accent colors to Apple's tables", () => {
    const both = (color: string) =>
      [A.nearestAccent(color, "8.0").name, A.nearestAccent(color, "8.5").name];
    expect(both("#007aff")).toEqual(["Sapphire", "Sapphire"]);
    expect(both("#007AFF")).toEqual(["Sapphire", "Sapphire"]);
    expect(both("#e0383e")).toEqual(["Crimson", "Crimson"]);
    expect(both("#953d96")).toEqual(["Magenta", "Magenta"]);
    expect(both("#989898")).toEqual(["Silver", "Silver"]);
    expect(both("#f7821b")).toEqual(["Copper", "Poppy"]);
    expect(both("#ffc600")).toEqual(["Gold", "Sunny"]);
    // Green (#62ba46) is left out: Pistachio and Emerald are within
    // 0.002 of each other.
  });

  it("returns a choice setAppearance takes", () => {
    const choice = A.nearestAccent("#007aff", "8.5");
    expect(choice).toEqual({ release: "8.5", name: "Sapphire" });
    A.setAppearance({ accent: choice });
    expect(prop("--osm-accent-3")).toBe("#3366ff");
  });

  it("validates its arguments", () => {
    expect(() => A.nearestAccent("blue", "8.0")).toThrow(RangeError);
    expect(() => A.nearestAccent(7 as never, "8.0")).toThrow(TypeError);
    expect(() => A.nearestAccent("#fff", "9.0" as never)).toThrow(RangeError);
  });
});

describe("registerSprites and the accent", () => {
  it("redraws only the sprites that follow it", () => {
    I.registerSprites({ "t-follow": ["qh"] }, {}, { accent: "follow" });
    I.registerSprites({ "t-fixed": ["q"] });
    I.registerSprites({ "t-own": ["qm"] }, { q: "#123456" },
                      { accent: "follow" });
    A.setAppearance({ accent: { release: "8.5", name: "Sunny" } });
    const follow = decodeURIComponent(prop("--osm-sprite-t-follow"));
    expect(follow).toContain('fill="#fef491"');
    expect(follow).toContain('fill="#fffee6"');
    expect(prop("--osm-sprite-t-fixed")).toBe("");
    expect(document.head.textContent).toContain(
      encodeURIComponent('fill="#ccccff"'));
    // The app's own palette wins over the accent.
    const own = decodeURIComponent(prop("--osm-sprite-t-own"));
    expect(own).toContain('fill="#123456"');
    expect(own).toContain('fill="#e6c144"');
  });

  it("draws a sprite registered later in the current accent", () => {
    A.setAppearance({ accent: { release: "8.0", name: "Gold" } });
    I.registerSprites({ "t-late": ["p"] }, {}, { accent: "follow" });
    expect(decodeURIComponent(prop("--osm-sprite-t-late")))
      .toContain('fill="#cccc00"');
  });

  it("lets a name registered again stop following", () => {
    I.registerSprites({ "t-icon": ["q"] }, {}, { accent: "follow" });
    I.registerSprites({ "t-icon": ["q"] }, {}, { accent: "fixed" });
    A.setAppearance({ accent: { release: "8.0", name: "Gold" } });
    expect(prop("--osm-sprite-t-icon")).toBe("");
  });

  it("changes nothing for a bad grid or option", () => {
    expect(() => I.registerSprites({ "t-a": ["q"], "t-b": ["q", "qq"] }, {},
                                   { accent: "follow" })).toThrow();
    expect(prop("--osm-sprite-t-a")).toBe("");
    expect(() => I.registerSprites({ "t-c": ["q"] }, {},
                                   { accent: "always" as never }))
      .toThrow(RangeError);
  });
});

describe("osmium.css", () => {
  const css = readFileSync(join(process.cwd(), "osmium.css"), "utf8");
  const root = css.indexOf(":root {");
  const rest = css.slice(0, root) + css.slice(css.indexOf("\n}\n", root));

  it("hard-codes no accent or highlight color outside :root", () => {
    // Lavender's A1..A6. Comments may name them; rules may not.
    const rules = rest.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const c of ["#ccccff", "#9999ff", "#6666cc", "#333399", "#000088",
                     "#000055"])
      expect(rules.toLowerCase(), c).not.toContain(c);
  });

  it("selects list rows and text in the Highlight Color", () => {
    expect(css).toMatch(/\.osm-row\.osm-selected \{\s*background: var\(--osm-highlight\); color: var\(--osm-highlight-text\);/);
    expect(css).toContain(
      "color-mix(in srgb, var(--osm-highlight) 99.6%, transparent)");
  });
});

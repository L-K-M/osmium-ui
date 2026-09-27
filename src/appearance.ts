// The Appearance control panel's two color settings, Accent Color and
// Highlight Color, and the calls that change them for the whole page.
//
// Mac OS 8.0 and 8.1 offer 18 accent colors (plus Black & White) in a
// scrolling list and nine highlight colors plus "Other…" (the Color
// Picker, any color) in a pop-up. Mac OS 8.5 renamed the accent
// "Variation:" ("for menus and controls"), moved it into the Apple
// platinum theme file and changed both lists. Apple's balloon help
// (8.6 Appearance control panel, STR# 2200) says the variation is "the
// color that appears in scroll bars, menus, progress indicators, and
// focused items", the highlight "a color for selecting text and
// highlighting other items". Window frames stay gray: Mac OS 8 dropped
// System 7's Window color.
//
// Every accent is an 8-entry color table, A0 (lightest) to A7 (always
// black). Osmium draws with it as follows (measured in Lavender):
//   A0  thumb gleams, and the progress bar's center row in 8.5 tables
//   A1  thumb top/left edges, progress rows 3 and 5
//   A2  thumb face, progress rows 2 and 6, the inactive progress fill
//   A3  thumb bottom/right edges, menu highlight left column and top
//       row, focus rings (see focusRing)
//   A4  menu highlight fill, thumb grip shadows
//   A5  menu highlight right column and bottom row
//   A6  progress bottom row and right end, pressed grip shadows
// The indeterminate progress bar's stripes run A5 A4 A3 A2 A1 A2 A3 A4
// A5 A6 down its ten rows, and A2 in an inactive window (measured in
// Lavender and Ivy; see sprites.ts).
// The menu-bar title highlight (A3 top row, A4 fill, A5 bottom row) is
// measured from a Mac OS 8.0 screenshot; the thumb roles for accents
// other than Lavender follow Mozilla's reverse engineering (see
// controlsprites.ts).
//
// State: this module owns the page's current appearance and the app
// sprites registered to follow the accent. It writes custom properties
// inline on document.documentElement, which beat the :root defaults in
// osmium.css and installOsmium()'s sprite rule whatever order they
// load in.
import { allSprites, spriteUrl } from "./sprites.js";
import type { Palette } from "./sprites.js";

/** An accent table, A0 .. A7, lowercase #rrggbb. */
type Ramp = readonly [string, string, string, string,
                      string, string, string, string];

// ---- Apple's tables ----------------------------------------------------
// Transcribed verbatim from Apple's resources, in each panel's menu
// order. Both releases leave out "Black & White": its table is empty
// (ctSize -1) and how Mac OS drew with it was never measured, so it
// isn't offered.

/** Mac OS 8.0/8.1 "Accent Color:": the Appearance control panel 1.0.1's
 * 'clut' 200-218 (Mac OS 8.1 disk image, archive.org item
 * basilisk-ii-1-4-2-68k-color-emulator-with-floppy-support-mac-os-8-1).
 * The Mac OS 8.0 CD (archive.org 691-1600-AMac_OS_8_v8.0_1997_CD)
 * carries the same 72-byte tables from offset 103017997 of its .toast.
 * Lavender is the default: it is also 'clut' -20233 in the 8.0 and 8.1
 * Appearance Extension and in the 8.5 and 8.6 System files. */
const ACCENTS_80 = {
  Aquamarine: [
    "#ccffff", "#66ffcc", "#00cc99", "#009999",
    "#006666", "#003333", "#002200", "#000000"],
  Copper: [
    "#ffffcc", "#ffcc99", "#ff9966", "#cc6633",
    "#993300", "#660000", "#220000", "#000000"],
  Crimson: [
    "#ffcccc", "#ff9999", "#ff6666", "#cc3333",
    "#990000", "#770000", "#440000", "#000000"],
  Emerald: [
    "#ccffcc", "#66ff99", "#33cc66", "#339966",
    "#006633", "#004400", "#002200", "#000000"],
  "French Blue": [
    "#eeeeee", "#ccccff", "#9999cc", "#666699",
    "#333366", "#000022", "#000011", "#000000"],
  Gold: [
    "#ffff99", "#ffff00", "#cccc00", "#999900",
    "#666600", "#333300", "#111111", "#000000"],
  Ivy: [
    "#ccffcc", "#99cc99", "#669966", "#336633",
    "#003300", "#002200", "#001100", "#000000"],
  Lavender: [
    "#eeeeee", "#ccccff", "#9999ff", "#6666cc",
    "#333399", "#000088", "#000055", "#000000"],
  Lime: [
    "#ffffcc", "#ccff66", "#99cc66", "#669900",
    "#336600", "#004400", "#003300", "#000000"],
  Magenta: [
    "#ffccff", "#ff99ff", "#cc66cc", "#993399",
    "#660066", "#330033", "#220000", "#000000"],
  Nutmeg: [
    "#ffffcc", "#ffcc99", "#cc9966", "#996633",
    "#663300", "#220000", "#110000", "#000000"],
  Olive: [
    "#ffffcc", "#cccc99", "#999966", "#666633",
    "#333300", "#002200", "#001100", "#000000"],
  Plum: [
    "#ffccff", "#cc99cc", "#996699", "#663366",
    "#330033", "#220000", "#110000", "#000000"],
  Rose: [
    "#eeeeee", "#ffcccc", "#cc9999", "#996666",
    "#663333", "#440000", "#220000", "#000000"],
  Sapphire: [
    "#eeeeee", "#99ccff", "#6699ff", "#3366ff",
    "#0033cc", "#000099", "#000055", "#000000"],
  Silver: [
    "#eeeeee", "#cccccc", "#aaaaaa", "#777777",
    "#555555", "#333333", "#222222", "#000000"],
  Teal: [
    "#eeeeee", "#99cccc", "#669999", "#336666",
    "#003333", "#002200", "#001100", "#000000"],
  Turquoise: [
    "#ccffff", "#66ffff", "#00ccff", "#0099cc",
    "#006699", "#003366", "#000022", "#000000"],
} as const satisfies Record<string, Ramp>;

/** Mac OS 8.5/8.6 "Variation:": the Apple platinum theme file 1.1.3's
 * 'clut' 200-220, listed in the order of its 'tvar' 128 (the IDs are not
 * in menu order: Pistachio is 209, Poppy 212, Sunny 219), read from an
 * installed Mac OS 8.6 (archive.org item mac-os-86). The Mac OS 8.5 CD
 * (archive.org 691-2157-AZUMac_OS_8.5_CD) holds the same 20 tables from
 * offset 266927510. Against 8.0, Aquamarine, Lime and Olive are gone,
 * Azul, Bondi, Pistachio, Poppy and Sunny are new, and French Blue,
 * Nutmeg, Plum, Rose and Teal have new colors. */
const VARIATION_RAMPS_85 = {
  Azul: [
    "#afc9ff", "#93b6ea", "#7599d0", "#6686b7",
    "#4a6999", "#30467d", "#293c6a", "#000000"],
  Bondi: [
    "#c8f8e9", "#67dacd", "#5ab9ad", "#308f91",
    "#0d716a", "#00454b", "#003333", "#000000"],
  Copper: [
    "#ffffcc", "#ffcc99", "#ff9966", "#cc6633",
    "#993300", "#660000", "#220000", "#000000"],
  Crimson: [
    "#ffcccc", "#ff9999", "#ff6666", "#cc3333",
    "#990000", "#770000", "#440000", "#000000"],
  Emerald: [
    "#ccffcc", "#66ff99", "#33cc66", "#339966",
    "#006633", "#004400", "#002200", "#000000"],
  "French Blue": [
    "#ccccff", "#b0b0ea", "#8585bc", "#666699",
    "#51517c", "#333366", "#26264d", "#000000"],
  Gold: [
    "#ffff99", "#ffff00", "#cccc00", "#999900",
    "#666600", "#333300", "#111111", "#000000"],
  Ivy: [
    "#ccffcc", "#99cc99", "#669966", "#336633",
    "#003300", "#002200", "#001100", "#000000"],
  Lavender: [
    "#eeeeee", "#ccccff", "#9999ff", "#6666cc",
    "#333399", "#000088", "#000055", "#000000"],
  Magenta: [
    "#ffccff", "#ff99ff", "#cc66cc", "#993399",
    "#660066", "#330033", "#220000", "#000000"],
  Nutmeg: [
    "#fed9b3", "#ecb277", "#cc9966", "#996633",
    "#663300", "#451f18", "#220000", "#000000"],
  Pistachio: [
    "#edffb7", "#dbfd75", "#cded6d", "#b5e040",
    "#99cc3e", "#669900", "#336600", "#000000"],
  Plum: [
    "#ffccff", "#dea4de", "#be80be", "#996699",
    "#663366", "#4a0a4a", "#330033", "#000000"],
  Poppy: [
    "#ffc05c", "#fe9c02", "#fe8502", "#f46f19",
    "#fe4200", "#e14200", "#a43000", "#000000"],
  Rose: [
    "#ffdcdc", "#efc8c8", "#cc9999", "#996666",
    "#794242", "#541f1f", "#350000", "#000000"],
  Sapphire: [
    "#eeeeee", "#99ccff", "#6699ff", "#3366ff",
    "#0033cc", "#000099", "#000055", "#000000"],
  Silver: [
    "#eeeeee", "#cccccc", "#aaaaaa", "#777777",
    "#555555", "#333333", "#222222", "#000000"],
  Sunny: [
    "#fffee6", "#fef491", "#f5db61", "#e6c144",
    "#ccab3b", "#aa8f35", "#887126", "#000000"],
  Teal: [
    "#b9eeee", "#99cccc", "#669999", "#477979",
    "#336666", "#074c4c", "#003333", "#000000"],
  Turquoise: [
    "#ccffff", "#66ffff", "#00ccff", "#0099cc",
    "#006699", "#003366", "#000022", "#000000"],
} as const satisfies Record<string, Ramp>;

/** Mac OS 8.0/8.1 "Highlight Color:": the items of MENU -4048 with the
 * colors of 'rgb ' -4048 (Appearance control panel 1.0.1; the same
 * bytes are at offsets 103010363 and 103010539 of the Mac OS 8.0 CD).
 * "Other…" follows Black & White. Black & White is setAppearance's
 * "black-white" rather than a name here, because it alone inverts. */
const HIGHLIGHT_COLORS_80 = {
  Purple: "#ccccff", Yellow: "#ffff00", Green: "#99ff00",
  Turquoise: "#33ffff", Red: "#ee0000", Pink: "#ff99ff", Blue: "#99ccff",
  Gray: "#bbbbbb",
} as const;

/** Mac OS 8.5/8.6 "Highlight Color:": 'hlit' 3000 of the Appearance
 * control panel 1.1 (Mac OS 8.6; identical bytes at offset 263274983
 * of the Mac OS 8.5 CD, where one copy spells it "Grey"), then MENU
 * 2203's "Other…". This list has no Black & White. */
const HIGHLIGHT_COLORS_85 = {
  Azul: "#99ccff", Bondi: "#99ffff", Green: "#ccff66", Plum: "#ffccff",
  Poppy: "#ffcc66", Purple: "#ccccff", Teal: "#ccffff", Yellow: "#ffff99",
  Gray: "#cccccc",
} as const;

// ---- public types --------------------------------------------------------

/** A Mac OS 8.0/8.1 accent color. */
export type Accent80 = keyof typeof ACCENTS_80;
/** A Mac OS 8.5/8.6 variation. */
export type Variation85 = keyof typeof VARIATION_RAMPS_85;
/** A Mac OS 8.0/8.1 highlight color other than Black & White. */
export type Highlight80 = keyof typeof HIGHLIGHT_COLORS_80;
/** A Mac OS 8.5/8.6 highlight color. */
export type Highlight85 = keyof typeof HIGHLIGHT_COLORS_85;
/** Which Mac OS release's list a name comes from: 8.0 (and 8.1) or 8.5
 * (and 8.6). Some names mean different colors in the two. */
export type AppearanceRelease = "8.0" | "8.5";

/** One of Apple's accent tables, or an accent derived from any color.
 * A derived accent is not Mac OS: Apple offered only its tables. */
export type AccentChoice =
  | { readonly release: "8.0"; readonly name: Accent80 }
  | { readonly release: "8.5"; readonly name: Variation85 }
  | { readonly color: string };

/** One of Apple's highlight colors, Black & White, or any color (the
 * panel's "Other…"). */
export type HighlightChoice =
  | "black-white"
  | { readonly release: "8.0"; readonly name: Highlight80 }
  | { readonly release: "8.5"; readonly name: Highlight85 }
  | { readonly color: string };

export interface Appearance {
  readonly accent: AccentChoice;
  readonly highlight: HighlightChoice;
}

/** The 8.5/8.6 Variation menu's names, in its order, for a pop-up. */
export const VARIATIONS_85 = Object.freeze(
  Object.keys(VARIATION_RAMPS_85) as Variation85[]);
/** The 8.5/8.6 Highlight Color menu's names, in its order. */
export const HIGHLIGHTS_85 = Object.freeze(
  Object.keys(HIGHLIGHT_COLORS_85) as Highlight85[]);

// ---- defaults ------------------------------------------------------------

/** Lavender, and the Purple highlight. The Mac OS 8.0 highlight default
 * is ambiguous: the guidebookgallery.org captures of one 8.0 machine
 * show Black & White, its Color Picker capture from another shows
 * Purple (black text on #ccccff), and no default resource was found.
 * Mac OS 8.5's "Mac OS Default" theme ('scen' 2000) is Lavender with
 * Purple. Osmium chose Purple. osmium.css's :root holds the same
 * values. */
const DEFAULT_APPEARANCE: Appearance = Object.freeze({
  accent: Object.freeze({ release: "8.0", name: "Lavender" } as const),
  highlight: Object.freeze({ release: "8.0", name: "Purple" } as const),
});

let current: Appearance = DEFAULT_APPEARANCE;

// ---- colors ---------------------------------------------------------------

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `value` as lowercase #rrggbb; throws on anything but #rgb or
 * #rrggbb (either case). */
function parseColor(value: unknown, what: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${what} must be a string, not ${typeof value}`);
  if (!HEX.test(value))
    throw new RangeError(`${what} ${JSON.stringify(value)} must be #rgb or ` +
                         "#rrggbb (hex digits, either case)");
  const hex = value.slice(1).toLowerCase();
  return "#" + (hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex);
}

/** sRGB channels 0..1 of a normalized #rrggbb. */
function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as
    [number, number, number];
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

/** WCAG 2 contrast ratio of two #rrggbb colors. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = channels(hex).map(toLinear) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// OKLab (Björn Ottosson, 2020), for deriving ramps and matching colors
// by how they look rather than by their RGB numbers.
type Lab = [l: number, a: number, b: number];

function toOklab(hex: string): Lab {
  const [r, g, b] = channels(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** Linear sRGB of an OKLab color; channels may fall outside 0..1. */
function fromOklab([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/** Lightness, chroma and hue (radians) of an OKLab color. */
function lch([L, a, b]: Lab): [number, number, number] {
  return [L, Math.hypot(a, b), Math.atan2(b, a)];
}

/** The #rrggbb nearest OKLCH (L, C, h): lightness clamped to 0..1, and
 * chroma reduced (by bisection) until the color is displayable. */
function fromLch(L: number, C: number, h: number): string {
  const lightness = Math.min(Math.max(L, 0), 1);
  const at = (c: number) =>
    fromOklab([lightness, c * Math.cos(h), c * Math.sin(h)]);
  const inGamut = (rgb: readonly number[]) =>
    rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
  let rgb = at(C);
  if (!inGamut(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid; else hi = mid;
    }
    rgb = at(lo);
  }
  return "#" + rgb.map((c) =>
    Math.round(Math.min(Math.max(fromLinear(Math.max(c, 0)), 0), 1) * 255)
      .toString(16).padStart(2, "0")).join("");
}

// The mean OKLab offsets of Apple's 38 accent tables (8.0 and 8.5)
// from their A3 entry: lightness steps up to A0..A2 and down to A4..A6,
// and each entry's chroma relative to A3's. Fitted in the design
// research; given each table's own A3, the derived ramps miss Apple's
// by a mean OKLab distance of 0.046 over A0..A6 (worst: Poppy, 0.14).
const LIGHTER = [0.357, 0.269, 0.141] as const;
const DARKER = [0.144, 0.267, 0.363] as const;
const LIGHTER_CHROMA = [0.52, 0.94, 1.0] as const;
const DARKER_CHROMA = [0.96, 0.89, 0.65] as const;

/** An accent ramp around a normalized #rrggbb, which becomes A3. The
 * steps shrink when the color is too light or too dark to take them in
 * full, so every entry stays a valid color. Not an Apple table. */
function deriveRamp(color: string): Ramp {
  const [L, C, h] = lch(toOklab(color));
  const up = Math.min(1, Math.max(0, (0.985 - L) / LIGHTER[0]));
  const down = Math.min(1, Math.max(0, (L - 0.08) / DARKER[2]));
  const lighter = LIGHTER.map((d, i) =>
    fromLch(L + d * up, C * LIGHTER_CHROMA[i]!, h));
  const darker = DARKER.map((d, i) =>
    fromLch(L - d * down, C * DARKER_CHROMA[i]!, h));
  return [...lighter, color, ...darker, "#000000"] as unknown as Ramp;
}

// ---- validation -----------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A table's entry for `name`, or a RangeError naming the release. */
function lookup<T>(table: Readonly<Record<string, T>>, name: unknown,
                   what: string): T {
  if (typeof name !== "string")
    throw new TypeError(`${what} name must be a string, not ${typeof name}`);
  if (!Object.hasOwn(table, name))
    throw new RangeError(`unknown ${what} ${JSON.stringify(name)}`);
  return table[name]!;
}

function checkRelease(release: unknown, what: string): AppearanceRelease {
  if (release === "8.0" || release === "8.5") return release;
  throw new RangeError(`${what} release ${JSON.stringify(release)} must be ` +
                       '"8.0" or "8.5"');
}

/** Check a caller's accent and return it normalized (a fresh object,
 * colors as lowercase #rrggbb). */
function normalizeAccent(value: unknown): AccentChoice {
  if (!isRecord(value))
    throw new TypeError("accent must be { release, name } or { color }");
  if ("color" in value)
    return Object.freeze({ color: parseColor(value["color"], "accent color") });
  const release = checkRelease(value["release"], "accent");
  if (release === "8.0") {
    lookup(ACCENTS_80, value["name"], "Mac OS 8.0 accent color");
    return Object.freeze({ release, name: value["name"] as Accent80 });
  }
  lookup(VARIATION_RAMPS_85, value["name"], "Mac OS 8.5 variation");
  return Object.freeze({ release, name: value["name"] as Variation85 });
}

function normalizeHighlight(value: unknown): HighlightChoice {
  if (value === "black-white") return value;
  if (!isRecord(value))
    throw new TypeError('highlight must be "black-white", ' +
                        "{ release, name } or { color }");
  if ("color" in value)
    return Object.freeze({
      color: parseColor(value["color"], "highlight color"),
    });
  const release = checkRelease(value["release"], "highlight");
  if (value["name"] === "Black & White")
    throw new RangeError('Black & White is the highlight "black-white"');
  if (release === "8.0") {
    lookup(HIGHLIGHT_COLORS_80, value["name"], "Mac OS 8.0 highlight color");
    return Object.freeze({ release, name: value["name"] as Highlight80 });
  }
  lookup(HIGHLIGHT_COLORS_85, value["name"], "Mac OS 8.5 highlight color");
  return Object.freeze({ release, name: value["name"] as Highlight85 });
}

// ---- resolving ----------------------------------------------------------

/** The dialog face (--osm-dialog) that focus rings are drawn on. */
const RING_BACKGROUND = "#dddddd";
/** WCAG 2.1 SC 1.4.11's minimum for a focus indicator. */
const RING_CONTRAST = 3;

/** The focus ring's color: A3, as Mac OS draws its rings (a Mac OS 9.0
 * edit text, measured), unless A3 falls short of 3:1 against the dialog
 * face; then the first darker entry that reaches it. A deviation:
 * Apple's light variations draw nearly invisible rings (Pistachio's A3
 * is 1.13:1). Lavender keeps A3. Most tables need at most A5; Pistachio
 * and Sunny need A6, and A7 (black) ends the search. */
function focusRing(ramp: Ramp): string {
  for (const c of ramp.slice(3))
    if (contrast(c, RING_BACKGROUND) >= RING_CONTRAST) return c;
  return ramp[7];
}

interface Resolved {
  readonly ramp: Ramp;
  /** The progress bar's center row. */
  readonly center: string;
  readonly highlight: string;
  readonly highlightText: string;
}

function resolve(appearance: Appearance): Resolved {
  const { accent, highlight } = appearance;
  const ramp: Ramp = "color" in accent ? deriveRamp(accent.color)
    : accent.release === "8.0" ? ACCENTS_80[accent.name]
    : VARIATION_RAMPS_85[accent.name];
  // The progress bar's center row: white in Mac OS 8.0 (its About This
  // Computer memory bar, the only 8.0 Appearance progress bar in the
  // guidebookgallery.org captures), A0 in the 8.5-era theme previews
  // (Apple platinum PICT 2000, 2001 and 2003, byte-identical on the
  // Mac OS 8.5 CD: Lavender #eeeeee, Ivy #ccffcc, Bondi #c8f8e9). A
  // derived accent draws the way Osmium's Mac OS 8.0 does.
  const center = "release" in accent && accent.release === "8.5"
    ? ramp[0] : "#ffffff";
  const color = highlight === "black-white" ? "#000000"
    : "color" in highlight ? highlight.color
    : highlight.release === "8.0" ? HIGHLIGHT_COLORS_80[highlight.name]
    : HIGHLIGHT_COLORS_85[highlight.name];
  // QuickDraw's hilite mode swaps the background and highlight colors,
  // so text inverts only when the highlight is the text's black (Black
  // & White: white on black); on any other highlight it stays black,
  // however dark the highlight (Mac OS 8.0 Color Picker and Open dialog,
  // Mac OS 9.0 Open dialog and edit text).
  return {
    ramp, center, highlight: color,
    highlightText: color === "#000000" ? "#ffffff" : "#000000",
  };
}

/** Sprite palette keys (sprites.ts) for an accent. */
function accentPalette({ ramp, center }: Resolved): Palette {
  return {
    w: ramp[0], q: ramp[1], p: ramp[2], m: ramp[3], l: ramp[4], j: ramp[5],
    n: ramp[6], h: center,
  };
}

// ---- the page ------------------------------------------------------------

/** The built-in sprites drawn in the accent. alert-note uses the same
 * letters but is an icon, and icons keep their colors. */
const ACCENT_SPRITES = new Set([
  "fill", "fill-left", "fill-right", "barber", "barber-inactive",
  "slider-thumb", "slider-thumb-pressed",
  "scroll-thumb", "scroll-thumb-pressed",
  "scroll-hthumb", "scroll-hthumb-pressed",
]);

/** App sprites registered to follow the accent, by name, so that
 * registering a name again replaces it. */
const following = new Map<string, {
  readonly rows: readonly string[]; readonly palette: Palette;
}>();

const spriteProperty = (name: string) => `--osm-sprite-${name}`;

function writeSprite(name: string, rows: readonly string[],
                     palette: Palette): void {
  document.documentElement.style.setProperty(spriteProperty(name),
                                             spriteUrl(rows, palette));
}

/** Write every custom property the appearance sets. */
function write(appearance: Appearance): void {
  const resolved = resolve(appearance);
  const style = document.documentElement.style;
  resolved.ramp.forEach((c, i) => style.setProperty(`--osm-accent-${i}`, c));
  style.setProperty("--osm-highlight", resolved.highlight);
  style.setProperty("--osm-highlight-text", resolved.highlightText);
  style.setProperty("--osm-focus-ring", focusRing(resolved.ramp));
  const palette = accentPalette(resolved);
  for (const [name, rows] of allSprites())
    if (ACCENT_SPRITES.has(name)) writeSprite(name, rows, palette);
  for (const [name, s] of following)
    writeSprite(name, s.rows, { ...palette, ...s.palette });
}

/** Change the accent, the highlight or both for the whole page, the way
 * the Appearance control panel changed them for the whole Mac:
 *
 *   setAppearance({ accent: { release: "8.0", name: "Gold" } });
 *   setAppearance({ highlight: "black-white" });
 *   setAppearance({ accent: { color: "#007AFF" },
 *                   highlight: { color: "#b3d7ff" } });
 *
 * A property left out keeps its current value. Colors are #rgb or
 * #rrggbb in either case. Everything is checked before anything
 * changes: a malformed argument throws a TypeError, an unknown name,
 * release or malformed color string a RangeError, and the page keeps
 * its appearance. Synchronous; needs no installOsmium(). */
export function setAppearance(change: {
  readonly accent?: AccentChoice;
  readonly highlight?: HighlightChoice;
}): void {
  if (!isRecord(change))
    throw new TypeError("setAppearance takes { accent?, highlight? }");
  for (const key of Object.keys(change))
    if (key !== "accent" && key !== "highlight")
      throw new TypeError(`setAppearance has no ${JSON.stringify(key)}; ` +
                          "it takes { accent?, highlight? }");
  const next: Appearance = Object.freeze({
    accent: change.accent === undefined ? current.accent
      : normalizeAccent(change.accent),
    highlight: change.highlight === undefined ? current.highlight
      : normalizeHighlight(change.highlight),
  });
  write(next);
  current = next;
}

/** The page's appearance: what setAppearance last set (colors as
 * lowercase #rrggbb), Lavender and Purple before that. */
export function getAppearance(): Appearance {
  return current;
}

/** The accent in Apple's `release` list closest in look to `color`: the
 * table whose swatch (A3, the color the Variation pop-up shows) is
 * nearest in OKLCH, weighing lightness half as much as chroma and hue,
 * because the tables differ mostly in hue. Grays (OKLab chroma below
 * 0.03) are Silver. For an app that follows a host system's accent
 * with an authentic table:
 *
 *   setAppearance({ accent: nearestAccent(hostAccent, "8.5") });
 *
 * Throws like setAppearance on a malformed color or release. */
export function nearestAccent(color: string, release: "8.0"):
  { readonly release: "8.0"; readonly name: Accent80 };
export function nearestAccent(color: string, release: "8.5"):
  { readonly release: "8.5"; readonly name: Variation85 };
export function nearestAccent(color: string, release: AppearanceRelease):
  AccentChoice;
export function nearestAccent(color: string,
                              release: AppearanceRelease): AccentChoice {
  const hex = parseColor(color, "color");
  const rel = checkRelease(release, "accent");
  const table: Readonly<Record<string, Ramp>> =
    rel === "8.0" ? ACCENTS_80 : VARIATION_RAMPS_85;
  const [L1, C1, h1] = lch(toOklab(hex));
  if (C1 < 0.03) return Object.freeze({ release: rel, name: "Silver" as const });
  let best = "Silver", bestDistance = Infinity;
  for (const [name, ramp] of Object.entries(table)) {
    if (name === "Silver") continue;
    const [L2, C2, h2] = lch(toOklab(ramp[3]));
    const dh = 2 * Math.sqrt(C1 * C2) * Math.sin((h1 - h2) / 2);
    const distance = Math.hypot(0.5 * (L1 - L2), C1 - C2, dh);
    if (distance < bestDistance) { bestDistance = distance; best = name; }
  }
  return Object.freeze({ release: rel, name: best } as AccentChoice);
}

// ---- app sprites (install.ts) --------------------------------------------

/** Draw app sprites in the current accent now and on every
 * setAppearance: always inline on <html>, where a later redraw
 * replaces them. */
export function followAccent(sprites: Iterable<[string, readonly string[]]>,
                             palette: Palette): void {
  const accent = accentPalette(resolve(current));
  // Draw them all first, so a bad grid throws before anything changes.
  const drawn = [...sprites].map(([name, rows]) =>
    [name, rows, spriteUrl(rows, { ...accent, ...palette })] as const);
  for (const [name, rows, url] of drawn) {
    document.documentElement.style.setProperty(spriteProperty(name), url);
    following.set(name, { rows, palette });
  }
}

/** Stop redrawing app sprites that now keep fixed colors, and drop
 * their inline value, which would outrank the fixed one. */
export function unfollowAccent(names: Iterable<string>): void {
  for (const name of names) {
    if (!following.delete(name)) continue;
    document.documentElement.style.removeProperty(spriteProperty(name));
  }
}

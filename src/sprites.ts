// Fixed-size Mac OS 8 bitmaps — the titlebar boxes, the grow box, the
// pinstripe and progress-bar tiles — as pixel art. Every entry is a
// grid of palette keys, one character per pixel, copied from Mac OS
// 8.0 screen output (reference screenshots, plus a running system for
// the pressed and inactive states). A hex
// digit is a gray level (0 = #000000, 8 = #888888, f = #ffffff),
// letters are named colors, '.' is transparent.
//
// The grids compile to crisp SVG data URIs (spriteUrl) that the
// stylesheet reads through custom properties, so osmium.css never
// hard-codes pixel art and every sprite stays reviewable as a picture.
// Control bitmaps live in controlsprites.ts; apps add their own (icons,
// say) with registerSprites (install.ts), naming extra colors in a
// palette of their own.
import { ALERT_SPRITES } from "./alertsprites.js";
import { CONTROL_SPRITES } from "./controlsprites.js";

/** Extra palette keys for a sprite: one character (a letter from g to
 * z, or uppercase; 0-9 and a-f are grays, '.' transparent) -> CSS
 * color. The kit's own letters are the accent ramp (w q p m l j n, and
 * h for the progress bar's center row) and the alert icons' colors (R P
 * M N Y K k y s); a palette may redefine them for its own sprites. */
export type Palette = Readonly<Record<string, string>>;

const COLORS: Palette = {
  // Lavender accent — the default Mac OS 8 highlight ramp, dark to light
  // (A6 n, A5 j, A4 l, A3 m, A2 p, A1 q). Only the indeterminate
  // progress bar draws with A5.
  n: "#000055", j: "#000088", l: "#333399", m: "#6666cc", p: "#9999ff",
  q: "#ccccff",
  // Its lightest entry (A0), the gleam on scroll and slider thumbs, and
  // the progress bar's center row, white in Mac OS 8.0. setAppearance
  // (appearance.ts) redraws the sprites that use these keys with
  // another accent; alert-note keeps its lavender, as icons don't
  // follow the accent.
  w: "#eeeeee", h: "#ffffff",
  // Alerts (alertsprites.ts): the stop icon's reds and hand, the
  // caution icon's yellow, the note icon's face, and the movable alert
  // title bar's red pinstripe.
  R: "#dd0000", P: "#ff66cc", M: "#990066", N: "#333366", Y: "#ffffcc",
  K: "#ffcc99", k: "#cc9966", y: "#ffff00", s: "#ff6666",
};

/** Resolve one palette key to a CSS color, or null for transparent. */
function color(key: string, palette: Palette): string | null {
  if (key === ".") return null;
  if (/^[0-9a-f]$/.test(key)) return "#" + key.repeat(6);
  const c = palette[key] ?? COLORS[key];
  if (!c) throw new Error(`unknown sprite palette key "${key}"`);
  return c;
}

/** SVG for a pixel grid: one path per color, one subpath per run.
 * crispEdges keeps the browser from antialiasing the pixel squares
 * when it rasterizes the image at the device's pixel ratio. */
export function spriteSvg(rows: readonly string[],
                          palette: Palette = {}): string {
  for (const key of Object.keys(palette)) {
    if (key.length !== 1 || /[0-9a-f.]/.test(key))
      throw new Error(`palette key "${key}" must be one character other ` +
                      "than 0-9, a-f and '.'");
  }
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const paths = new Map<string, string>();
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`sprite row ${y} is not ${w} wide`);
    for (let x = 0; x < w;) {
      const c = color(row[x]!, palette);
      let end = x + 1;
      while (end < w && row[end] === row[x]) end++;
      if (c) paths.set(c, (paths.get(c) ?? "") + `M${x} ${y}h${end - x}v1H${x}z`);
      x = end;
    }
  });
  const body = [...paths].map(([c, d]) => `<path fill="${c}" d="${d}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"` +
    ` shape-rendering="crispEdges">${body}</svg>`;
}

/** A sprite as a CSS `url(...)` value, for a background or border
 * image. */
export function spriteUrl(rows: readonly string[],
                          palette: Palette = {}): string {
  const svg = spriteSvg(rows, palette);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---- titlebar boxes (13 x 13, engraved rim included) ---------------
// The face is a diagonal ramp: 99 -> ff lit from the bottom right, in
// a 22 frame. Pressed, the ramp darkens to 44 -> bb. Zoom and collapse
// overlay their glyph lines on the same face.
const CLOSE = [
  "888888888888.",
  "822222222222f",
  "82fcccccccc2f",
  "82c99aabbc82f",
  "82c9aabbcc82f",
  "82caabbccd82f",
  "82cabbccdd82f",
  "82cbbccdde82f",
  "82cbccddee82f",
  "82cccddeef82f",
  "82c888888882f",
  "822222222222f",
  ".ffffffffffff",
];
const CLOSE_PRESSED = [
  "888888888888.",
  "822222222222f",
  "824455667782f",
  "824556677882f",
  "825566778892f",
  "825667788992f",
  "826677889992f",
  "826778899a92f",
  "82778899aa92f",
  "8278899aab92f",
  "828899999992f",
  "822222222222f",
  ".ffffffffffff",
];

/** Overlay 2-pixel glyph lines onto a box face. */
function overlay(face: readonly string[], lines: readonly string[]): string[] {
  return face.map((row, y) => [...row].map((c, x) =>
    lines[y]![x] === "2" ? "2" : c).join(""));
}
const ZOOM_LINES = [
  ".............",
  ".......2.....",
  ".......2.....",
  ".......2.....",
  ".......2.....",
  ".......2.....",
  ".......2.....",
  ".2222222.....",
  ".............",
  ".............",
  ".............",
  ".............",
  ".............",
];
const COLLAPSE_LINES = [
  ".............",
  ".............",
  ".............",
  ".............",
  ".............",
  ".22222222222.",
  ".............",
  ".22222222222.",
  ".............",
  ".............",
  ".............",
  ".............",
  ".............",
];

// ---- grow box (19 x 19) ---------------------------------------------
// A window without scroll bars notches its content frame around the
// grow box: the black content edge steps in by 15px, the notch takes
// the frame's face and highlight, and three engraved diagonals mark
// the grip. Covers [W-21, W-3] x [H-21, H-3] of a W x H window.
const GROW = [
  "0000000000000000fcc",
  "0ffffffffffffffffcc",
  "0fccccccccccccccccc",
  "0fccccccccccccccccc",
  "0fcccccccffcccccccc",
  "0fccccccfc7cccccccc",
  "0fcccccfc7cffcccccc",
  "0fccccfc7cfc7cccccc",
  "0fcccfc7cfc7cffcccc",
  "0fccfc7cfc7cfc7cccc",
  "0fcca7cfc7cfc7ccccc",
  "0fccccfc7cfc7cccccc",
  "0fcccca7cfc7ccccccc",
  "0fccccccfc7cccccccc",
  "0fcccccca7ccccccccc",
  "0fccccccccccccccccc",
  "ffccccccccccccccccc",
  "ccccccccccccccccccc",
  "ccccccccccccccccccc",
];
// Inactive, the grip goes but the notch keeps a faint ee highlight on
// a flat dd face inside the 55 content edge.
const GROW_INACTIVE = [
  "5555555555555555edd",
  "5eeeeeeeeeeeeeeeedd",
  ...Array<string>(14).fill("5eddddddddddddddddd"),
  "eeddddddddddddddddd",
  "ddddddddddddddddddd",
  "ddddddddddddddddddd",
];

// ---- tiles -----------------------------------------------------------
// Pinstripes: 1px white over 1px 77, six pairs per titlebar. Each
// color is its own tile so the stylesheet can offset the gray line one
// pixel right of the white one, the way Mac OS 8 staggers the ends.
const STRIPE_HI = ["f", "."];
const STRIPE_LO = [".", "7"];
// A movable alert's title bar pairs the white line with ff6666 (Mac OS
// 8 HIG figures 3-6 and 3-8; not captured from a running system).
const STRIPE_ALERT_LO = [".", "s"];

// Progress-bar fill (10 rows tall): the lavender tube, a lighter left
// cap and a darker, rounding-off right end.
const FILL = ["l", "m", "p", "q", "h", "q", "p", "m", "l", "n"];
const FILL_LEFT = ["mm", "mp", "mq", "mh", "mh", "mh", "mq", "mp", "mm", "ml"];
const FILL_RIGHT = [
  "lll", "mmn", "pln", "qln", "qln", "qln", "pln", "mln", "lln", "nnn",
];

// Indeterminate progress bar ("barber pole"), one 16 x 10 tile of the
// stripes that fill the track inside its black edge. Drawn by Mac OS
// 8.0's Appearance Extension, 'CDEF' 5 "Progress Bar" (8.1's is the
// same): every row alternates 8px of an accent color with 8px of a
// gray, starting one pixel further right than the row above, so the
// stripes lean down to the right. Row by row the accent runs A5 A4 A3
// A2 A1 A2 A3 A4 A5 A6 and the gray 55 77 aa bb ff dd bb 99 77 55; in
// an inactive window every row is A2 and dd. The table and the run
// lengths are read from the CDEF's code (offsets 0x12e2-0x1578 and
// 0x1054-0x1264). The pixels match the Finder's "Preparing to copy…"
// window in Mac OS 8.0 running in Infinite Mac (640 x 480 at 1:1, bar
// at screen x 190..377, y 133..146), gamma-corrected back to the Mac
// palette: every captured frame of the ten stripe rows (Lavender and
// Ivy, active and inactive; Mac OS 8.5's Finder in Lavender too) is
// this tile at one of four offsets. osmium.css moves it 4px right per
// step, as the CDEF does.
const BARBER = [
  "jjjjjjjj55555555",
  "7llllllll7777777",
  "aammmmmmmmaaaaaa",
  "bbbppppppppbbbbb",
  "ffffqqqqqqqqffff",
  "dddddppppppppddd",
  "bbbbbbmmmmmmmmbb",
  "9999999llllllll9",
  "77777777jjjjjjjj",
  "n55555555nnnnnnn",
];
const BARBER_INACTIVE = [
  "ppppppppdddddddd",
  "dppppppppddddddd",
  "ddppppppppdddddd",
  "dddppppppppddddd",
  "ddddppppppppdddd",
  "dddddppppppppddd",
  "ddddddppppppppdd",
  "dddddddppppppppd",
  "ddddddddpppppppp",
  "pddddddddppppppp",
];

export const SPRITES = {
  close: CLOSE,
  closePressed: CLOSE_PRESSED,
  zoom: overlay(CLOSE, ZOOM_LINES),
  zoomPressed: overlay(CLOSE_PRESSED, ZOOM_LINES),
  collapse: overlay(CLOSE, COLLAPSE_LINES),
  collapsePressed: overlay(CLOSE_PRESSED, COLLAPSE_LINES),
  grow: GROW,
  growInactive: GROW_INACTIVE,
  stripeHi: STRIPE_HI,
  stripeLo: STRIPE_LO,
  stripeAlertLo: STRIPE_ALERT_LO,
  fill: FILL,
  fillLeft: FILL_LEFT,
  fillRight: FILL_RIGHT,
  barber: BARBER,
  barberInactive: BARBER_INACTIVE,
} as const;

export type SpriteName = keyof typeof SPRITES;

/** Every built-in sprite by its custom-property name (kebab-case). */
export function allSprites(): [string, readonly string[]][] {
  return [
    ...Object.entries(SPRITES).map(([name, rows]): [string, readonly string[]] =>
      [name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), rows]),
    ...Object.entries(CONTROL_SPRITES),
    ...Object.entries(ALERT_SPRITES),
  ];
}

/** `--osm-sprite-<name>: url(...)` declarations, ready to drop into a
 * :root rule: the built-in sprites, or `sprites` drawn with `palette`. */
export function spriteCss(
  sprites: Iterable<[string, readonly string[]]> = allSprites(),
  palette: Palette = {},
): string {
  return [...sprites].map(([name, rows]) =>
    `--osm-sprite-${name}: ${spriteUrl(rows, palette)};`).join("\n");
}

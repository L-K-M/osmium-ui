// Desktop patterns: the colors and 8 x 8 tiles the Control Panel's
// Desktop pane offers. Tiles are sprites like any other, drawn with
// PALETTE on top of the kit's grays and lavender ramp.
import { registerSprites } from "../src/index.js";

const PALETTE = {
  D: "#9999cc", r: "#cc6633", t: "#339999", u: "#66cccc",
} as const;

const TILES = {
  bricks: [
    "rrrrrrrc",
    "rrrrrrrc",
    "rrrrrrrc",
    "cccccccc",
    "rrrcrrrr",
    "rrrcrrrr",
    "rrrcrrrr",
    "cccccccc",
  ],
  diamonds: [
    "DDDmDDDD",
    "DDmqmDDD",
    "DmqqqmDD",
    "mqqqqqmD",
    "DmqqqmDD",
    "DDmqmDDD",
    "DDDmDDDD",
    "DDDDDDDD",
  ],
  stripes: [
    "mmDDDDDD",
    "DmmDDDDD",
    "DDmmDDDD",
    "DDDmmDDD",
    "DDDDmmDD",
    "DDDDDmmD",
    "DDDDDDmm",
    "mDDDDDDm",
  ],
  weave: [
    "uuuutttt",
    "uuuutttt",
    "ttttuuuu",
    "ttttuuuu",
    "uuuutttt",
    "uuuutttt",
    "ttttuuuu",
    "ttttuuuu",
  ],
  dither: [
    "ccdcccdc",
    "dcccdccc",
    "ccdcccdc",
    "dcccdccc",
    "ccdcccdc",
    "dcccdccc",
    "ccdcccdc",
    "dcccdccc",
  ],
} as const;

export interface Pattern {
  readonly name: string;
  /** The CSS background that paints it. */
  readonly background: string;
}

const tile = (name: keyof typeof TILES): string =>
  `var(--osm-sprite-pattern-${name})`;

export const PATTERNS: readonly Pattern[] = [
  // Mac OS 8's desktop color, as the emulator captures show it.
  { name: "Lavender", background: "#9999cc" },
  { name: "Diamonds", background: tile("diamonds") },
  { name: "Stripes", background: tile("stripes") },
  { name: "Grape", background: "#666699" },
  { name: "Teal", background: "#339999" },
  { name: "Weave", background: tile("weave") },
  { name: "Bricks", background: tile("bricks") },
  { name: "Dither", background: tile("dither") },
  { name: "Night", background: "#000055" },
];

let registered = false;

/** Publish the pattern tiles (once per page). */
export function registerPatterns(): void {
  if (registered) return;
  registered = true;
  registerSprites(
    Object.fromEntries(Object.entries(TILES)
      .map(([name, rows]) => [`pattern-${name}`, rows])),
    PALETTE);
}

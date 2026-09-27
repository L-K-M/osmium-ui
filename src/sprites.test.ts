import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPRITES, allSprites, spriteCss, spriteSvg } from "./sprites.js";
import { titleLeft } from "./window.js";
import { CONTROL_SPRITES } from "./controlsprites.js";
import { ALERT_SPRITES } from "./alertsprites.js";

// Box pixels as Mac OS 8.0 draws them, gray level per hex digit: the
// Finder's zoom and collapse boxes, and the zoom box held down.
const ZOOM = [
  "888888888888.", "822222222222f", "82fcccc2ccc2f", "82c99aa2bc82f",
  "82c9aab2cc82f", "82caabb2cd82f", "82cabbc2dd82f", "82222222de82f",
  "82cbccddee82f", "82cccddeef82f", "82c888888882f", "822222222222f",
  ".ffffffffffff",
];
const COLLAPSE = [
  "888888888888.", "822222222222f", "82fcccccccc2f", "82c99aabbc82f",
  "82c9aabbcc82f", "822222222222f", "82cabbccdd82f", "822222222222f",
  "82cbccddee82f", "82cccddeef82f", "82c888888882f", "822222222222f",
  ".ffffffffffff",
];
const ZOOM_PRESSED_TOP = [
  "888888888888.", "822222222222f", "824455627782f", "824556627882f",
  "825566728892f", "825667728992f", "826677829992f", "822222229a92f",
];

const LEFT_ARROW = [
  "0000000000000000", "0fffffffffffffd0", "0fddddddddddddb0",
  "0fddddddddddddb0", "0fddddddd0ddddb0", "0fdddddd00ddddb0",
  "0fddddd000ddddb0", "0fdddd0000ddddb0", "0fdddd0000ddddb0",
  "0fddddd000ddddb0", "0fdddddd00ddddb0", "0fddddddd0ddddb0",
  "0fddddddddddddb0", "0fddddddddddddb0", "0dbbbbbbbbbbbbb0",
  "0000000000000000",
];
const RIGHT_ARROW = [
  "0000000000000000", "0fffffffffffffd0", "0fddddddddddddb0",
  "0fddddddddddddb0", "0fdddd0dddddddb0", "0fdddd00ddddddb0",
  "0fdddd000dddddb0", "0fdddd0000ddddb0", "0fdddd0000ddddb0",
  "0fdddd000dddddb0", "0fdddd00ddddddb0", "0fdddd0dddddddb0",
  "0fddddddddddddb0", "0fddddddddddddb0", "0dbbbbbbbbbbbbb0",
  "0000000000000000",
];
const TRACK_START = [
  "000", "777", "788", "78a", "78a", "78a", "78a", "78a", "78a", "78a",
  "78a", "78a", "78a", "7bb", "ccc", "000",
];

// The list view sort order button in the list's normal order, Mac OS
// 9.0 Sherlock 2 (x=464..479 y=119..139) and Finder captures.
const SORTDIR = [
  "6666666666666665", "6fffffffffffffc3", "6fcccccccccccc83",
  "6fcccccccccccc83", "6fcccccccccccc83", "6fcccccccccccc83",
  "6fccccc45ccccc83", "6fcccccbbccccc83", "6fcccc4220cccc83",
  "6fccccbbbbcccc83", "6fccc421110ccc83", "6fcccbbbbbbccc83",
  "6fcc42111110cc83", "6fcccccccccccc83", "6fcccccccccccc83",
  "6fcccccccccccc83", "6fcccccccccccc83", "6fcccccccccccc83",
  "6fcccccccccccc83", "6c88888888888883", "5333333333333333",
];

describe("sprites", () => {
  it("are rectangular grids of known palette keys", () => {
    for (const [name, rows] of allSprites()) {
      expect(rows.length, name).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.length)).size, name).toBe(1);
      expect(() => spriteSvg(rows), name).not.toThrow();
    }
  });

  it("draw the titlebar boxes pixel for pixel", () => {
    expect(SPRITES.zoom).toEqual(ZOOM);
    expect(SPRITES.collapse).toEqual(COLLAPSE);
    expect(SPRITES.zoomPressed.slice(0, 8)).toEqual(ZOOM_PRESSED_TOP);
  });

  it("compile runs of one color into a single crisp path", () => {
    expect(spriteSvg(["ff8", ".f."])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"' +
      ' shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h2v1H0z' +
      'M1 1h1v1H1z"/><path fill="#888888" d="M2 0h1v1H2z"/></svg>');
    expect(() => spriteSvg(["x"])).toThrow(/palette key/);
  });

  it("expose every sprite as a custom property", () => {
    const css = spriteCss();
    for (const name of ["close-pressed", "grow-inactive", "fill-right",
                        "button-default-pressed", "scroll-thumb"])
      expect(css).toContain(`--osm-sprite-${name}: url("data:image/svg+xml,`);
  });

  it("draw the horizontal scroll bar pixel for pixel", () => {
    // Mac OS 8.0's Desktop Pictures, the scroll bar under its preview:
    // both arrows, and the track's first three columns after the thumb.
    expect(CONTROL_SPRITES["scroll-left"]).toEqual(LEFT_ARROW);
    expect(CONTROL_SPRITES["scroll-right"]).toEqual(RIGHT_ARROW);
    const track = CONTROL_SPRITES["scroll-htrack-left"]!.map((r, y) =>
      r + CONTROL_SPRITES["scroll-htrack"]![y]);
    expect(track).toEqual(TRACK_START);
  });

  it("draw the sort order button as measured", () => {
    expect(CONTROL_SPRITES["sortdir"]).toEqual(SORTDIR);
    // The reversed state (not captured) keeps the frame and stacks the
    // same dark steps widest first, each but the last over a shade
    // line as wide.
    const rev = CONTROL_SPRITES["sortdir-reversed"]!;
    expect(rev.slice(0, 6)).toEqual(SORTDIR.slice(0, 6));
    expect(rev.slice(13)).toEqual(SORTDIR.slice(13));
    expect([rev[6], rev[8], rev[10], rev[12]])
      .toEqual([SORTDIR[12], SORTDIR[10], SORTDIR[8], SORTDIR[6]]);
    for (const y of [7, 9, 11]) {
      expect(rev[y]!.slice(2, 14))
        .toBe(rev[y - 1]!.slice(2, 14).replace(/[0-5]/g, "b"));
    }
  });

  it("draw the alert icons as measured", () => {
    // Mac OS 8.0's Finder alerts (stop, caution) and the Mac OS 8 HIG's
    // figure 3-6 (note): first and last rows, and the caution icon's
    // base.
    const stop = ALERT_SPRITES["alert-stop"]!;
    expect(stop[0]).toBe("........RRRRRRRRRRRRRRRR........");
    expect(stop[31]).toBe(".......fMNNNNNNNNNNNNNNNf.......");
    expect(ALERT_SPRITES["alert-caution"]![29])
      .toBe("00kkkkkkkkkkkkkkkkkkkkkkkkkkkk00");
    expect(ALERT_SPRITES["alert-note"]![1])
      .toBe("2fffffffK44444444444444444444442");
    for (const rows of Object.values(ALERT_SPRITES)) {
      expect(rows.length).toBe(32);
      expect(rows.every((r) => r.length === 32)).toBe(true);
    }
    const css = spriteCss();
    for (const name of ["alert-stop", "alert-caution", "alert-note",
                        "stripe-alert-lo"])
      expect(css).toContain(`--osm-sprite-${name}: url("data:image/svg+xml,`);
    expect(spriteSvg(SPRITES.stripeAlertLo)).toContain('fill="#ff6666"');
  });

  it("reject palette keys that can't be told from grays", () => {
    expect(() => spriteSvg(["a"], { a: "#ff0000" })).toThrow(/palette key/);
    expect(() => spriteSvg(["y"], { yy: "#ff0000" })).toThrow(/palette key/);
  });

  it("draw app sprites with an app palette", () => {
    expect(spriteSvg(["y"], { y: "#ffcc00" })).toContain('fill="#ffcc00"');
    expect(spriteCss([["icon-fish", ["y."]]], { y: "#ffcc00" }))
      .toMatch(/^--osm-sprite-icon-fish: url\("data:image\/svg\+xml,/);
  });

  it("mark the accent's A0 and the progress center with w and h", () => {
    // Lavender's A0 is the gray it replaced, the center row white.
    expect(spriteSvg(["wh"])).toContain('fill="#eeeeee"');
    expect(spriteSvg(["wh"])).toContain('fill="#ffffff"');
    const at = (name: string, x: number, y: number) =>
      CONTROL_SPRITES[name]![y]![x];
    for (const [x, y] of [[1, 1], [4, 4], [4, 6], [4, 8], [4, 10]])
      expect(at("scroll-thumb", x!, y!)).toBe("w");
    for (const [x, y] of [[1, 1], [4, 3], [6, 3], [8, 3]])
      expect(at("slider-thumb", x!, y!)).toBe("w");
    expect(SPRITES.fill[4]).toBe("h");
    expect(SPRITES.fillLeft.slice(3, 6)).toEqual(["mh", "mh", "mh"]);
  });
});

// Mac OS 8.0's Appearance Extension, 'CDEF' 5 "Progress Bar": the
// accent entry and the gray of each of the barber pole's ten rows (the
// table the CDEF builds at 0x12e2), A5 A4 A3 A2 A1 A2 A3 A4 A5 A6 over
// 55 77 aa bb ff dd bb 99 77 55; A2 over dd in an inactive window.
const POLE = { accent: "jlmpqpmljn", gray: "57abfdb975" };
const POLE_INACTIVE = { accent: "pppppppppp", gray: "dddddddddd" };

/** Mac OS 8.0's CDEF 5 drawing the barber pole's rows (0x1054-0x1264),
 * emulated for an inner width `w`. Its phases 1 to 4 start row 0 with
 * an 8px gray run, a 4px accent run, an 8px accent run and a 4px gray
 * run; each row's first run is 1px longer than the row above's, and
 * after 8px it becomes 1px of the other color. Every run is a QuickDraw
 * Line clamped to right - 1, where the pen stops. Returns "A" (accent)
 * or "g" (gray) per pixel of each row. */
function cdefRows(w: number, phase: 1 | 2 | 3 | 4): string[] {
  let [len, grayFirst]: [number, boolean] = [
    ...([[8, true], [4, false], [8, false], [4, true]] as const)[phase - 1]!];
  const rows: string[] = [];
  for (let r = 0; r < 10; r++) {
    const px: string[] = [];
    let h = 0;
    let color = grayFirst ? "g" : "A";
    let run: number = len;
    do {
      let d = run;
      if (h + d >= w - 1) d = w - h - 1;
      if (d > 0) {
        for (let x = h; x <= h + d; x++) px[x] = color;
        h += d;
      }
      color = color === "A" ? "g" : "A";
      run = 8;
    } while (w - 1 > h);
    rows.push(px.join(""));
    if (++len > 8) {
      len = 1;
      grayFirst = !grayFirst;
    }
  }
  return rows;
}

describe("the indeterminate progress bar", () => {
  const css = readFileSync(join(process.cwd(), "osmium.css"), "utf8");
  const TICK = 1000 / 60.15;

  it("tiles the CDEF's stripes, one pixel further right each row", () => {
    for (const [tile, rows] of [[SPRITES.barber, POLE],
                                [SPRITES.barberInactive, POLE_INACTIVE]] as const) {
      expect(tile).toHaveLength(10);
      tile.forEach((row, r) => {
        const want = Array.from({ length: 16 }, (_, x) =>
          (x - r + 16) % 16 < 8 ? rows.accent[r] : rows.gray[r]).join("");
        expect(row, `row ${r}`).toBe(want);
      });
    }
    // Lavender's A5, a key only the barber pole uses.
    expect(spriteSvg(["j"])).toContain('fill="#000088"');
  });

  it("steps 4px right, alternately 6 and 19 ticks apart", () => {
    const frames = [...css.matchAll(
      /(\d+)% \{ background-position: (\d+)px 0, (\d+)px 0; \}/g)]
      .map((m) => m.slice(1).map(Number) as [number, number, number]);
    expect(frames.map(([pct]) => pct)).toEqual([0, 12, 50, 62, 100]);
    frames.forEach(([, a, b], i) => {
      expect(a).toBe(8 + 4 * i);
      expect(b).toBe(a + 1);
    });
    const ms = Number(css.match(
      /animation: osm-barber (\d+)ms step-end infinite;/)![1]);
    expect(ms / TICK).toBeCloseTo(50, 1);
    const holds = frames.slice(1).map(([pct], i) =>
      Math.round((pct - frames[i]![0]) / 100 * ms / TICK));
    expect(holds).toEqual([6, 19, 6, 19]);
  });

  it("holds still for reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.osm-progress\.osm-indeterminate > \.osm-progress-track \{ animation: none; \}/);
  });

  it("dims to A2 and dd in an inactive window", () => {
    expect(css).toMatch(/\.osm-inactive \.osm-progress\.osm-indeterminate > \.osm-progress-track \{\s*background-image: var\(--osm-sprite-barber-inactive\),\s*var\(--osm-sprite-barber-inactive\);/);
  });

  it("draws the CDEF's phases at any width, last column too", () => {
    // Paints the track as osmium.css declares it. Its padding box is
    // the CDEF's inner rect, w px wide inside the black edge, and the
    // rule's own padding narrows the content box. Each background layer
    // repeats the tile along x from its origin box's left edge, moved
    // by its position, and paints only inside its clip box (one box
    // sets both, none means padding-box and border-box); the first
    // layer is on top. Unanimated, and at each keyframe, the track must
    // show what the CDEF draws in its first phase and in the phase that
    // step brings, including the last column, which QuickDraw never
    // started a stripe in and which repeats the one before it.
    const rule = css.match(
      /^\.osm-progress\.osm-indeterminate > \.osm-progress-track \{([^}]*)\}/m)![1]!;
    expect(rule.match(/padding[\w-]*:/g)).toEqual(["padding-right:"]);
    const pad = Number(rule.match(/padding-right: (\d+)px;/)?.[1] ?? 0);
    const layers = rule.match(/background:([^;]*);/)![1]!.split(",").map((l) => {
      const m = l.trim().replace(/\s+/g, " ").match(
        /^var\(--osm-sprite-barber\) (-?\d+)px 0 \/ 16px 10px repeat-x((?: [a-z]+-box){0,2})$/);
      expect(m, l).not.toBeNull();
      const b = m![2]!.split(" ").filter(Boolean);
      return { x: Number(m![1]), origin: b[0] ?? "padding-box",
               clip: b[1] ?? b[0] ?? "border-box" };
    });
    const frames = [...css.matchAll(
      /(\d+)% \{ background-position: ([^;]+); \}/g)].map((m) =>
      m[2]!.split(",").map((p) => Number(p.trim().match(/^(-?\d+)px 0$/)![1])));
    expect(frames).toHaveLength(5);
    const paint = (w: number, xs: readonly number[]) => {
      const box: Record<string, readonly [number, number]> = {
        "border-box": [-1, w + 1], "padding-box": [0, w],
        "content-box": [0, w - pad],
      };
      return SPRITES.barber.map((line, r) =>
        Array.from({ length: w }, (_, x) => {
          let px = "?";
          for (let i = layers.length - 1; i >= 0; i--) {
            const { origin, clip } = layers[i]!;
            if (x < box[clip]![0] || x >= box[clip]![1]) continue;
            const col = (((x - box[origin]![0] - xs[i]!) % 16) + 16) % 16;
            px = line[col] === POLE.accent[r] ? "A" : "g";
          }
          return px;
        }).join(""));
    };
    const cases: [string, readonly number[], 1 | 2 | 3 | 4][] = [
      ["unanimated", layers.map((l) => l.x), 1],
      ...frames.map((xs, i) => [`keyframe ${i}`, xs, (i % 4) + 1] as
        [string, number[], 1 | 2 | 3 | 4]),
    ];
    for (let w = 2; w <= 200; w++)
      for (const [name, xs, phase] of cases)
        expect(paint(w, xs), `width ${w}, ${name}`).toEqual(cdefRows(w, phase));
  });
});

describe("titleLeft", () => {
  // [window width, title width, title x] from Mac OS 8.0 windows:
  // Finder "Mac OS 8 full", Appearance, Desktop Pictures, About This
  // Computer, Key Caps.
  it("matches the Window Manager's centering", () => {
    for (const [w, t, x] of [[416, 77, 169], [396, 77, 159], [442, 106, 168],
                             [478, 130, 174], [492, 56, 218]] as const)
      expect(titleLeft(w, t)).toBe(x);
  });
});

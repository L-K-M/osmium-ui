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
    // same dark steps widest first, each over a shade line as wide.
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

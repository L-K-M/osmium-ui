// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { emboldened, strikeGlyphs } from "./bitmapfont.js";
import { GENEVA_9 } from "./fonts/geneva9.js";
import { buildPixelFont } from "./ttf.js";

it("registers Geneva 9 in QuickDraw-synthesized bold too", async () => {
  // happy-dom has no FontFace or document.fonts: record what's added.
  const faces: { family: string; bytes: Uint8Array; weight: string }[] = [];
  vi.stubGlobal("FontFace", class {
    constructor(family: string, buf: ArrayBuffer, d: { weight: string }) {
      faces.push({ family, bytes: new Uint8Array(buf), weight: d.weight });
    }
    load() { return Promise.resolve(this); }
  });
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts");
  Object.defineProperty(document, "fonts", { value: { add() {} },
                                             configurable: true });
  const { installOsmium } = await import("./install.js");
  await installOsmium();
  vi.unstubAllGlobals();
  if (fonts) Object.defineProperty(document, "fonts", fonts);
  else delete (document as { fonts?: unknown }).fonts;

  const g9 = faces.filter((f) => f.family === GENEVA_9.family);
  expect(g9.map((f) => f.weight)).toEqual(["400", "700"]);
  const bold = buildPixelFont({
    family: GENEVA_9.family, bold: true, sizePx: GENEVA_9.sizePx,
    ascent: GENEVA_9.ascent, descent: GENEVA_9.descent,
    glyphs: emboldened(strikeGlyphs(GENEVA_9)),
  });
  expect(g9[1]!.bytes).toEqual(bold);
});

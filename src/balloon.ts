// Balloon Help, the Mac OS 8 Help Manager's help balloons: a message in
// a white, black-outlined balloon whose tail points at the thing it
// explains. Looks come from osmium.css (.osm-balloon) and the balloon
// sprites in controlsprites.ts, measured from Mac OS 8.0 (the same
// shape in System 7.5.3, 8.5 and 9.0).
//
// As in Mac OS, the reader turns Balloon Help on and off for the whole
// page (Show Balloons / Hide Balloons in a Help menu, balloonMenuItem),
// and while it is on, a balloon opens once the pointer rests on a
// target for a tenth of a second and closes the moment the pointer
// leaves the target. One balloon is open at a time. Apps without a
// Help menu can use the "hover" trigger instead, which Mac OS didn't
// have. The target stays a native element: the balloon is its
// aria-describedby description whether it shows or not.
//
// Sizing, from 11 balloons measured in Mac OS 8.0: the text box is
// T x 12n (n lines of Geneva 9), the outline (T + 24) x (12n + 24),
// plus the 1px shadow. T comes from a golden-ratio search (see
// balloonTextBox) and plain text wraps the way TextEdit wraps it.
//
// What this module leaves out of Mac OS and why is listed in the
// README; in short: keyboard focus and Escape are added for
// accessibility, touch has no long-press (touch readers get the
// description), and balloons are not "hoverable" (WCAG 1.4.13): they
// ignore the pointer and close when it leaves the target, as the Help
// Manager's did.
import { inside } from "./controls.js";
import { GENEVA_9 } from "./fonts/geneva9.js";
import { installOsmium } from "./install.js";
import type { MenuItem } from "./menubar.js";

/** Where the tail leaves the balloon, and so where its tip is: the side
 * the tail comes out of, then the end of that side it sits near. Inside
 * Macintosh's variation codes 0-7 (More Macintosh Toolbox, fig. 3-4), in
 * order: "left-top" 0, "top-left" 1, "top-right" 2, "right-top" 3,
 * "right-bottom" 4, "bottom-right" 5, "bottom-left" 6, "left-bottom" 7. */
export type BalloonVariant =
  | "left-top" | "top-left" | "top-right" | "right-top"
  | "right-bottom" | "bottom-right" | "bottom-left" | "left-bottom";

/** Balloon Help's page-wide state, as Show Balloons / Hide Balloons in
 * the Help menu sets it. */
export type BalloonHelpState = "shown" | "hidden";

/** When a target's balloon opens. */
export type BalloonTrigger =
  /** Mac OS 8: only while Balloon Help is shown, once the pointer has
   * rested on the target for a tenth of a second. */
  | "balloon-help"
  /** Not in Mac OS 8, for apps without a Help menu: also while Balloon
   * Help is hidden, once the pointer (or keyboard focus) has rested on
   * the target for `delay` ms. While shown, it behaves as above. */
  | "hover";

/** Where the tip points. */
export type BalloonTip =
  /** At a fixed point of the target: the Help Manager's default tip for
   * a dialog item, 10px in from the target's right and bottom edges
   * (Inside Macintosh, 'hdlg' resources), transposed across the target
   * when the balloon has to flip to another side. */
  | "anchor"
  /** Where the pointer came to rest, the tip one pixel right of and
   * below the hot spot. Observed on Finder title-bar balloons only
   * (one capture per variant, and an inactive window's balloon measured
   * two pixels right instead); keyboard focus and show() use "anchor". */
  | "pointer";

/** A help message: plain text, whose "\n" starts a new line (an empty
 * line is a 12px blank line, as in Apple's "Title\n\nExplanation"
 * balloons), or a Node, deep-cloned into the balloon each time it opens
 * (build it once; listeners and ids are not kept, balloons can't be
 * clicked). */
export type BalloonContent = string | Node;

export interface BalloonOptions {
  /** The message, or a function called each time the balloon opens, so
   * it can follow the target's state (Apple gave dimmed controls their
   * own balloon). */
  content: BalloonContent | (() => BalloonContent);
  /** Preferred variant, tried first; others are tried when it doesn't
   * fit. Default "left-top" (the Help Manager's preferred code 0). */
  variant?: BalloonVariant;
  /** Default "balloon-help". */
  trigger?: BalloonTrigger;
  /** Rest time for "hover" while Balloon Help is hidden, in ms. Default
   * 500, a choice rather than a Mac OS value. */
  delay?: number;
  /** Default "anchor". */
  tip?: BalloonTip;
  /** How far in from the target's edges an "anchor" tip sits, clamped
   * to the target's center. Default { x: 10, y: 10 }. */
  anchor?: { readonly x: number; readonly y: number };
  /** Widest text box, px. Default: the viewport's width less 64. */
  maxWidth?: number;
}

export interface OsmiumBalloon {
  readonly target: HTMLElement;
  /** The role=tooltip element, hidden while closed; the target's
   * aria-describedby names it for as long as the help is attached. */
  readonly element: HTMLElement;
  readonly open: boolean;
  /** Replace the message; an open balloon is laid out again in place. */
  setContent(content: BalloonOptions["content"]): void;
  /** Open now, whatever the trigger and state, with the tip at the
   * anchor. It closes like any other: when the pointer, having been on
   * the target, leaves it. */
  show(): void;
  hide(): void;
  /** Remove the help: close, drop the element, restore
   * aria-describedby. */
  detach(): void;
}

// ---- measured constants ----------------------------------------------------

/** Pointer rest before a balloon opens: "around one-tenth of a
 * second", fixed by the system (More Macintosh Toolbox, p. 3-11). */
export const BALLOON_REST_MS = 100;
/** Default rest for "hover" while Balloon Help is hidden. */
const HOVER_DELAY_MS = 500;
/** Geneva 9's line pitch in balloons, blank lines included. */
export const BALLOON_LINE = 12;
/** Outline minus text box, each way: the pen starts 12px right of the
 * outline's left pixel and the first baseline row is 20px below its
 * top row, with 12px to spare at the right and bottom. */
const OUTLINE_PAD = 24;
/** Border box = outline + the 1px shadow. */
const SHADOW = 1;
/** The golden ratio as the Help Manager rounds it, in thousandths so
 * that floor() is exact: floor(1.618 * 144) is 232, not 233. */
const GOLDEN_MILLI = 1618;
/** Room kept either side of the widest default text box. */
const VIEWPORT_MARGIN = 32;
/** Where an "anchor" tip sits by default: 10px in from the target's
 * right and bottom edges, the Help Manager's default dialog-item tip. */
const DEFAULT_ANCHOR = { x: 10, y: 10 } as const;
/** Width assumed per character when nothing can measure a fallback
 * glyph (no canvas): Geneva 9's typical lowercase advance. */
const FALLBACK_ADVANCE = 6;

const VARIANTS: readonly BalloonVariant[] = [
  "left-top", "top-left", "top-right", "right-top",
  "right-bottom", "bottom-right", "bottom-left", "left-bottom",
];

/** An outline corner pixel: left-top, right-top, left-bottom,
 * right-bottom. */
type Corner = "lt" | "rt" | "lb" | "rb";

interface Tail {
  readonly corner: Corner;
  /** The overlay's top-left, from the corner pixel. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** The tip pixel, from the corner pixel. */
  readonly tip: readonly [number, number];
}

/** Each variant's tail overlay (the balloon-<variant> sprites) and tip,
 * measured from the Mac OS 8.0 captures listed in controlsprites.ts.
 * osmium.css places the same overlays. */
export const TAILS: Readonly<Record<BalloonVariant, Tail>> = {
  "left-top": { corner: "lt", x: -16, y: 1, w: 17, h: 16, tip: [-16, 1] },
  "top-left": { corner: "lt", x: 1, y: -17, w: 17, h: 18, tip: [1, -17] },
  "top-right": { corner: "rt", x: -15, y: -16, w: 16, h: 17, tip: [0, -16] },
  "right-top": { corner: "rt", x: 0, y: 1, w: 19, h: 17, tip: [18, 1] },
  "right-bottom": { corner: "rb", x: 0, y: -16, w: 20, h: 18, tip: [19, 1] },
  "bottom-right": { corner: "rb", x: -15, y: 0, w: 17, h: 19, tip: [1, 18] },
  "bottom-left": { corner: "lb", x: 0, y: 0, w: 18, h: 20, tip: [0, 19] },
  "left-bottom": { corner: "lb", x: -17, y: -15, w: 18, h: 17, tip: [-17, 1] },
};

// ---- pure layout rules (exported for tests, not from index.ts) ---------------

const side = (v: BalloonVariant) => v.split("-")[0]!;
const end = (v: BalloonVariant) => v.split("-")[1]!;
const flip: Record<string, string> = {
  left: "right", right: "left", top: "bottom", bottom: "top",
};
const mirrorX = (v: BalloonVariant): BalloonVariant => v.replace(
  /left|right/g, (m) => flip[m]!) as BalloonVariant;
const mirrorY = (v: BalloonVariant): BalloonVariant => v.replace(
  /top|bottom/g, (m) => flip[m]!) as BalloonVariant;
const adjacent = (v: BalloonVariant): BalloonVariant =>
  `${end(v)}-${side(v)}` as BalloonVariant;

/** The candidates tried, in order: `preferred`, its left/right mirror,
 * top/bottom mirror, both, then the same four with the tail moved to
 * the adjacent side ("left-top" <-> "top-left"). Mac OS 8's own order
 * wasn't measured, only that balloons flip this way near screen edges;
 * Inside Macintosh says the Help Manager transposes the tip across the
 * hot rectangle and tries other variation codes. */
export function variantOrder(preferred: BalloonVariant): BalloonVariant[] {
  const four = (v: BalloonVariant) =>
    [v, mirrorX(v), mirrorY(v), mirrorX(mirrorY(v))];
  return [...four(preferred), ...four(adjacent(preferred))];
}

let advances: Map<number, number> | undefined;

/** Advance of `s` in Geneva 9, summed from the strike in whole pixels,
 * as QuickDraw measured it. Runs of characters the strike lacks (emoji,
 * arrows, most non-Latin scripts) are measured by `fallback`, which
 * should report how wide the browser's fallback font draws them. */
export function geneva9Advance(s: string,
                               fallback: (run: string) => number): number {
  advances ??= new Map(GENEVA_9.glyphs.map(([cp, adv]) => [cp, adv]));
  let total = 0;
  let missing = "";
  for (const ch of s) {
    const adv = advances.get(ch.codePointAt(0)!);
    if (adv === undefined) {
      missing += ch;
      continue;
    }
    if (missing) total += fallback(missing);
    missing = "";
    total += adv;
  }
  return missing ? total + fallback(missing) : total;
}

const trimEnd = (s: string) => s.replace(/ +$/, "");

/** TextEdit-style wrap of plain text into a text box `width` wide:
 * paragraphs at "\n" (an empty one is a blank line), breaks after
 * spaces, and a word wider than a line broken by character. A line fits
 * when its advance, trailing spaces left out, is at most width - 1:
 * "title bar and drag the window." (135px) didn't fit Mac OS 8.0's 135px
 * balloon. */
export function wrapBalloonText(text: string, width: number,
                                advance: (s: string) => number): string[] {
  const fits = (s: string) => advance(trimEnd(s)) <= width - 1;
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.match(/[^ ]+ *| +/g) ?? []) {
      if (line && !fits(line + word)) {
        lines.push(trimEnd(line));
        line = "";
      }
      line += word;
      // A word too wide for any line: break it where it overflows,
      // keeping at least one character per line.
      while (!fits(line)) {
        const chars = [...trimEnd(line)];
        let n = chars.length - 1;
        while (n > 1 && !fits(chars.slice(0, n).join(""))) n--;
        if (n < 1 || n >= chars.length) break;
        lines.push(chars.slice(0, n).join(""));
        line = line.slice(chars.slice(0, n).join("").length);
      }
    }
    lines.push(trimEnd(line));
  }
  return lines;
}

/** The text box the Help Manager gives a message, found by the
 * golden-ratio search of Apple's US patent 5,428,733 (the link from
 * that patent to Balloon Help is inferred; the patent doesn't name it):
 * for heights H = 12, 24, 36, ..., try text widths floor(1.618 (H - 12)),
 * floor(1.618 H) and floor(1.618 (H + 12)); the first width at which
 * the message is at most H tall wins. `height(w)` is the message's
 * height at text width w.
 *
 * With plain Geneva 9 text wrapped by wrapBalloonText, this reproduces
 * the width and line breaks of all 11 fully read Mac OS 8.0 balloons,
 * whose widths are 97, 116, 135 and 174. It does not reproduce the
 * "Turns Balloon help off." balloon of the Help menu's Hide Balloons
 * item (System 7.5.3, Mac OS 8.5 and 9.0), drawn 58 wide in 3 lines
 * where this gives 38 in 3; why is unexplained. Treat the widths as a
 * model beyond the measured cases, short messages especially.
 *
 * Candidate widths are clamped to `maxWidth`. Once every candidate is
 * clamped the answer is maxWidth, whatever the height, so the search
 * always ends. Each width is measured once. */
export function balloonTextBox(height: (width: number) => number,
                               maxWidth: number):
    { width: number; height: number } {
  const cap = Math.max(1, Math.floor(maxWidth));
  const measured = new Map<number, number>();
  const heightAt = (w: number) => {
    let h = measured.get(w);
    if (h === undefined) measured.set(w, h = height(w));
    return h;
  };
  const golden = (h: number) => Math.floor(h * GOLDEN_MILLI / 1000);
  for (let h = BALLOON_LINE; ; h += BALLOON_LINE) {
    if (golden(h - BALLOON_LINE) >= cap) return { width: cap, height: heightAt(cap) };
    for (const g of [h - BALLOON_LINE, h, h + BALLOON_LINE].map(golden)) {
      if (g <= 0) continue;
      const w = Math.min(g, cap);
      if (heightAt(w) <= h) return { width: w, height: heightAt(w) };
    }
  }
}

function cornerAt(c: Corner, w: number, h: number): { x: number; y: number } {
  return { x: c[0] === "l" ? 0 : w - 1, y: c[1] === "t" ? 0 : h - 1 };
}

/** Where the tip pixel sits in the balloon's border box (a w x h
 * outline plus its shadow) for each variant. */
export function tipOffset(v: BalloonVariant, w: number,
                          h: number): { x: number; y: number } {
  const t = TAILS[v];
  const c = cornerAt(t.corner, w, h);
  return { x: c.x + t.tip[0], y: c.y + t.tip[1] };
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The balloon's whole extent, tail included, in its border box's
 * coordinates. */
function extent(v: BalloonVariant, w: number, h: number): Rect {
  const t = TAILS[v];
  const c = cornerAt(t.corner, w, h);
  const x = c.x + t.x, y = c.y + t.y;
  return {
    left: Math.min(0, x), top: Math.min(0, y),
    right: Math.max(w + SHADOW, x + t.w), bottom: Math.max(h + SHADOW, y + t.h),
  };
}

const shift = (r: Rect, dx: number, dy: number): Rect => ({
  left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy,
});
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const within = (a: Rect, b: Rect) =>
  a.left >= b.left && a.top >= b.top && a.right <= b.right &&
  a.bottom <= b.bottom;
const area = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

export interface BalloonPlacement {
  readonly variant: BalloonVariant;
  /** The border box's top-left, client px. */
  readonly left: number;
  readonly top: number;
  /** How far the balloon is taller than `bounds` allow when nothing
   * fit, in px (the message is clipped by that much); 0 otherwise. */
  readonly clip: number;
}

/** Pick the first variant in variantOrder(preferred) whose balloon (a
 * w x h outline, shadow and tail included) with its tip on
 * tipFor(variant) lies inside `bounds` and clear of every `avoid`
 * rectangle (a menu bar: the Help Manager keeps balloons out of it). If
 * none fits, the one with the largest area inside bounds, moved into
 * them, with `clip` saying how much of it still doesn't fit. Pure. */
export function placeBalloon(w: number, h: number, preferred: BalloonVariant,
                             tipFor: (v: BalloonVariant) => { x: number; y: number },
                             bounds: Rect, avoid: readonly Rect[] = []):
    BalloonPlacement {
  let best: { v: BalloonVariant; left: number; top: number; area: number } | null =
    null;
  for (const v of variantOrder(preferred)) {
    const tip = tipFor(v);
    const off = tipOffset(v, w, h);
    const left = tip.x - off.x, top = tip.y - off.y;
    const box = shift(extent(v, w, h), left, top);
    if (within(box, bounds) && !avoid.some((a) => overlaps(box, a)))
      return { variant: v, left, top, clip: 0 };
    const a = area(box, bounds);
    if (!best || a > best.area) best = { v, left, top, area: a };
  }
  // Nothing fits: move the best into bounds, keeping its top edge on
  // screen when it is too tall, and clip what's left.
  const { v, left, top } = best!;
  const e = extent(v, w, h);
  const box = shift(e, left, top);
  const dx = Math.max(bounds.left - box.left,
                      Math.min(0, bounds.right - box.right));
  const dy = Math.max(bounds.top - box.top,
                      Math.min(0, bounds.bottom - box.bottom));
  const clip = Math.max(0, (e.bottom - e.top) - (bounds.bottom - bounds.top));
  return { variant: v, left: left + dx, top: top + dy, clip };
}

/** The tip for an "anchor" balloon of variant `v` on a target at `r`:
 * `inset` in from the corner of the target on the side the balloon's
 * body leaves from, so the body grows away from the target's middle.
 * Transposed across the target for the other variants, as the Help
 * Manager transposes a tip across its hot rectangle. */
export function anchorTip(r: Rect, v: BalloonVariant,
                          inset: { readonly x: number; readonly y: number }):
    { x: number; y: number } {
  const ix = Math.max(0, Math.min(inset.x, Math.floor((r.right - r.left) / 2)));
  const iy = Math.max(0, Math.min(inset.y, Math.floor((r.bottom - r.top) / 2)));
  // The body lies right of the tip when the tail sits at the balloon's
  // left, and below it when the tail sits at its top.
  const bodyRight = /left/.test(v);
  const bodyBelow = /top/.test(v);
  return {
    x: bodyRight ? Math.round(r.right) - ix : Math.round(r.left) + ix,
    y: bodyBelow ? Math.round(r.bottom) - iy : Math.round(r.top) + iy,
  };
}

// ---- Balloon Help's state ---------------------------------------------------

let state: BalloonHelpState = "hidden";
const listeners = new Set<(s: BalloonHelpState) => void>();

/** Whether Balloon Help is shown. Starts "hidden", as in Mac OS. */
export function balloonHelp(): BalloonHelpState {
  return state;
}

/** Show or hide Balloon Help for the page. Hiding closes an open
 * balloon the pointer or keyboard opened under the "balloon-help"
 * trigger at once, as Hide Balloons does (a hovered "hover" balloon, or
 * one opened with show(), stays). Listeners run only on a change. */
export function setBalloonHelp(next: BalloonHelpState): void {
  if (next !== "shown" && next !== "hidden")
    throw new TypeError(`unknown Balloon Help state "${String(next)}"`);
  if (next === state) return;
  state = next;
  if (state === "hidden" && current && current.opener !== "show" &&
      current.att.trigger === "balloon-help") close();
  updateTracking();
  // Every listener runs; one that throws is reported afterwards
  // without stopping the others.
  for (const l of [...listeners]) {
    try {
      l(state);
    } catch (err) {
      queueMicrotask(() => { throw err; });
    }
  }
}

/** Call `listener` after every change; returns the unsubscribe
 * function. */
export function onBalloonHelpChange(
  listener: (state: BalloonHelpState) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The Help menu command: "Show Balloons" or "Hide Balloons" to match
 * the state, toggling it. Menu items are built each time a menu opens,
 * so
 *   { title: "Help", items: () => [about, MENU_SEPARATOR,
 *       balloonMenuItem(), MENU_SEPARATOR, appHelp] }
 * always shows the right title (the layout of Mac OS 8.0's Finder Help
 * menu). Mac OS 8.0's "Hide Balloons" wasn't captured; the title is
 * System 7.5.3's and Mac OS 8.5's. */
export function balloonMenuItem(): MenuItem {
  const shown = state === "shown";
  return {
    title: shown ? "Hide Balloons" : "Show Balloons",
    action: () => setBalloonHelp(shown ? "hidden" : "shown"),
  };
}

// ---- attachments ------------------------------------------------------------

interface Attachment {
  readonly target: HTMLElement;
  readonly el: HTMLElement;
  readonly text: HTMLElement;
  readonly trigger: BalloonTrigger;
  readonly variant: BalloonVariant;
  readonly delay: number;
  readonly tip: BalloonTip;
  readonly anchor: { readonly x: number; readonly y: number };
  readonly maxWidth: number | undefined;
  content: BalloonOptions["content"];
  detach(): void;
}

/** What opened the current balloon, which decides what closes it. */
type Opener =
  /** The pointer resting on the target: closes when it leaves. */
  | "pointer"
  /** Keyboard focus: closes on focusout, ignores the pointer. */
  | "focus"
  /** show(): closes when the pointer, once on the target, leaves. */
  | "show";

interface OpenBalloon {
  readonly att: Attachment;
  readonly opener: Opener;
  /** The rest point for a "pointer" tip; null anchors it. */
  readonly point: { x: number; y: number } | null;
  /** Whether the pointer has been seen on the target since opening. */
  pointerIn: boolean;
}

const attached = new WeakMap<Element, Attachment>();
/** Live attachments, and how many have the "hover" trigger: tracking
 * runs only while one of them could open. */
let count = 0;
let hoverCount = 0;
let current: OpenBalloon | null = null;
/** A balloon closed with Escape stays closed until the pointer or the
 * keyboard moves to another target (WCAG 1.4.13, dismissible). */
let dismissed: Attachment | null = null;
let seq = 0;

/** The attachment of `node` or its nearest attached ancestor: the
 * innermost wins, like the most specific hot rectangle. */
function attachmentFor(node: EventTarget | null): Attachment | null {
  let e: Element | null = node instanceof Element ? node
    : node instanceof Node ? node.parentElement : null;
  for (; e; e = e.parentElement) {
    const a = attached.get(e);
    if (a) return a;
  }
  return null;
}

/** Give `target` a help balloon. Throws if the target already has one
 * (detach it first) or an option is out of range.
 *
 * A target with a `title` attribute also gets the browser's own
 * tooltip next to the balloon; drop the title (the balloon is the
 * target's description anyway) or keep it only in aria-label. A target
 * removed from the page without detach() keeps its balloon element in
 * the body until the balloon next tries to open, which detaches it;
 * frameworks should call detach() when they unmount the target. */
export function attachBalloon(target: HTMLElement,
                              opts: BalloonOptions): OsmiumBalloon {
  if (attached.has(target))
    throw new Error("the target already has a balloon; detach it first");
  const variant = opts.variant ?? "left-top";
  if (!VARIANTS.includes(variant))
    throw new TypeError(`unknown balloon variant "${String(variant)}"`);
  const trigger = opts.trigger ?? "balloon-help";
  if (trigger !== "balloon-help" && trigger !== "hover")
    throw new TypeError(`unknown balloon trigger "${String(trigger)}"`);
  const tip = opts.tip ?? "anchor";
  if (tip !== "anchor" && tip !== "pointer")
    throw new TypeError(`unknown balloon tip "${String(tip)}"`);
  const delay = opts.delay ?? HOVER_DELAY_MS;
  if (!Number.isFinite(delay) || delay < 0)
    throw new RangeError(`balloon delay ${delay} is not a time in ms`);
  if (opts.maxWidth !== undefined &&
      !(Number.isFinite(opts.maxWidth) && opts.maxWidth >= 1))
    throw new RangeError(`balloon maxWidth ${opts.maxWidth} is not a width`);
  void installOsmium().catch(() => {});

  const el = document.createElement("div");
  el.className = "osm-balloon";
  el.id = `osm-balloon-${++seq}`;
  el.setAttribute("role", "tooltip");
  el.hidden = true;
  const text = document.createElement("div");
  text.className = "osm-balloon-text";
  el.append(text);
  document.body.append(el);
  const described = target.getAttribute("aria-describedby");
  target.setAttribute("aria-describedby",
                      described ? `${described} ${el.id}` : el.id);

  const att: Attachment = {
    target, el, text, trigger, variant, delay, tip,
    anchor: opts.anchor ?? DEFAULT_ANCHOR,
    maxWidth: opts.maxWidth,
    content: opts.content,
    detach,
  };
  attached.set(target, att);
  count++;
  if (trigger === "hover") hoverCount++;
  fill(att, resolve(att));
  updateTracking();

  let live = true;
  function detach(): void {
    if (!live) return;
    live = false;
    if (current?.att === att) close();
    if (dismissed === att) dismissed = null;
    if (hovered === att) hovered = null;
    attached.delete(target);
    count--;
    if (trigger === "hover") hoverCount--;
    el.remove();
    // Take out only our id: the app may have changed the rest since.
    const ids = (target.getAttribute("aria-describedby") ?? "")
      .split(/\s+/).filter((id) => id && id !== el.id);
    if (ids.length) target.setAttribute("aria-describedby", ids.join(" "));
    else target.removeAttribute("aria-describedby");
    updateTracking();
  }

  return {
    target,
    element: el,
    get open() { return current?.att === att; },
    setContent(content) {
      if (!live) return;
      att.content = content;
      const c = resolve(att);
      if (current?.att === att) layOut(current, c);
      else fill(att, c);
    },
    show() {
      if (live) open(att, "show", null);
    },
    hide() {
      if (current?.att === att) close();
    },
    detach,
  };
}

function resolve(att: Attachment): BalloonContent {
  return typeof att.content === "function" ? att.content() : att.content;
}

const MEDIA = "img, svg, picture, canvas, video";

function isEmpty(c: BalloonContent): boolean {
  if (typeof c === "string") return c.trim() === "";
  if ((c.textContent ?? "").trim() !== "") return false;
  if (c instanceof Element && c.matches(MEDIA)) return false;
  return !(c instanceof Element || c instanceof DocumentFragment) ||
    c.querySelector(MEDIA) === null;
}

/** A copy of `node` for the balloon, without ids (they would repeat
 * ones in the page, or in the balloon's last showing). */
function copy(node: Node): Node {
  const clone = node.cloneNode(true);
  if (clone instanceof Element) clone.removeAttribute("id");
  if (clone instanceof Element || clone instanceof DocumentFragment)
    for (const e of Array.from(clone.querySelectorAll("[id]")))
      e.removeAttribute("id");
  return clone;
}

/** Put the message in the balloon as it reads when closed: the whole
 * text, for the target's description. */
function fill(att: Attachment, c: BalloonContent): void {
  att.text.classList.toggle("osm-balloon-plain", typeof c === "string");
  att.text.style.maxHeight = "";
  if (typeof c === "string") att.text.textContent = c;
  else att.text.replaceChildren(copy(c));
}

// ---- opening, sizing and placing ---------------------------------------------

/** How wide the browser draws characters Geneva 9 lacks: measured in
 * the balloon's own font stack, whose fallback draws them, rounded up
 * so a line never ends up wider than the model thinks. */
function fallbackAdvance(el: Element): (run: string) => number {
  return (run) => {
    const ctx = (canvas ??= document.createElement("canvas")).getContext("2d");
    if (!ctx) return [...run].length * FALLBACK_ADVANCE;
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return Math.ceil(ctx.measureText(run).width);
  };
}
let canvas: HTMLCanvasElement | undefined;

function viewport(): Rect {
  const d = document.documentElement;
  return { left: 0, top: 0, right: d.clientWidth || window.innerWidth,
           bottom: d.clientHeight || window.innerHeight };
}

/** Menu bars on screen, which balloons keep out of. */
function menuBars(): Rect[] {
  const vp = viewport();
  return Array.from(document.querySelectorAll(".osm-menubar"))
    .map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && overlaps(r, vp));
}

function open(att: Attachment, opener: Opener,
              point: { x: number; y: number } | null): void {
  // A target taken out of the page without detach() is detached now.
  if (!att.target.isConnected) {
    att.detach();
    return;
  }
  // Nothing to point at: Mac OS shows no balloon when both the tip
  // and the alternate rectangle are off screen.
  if (!overlaps(att.target.getBoundingClientRect(), viewport())) return;
  const c = resolve(att);
  if (isEmpty(c)) return;
  if (current && current.att !== att) close();
  const next: OpenBalloon = current?.att === att
    ? { ...current, opener, point }
    : { att, opener, point, pointerIn: opener === "pointer" };
  if (!current) addOpenListeners();
  current = next;
  layOut(next, c);
}

function layOut(b: OpenBalloon, c: BalloonContent): void {
  const { att } = b;
  const { el, text } = att;
  fill(att, c);
  // Measured while laid out but not yet seen.
  el.style.visibility = "hidden";
  el.hidden = false;
  const vp = viewport();
  const maxWidth = att.maxWidth ?? Math.max(1, vp.right - 2 * VIEWPORT_MARGIN);
  let box: { width: number; height: number };
  if (typeof c === "string") {
    // Draw exactly the lines the model broke, so the balloon's line
    // breaks are the measured ones and not the browser's.
    const advance = (s: string) => geneva9Advance(s, fallbackAdvance(el));
    const lines = (w: number) => wrapBalloonText(c, w, advance);
    box = balloonTextBox((w) => lines(w).length * BALLOON_LINE, maxWidth);
    text.textContent = lines(box.width).join("\n");
  } else {
    // Rich content is sized by layout: the browser's line breaking,
    // not TextEdit's.
    box = balloonTextBox((w) => {
      el.style.width = `${w + OUTLINE_PAD + SHADOW}px`;
      return text.offsetHeight;
    }, maxWidth);
  }
  const w = box.width + OUTLINE_PAD, h = box.height + OUTLINE_PAD;
  el.style.width = `${w + SHADOW}px`;

  const r = att.target.getBoundingClientRect();
  const tipFor = (v: BalloonVariant) => b.point && att.tip === "pointer"
    ? { x: Math.round(b.point.x) + 1, y: Math.round(b.point.y) + 1 }
    : anchorTip(r, v, att.anchor);
  const p = placeBalloon(w, h, att.variant, tipFor, vp, menuBars());
  VARIANTS.forEach((v) => el.classList.toggle(`osm-balloon-${v}`,
                                               v === p.variant));
  // Clipped a whole line at a time, as the Help Manager clips.
  if (p.clip > 0) {
    const lines = Math.floor(Math.max(0, box.height - p.clip) / BALLOON_LINE);
    text.style.maxHeight = `${lines * BALLOON_LINE}px`;
  }
  el.style.left = `${p.left}px`;
  el.style.top = `${p.top}px`;
  el.style.visibility = "";
}

function close(): void {
  if (!current) return;
  current.att.el.hidden = true;
  current = null;
  removeOpenListeners();
}

// ---- while a balloon is open --------------------------------------------------

function onOpenMove(e: PointerEvent): void {
  if (!current || e.pointerType === "touch" || current.opener === "focus")
    return;
  if (inside(current.att.target, e.clientX, e.clientY)) {
    current.pointerIn = true;
    return;
  }
  if (current.pointerIn) close();
}

/** Escape closes the balloon. Only preventDefault: bindDialogKeys and
 * hostWindow leave a prevented Escape alone, so the same press doesn't
 * also cancel the dialog or close the window, while other listeners
 * (an open menu, a search field) still see it. */
function onOpenKey(e: KeyboardEvent): void {
  if (e.key !== "Escape" || !current) return;
  dismissed = current.att;
  close();
  e.preventDefault();
}

/** A scroll of the page or of anything around the target moves the
 * target out from under its tip; other scrolls leave it be. */
function onOpenScroll(e: Event): void {
  if (!current) return;
  const t = e.target;
  if (t === document || (t instanceof Node && t.contains(current.att.target)))
    close();
}

function addOpenListeners(): void {
  document.addEventListener("pointermove", onOpenMove,
                            { capture: true, passive: true });
  document.addEventListener("keydown", onOpenKey, true);
  document.addEventListener("scroll", onOpenScroll,
                            { capture: true, passive: true });
  window.addEventListener("resize", close);
  window.addEventListener("blur", close);
}

function removeOpenListeners(): void {
  document.removeEventListener("pointermove", onOpenMove, true);
  document.removeEventListener("keydown", onOpenKey, true);
  document.removeEventListener("scroll", onOpenScroll, true);
  window.removeEventListener("resize", close);
  window.removeEventListener("blur", close);
}

// ---- tracking: only while some balloon could open ---------------------------
// pointerover says which target the pointer is on and pointermove only
// restarts a timer, so tracking costs no layout per move. When the
// pointer has rested, one hit test at the rest point confirms the
// target. Current Chromium (141), Firefox (155) and WebKit (26) send
// pointer events to disabled buttons, so dimmed controls get balloons
// too; older WebKit (WKWebView on macOS 12) wasn't checked.

let tracking = false;
/** The attachment under the pointer, by the last pointerover. */
let hovered: Attachment | null = null;
let restAt = { x: 0, y: 0 };
let restTimer: ReturnType<typeof setTimeout> | undefined;
let focusTimer: ReturnType<typeof setTimeout> | undefined;

const canOpen = (a: Attachment) =>
  a !== dismissed && (a.trigger === "hover" || state === "shown");
const restFor = (a: Attachment) =>
  state === "shown" ? BALLOON_REST_MS : a.delay;

function updateTracking(): void {
  const want = count > 0 && (state === "shown" || hoverCount > 0);
  if (want === tracking) return;
  tracking = want;
  if (want) {
    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointermove", onMove,
                              { capture: true, passive: true });
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return;
  }
  document.removeEventListener("pointerover", onOver, true);
  document.removeEventListener("pointermove", onMove, true);
  document.removeEventListener("pointerout", onOut, true);
  document.removeEventListener("focusin", onFocusIn);
  document.removeEventListener("focusout", onFocusOut);
  clearTimeout(restTimer);
  clearTimeout(focusTimer);
  hovered = null;
}

function onOver(e: PointerEvent): void {
  if (e.pointerType === "touch") return;
  restAt = { x: e.clientX, y: e.clientY };
  const a = attachmentFor(e.target);
  if (a !== hovered) {
    hovered = a;
    if (dismissed && a !== dismissed) dismissed = null;
    if (current && current.opener === "pointer" && current.att !== a) close();
  }
  rest();
}

function onMove(e: PointerEvent): void {
  if (e.pointerType === "touch") return;
  restAt = { x: e.clientX, y: e.clientY };
  // An open balloon stays where it opened while the pointer moves on
  // its target.
  if (current && current.att === hovered) return;
  rest();
}

function onOut(e: PointerEvent): void {
  if (e.relatedTarget !== null || e.pointerType === "touch") return;
  // The pointer left the page.
  hovered = null;
  clearTimeout(restTimer);
  if (current?.opener === "pointer") close();
}

/** (Re)start the rest timer for the target under the pointer. */
function rest(): void {
  clearTimeout(restTimer);
  const a = hovered;
  if (!a || !canOpen(a)) return;
  restTimer = setTimeout(() => {
    const { x, y } = restAt;
    const hit = attachmentFor(document.elementFromPoint(x, y));
    if (hit && canOpen(hit)) open(hit, "pointer", { x, y });
  }, restFor(a));
}

function onFocusIn(e: FocusEvent): void {
  clearTimeout(focusTimer);
  // Only while the keyboard is driving (install.ts keeps .osm-kbd on the
  // root): a click that focuses a control mustn't open its balloon.
  if (!document.documentElement.classList.contains("osm-kbd")) return;
  const a = attachmentFor(e.target);
  if (dismissed && a !== dismissed) dismissed = null;
  if (!a || !canOpen(a)) return;
  focusTimer = setTimeout(() => {
    if (a.target.contains(document.activeElement)) open(a, "focus", null);
  }, restFor(a));
}

function onFocusOut(e: FocusEvent): void {
  clearTimeout(focusTimer);
  if (current?.opener !== "focus") return;
  if (attachmentFor(e.relatedTarget) === current.att) return;
  close();
}

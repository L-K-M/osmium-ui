// A document window's text, the way TeachText and SimpleText show it
// with TextEdit: white, wrapped to the window's width, a vertical
// scroll bar and nothing else. Measured from SimpleText 1.4 on Mac OS
// 8.0 in an emulator, in the coordinates of the window's content area
// (inside its black edge):
//
//   text rectangle   4px in from the left, top and bottom-strip edges
//                    and 4px short of the scroll bar; the first glyph's
//                    pen 1px inside it, the first line's top on it
//   lines            the font's line: Geneva 12 on 16px (ascent 12,
//                    descent 3, leading 1)
//   scroll bar       vertical only, its black edges over the content's
//                    top and right edges, stopping above the strip
//   bottom strip     15px along the bottom: a black line over white,
//                    from the left edge to the scroll bar, where a
//                    horizontal scroll bar would be; the window's grow
//                    box sits in the corner beside it
//   inactive         the text stays black, the caret goes, the scroll
//                    bar is blank (white inside its 55 edges) and a
//                    selection is framed in a 1px black outline
//                    (TextEdit's outline highlighting)
//   selection        rows of whole lines, from the text rectangle's left
//                    edge at a line's start and on to its right edge
//                    where the selection goes past a line's end
//
// The text is a native <textarea>, so typing, input methods, spelling
// services, the clipboard shortcuts and assistive technology work as in
// any text field. Beyond it this module adds TextEdit's single-level
// undo, the read-only mode SimpleText gives a ttro document, a length
// limit, TextEdit's highlight where the browser draws none (the
// inactive outline, and the selection while a menu has the keyboard),
// and double-click word selection without the trailing space. See the
// README for what differs from TextEdit.
import { attachScrollbar, part } from "./controls.js";
import { installOsmium } from "./install.js";

/** Whether the reader may change the text. */
export type TextViewMode =
  /** Typing, cutting, pasting and undo. */
  | "editable"
  /** Like SimpleText's read-only (ttro) documents: no caret, and every
   * attempt to type goes to `onRejectedEdit` (SimpleText's stop alert).
   * Unlike SimpleText the text can still be selected and copied, which
   * readers and assistive technology need. */
  | "read-only";

/** A strike the text is drawn in (installOsmium registers them). */
export type TextViewFont =
  /** Geneva 12 on 16px lines, TeachText's and SimpleText's default. */
  | "geneva-12"
  /** Geneva 10 on 13px lines. */
  | "geneva-10"
  /** Geneva 9 on 12px lines. */
  | "geneva-9"
  /** Charcoal 12 on 16px lines. */
  | "charcoal-12";

export interface TextViewOptions {
  /** The text area's accessible name (the document's name, say). */
  readonly label: string;
  readonly text?: string;
  /** Defaults to "editable". */
  readonly mode?: TextViewMode;
  /** Defaults to "geneva-12". */
  readonly font?: TextViewFont;
  /** The longest text, in UTF-16 code units; TextEdit's own limit is
   * 32767. An edit that would pass it is refused and reported to
   * `onLimit`. Unlimited when omitted. */
  readonly maxLength?: number;
  /** After every edit: typing, undo, cut, paste, clear (not setText). */
  readonly onChange?: () => void;
  /** An edit was refused because the text would pass `maxLength`. */
  readonly onLimit?: () => void;
  /** Someone typed in a "read-only" view. */
  readonly onRejectedEdit?: () => void;
}

export interface OsmiumTextView {
  readonly element: HTMLElement;
  readonly textarea: HTMLTextAreaElement;
  readonly text: string;
  readonly mode: TextViewMode;
  readonly font: TextViewFont;
  /** Whether undo() has something to undo (or, right after one, redo). */
  readonly canUndo: boolean;
  /** Whether some text is selected. */
  readonly hasSelection: boolean;
  /** Replace the whole text: the caret goes to the start, the view to
   * the top, and undo forgets what came before. */
  setText(text: string): void;
  setMode(mode: TextViewMode): void;
  setFont(font: TextViewFont): void;
  /** TextEdit's single-level undo, as a Mac OS 8 application's Undo
   * command offers it: undo the last edit (a run of typing, a cut, a
   * paste, a clear, a drop), and undo again to redo it. Command-Z (or
   * Control-Z) and the browser's own Undo come here too. */
  undo(): void;
  /** Copy the selection to the clipboard and delete it. Rejects, leaving
   * the text as it was, when the browser refuses the clipboard (a
   * script may write to it only while handling the reader's own click
   * or keystroke) or the view is read-only. */
  cut(): Promise<void>;
  /** Copy the selection to the clipboard. Rejects when the browser
   * refuses. */
  copy(): Promise<void>;
  /** Replace the selection with the clipboard's text. Browsers let a
   * script read the clipboard only with the reader's permission (a
   * prompt or a Paste button of the browser's own), so this rejects
   * when that is refused or unsupported, and leaves the text alone. A
   * paste that would pass `maxLength` goes to `onLimit` instead. The
   * browser's own Paste (Command-V) needs no permission. */
  paste(): Promise<void>;
  /** Delete the selection without touching the clipboard. Throws in a
   * read-only view. */
  clear(): void;
  selectAll(): void;
  /** Give the text the keyboard. */
  focus(): void;
  /** Re-read the text's extent and redraw the highlight it draws (after
   * changing `textarea` from script, say). Edits, scrolling, resizing and
   * window activation are followed by themselves. */
  update(): void;
}

/** Line heights of the fonts, osmium.css's (the arrow step and the
 * outline's rows). */
const LINE_H: Readonly<Record<TextViewFont, number>> = {
  "geneva-12": 16, "geneva-10": 13, "geneva-9": 12, "charcoal-12": 16,
};
const MODES: readonly TextViewMode[] = ["editable", "read-only"];

/** Input types that extend a run of typing, which undoes as one edit.
 * Everything else (a paste, a cut, a drop, a spelling correction)
 * undoes on its own. */
const TYPING = new Set([
  "insertText", "insertLineBreak", "insertParagraph",
  "insertCompositionText", "deleteContentBackward", "deleteContentForward",
  "deleteWordBackward", "deleteWordForward", "deleteSoftLineBackward",
  "deleteSoftLineForward", "deleteHardLineBackward", "deleteHardLineForward",
]);

/** A state the text can go back to. */
interface Snapshot {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Where a selection's TextEdit highlight region lies: bands of whole
 * lines, each an x interval, in the text rectangle's pixels. */
export interface Band { top: number; bottom: number; x0: number; x1: number }

/** The TextEdit highlight region of a selection from `start` (x, line)
 * to `end` (x, line) in a text rectangle `width` wide with lines `lh`
 * tall: from the start to the rectangle's right edge, whole lines, then
 * from its left edge to the end. A start at the beginning of a line
 * begins at the left edge; `toEdge` runs the last line to the right
 * edge (the selection goes on past its end). */
export function highlightBands(start: { x: number; line: number },
                               end: { x: number; line: number },
                               toEdge: boolean, width: number,
                               lh: number): Band[] {
  const x1 = toEdge ? width : end.x;
  if (end.line === start.line)
    return [{ top: start.line * lh, bottom: (start.line + 1) * lh,
              x0: start.x, x1 }];
  const bands: Band[] = [{ top: start.line * lh, bottom: (start.line + 1) * lh,
                           x0: start.x, x1: width }];
  if (end.line > start.line + 1)
    bands.push({ top: (start.line + 1) * lh, bottom: end.line * lh,
                 x0: 0, x1: width });
  bands.push({ top: end.line * lh, bottom: (end.line + 1) * lh, x0: 0, x1 });
  return bands.filter((b) => b.x1 > b.x0);
}

/** [a0, a1) without [b0, b1): up to two intervals. */
function without(a0: number, a1: number, b0: number,
                 b1: number): [number, number][] {
  if (b1 <= a0 || b0 >= a1) return [[a0, a1]];
  const out: [number, number][] = [];
  if (b0 > a0) out.push([a0, b0]);
  if (b1 < a1) out.push([b1, a1]);
  return out;
}

/** The 1px frame of the bands' union, drawn inside it as QuickDraw's
 * FrameRgn draws: rectangles {x, y, w, h}. A band's top row is framed
 * where the band above doesn't reach, its bottom row where the band
 * below doesn't, and both its end columns fully. */
export function outlineRects(bands: readonly Band[]):
    { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  bands.forEach((b, i) => {
    const above = bands[i - 1];
    const below = bands[i + 1];
    const rows: [number, [number, number][]][] = [
      [b.top, above && above.bottom === b.top
        ? without(b.x0, b.x1, above.x0, above.x1) : [[b.x0, b.x1]]],
      [b.bottom - 1, below && below.top === b.bottom
        ? without(b.x0, b.x1, below.x0, below.x1) : [[b.x0, b.x1]]],
    ];
    for (const [y, spans] of rows)
      for (const [x0, x1] of spans) out.push({ x: x0, y, w: x1 - x0, h: 1 });
    out.push({ x: b.x0, y: b.top, w: 1, h: b.bottom - b.top },
             { x: b.x1 - 1, y: b.top, w: 1, h: b.bottom - b.top });
  });
  return out;
}

/** The selection a double-click made, without the spaces after its
 * word (TextEdit's word selection), when there is a word to keep. */
export function trimTrailingSpace(text: string, start: number,
                                  end: number): number {
  let e = end;
  while (e > start && (text[e - 1] === " " || text[e - 1] === "\t")) e--;
  return e > start ? e : end;
}

/** Mount a text view in `host`, which it fills: give it a size (the
 * whole content area of a document window, say, with `inset: 0`). The
 * host should be in the document, so the scroll bar can size itself.
 * Throws on an unknown mode or font. */
export function mountTextView(host: HTMLElement,
                              opts: TextViewOptions): OsmiumTextView {
  let mode = opts.mode ?? "editable";
  let font = opts.font ?? "geneva-12";
  checkMode(mode);
  checkFont(font);
  const max = opts.maxLength ?? Infinity;

  host.classList.add("osm-textview");
  const textarea = part("textarea", "") as HTMLTextAreaElement;
  textarea.setAttribute("aria-label", opts.label);
  // Mac OS 8 had no spelling checker underlining words as you type.
  textarea.spellcheck = false;
  textarea.value = opts.text ?? "";
  const layer = part("div", "osm-textview-highlight");
  layer.setAttribute("aria-hidden", "true");
  const mirror = part("div", "osm-textview-mirror");
  mirror.setAttribute("aria-hidden", "true");
  const strip = part("div", "osm-textview-strip");
  host.append(mirror, textarea, layer, strip);
  const sb = attachScrollbar(host, textarea, () => LINE_H[font]);

  function applyMode(): void {
    textarea.readOnly = mode === "read-only";
    host.dataset["mode"] = mode;
  }
  function applyFont(): void { host.dataset["font"] = font; }
  applyMode();
  applyFont();

  // ---- undo ---------------------------------------------------------------
  // One state to go back to. It is taken before an edit that starts a
  // new group: any edit but typing, or typing after the caret moved (the
  // selection isn't where the last typing left it). Undo swaps it with
  // the current state, so undoing again redoes.
  let saved: Snapshot | null = null;
  let undone = false;
  let typing = false;
  let typedTo: [number, number] | null = null;
  let lastType = "";
  // The state before the current edit, to go back to if it overflows.
  let before: Snapshot | null = null;
  // An edit this module makes itself has taken its snapshot already.
  let scripted = false;

  const current = (): Snapshot => ({
    text: textarea.value, start: textarea.selectionStart,
    end: textarea.selectionEnd,
  });

  function snapshot(): void {
    saved = current();
    undone = false;
  }

  function restore(s: Snapshot): void {
    textarea.value = s.text;
    textarea.setSelectionRange(s.start, s.end);
    reveal(s.end);
  }

  function changed(): void {
    sb.update();
    redraw();
    opts.onChange?.();
  }

  function undo(): void {
    if (!saved) return;
    const now = current();
    restore(saved);
    saved = now;
    undone = !undone;
    typing = false;
    changed();
  }

  /** Length of the text an edit inserts, as far as beforeinput tells. */
  function inserted(e: InputEvent): number {
    if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph")
      return 1;
    return (e.data ?? e.dataTransfer?.getData("text/plain") ?? "").length;
  }

  textarea.addEventListener("beforeinput", (e) => {
    if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
      e.preventDefault();
      if ((e.inputType === "historyUndo") !== undone) undo();
      return;
    }
    const { selectionStart: s, selectionEnd: t, value } = textarea;
    if (value.length - (t - s) + inserted(e) > max &&
        e.inputType.startsWith("insert") && e.cancelable) {
      e.preventDefault();
      opts.onLimit?.();
      return;
    }
    before = current();
    if (scripted) return;
    const isTyping = TYPING.has(e.inputType);
    const moved = !typedTo || typedTo[0] !== s || typedTo[1] !== t;
    const sameDrag = e.inputType === "insertFromDrop" &&
      lastType === "deleteByDrag";
    if (!sameDrag && (!isTyping || !typing || moved)) snapshot();
    typing = isTyping;
    lastType = e.inputType;
  });

  textarea.addEventListener("input", () => {
    // An input method's composition can't be cancelled up front.
    if (textarea.value.length > max && before) {
      restore(before);
      opts.onLimit?.();
    }
    typedTo = [textarea.selectionStart, textarea.selectionEnd];
    changed();
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    const command = (e.metaKey || e.ctrlKey) && !e.altKey;
    const k = e.key.toLowerCase();
    if (command && k === "z") {
      // Command-Z undoes and redoes by turns; Shift-Command-Z only redoes.
      e.preventDefault();
      if (mode === "editable" && (!e.shiftKey || undone)) undo();
      return;
    }
    if (command && k === "y" && !e.shiftKey) {
      e.preventDefault();
      if (mode === "editable" && undone) undo();
      return;
    }
    if (mode !== "read-only" || e.repeat || command) return;
    if (e.key.length === 1 || ["Enter", "Backspace", "Delete"].includes(e.key))
      opts.onRejectedEdit?.();
  });

  // Double-click selects a word; browsers that take the space after it
  // too (Chromium on Windows) give it back, as TextEdit does.
  textarea.addEventListener("dblclick", () => {
    const { selectionStart: s, selectionEnd: t, value } = textarea;
    const e = trimTrailingSpace(value, s, t);
    if (e !== t) textarea.setSelectionRange(s, e, "forward");
  });

  // Presses in the margins around the text rectangle and on the strip
  // go to the text, as a press anywhere in TextEdit's view rectangle
  // would.
  host.addEventListener("pointerdown", (e) => {
    if (e.target !== host && e.target !== strip) return;
    e.preventDefault();
    textarea.focus({ preventScroll: true });
  });

  // ---- edits made from menus ------------------------------------------------

  function requireEditable(what: string): void {
    if (mode === "read-only")
      throw new Error(`can't ${what} in a read-only text view`);
  }

  /** Replace the selection with `text` as one undoable edit, through the
   * browser's editing commands where it has them (which keep the caret
   * in view and fire input events), else setRangeText. */
  function replaceSelection(text: string): void {
    textarea.focus({ preventScroll: true });
    snapshot();
    typing = false;
    scripted = true;
    try {
      const done = text ? command("insertText", text) : command("delete");
      if (!done) {
        textarea.setRangeText(text, textarea.selectionStart,
                              textarea.selectionEnd, "end");
        textarea.dispatchEvent(new Event("input"));
        reveal(textarea.selectionEnd);
      }
    } finally {
      scripted = false;
    }
  }

  function selected(): string {
    return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  }

  /** Copy `text` (the selection) with the browser's `name` command, or
   * else the Clipboard API. Resolves to whether the browser's command
   * did it, which for "cut" also deleted the selection. */
  async function writeClipboard(text: string,
                                name: "copy" | "cut"): Promise<boolean> {
    textarea.focus({ preventScroll: true });
    // The browser's own command works inside the reader's click or
    // keystroke in every engine and needs no permission.
    if (command(name)) return true;
    if (!navigator.clipboard?.writeText)
      throw new Error("This browser doesn't let the page use the clipboard.");
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      throw new Error("The browser didn't let the page write to the " +
                      "clipboard.", { cause: err });
    }
    return false;
  }

  async function cut(): Promise<void> {
    requireEditable("cut");
    const text = selected();
    if (!text) return;
    // Browsers fire no beforeinput for their own commands run from
    // script, so the cut's undo state is taken here, and put back if
    // the cut doesn't happen.
    const kept = { saved, undone };
    snapshot();
    typing = false;
    let native: boolean;
    try {
      native = await writeClipboard(text, "cut");
    } catch (err) {
      ({ saved, undone } = kept);
      throw err;
    }
    // The browser's cut removed the text itself.
    if (!native) replaceSelection("");
  }

  async function copy(): Promise<void> {
    const text = selected();
    if (text) await writeClipboard(text, "copy");
  }

  async function paste(): Promise<void> {
    requireEditable("paste");
    if (!navigator.clipboard?.readText)
      throw new Error("This browser doesn't let the page read the clipboard.");
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch (err) {
      throw new Error("The browser didn't let the page read the clipboard.",
                      { cause: err });
    }
    const { selectionStart: s, selectionEnd: t, value } = textarea;
    if (value.length - (t - s) + text.length > max) {
      opts.onLimit?.();
      return;
    }
    replaceSelection(text);
  }

  // ---- the highlight the browser doesn't draw ------------------------------
  // The browser draws no selection in a text area without the keyboard,
  // so this draws TextEdit's from a copy of the text laid out the same
  // way (the mirror): the selection's highlight region framed while the
  // window is inactive (TEDeactivate's outline), and filled while the
  // window is active but the keyboard is elsewhere, in one of its menus,
  // say. The fill is blended over the text, so the text under it takes
  // the highlight's text color as the browser's own selection would:
  // multiplied by the Highlight Color (black text stays black), or
  // inverted for Black & White.

  function lineHeight(): number { return LINE_H[font]; }

  /** Where the character at `i` (its left edge, or with `after` its
   * right edge) lies in the mirror, relative to the text rectangle. A
   * newline, which may have no box of its own, is measured by the
   * position just before it. */
  function measure(node: Text, i: number,
                   after: boolean): { x: number; line: number } {
    const data = node.data;
    const newline = data[i] === "\n";
    if (newline && (i === 0 || data[i - 1] === "\n")) {
      // A newline alone on its line (a blank line, or one of several at
      // the end): Chromium gives the position before it no client rect,
      // and the all-zero bounding rect would put it above the text. It
      // starts its line, counted from the first newline of its run:
      // that one ends a line of text (so it has a rect), or is the
      // text's first character, alone on line 0. Each newline after it
      // is alone on the next line.
      let first = i;
      while (first > 0 && data[first - 1] === "\n") first--;
      const line = first === 0 ? 0 : measure(node, first, false).line;
      return { x: 0, line: line + i - first };
    }
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, newline ? i : i + 1);
    const r = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const box = mirror.getBoundingClientRect();
    const x = Math.round((after && !newline ? r.right : r.left) - box.left);
    return { x, line: Math.floor((r.top - box.top + 1) / lineHeight()) };
  }

  function syncMirror(): Text {
    const text = textarea.value;
    let node = mirror.firstChild as Text | null;
    if (!node) mirror.append(node = document.createTextNode(""));
    if (node.data !== text) node.data = text;
    return node;
  }

  function redraw(): void {
    layer.textContent = "";
    const { selectionStart: s, selectionEnd: t } = textarea;
    const inactive = host.closest(".osm-inactive") !== null;
    if (s >= t || (document.activeElement === textarea && !inactive)) return;
    const node = syncMirror();
    const lh = lineHeight();
    const width = layer.clientWidth;
    const start = measure(node, s, false);
    // The text's first pixel column, 1px inside the text rectangle: a
    // selection starting there starts at the rectangle's edge.
    const pen = parseFloat(getComputedStyle(textarea).paddingLeft) || 0;
    if (start.x <= pen) start.x = 0;
    const end = measure(node, t - 1, true);
    const toEdge = textarea.value[t - 1] === "\n" || t === textarea.value.length;
    const bands = highlightBands(start, end, toEdge, width, lh);
    const dy = -textarea.scrollTop;
    const rects = inactive ? outlineRects(bands)
      : bands.map((b) => ({ x: b.x0, y: b.top, w: b.x1 - b.x0,
                            h: b.bottom - b.top }));
    const cls = inactive ? "" : invertsText() ? "osm-textview-invert"
                                              : "osm-textview-fill";
    for (const r of rects) {
      const d = part("div", cls);
      d.style.cssText = `left:${r.x}px;top:${r.y + dy}px;` +
        `width:${r.w}px;height:${r.h}px`;
      layer.append(d);
    }
  }

  /** Whether the Highlight Color inverts (Black & White: white text). */
  function invertsText(): boolean {
    const c = getComputedStyle(host).getPropertyValue("--osm-highlight-text");
    return ["#fff", "#ffffff", "white"].includes(c.trim().toLowerCase());
  }

  /** Scroll the text so position `i` is in view. */
  function reveal(i: number): void {
    const node = syncMirror();
    const lh = lineHeight();
    const at = node.data.length
      ? measure(node, Math.min(i, node.data.length - 1), i >= node.data.length)
      : { x: 0, line: 0 };
    // A caret after a final newline sits on the line below it.
    const line = i >= node.data.length && node.data.endsWith("\n")
      ? at.line + 1 : at.line;
    const top = line * lh;
    if (top < textarea.scrollTop) textarea.scrollTop = top;
    else if (top + lh > textarea.scrollTop + textarea.clientHeight)
      textarea.scrollTop = top + lh - textarea.clientHeight;
  }

  // Activation lives on the window around the view: watch every
  // ancestor's class, again whenever the text gains or loses the
  // keyboard (a window mounted around the view after it).
  const watch = new MutationObserver(redraw);
  function watchAncestors(): void {
    for (let el = host.parentElement; el; el = el.parentElement)
      watch.observe(el, { attributes: true, attributeFilter: ["class"] });
  }
  watchAncestors();
  for (const type of ["focus", "blur"])
    textarea.addEventListener(type, () => { watchAncestors(); redraw(); });
  textarea.addEventListener("scroll", redraw, { passive: true });
  textarea.addEventListener("select", redraw);
  new ResizeObserver(redraw).observe(textarea);
  // The fonts change the text's layout once they are in.
  void installOsmium().catch(() => {}).finally(() => { sb.update(); redraw(); });

  return {
    element: host,
    textarea,
    get text() { return textarea.value; },
    get mode() { return mode; },
    get font() { return font; },
    get canUndo() { return saved !== null; },
    get hasSelection() {
      return textarea.selectionStart < textarea.selectionEnd;
    },
    setText(text) {
      textarea.value = text;
      textarea.setSelectionRange(0, 0);
      textarea.scrollTop = 0;
      saved = null;
      undone = false;
      typing = false;
      typedTo = null;
      sb.update();
      redraw();
    },
    setMode(next) {
      checkMode(next);
      mode = next;
      applyMode();
    },
    setFont(next) {
      checkFont(next);
      font = next;
      applyFont();
      sb.update();
      redraw();
    },
    undo() {
      if (mode === "editable") undo();
    },
    cut,
    copy,
    paste,
    clear() {
      requireEditable("clear");
      if (textarea.selectionStart < textarea.selectionEnd) replaceSelection("");
    },
    selectAll() {
      textarea.focus({ preventScroll: true });
      textarea.select();
      redraw();
    },
    focus: () => textarea.focus({ preventScroll: true }),
    update() {
      sb.update();
      redraw();
    },
  };
}

/** A browser editing command on the focused text area; false where it
 * is refused or unsupported (document.execCommand is deprecated but has
 * no replacement for these). */
function command(name: string, value?: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  try {
    return document.execCommand(name, false, value);
  } catch {
    return false;
  }
}

function checkMode(mode: TextViewMode): void {
  if (!MODES.includes(mode))
    throw new RangeError(`text view mode ${JSON.stringify(mode)} must be ` +
                         '"editable" or "read-only"');
}

function checkFont(font: TextViewFont): void {
  if (!Object.hasOwn(LINE_H, font))
    throw new RangeError(`text view font ${JSON.stringify(font)} must be ` +
                         Object.keys(LINE_H).map((f) => `"${f}"`).join(", "));
}

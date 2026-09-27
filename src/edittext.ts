// Mac OS 8 edit text. A single-line field is a plain
// <input class="osm-edit"> that osmium.css draws completely: the
// Platinum frame (a black line with a 1px engraved bevel outside it),
// the focus ring, the Black & White text highlight. This module wires
// the multi-line kind: a <textarea> in a framed host with an Osmium
// scroll bar. Mac OS 8.0 had no standard scrolling edit text (the
// scrolling text box came with Appearance 1.1 and is read-only), so
// this is the TextEdit-plus-scroll-bar construct applications built for
// themselves, in the Appearance edit text frame.
//
// The native <input> and <textarea> stay the keyboard target and the
// accessible object; the scroll bar is aria-hidden. A deactivated
// window hides its fields' caret, selection and ring in CSS
// (TEDeactivate), but DOM focus stays where it was: with "manual"
// window activation, blur a focused field when its window deactivates,
// or typing would go on into a field the reader can't see is active.
import { attachScrollbar } from "./controls.js";
import { installOsmium } from "./install.js";

/** Charcoal 12's line, osmium.css's text area line height: the arrow
 * step when the textarea's computed line height can't be read. */
const LINE_H = 16;

export interface OsmiumTextArea {
  readonly element: HTMLElement;
  readonly textarea: HTMLTextAreaElement;
  /** Re-read the text's extent. Typing, scrolling and resizing keep the
   * scroll bar current by themselves; call this after setting
   * `textarea.value` from script. */
  update(): void;
}

/** Wire a multi-line edit text: `host` (it becomes .osm-edit-area)
 * holding one <textarea>. Adds a vertical scroll bar whose black edges
 * overlap the frame's black line, as a list box's do, and whose arrows
 * step one line of the textarea's font (read when mounting, so mount a
 * host that is in the document; otherwise they step 16px). Throws,
 * leaving `host` untouched, if it has no <textarea> child. */
export function mountTextArea(host: HTMLElement): OsmiumTextArea {
  const textarea =
    host.querySelector<HTMLTextAreaElement>(":scope > textarea");
  if (!textarea) throw new Error("a text area needs a <textarea> child");

  host.classList.add("osm-edit-area");
  const line = parseFloat(getComputedStyle(textarea).lineHeight) || LINE_H;
  const sb = attachScrollbar(host, textarea, line);
  // Text that starts to overflow doesn't always scroll (the caret may
  // still be in view), so no scroll event would re-read the extent.
  textarea.addEventListener("input", () => sb.update());
  // The fonts change the text's height once they are in.
  void installOsmium().catch(() => {}).finally(() => sb.update());
  return { element: host, textarea, update: () => sb.update() };
}

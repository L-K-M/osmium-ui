// Mac OS 8 alert boxes: an icon, a message, an optional explanation
// and up to three push buttons, laid out the way StandardAlert
// (Appearance Manager 1.0, Mac OS 8.0) lays them out, with the metrics
// of the Mac OS 8.0 Finder's alerts. Looks come from osmium.css: the
// alert frame Mac OS 8.0's alerts draw (presumably kWindowAlertProc's),
// or with the movable alert's title bar from the Mac OS 8 HIG.
//
// While an alert is up it holds the page (modal.ts): nothing else
// takes the mouse or the keyboard until one of its buttons is pressed.
// Its keys are its own: Return and Enter press the default button,
// Escape and Command-period the cancel button (even when another of
// its buttons has the focus), and Tab and Shift-Tab stay inside it.
import {
  fitButton, flashButton, part, pushButton, swallowClick, textWidth,
} from "./controls.js";
import { installOsmium } from "./install.js";
import { openModal } from "./modal.js";
import { titleLeft } from "./window.js";
import type { OsmiumWindow } from "./window.js";

/** Which icon an alert shows: StandardAlert's alert types. */
export type AlertKind =
  /** An octagon with a raised hand: the action can't be completed. */
  | "stop"
  /** A face with a speech balloon: information, no risk. */
  | "note"
  /** A triangle with an exclamation point: the action may do harm. */
  | "caution"
  /** No icon (kAlertPlainAlert), or the app's own through `icon`. */
  | "plain";

/** How an alert holds the page. Both block everything else until one
 * of the alert's buttons is pressed. */
export type AlertModality =
  /** kWindowAlertProc: no title bar. */
  | "modal"
  /** kWindowMovableAlertProc: a title bar to drag it by, the Mac OS 8
   * HIG's preferred form. */
  | "movable";

/** A button slot. StandardAlert places them right to left. */
export type AlertButton =
  /** The rightmost (StandardAlert's defaultText, "OK"). */
  | "ok"
  /** Left of OK ("Cancel"). */
  | "cancel"
  /** At the left edge of the text column ("Don't Save"). */
  | "other";

/** How an alert ended: the button pressed, or close() without one. */
export type AlertResult = AlertButton | "dismissed";

/** Where an alert appears. */
export type AlertPosition =
  /** Centered across the page below any .osm-menubar, a fifth of the
   * free height above it (kWindowAlertPositionParentWindowScreen,
   * StandardAlert's default). */
  | "screen"
  /** Centered on `parent`, a fifth of its free height down, below its
   * title bar (kWindowAlertPositionParentWindow). */
  | "parent";

export interface AlertButtons {
  /** The rightmost button's title. Defaults to "OK". */
  readonly ok?: string;
  /** Left of OK. No Cancel button when omitted. */
  readonly cancel?: string;
  /** At the far left, "Don't Save" say. None when omitted. */
  readonly other?: string;
}

export interface AlertOptions {
  readonly kind: AlertKind;
  /** A short summary in the system font (Charcoal 12). "\n" breaks a
   * line; a word too long for the column breaks between letters. */
  readonly message: string;
  /** More detail below the message, in the small system font (Geneva
   * 10). */
  readonly explanation?: string;
  readonly buttons?: AlertButtons;
  /** Wears the default ring and takes Return and Enter. Defaults to
   * "ok"; make it "cancel" when OK destroys something, or "none". */
  readonly defaultButton?: AlertButton | "none";
  /** Pressed by Escape and Command-period. Defaults to "cancel" when
   * there is a Cancel button, else "none" (the keys do nothing). */
  readonly cancelButton?: AlertButton | "none";
  /** Defaults to "modal". */
  readonly modality?: AlertModality;
  /** A "movable" alert's title-bar text. StandardAlert draws none, so
   * it defaults to none: pinstripes across the whole bar. */
  readonly title?: string;
  /** With kind "plain": a 32 x 32 sprite registered with
   * registerSprites, drawn where the alert icon goes. */
  readonly icon?: string;
  /** Defaults to "screen". "parent" needs `parent`. */
  readonly position?: AlertPosition;
  /** The window the alert is about: drawn inactive while the alert is
   * up, and what "parent" centers on. */
  readonly parent?: OsmiumWindow;
  /** Called for each press outside the alert, where Mac OS plays the
   * system alert sound. Osmium plays none itself. */
  readonly onBeep?: () => void;
}

export interface OsmiumAlert {
  /** The alert box: its outline box (the 1px shadow hangs outside).
   * The app may move it, but a window resize puts it back in its
   * computed place unless it was dragged by its title bar. */
  readonly element: HTMLElement;
  /** Settles once the alert is gone, the page released and focus back:
   * with the button pressed, or "dismissed". Never rejects. */
  readonly result: Promise<AlertResult>;
  /** Take the alert down. With `button`, flash it for 8 ticks and end
   * as if it were pressed; without one, end with "dismissed". Does
   * nothing once the alert has ended; throws for a button the alert
   * doesn't have. */
  close(button?: AlertButton): void;
}

// ---- layout ------------------------------------------------------------
// In port coordinates: the port (the alert's content) sits 3px inside
// the black outline, and below a movable alert's 21px title bar.
// Measured from the Mac OS 8.0 Finder's alerts (374 x 104: a stop
// alert with OK, and the Empty Trash caution alert with Cancel and
// OK), which these numbers rebuild pixel for pixel. They keep the 1992
// HIG's alert spacing, counted from the outline's outer pixel: 13
// above the icon and 23 left of it, 23 from icon to text, 13 between
// buttons and from the text down to them.
//
// Not measured: StandardAlert's own layout (none of the Mac OS 8.0
// alerts captured used it), so the explanation's place, the other
// button's and the growth rules are derived, as labeled below.

/** Frame width: the outline, the red bevel, the white/99 bevel. */
const FRAME = 3;
/** A movable alert's title bar, down to its black separator line. */
const TITLE_BAR = 21;
const ICON_X = 20;
const ICON_Y = 10;
/** The text column: from the message pen to 10px short of the port's
 * right edge. */
const TEXT_X = 75;
const TEXT_R = 10;
/** First line box of the message: baseline on port row 18, level with
 * the icon's top at Charcoal's cap height. */
const MESSAGE_TOP = 7;
const MESSAGE_LINE = 16;
/** Derived: HIG figure 3-5 (a StandardAlert-style figure, not a
 * capture) has the explanation's first baseline 20px below the
 * message's; this gap gives the same with Geneva 10's 13px lines. */
const EXPLANATION_GAP = 6;
const EXPLANATION_LINE = 13;
/** Buttons: 10px from the port's right and bottom edges, 13px apart,
 * no higher than the Finder's (68) and 13px below the text. */
const BUTTON_H = 20;
/** The Finder's buttons are 59 wide, measured, "Cancel" included.
 * (Alerts built from resources fix their own widths: other Mac OS 8.0
 * alerts have 60 to 74, Process Manager and Chooser 60, AppleCD Audio
 * Player 66, Stickies 74.) Derived, not measured: past 59, a button
 * grows to keep 8px either side of its title ("Cancel", 42px, fits in
 * 59 with room to spare). */
const BUTTON_W = 59;
const BUTTON_TITLE_PAD = 8;
const BUTTON_MARGIN = 10;
const BUTTON_GAP = 13;
const MIN_BUTTON_TOP = 68;
const TEXT_TO_BUTTONS = 13;
/** Derived: the other button at the text's left edge, where HIG figure
 * 3-5 puts its Help button. */
const OTHER_X = TEXT_X;
/** The Finder's alerts, and every alert in the HIG's figures, are 374
 * wide (outline); wider button rows widen it. */
const MIN_PORT_W = 368;
/** The default button's ring, outside its box (osmium.css). */
const DEFAULT_RING = 3;

/** What alertLayout needs to know about the content. */
export interface AlertMetrics {
  readonly messageLines: number;
  /** 0 without an explanation. */
  readonly explanationLines: number;
  /** The buttons present, with their widths (ring excluded). */
  readonly buttons: readonly { which: AlertButton; width: number }[];
  readonly modality: AlertModality;
}

/** Where everything goes. `width` and `height` are the outline box;
 * the rest is in port coordinates. */
export interface AlertLayout {
  readonly width: number;
  readonly height: number;
  readonly port: { x: number; y: number; w: number; h: number };
  readonly icon: { x: number; y: number };
  readonly message: { x: number; y: number; w: number };
  readonly explanation: { y: number } | null;
  /** Each button's box, its ring excluded. */
  readonly buttons: readonly
    { which: AlertButton; x: number; y: number; w: number }[];
}

/** Lay out an alert: the Finder's measured metrics, grown to fit more
 * text (down) or wider buttons (right). */
export function alertLayout(m: AlertMetrics): AlertLayout {
  const width = (which: AlertButton) =>
    m.buttons.find((b) => b.which === which)?.width;
  const ok = width("ok"), cancel = width("cancel"), other = width("other");
  // The row's own width: other, then cancel, then OK, gaps between.
  const row = [other, cancel, ok].filter((w) => w !== undefined)
    .reduce((sum, w, i) => sum + w + (i ? BUTTON_GAP : 0), 0);
  const portW = Math.max(MIN_PORT_W, TEXT_X + row + BUTTON_MARGIN);

  const messageBottom = MESSAGE_TOP + MESSAGE_LINE * m.messageLines;
  const explanation = m.explanationLines > 0
    ? { y: messageBottom + EXPLANATION_GAP } : null;
  const textBottom = explanation
    ? explanation.y + EXPLANATION_LINE * m.explanationLines : messageBottom;
  const buttonY = Math.max(MIN_BUTTON_TOP, textBottom + TEXT_TO_BUTTONS);
  const portH = buttonY + BUTTON_H + BUTTON_MARGIN;

  // Right to left from the port's right margin, other at the left.
  const buttons: { which: AlertButton; x: number; y: number; w: number }[] = [];
  let right = portW - BUTTON_MARGIN;
  for (const [which, w] of [["ok", ok], ["cancel", cancel]] as const) {
    if (w === undefined) continue;
    buttons.unshift({ which, x: right - w, y: buttonY, w });
    right -= w + BUTTON_GAP;
  }
  if (other !== undefined)
    buttons.unshift({ which: "other", x: OTHER_X, y: buttonY, w: other });

  const bar = m.modality === "movable" ? TITLE_BAR : 0;
  return {
    width: portW + 2 * FRAME,
    height: portH + 2 * FRAME + bar,
    port: { x: FRAME, y: FRAME + bar, w: portW, h: portH },
    icon: { x: ICON_X, y: ICON_Y },
    message: { x: TEXT_X, y: MESSAGE_TOP, w: portW - TEXT_X - TEXT_R },
    explanation,
    buttons,
  };
}

/** The outline box's top-left for an alert of `size` in `area` (the
 * page below the menu bar, or the parent window's outline box), kept
 * in `viewport` and below its menu bar (`top`). The shadow counts: the
 * free space is area - (size + 1). Mac OS 8.0 places Stickies, Process
 * Manager and AppleCD Audio Player alerts exactly so. The Finder's two
 * captured alerts (both 374 x 104) sit at (133, 87) instead, off this
 * rule's (132, 91); whether the Finder uses a fixed spot is unverified,
 * as only that one size was captured. An alert that doesn't fit pins to the top
 * left, under the menu bar. */
export function alertPosition(
  size: { w: number; h: number },
  area: { x: number; y: number; w: number; h: number },
  mode: AlertPosition,
  viewport: { w: number; h: number; top: number },
): { x: number; y: number } {
  const x = area.x + Math.floor((area.w - (size.w + 1)) / 2);
  let y = area.y + Math.floor((area.h - (size.h + 1)) / 5);
  // Derived from the Window Manager's description, not measured: the
  // parent's title bar stays in view.
  if (mode === "parent") y = Math.max(y, area.y + TITLE_BAR);
  return keepInView({ x, y }, size, viewport);
}

function keepInView(p: { x: number; y: number }, size: { w: number; h: number },
                    vp: { w: number; h: number; top: number }):
    { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(p.x, vp.w - size.w - 1)),
    y: Math.max(vp.top, Math.min(p.y, vp.h - size.h - 1)),
  };
}

/** The page's visible area, and where any menu bar ends. */
function viewport(): { w: number; h: number; top: number } {
  const root = document.documentElement;
  const bar = document.querySelector(".osm-menubar");
  return {
    w: root.clientWidth || window.innerWidth,
    h: root.clientHeight || window.innerHeight,
    top: bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0,
  };
}

// ---- the alert ------------------------------------------------------------

const ICON_LABEL: Readonly<Record<Exclude<AlertKind, "plain">, string>> = {
  stop: "Stop", note: "Note", caution: "Caution",
};
/** DOM order, which is also the order Tab takes them in: left to right. */
const SLOTS: readonly AlertButton[] = ["other", "cancel", "ok"];
const KINDS: readonly AlertKind[] = ["stop", "note", "caution", "plain"];
const MODALITIES: readonly AlertModality[] = ["modal", "movable"];
const POSITIONS: readonly AlertPosition[] = ["screen", "parent"];

let alertSeq = 0;

/** Show an alert box. It is added to document.body and placed, and
 * blocks the rest of the page until a button is pressed. It stays
 * hidden until the bitmap fonts are in (installOsmium), so its layout
 * is right the first time it shows; then it takes the focus and the
 * keys. Throws only for a programming error: an unknown kind,
 * modality or position, `icon` with a kind other than "plain",
 * "parent" without `parent`, or a defaultButton or cancelButton naming
 * a button the alert doesn't have. */
export function showAlert(opts: AlertOptions): OsmiumAlert {
  const modality = opts.modality ?? "modal";
  const position = opts.position ?? "screen";
  // The option types are string unions; check them for untyped callers.
  if (!KINDS.includes(opts.kind))
    throw new TypeError(`unknown alert kind "${String(opts.kind)}"`);
  if (!MODALITIES.includes(modality))
    throw new TypeError(`unknown alert modality "${String(modality)}"`);
  if (!POSITIONS.includes(position))
    throw new TypeError(`unknown alert position "${String(position)}"`);
  const titles: Record<AlertButton, string | undefined> = {
    ok: opts.buttons?.ok ?? "OK",
    cancel: opts.buttons?.cancel,
    other: opts.buttons?.other,
  };
  const present = SLOTS.filter((s) => titles[s] !== undefined);
  const defaultButton = opts.defaultButton ?? "ok";
  const cancelButton = opts.cancelButton ??
    (titles.cancel !== undefined ? "cancel" : "none");
  if (opts.icon !== undefined && opts.kind !== "plain")
    throw new Error(`an alert's icon replaces kind "plain" only, not "${opts.kind}"`);
  if (position === "parent" && !opts.parent)
    throw new Error('an alert with position "parent" needs a parent window');
  for (const [role, b] of [["defaultButton", defaultButton],
                           ["cancelButton", cancelButton]] as const) {
    if (b !== "none" && !present.includes(b))
      throw new Error(`${role} "${b}" names a button this alert doesn't have`);
  }

  // Before the modal key routing starts: installOsmium's keyboard
  // tracking (focus rings) must see keys first.
  const fonts = installOsmium().catch(() => {
    // Laid out with the fallback fonts; mountWindow reports the error.
  });

  const id = `osm-alert-${++alertSeq}`;
  const layer = part("div", "osm-modal-layer");
  const box = part("div", "osm-alert");
  box.classList.toggle("osm-movable", modality === "movable");
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-modal", "true");
  // The alert box takes the focus, not a button: Return and Escape work
  // at once and no focus ring shows, as on the Mac, where buttons had no
  // keyboard focus. The WAI-ARIA alertdialog pattern suggests focusing
  // the least destructive button instead; Tab reaches the buttons.
  box.tabIndex = -1;
  box.style.visibility = "hidden";

  const bar = modality === "movable" ? titleBar(opts.title ?? "") : null;
  const port = part("div", "osm-alert-port");
  const icon = alertIcon(opts);
  const message = part("div", "osm-alert-message");
  message.id = `${id}-message`;
  message.textContent = opts.message;
  box.setAttribute("aria-labelledby", message.id);
  let explanation: HTMLElement | null = null;
  if (opts.explanation) {
    explanation = part("div", "osm-alert-explanation");
    explanation.id = `${id}-explanation`;
    explanation.textContent = opts.explanation;
    box.setAttribute("aria-describedby", explanation.id);
  }
  const buttons = new Map<AlertButton, HTMLButtonElement>();
  for (const which of present) {
    const b = part("button", "osm-button") as HTMLButtonElement;
    b.type = "button";
    b.dataset["alertButton"] = which;
    b.classList.toggle("osm-default", which === defaultButton);
    b.textContent = titles[which]!;
    buttons.set(which, b);
  }
  port.append(...(icon ? [icon] : []), message,
              ...(explanation ? [explanation] : []), ...buttons.values());
  box.append(...(bar ? [bar.bar] : []), port);
  document.body.append(layer, box);
  const session = openModal(box, layer, opts.parent);

  let ended = false;
  let resolve!: (r: AlertResult) => void;
  const result = new Promise<AlertResult>((r) => { resolve = r; });
  let size = { w: 0, h: 0 };
  // Once dragged, the alert stays where it was put.
  let moved = false;

  function end(r: AlertResult): void {
    if (ended) return;
    ended = true;
    window.removeEventListener("resize", place);
    layer.remove();
    box.remove();
    session.end();
    resolve(r);
  }

  /** A press from the keyboard or close(button): flash, then end. Once
   * a press is flashing, the alert's outcome is decided: further
   * presses and a close() without a button do nothing. */
  let pressing = false;
  function press(which: AlertButton): void {
    const b = buttons.get(which);
    if (ended || pressing || !b || b.disabled) return;
    pressing = true;
    flashButton(b, () => end(which));
  }

  // The Dialog Manager ends an alert on the release of a tracked
  // button, with no further flash.
  for (const [which, b] of buttons) pushButton(b, () => end(which));

  // Presses outside the alert do nothing but beep (ModalDialog plays
  // the alert sound for a mouse-down outside an alert). Nothing under
  // it scrolls: not over the layer, and not over the alert, which has
  // nothing to scroll itself (modal.ts holds back the scrolling keys).
  layer.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    swallowClick();
    opts.onBeep?.();
  });
  for (const el of [layer, box]) {
    for (const type of ["wheel", "touchmove"] as const)
      el.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  function layout(): void {
    const widths = present.map((which) => {
      const b = buttons.get(which)!;
      const width = Math.max(BUTTON_W,
        textWidth(b.textContent ?? "", b) + 2 * BUTTON_TITLE_PAD);
      b.dataset["width"] = String(width);
      fitButton(b);
      return { which, width };
    });
    const metrics: AlertMetrics = {
      messageLines: 1,
      explanationLines: explanation ? 1 : 0,
      buttons: widths,
      modality,
    };
    // The width doesn't depend on the text: wrap the text in its
    // column, then count the lines.
    const first = alertLayout(metrics);
    for (const t of [message, explanation]) {
      if (!t) continue;
      t.style.left = `${first.message.x}px`;
      t.style.width = `${first.message.w}px`;
    }
    const l = alertLayout({
      ...metrics,
      messageLines: lines(message, MESSAGE_LINE),
      explanationLines: explanation ? lines(explanation, EXPLANATION_LINE) : 0,
    });
    size = { w: l.width, h: l.height };
    box.style.width = `${l.width}px`;
    box.style.height = `${l.height}px`;
    message.style.top = `${l.message.y}px`;
    if (explanation && l.explanation)
      explanation.style.top = `${l.explanation.y}px`;
    if (icon) {
      icon.style.left = `${l.icon.x}px`;
      icon.style.top = `${l.icon.y}px`;
    }
    for (const p of l.buttons) {
      const b = buttons.get(p.which)!;
      const ring = b.classList.contains("osm-default") ? DEFAULT_RING : 0;
      b.style.left = `${p.x - ring}px`;
      b.style.top = `${p.y - ring}px`;
    }
    if (bar?.title) {
      // Centered on the whole alert, as mountWindow centers a title.
      const adv = Math.round(bar.title.getBoundingClientRect().width);
      box.style.setProperty("--osm-title-x", `${titleLeft(l.width, adv)}px`);
      box.style.setProperty("--osm-title-w", `${adv}px`);
    }
  }

  function place(): void {
    const vp = viewport();
    let p: { x: number; y: number };
    if (moved) {
      p = keepInView({ x: parseFloat(box.style.left) || 0,
                       y: parseFloat(box.style.top) || 0 }, size, vp);
    } else if (position === "parent" && opts.parent) {
      const r = opts.parent.element.getBoundingClientRect();
      p = alertPosition(size, {
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
      }, "parent", vp);
    } else {
      p = alertPosition(size, { x: 0, y: vp.top, w: vp.w, h: vp.h - vp.top },
                        "screen", vp);
    }
    box.style.left = `${p.x}px`;
    box.style.top = `${p.y}px`;
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Tab") {
      e.preventDefault();
      cycleFocus(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Escape" || (e.metaKey && e.key === ".")) {
      // An open help balloon took this Escape to close itself
      // (balloon.ts); the next one cancels.
      if (e.key === "Escape" && e.defaultPrevented) return;
      // With no cancel button the key does nothing, as on the Mac.
      e.preventDefault();
      if (!e.repeat && cancelButton !== "none") press(cancelButton);
      return;
    }
    if (e.key !== "Enter") return;
    // A focused alert button takes Return itself, through its own
    // (native) activation, as bindDialogKeys leaves focused buttons be.
    const t = e.target;
    if (t instanceof Element && t.closest("button") && box.contains(t)) return;
    e.preventDefault();
    if (!e.repeat && defaultButton !== "none") press(defaultButton);
  }

  /** Tab and Shift-Tab go round the alert's buttons, left to right. */
  function cycleFocus(d: 1 | -1): void {
    const order = [...buttons.values()].filter((b) => !b.disabled);
    const n = order.length;
    if (!n) return;
    const i = order.indexOf(document.activeElement as HTMLButtonElement);
    const next = i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n;
    order[next]!.focus();
  }

  if (bar) {
    // Mac OS 8 drags an outline of the window; the alert moves live,
    // kept in the page and below its menu bar.
    bar.bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      bar.bar.setPointerCapture(e.pointerId);
      const x0 = (parseFloat(box.style.left) || 0) - e.clientX;
      const y0 = (parseFloat(box.style.top) || 0) - e.clientY;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        moved = true;
        const p = keepInView({ x: Math.round(x0 + ev.clientX),
                               y: Math.round(y0 + ev.clientY) }, size, viewport());
        box.style.left = `${p.x}px`;
        box.style.top = `${p.y}px`;
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        bar.bar.removeEventListener("pointermove", move);
        bar.bar.removeEventListener("pointerup", up);
        bar.bar.removeEventListener("pointercancel", up);
      };
      bar.bar.addEventListener("pointermove", move);
      bar.bar.addEventListener("pointerup", up);
      bar.bar.addEventListener("pointercancel", up);
    });
  }

  // Show it, then focus it, then take keys: nothing unseen can be
  // pressed. An alert opened on top of this one meanwhile keeps the
  // focus; this one gets it when that one closes (modal.ts).
  void fonts.then(() => {
    if (ended) return;
    layout();
    place();
    box.style.visibility = "";
    if (session.isTop) box.focus({ preventScroll: true });
    session.takeKeys(onKey);
    window.addEventListener("resize", place);
  });

  return {
    element: box,
    result,
    close(button) {
      if (ended || pressing) return;
      if (button === undefined) { end("dismissed"); return; }
      if (!buttons.has(button))
        throw new Error(`this alert has no "${button}" button`);
      press(button);
    },
  };
}

/** Lines of text in `el`, at `pitch` pixels a line. */
function lines(el: HTMLElement, pitch: number): number {
  return Math.max(1, Math.round(el.getBoundingClientRect().height / pitch));
}

/** The kind's icon, labeled for assistive tech because the kind says
 * how serious the alert is; an app's own icon (kind "plain") is
 * decorative. Null for a plain alert without one. */
function alertIcon(opts: AlertOptions): HTMLElement | null {
  const name = opts.kind === "plain" ? opts.icon : `alert-${opts.kind}`;
  if (name === undefined) return null;
  const icon = part("div", "osm-alert-icon");
  icon.style.setProperty("--osm-icon", `var(--osm-sprite-${name})`);
  if (opts.kind === "plain") {
    icon.setAttribute("aria-hidden", "true");
  } else {
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", ICON_LABEL[opts.kind]);
  }
  return icon;
}

/** A movable alert's title bar: pinstripes, parted around the title
 * when there is one. */
function titleBar(text: string): { bar: HTMLElement; title: HTMLElement | null } {
  const bar = part("div", "osm-alert-titlebar");
  if (!text) {
    bar.append(part("div", "osm-stripes osm-stripes-all"));
    return { bar, title: null };
  }
  const title = part("span", "osm-title");
  title.textContent = text;
  bar.append(part("div", "osm-stripes osm-stripes-l"), title,
             part("div", "osm-stripes osm-stripes-r"));
  return { bar, title };
}

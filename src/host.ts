// Hosts a page's Osmium window. In a native shell (a WKWebView app
// using the Swift host in macos/OsmiumWindows.swift) every window is a
// borderless NSWindow that the page draws completely, so the chrome's
// gestures go to the shell as window ops, which it applies to the
// window whose page sent them:
//
//   winClose            close the window
//   winZoom             toggle between the user and standard frames
//   winShade {on}       fold to the titlebar (windowshade) and back
//   winGrow             track the grow box (bottom-right resize)
//   dragWindow          move the window with the mouse
//
// By default the ops go to the "osmium" script message handler; an app
// with its own page-to-shell channel passes `post`. In a browser tab
// the same page fills the tab and does what a tab can: close a
// script-opened tab, resize one, fold the window in CSS. Escape closes
// the window (unless the page takes the key or the focus is in a text
// field), the way Finsical's panels close; pass escape: "ignore" for a
// document window that shouldn't.
import { isModal } from "./modal.js";
import { mountWindow } from "./window.js";
import type { Activation, OsmiumWindow } from "./window.js";

export interface Size { w: number; h: number }

/** A window gesture for the native shell (see the table above). */
export type WindowOp =
  | { op: "winClose" } | { op: "winZoom" } | { op: "winGrow" }
  | { op: "dragWindow" } | { op: "winShade"; on: boolean };

export interface HostOptions {
  title: string;
  /** Show the zoom box. `standard` is the zoomed size in a browser tab;
   * a native window zooms to its OsmiumWindowSpec size instead. */
  zoom?: { standard: Size };
  /** Show the grow box. `min` bounds the resize in a browser tab; a
   * native window uses its OsmiumWindowSpec minSize. */
  grow?: { min: Size };
  /** Send a window op to the native shell. Defaults to the "osmium"
   * WKScriptMessageHandler (a no-op when there is none). */
  post?: (op: WindowOp) => void;
  /** Whether a native shell hosts the page. Defaults to true when
   * `post` is given, else to whether the "osmium" handler exists. */
  native?: boolean;
  /** What Escape does. Defaults to "close". */
  escape?: EscapeKey;
  /** What draws the window active. Defaults to "page": the page's
   * focus, and inactive while an alert is up. With "manual" only
   * `window.setActive` and alerts with this window as `parent` do: the
   * app follows the native window's key state itself. */
  activation?: Activation;
}

/** What Escape does in a hosted window. */
export type EscapeKey =
  /** Close the window, unless the page took the key or the focus is in
   * a text field. */
  | "close"
  /** Nothing: the page handles Escape itself, if at all. */
  | "ignore";

export interface HostedWindow {
  /** The drawn window. Shade through setShaded below, not through it,
   * so the native window follows. */
  readonly window: OsmiumWindow;
  readonly shaded: boolean;
  /** Fold the window to its titlebar or unfold it, as its collapse box
   * does. */
  setShaded(on: boolean): void;
  close(): void;
  /** Remove every listener and observer hostWindow and the window added
   * to the page (Escape, resize, a grow in progress, and the window's
   * own, see OsmiumWindow.destroy), so the window can be hosted again
   * without leaks. The chrome stays; take the element out yourself. */
  destroy(): void;
}

type Handlers = { osmium?: { postMessage(m: unknown): void } };
const handler = () =>
  (window as { webkit?: { messageHandlers?: Handlers } })
    .webkit?.messageHandlers?.osmium;

/** A shaded native window is titlebar-only (~23px tall); an expanded
 * one is far taller. A viewport growing across this height means the
 * shell expanded the window (reopening a window closed while shaded),
 * so the page's fold state follows. Tab switches and minimizing leave
 * the height alone and keep the fold. */
const SHADED_MAX_H = 60;

/** Mount an Osmium window on `el` and wire its boxes to the native
 * shell, or to the browser tab the page runs in. */
export function hostWindow(el: HTMLElement,
                           opts: HostOptions): HostedWindow {
  const native = opts.native ?? (opts.post !== undefined || !!handler());
  const post = opts.post ?? ((op: WindowOp) => handler()?.postMessage(op));
  let shaded = false;
  let destroyed = false;

  const close = () => {
    post({ op: "winClose" });
    if (!native) window.close(); // no-op unless script-opened
  };

  let tabSize: Size | null = null;
  const zoom = () => {
    if (shaded || !opts.zoom) return;
    if (native) { post({ op: "winZoom" }); return; }
    if (tabSize) {
      window.resizeTo(tabSize.w, tabSize.h);
      tabSize = null;
    } else {
      tabSize = { w: window.outerWidth, h: window.outerHeight };
      window.resizeTo(opts.zoom.standard.w, opts.zoom.standard.h);
    }
  };

  const setShade = (on: boolean) => {
    shaded = on;
    win.setShaded(on);
    post({ op: "winShade", on });
  };

  /** Ends the grow in a browser tab that is in progress, if one is. */
  let endGrow: (() => void) | null = null;
  const grow = (e: PointerEvent) => {
    e.preventDefault();
    if (native) { post({ op: "winGrow" }); return; }
    endGrow?.(); // one grow at a time
    // In a tab: resize the drawn window itself, top-left pinned.
    const min = opts.grow!.min;
    const r = el.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY, w0 = r.width, h0 = r.height;
    el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
    el.style.right = "auto"; el.style.bottom = "auto";
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      el.style.width = `${Math.max(min.w, w0 + ev.clientX - x0)}px`;
      if (!shaded)
        el.style.height = `${Math.max(min.h, h0 + ev.clientY - y0)}px`;
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId === e.pointerId) stop();
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      endGrow = null;
    };
    endGrow = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const win = mountWindow(el, {
    title: opts.title,
    ...(opts.activation ? { activation: opts.activation } : {}),
    onClose: close,
    ...(opts.zoom ? { onZoom: zoom } : {}),
    onCollapse: () => setShade(!shaded),
    ...(opts.grow ? { onGrow: grow } : {}),
    onDrag: (e) => {
      e.preventDefault();
      post({ op: "dragWindow" });
    },
  });

  // Escape closes, unless something inside (a menu, a dialog key
  // handler) took the key: checked after the event has been through
  // every listener, whichever order they were added in. Escape typed
  // in a text field never closes the window: the field keeps it (a
  // search field clears), or a dialog's bindDialogKeys takes it from a
  // single-line edit text to press Cancel. While an alert is up
  // (showAlert), Escape is the alert's.
  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.repeat || isModal()) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest("input:not([type=checkbox]):not([type=range]), " +
                   "textarea, [contenteditable]")) return;
    setTimeout(() => { if (!e.defaultPrevented && !destroyed) close(); });
  };
  const closeOnEscape = (opts.escape ?? "close") === "close";
  if (closeOnEscape) window.addEventListener("keydown", onEscape);

  // A reload resets the page's fold state: put the native window back
  // in step (a no-op when it isn't shaded; ignored in a tab).
  post({ op: "winShade", on: false });
  let lastH = window.innerHeight;
  const onResize = () => {
    const h = window.innerHeight;
    if (shaded && lastH <= SHADED_MAX_H && h > SHADED_MAX_H) {
      shaded = false;
      win.setShaded(false);
    }
    lastH = h;
  };
  window.addEventListener("resize", onResize);

  return {
    window: win,
    get shaded() { return shaded; },
    setShaded: (on) => { if (on !== shaded) setShade(on); },
    close,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      endGrow?.();
      if (closeOnEscape) window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onResize);
      win.destroy();
    },
  };
}

// A movable modal dialog for the demo's own dialogs (Foolscap's Open
// and Save As). Osmium has alerts but no general modal dialog, so the
// demo builds one from a document window without boxes, which is how
// Mac OS 8's movable modal dialog looks (kWindowMovableModalDialogProc:
// a title bar to drag it by, no close, zoom or collapse box). Its frame
// wasn't captured; Standard File's own Open dialog in Mac OS 8.0 is a
// modal dialog with no title bar at all.
//
// While it is up, the rest of the page is inert: the windows and the
// desktop take no presses or keys, and the menu bar dims and ignores
// keyboard equivalents (menubar.ts skips an inert bar). A press outside
// the dialog beeps. Return and Escape press its default and cancel
// buttons through bindDialogKeys.
import { bindDialogKeys, mountWindow } from "../src/index.js";
import type { OsmiumWindow } from "../src/index.js";
import { el } from "./dom.js";

/** Above the desktop's windows (their z-index is their stacking
 * order) and the menu bar (100); below menus (1000) and alerts (2000). */
const Z = 500;
/** Menu bar height; the dialog stays below it. */
const MENU_H = 20;

export interface DemoDialog {
  readonly window: OsmiumWindow;
  /** The dialog's content area, to fill. */
  readonly content: HTMLElement;
  /** Wire Return and Escape to the dialog's buttons. */
  bindKeys(ok: HTMLButtonElement, cancel: HTMLButtonElement,
           actions: { ok(): void; cancel(): void }): void;
  /** Take the dialog down and give the page back. */
  close(): void;
}

export interface DialogOptions {
  readonly title: string;
  /** The drawn window's size. */
  readonly width: number;
  readonly height: number;
  /** The window the dialog is about, drawn inactive while it is up. */
  readonly parent?: OsmiumWindow;
  readonly onBeep?: () => void;
}

export function openDialog(opts: DialogOptions): DemoDialog {
  const layer = el("div", "dlg-layer");
  layer.style.zIndex = String(Z);
  layer.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    opts.onBeep?.();
  });
  const node = el("div", "dlg");
  // What the inert page already does, told to assistive technology.
  node.setAttribute("role", "dialog");
  node.setAttribute("aria-modal", "true");
  node.setAttribute("aria-label", opts.title);
  node.style.zIndex = String(Z + 1);
  node.style.width = `${opts.width}px`;
  node.style.height = `${opts.height}px`;
  // Centered, a fifth of the free height below the menu bar, as alerts
  // are placed.
  const x = Math.max(0, Math.floor((window.innerWidth - opts.width) / 2));
  const y = MENU_H + Math.max(0, Math.floor(
    (window.innerHeight - MENU_H - opts.height) / 5));
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  const content = el("div", "osm-content");
  node.append(content);

  // Everything else on the page goes inert until the dialog closes.
  const blocked = Array.from(document.body.children)
    .filter((c): c is HTMLElement => c instanceof HTMLElement && !c.inert);
  for (const c of blocked) c.inert = true;
  const returnFocus = document.activeElement;
  document.body.append(layer, node);

  const win = mountWindow(node, {
    title: opts.title,
    activation: "manual",
    onDrag: (e) => {
      e.preventDefault();
      const dx = e.clientX - node.offsetLeft, dy = e.clientY - node.offsetTop;
      const move = (ev: PointerEvent) => {
        node.style.left = `${Math.round(ev.clientX - dx)}px`;
        node.style.top = `${Math.max(MENU_H, Math.round(ev.clientY - dy))}px`;
      };
      // A canceled touch ends the drag too; otherwise the dialog would
      // follow the next pointer that moves.
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
  });
  win.setActive(true);
  // Only an active parent is drawn inactive and back; one already
  // inactive stays so.
  const parent = opts.parent;
  const parentWasActive = parent !== undefined &&
    !parent.element.classList.contains("osm-inactive");
  if (parentWasActive) parent.setActive(false);

  const unbind: (() => void)[] = [];
  let open = true;
  return {
    window: win,
    content,
    bindKeys(ok, cancel, actions) {
      unbind.push(bindDialogKeys(ok, cancel,
                                 { ...actions, active: () => open }));
    },
    close() {
      if (!open) return;
      open = false;
      for (const u of unbind) u();
      node.remove();
      layer.remove();
      for (const c of blocked) c.inert = false;
      if (parentWasActive) parent.setActive(true);
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
        returnFocus.focus({ preventScroll: true });
    },
  };
}

// The page's modal state while alerts are up (alert.ts). Every modal
// alert joins one stack, and the stack alone decides what the rest of
// the page looks like and takes:
//
//   html.osm-modal   while any alert is up: menu bar titles dim,
//                    windows with "page" activation draw inactive,
//                    bindDialogKeys and hostWindow's Escape stand down
//   .osm-top         on the topmost alert, the only one that takes keys
//   z-index          each alert above its own click-eating layer, the
//                    n-th pair at 2000 + 2n and 2001 + 2n (menus are 1000)
//   inert            on every other child of <body>, lower alerts
//                    included, and on children added while it lasts
//
// Keeping this in one place lets alerts close in any order: closing a
// lower alert first leaves the page blocked until the last one goes.
// Each change dispatches MODAL_CHANGE on window.
import type { OsmiumWindow } from "./window.js";

/** Dispatched on window whenever an alert opens or closes. */
export const MODAL_CHANGE = "osm-modalchange";

const MODAL_CLASS = "osm-modal";
const TOP_CLASS = "osm-top";
/** Above pop-up and menu bar menus (1000). */
const Z_BASE = 2000;

/** Whether a modal alert is up. */
export function isModal(): boolean {
  return document.documentElement.classList.contains(MODAL_CLASS);
}

// Open pop-up and menu bar menus register here, so an alert can close
// them as it opens: a menu left open under it would keep taking Return
// and Escape (menus listen in the capture phase).
const menuClosers = new Set<() => void>();

/** Have `close` called when an alert opens; the returned function
 * unregisters it (call it when the menu closes). */
export function closeWhenModal(close: () => void): () => void {
  menuClosers.add(close);
  return () => { menuClosers.delete(close); };
}

export interface ModalSession {
  /** Whether this session's alert is the topmost one. */
  readonly isTop: boolean;
  /** Route every keydown to `handler` while this alert is on top (it
   * sees keys first, in the document's capture phase). Until this is
   * called the alert takes no keys, so nothing unseen can be pressed. */
  takeKeys(handler: (e: KeyboardEvent) => void): void;
  /** Leave the stack: release the page if no alert is left (else the
   * next one down takes over), reactivate the parent, and give focus
   * back. Call after taking the alert's elements out of the page. */
  end(): void;
}

interface Entry {
  readonly box: HTMLElement;
  readonly layer: HTMLElement;
  readonly parent: OsmiumWindow | undefined;
  /** Where focus goes back to when this alert closes on top. */
  returnFocus: HTMLElement | null;
  keys: ((e: KeyboardEvent) => void) | null;
}

let stack: Entry[] = [];
/** The page's own inert and aria-hidden values, for everything the
 * stack has blocked, restored when the last alert closes. */
const saved = new Map<HTMLElement, { inert: boolean; hidden: string | null }>();
/** Parent windows the stack drew inactive, with how many alerts hold
 * each and whether it was active before the first. */
const held = new Map<OsmiumWindow, { count: number; wasActive: boolean }>();
let observer: MutationObserver | null = null;

const KEY_EVENTS = ["keydown", "keypress", "keyup"] as const;

const supportsInert = () => "inert" in HTMLElement.prototype;

/** Put an alert (`box`, over its full-page `layer`, both children of
 * <body>) on top of the modal stack, drawing `parent` inactive. Open
 * menus close first, and whatever has focus now is where focus returns
 * to afterwards. */
export function openModal(box: HTMLElement, layer: HTMLElement,
                          parent?: OsmiumWindow): ModalSession {
  for (const close of [...menuClosers]) close();
  const active = document.activeElement;
  const entry: Entry = {
    box, layer, parent, keys: null,
    returnFocus: active instanceof HTMLElement && active !== document.body
      ? active : null,
  };
  stack.push(entry);
  if (stack.length === 1) start();
  if (parent) hold(parent);
  sync();
  window.dispatchEvent(new Event(MODAL_CHANGE));
  return {
    get isTop() { return stack[stack.length - 1] === entry; },
    takeKeys(handler) { entry.keys = handler; },
    end: () => end(entry),
  };
}

function end(entry: Entry): void {
  const i = stack.indexOf(entry);
  if (i < 0) return;
  const wasTop = i === stack.length - 1;
  stack.splice(i, 1);
  // A lower alert closing first: the alert above it was going to give
  // focus back to this one, so it gives it where this one would have.
  const above = stack[i];
  if (!wasTop && above?.returnFocus && entry.box.contains(above.returnFocus))
    above.returnFocus = entry.returnFocus;
  // Parent first, then the event: a "page" window's sync on the event
  // gets the last word, so it ends up drawn as the page's focus says.
  if (entry.parent) release(entry.parent);
  if (stack.length) sync(); else stop();
  window.dispatchEvent(new Event(MODAL_CHANGE));
  if (!wasTop) return;
  // Focus was in the alert (now gone, so it fell to body) or already on
  // body: give it back, to the alert now on top if there is one (the
  // element this alert took it from may be blocked under that one).
  // Focus the app moved elsewhere stays there.
  const now = document.activeElement;
  if (now && now !== document.body) return;
  const next = stack[stack.length - 1];
  const back = entry.returnFocus;
  const target = next && !(back && next.box.contains(back)) ? next.box : back;
  if (target?.isConnected) target.focus({ preventScroll: true });
}

function start(): void {
  document.documentElement.classList.add(MODAL_CLASS);
  for (const type of KEY_EVENTS) document.addEventListener(type, onKey, true);
  // Anything appended to <body> while an alert is up (an app's portal,
  // say) is blocked too.
  observer = new MutationObserver(() => { if (stack.length) sync(); });
  observer.observe(document.body, { childList: true });
}

function stop(): void {
  document.documentElement.classList.remove(MODAL_CLASS);
  for (const type of KEY_EVENTS) document.removeEventListener(type, onKey, true);
  observer?.disconnect();
  observer = null;
  for (const [el, was] of saved) restore(el, was);
  saved.clear();
}

/** Stack order, the top marker and inert, from the stack as it is. */
function sync(): void {
  const top = stack[stack.length - 1]!;
  stack.forEach((e, n) => {
    e.layer.style.zIndex = String(Z_BASE + 2 * n);
    e.box.style.zIndex = String(Z_BASE + 2 * n + 1);
    e.box.classList.toggle(TOP_CLASS, e === top);
  });
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    const open = child === top.box || child === top.layer;
    if (!saved.has(child)) {
      if (open) continue;
      saved.set(child, {
        inert: child.inert === true, hidden: child.getAttribute("aria-hidden"),
      });
    }
    if (open) restore(child, saved.get(child)!);
    else block(child);
  }
}

function block(el: HTMLElement): void {
  // Without inert (Safari before 15.5), assistive tech at least skips
  // the page; the key routing below keeps the keyboard in the alert.
  if (supportsInert()) el.inert = true;
  else el.setAttribute("aria-hidden", "true");
}

function restore(el: HTMLElement,
                 was: { inert: boolean; hidden: string | null }): void {
  if (supportsInert()) el.inert = was.inert;
  if (was.hidden === null) el.removeAttribute("aria-hidden");
  else el.setAttribute("aria-hidden", was.hidden);
}

function hold(w: OsmiumWindow): void {
  const h = held.get(w);
  if (h) { h.count++; return; }
  held.set(w, {
    count: 1, wasActive: !w.element.classList.contains("osm-inactive"),
  });
  // Inside Macintosh: Toolbox Essentials (Dialog Manager) has the
  // front window deactivated before an alert comes up, and Mac OS 8.0
  // draws the Finder window inactive behind its alerts.
  w.setActive(false);
}

function release(w: OsmiumWindow): void {
  const h = held.get(w);
  if (!h || --h.count > 0) return;
  held.delete(w);
  if (h.wasActive) w.setActive(true);
}

// Keys that scroll the page when nothing focused takes them. The alert
// has nothing that scrolls, so aimed at it they would scroll the page
// under it. Space is left to a focused button, which it presses.
const SCROLL_KEYS = new Set([
  " ", "PageUp", "PageDown", "Home", "End",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

/** Keys go to the top alert first, then no further: nothing under an
 * alert may act on a key, the page's own document and window listeners
 * included. (A listener on window in the capture phase runs before
 * this one and can't be kept out.) The alert's buttons still take Return
 * and Space through their native activation, which is a default action,
 * not a listener. Keys aimed outside the alert (focus on body, say)
 * lose their default too, and so do the scrolling keys aimed at it.
 * Browser shortcuts (with Command, Control or Option) keep their
 * default. keyup and keypress are held back the same way. */
function onKey(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.type === "keydown") top.keys?.(e);
  e.stopPropagation();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (!(t instanceof Node && top.box.contains(t))) {
    e.preventDefault();
    return;
  }
  if (!SCROLL_KEYS.has(e.key)) return;
  if (e.key === " " && t instanceof Element && t.closest("button")) return;
  e.preventDefault();
}

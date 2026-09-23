// The desktop demo (index.html): a Mac OS 8 desktop in the browser.
// Several Osmium windows share the page, so they use mountWindow's
// "manual" activation and this module plays Window Manager: exactly
// the frontmost window is active; a press in another window brings it
// forward (a press in its content only activates it, as in Mac OS 8,
// while a titlebar press activates and drags in one gesture); close
// boxes hide windows, which the menu bar and the desktop icons reopen;
// collapse boxes windowshade; the Finder window zooms and grows.
import { installOsmium, mountWindow } from "../src/index.js";
import type { OsmiumWindow, Size } from "../src/index.js";
import { el, swallowClick } from "./dom.js";
import { registerDemoSprites, sprite } from "./icons.js";
import type { SpriteName } from "./icons.js";
import { mountMenuBar } from "./menubar.js";
import { registerPatterns } from "./patterns.js";
import type { Pattern } from "./patterns.js";
import { WINDOWS } from "./windows.js";
import type { WindowContent, WindowId, WindowSpec } from "./windows.js";

/** The menu bar's height; windows stay below it. */
const MENU_H = 20;
/** Room kept between a zoomed window and the screen's edges. */
const MARGIN = 8;
/** How much of a dragged window's titlebar stays on screen. */
const KEEP_VISIBLE = 40;
/** Desktop icon cell width (the label may overhang it). */
const ICON_CELL_W = 76;

interface Frame { x: number; y: number; w: number; h: number }

/** Where the windows start, arranged for a 1024 x 720 screen (moved in
 * on smaller ones), and their stacking order, back to front. */
const START: readonly { id: WindowId; x: number; y: number }[] = [
  { id: "about", x: 24, y: 40 },
  { id: "panel", x: 16, y: 300 },
  { id: "finder", x: 344, y: 44 },
  { id: "controls", x: 472, y: 372 },
];

const ICONS: readonly { id: WindowId; label: string; icon: SpriteName }[] = [
  { id: "finder", label: "Osmium HD", icon: "icon-disk" },
  { id: "controls", label: "Controls", icon: "icon-app" },
  { id: "panel", label: "Control Panel", icon: "icon-panel" },
  { id: "about", label: "About Osmium UI", icon: "icon-readme" },
];

interface DeskWindow {
  readonly spec: WindowSpec;
  readonly el: HTMLElement;
  readonly win: OsmiumWindow;
  content: WindowContent;
  shaded: boolean;
  /** The frame to go back to from the zoomed (standard) state. */
  userFrame: Frame | null;
}

registerDemoSprites();
registerPatterns();
const desktop = document.getElementById("desktop")!;

/** Visible windows, back to front. */
let stack: DeskWindow[] = [];
const front = (): DeskWindow | undefined => stack[stack.length - 1];

const noShadow = (s: Size): Size => ({ w: s.w - 1, h: s.h - 1 });

function frameOf(w: DeskWindow): Frame {
  return { x: w.el.offsetLeft, y: w.el.offsetTop,
           w: w.el.offsetWidth, h: w.el.offsetHeight };
}

function setFrame(w: DeskWindow, f: Frame): void {
  Object.assign(w.el.style, {
    left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px`,
  });
}

/** Follow one pointer until it's released. */
function track(e: PointerEvent, move: (ev: PointerEvent) => void): void {
  e.preventDefault();
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId === e.pointerId) move(ev);
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

// ---- activation and stacking --------------------------------------------

function activate(w: DeskWindow): void {
  if (front() !== w) {
    stack = [...stack.filter((s) => s !== w), w];
    stack.forEach((s, i) => {
      s.el.style.zIndex = String(i + 1);
      s.win.setActive(s === w);
    });
  }
  // The keyboard follows the active window: nothing outside it (a
  // window behind, a desktop icon) may keep it.
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && !w.el.contains(focused))
    focused.blur();
  if (!w.el.contains(document.activeElement)) w.content.focus?.();
}

function open(id: WindowId): void {
  const w = windows.get(id)!;
  w.el.hidden = false;
  activate(w);
}

function close(w: DeskWindow): void {
  w.el.hidden = true;
  w.win.setActive(false);
  if (w.el.contains(document.activeElement))
    (document.activeElement as HTMLElement).blur();
  stack = stack.filter((s) => s !== w);
  const next = front();
  if (next) {
    next.win.setActive(true);
    next.content.focus?.();
  }
}

// ---- window gestures ------------------------------------------------------

function drag(w: DeskWindow, e: PointerEvent): void {
  const dx = e.clientX - w.el.offsetLeft, dy = e.clientY - w.el.offsetTop;
  track(e, (ev) => {
    const x = Math.min(window.innerWidth - KEEP_VISIBLE,
      Math.max(KEEP_VISIBLE - w.el.offsetWidth, Math.round(ev.clientX - dx)));
    const y = Math.min(window.innerHeight - KEEP_VISIBLE,
      Math.max(MENU_H, Math.round(ev.clientY - dy)));
    w.el.style.left = `${x}px`;
    w.el.style.top = `${y}px`;
  });
}

function grow(w: DeskWindow, e: PointerEvent): void {
  const min = noShadow(w.spec.min ?? w.spec.size);
  const f = frameOf(w);
  track(e, (ev) => {
    setFrame(w, { ...f,
      w: Math.max(min.w, Math.round(f.w + ev.clientX - e.clientX)),
      h: Math.max(min.h, Math.round(f.h + ev.clientY - e.clientY)) });
  });
}

/** The zoomed frame: the content's standard size, kept on screen. */
function standardFrame(w: DeskWindow, f: Frame): Frame {
  const s = w.content.standardSize?.(f) ?? noShadow(w.spec.size);
  const maxW = window.innerWidth - 2 * MARGIN;
  const maxH = window.innerHeight - MENU_H - 2 * MARGIN;
  const size = { w: Math.min(s.w, maxW), h: Math.min(s.h, maxH) };
  return {
    ...size,
    x: Math.max(MARGIN, Math.min(f.x, window.innerWidth - MARGIN - size.w)),
    y: Math.max(MENU_H + MARGIN,
                Math.min(f.y, window.innerHeight - MARGIN - size.h)),
  };
}

/** Toggle between the user and standard frames, as the zoom box does. */
function zoom(w: DeskWindow): void {
  if (w.shaded) return;
  const f = frameOf(w);
  const std = standardFrame(w, f);
  const zoomed = f.x === std.x && f.y === std.y && f.w === std.w &&
    f.h === std.h;
  if (zoomed && w.userFrame) {
    setFrame(w, w.userFrame);
    w.userFrame = null;
  } else {
    w.userFrame = f;
    setFrame(w, std);
  }
}

function shade(w: DeskWindow): void {
  w.shaded = !w.shaded;
  w.win.setShaded(w.shaded);
}

// ---- the windows ------------------------------------------------------------

const windows = new Map<WindowId, DeskWindow>();
for (const spec of WINDOWS) {
  const node = el("div");
  node.hidden = true;
  if (spec.info) node.classList.add("osm-info");
  const content = el("div", "osm-content");
  node.append(content);
  desktop.append(node);
  // The handlers reach the window record, which exists before any of
  // them can run.
  const self = (): DeskWindow => windows.get(spec.id)!;
  const win = mountWindow(node, {
    title: spec.title,
    activation: "manual",
    onClose: () => close(self()),
    onCollapse: () => shade(self()),
    onDrag: (e) => drag(self(), e),
    ...(spec.zoom ? { onZoom: () => zoom(self()) } : {}),
    ...(spec.min ? { onGrow: (e: PointerEvent) => grow(self(), e) } : {}),
  });
  win.setActive(false);
  const w: DeskWindow = {
    spec, el: node, win, content: {}, shaded: false,
    userFrame: null,
  };
  windows.set(spec.id, w);
  w.content = spec.build(content, {
    close: () => close(w),
    isActive: () => front() === w,
    open,
    setDesktop,
  });

  // A press in a window behind brings it forward. In its content the
  // press does nothing else (Mac OS 8 spends that click on activation);
  // on the titlebar it goes on to drag the window.
  node.addEventListener("pointerdown", (e) => {
    if (front() === w) return;
    activate(w);
    if ((e.target as Element).closest(".osm-titlebar")) return;
    e.stopPropagation();
    e.preventDefault();
    swallowClick();
  }, true);
  // Tabbing into a window behind brings it forward too.
  node.addEventListener("focusin", () => {
    if (front() !== w) activate(w);
  });
}

/** Put every window back where it started (Special > Clean Up). */
function cleanUp(): void {
  for (const s of START) {
    const w = windows.get(s.id)!;
    if (w.shaded) shade(w);
    w.userFrame = null;
    const size = noShadow(w.spec.size);
    setFrame(w, {
      ...size,
      x: Math.max(0, Math.min(s.x, window.innerWidth - size.w - MARGIN)),
      y: Math.max(MENU_H, Math.min(s.y, window.innerHeight - size.h - MARGIN)),
    });
    open(s.id);
  }
}

function setDesktop(p: Pattern): void {
  document.documentElement.style.background = p.background;
}

// ---- desktop icons --------------------------------------------------------
// A press selects an icon, a double-click (or Return) opens its window.

const iconsEl = document.getElementById("icons")!;
const labels: HTMLElement[] = [];
let selectedIcon: { el: HTMLElement; id: WindowId } | null = null;
function selectIcon(icon: { el: HTMLElement; id: WindowId } | null): void {
  selectedIcon?.el.classList.remove("dsk-selected");
  selectedIcon = icon;
  icon?.el.classList.add("dsk-selected");
}
for (const d of ICONS) {
  const icon = el("button", "dsk-icon");
  icon.type = "button";
  const img = el("span", "dsk-img");
  img.style.backgroundImage = sprite(d.icon);
  const label = el("span", "dsk-label", d.label);
  labels.push(label);
  icon.append(img, label);
  icon.addEventListener("pointerdown", (e) => {
    if (e.button === 0) selectIcon({ el: icon, id: d.id });
  });
  icon.addEventListener("dblclick", () => open(d.id));
  icon.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.repeat) return;
    e.preventDefault();
    selectIcon({ el: icon, id: d.id });
    open(d.id);
  });
  iconsEl.append(icon);
}
// A press on the desktop itself clears the icon selection.
desktop.addEventListener("pointerdown", (e) => {
  if (e.target === desktop) selectIcon(null);
});

/** Center each label box under its icon on a whole pixel. */
function placeLabels(): void {
  for (const l of labels)
    l.style.marginLeft = `${Math.floor((ICON_CELL_W - l.offsetWidth) / 2)}px`;
}
placeLabels();
void installOsmium().catch(() => {}).finally(placeLabels);

// ---- the menu bar -------------------------------------------------------

const openable = (id: WindowId) => ({
  title: windows.get(id)!.spec.title, action: () => open(id),
});
mountMenuBar(document.getElementById("menubar")!, [
  { title: "Osmium", icon: "logo", items: () => [
    { title: "About Osmium UI…", action: () => open("about") },
    null,
    openable("panel"),
    openable("controls"),
    openable("finder"),
  ] },
  { title: "File", items: () => {
    const icon = selectedIcon;
    const w = front();
    return [
      { title: "Open", ...(icon ? { action: () => open(icon.id) } : {}) },
      { title: "Close Window", ...(w ? { action: () => close(w) } : {}) },
    ];
  } },
  { title: "Edit", items: () => [
    { title: "Undo" }, null, { title: "Cut" }, { title: "Copy" },
    { title: "Paste" }, { title: "Clear" }, null, { title: "Select All" },
  ] },
  { title: "Special", items: () => [
    { title: "Clean Up", action: cleanUp },
    { title: "Empty Trash…" },
    null,
    { title: "Restart", action: () => location.reload() },
  ] },
]);

cleanUp();

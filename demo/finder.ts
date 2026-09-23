// "Osmium HD": a Finder window in list view. A header placard, column
// headers that sort (the sorted column's header sinks and its cells
// shade), rows with small icons, a scroll bar and keyboard navigation
// from mountList, and a dimmed horizontal scroll bar beside the grow
// box. Double-clicking one of the demo's own items opens its window.
import { centerText, mountList } from "../src/index.js";
import type { Size } from "../src/index.js";
import { el } from "./dom.js";
import { sprite } from "./icons.js";
import type { SpriteName } from "./icons.js";
import type { WindowContent, WindowEnv, WindowId } from "./windows.js";

type Column = "name" | "size" | "kind";

interface Item {
  readonly name: string;
  /** In K, rounded up the way the Finder shows it. */
  readonly size: number;
  readonly kind: string;
  readonly icon: SpriteName;
  /** The demo window a double-click opens. */
  readonly opens?: WindowId;
}

const ITEMS: readonly Item[] = [
  { name: "About Osmium UI", size: 4, kind: "document", icon: "small-text",
    opens: "about" },
  { name: "Controls", size: 212, kind: "application program",
    icon: "small-app", opens: "controls" },
  { name: "Control Panel", size: 96, kind: "control panel",
    icon: "small-panel", opens: "panel" },
  { name: "Window Host", size: 48, kind: "system extension",
    icon: "small-extension" },
  { name: "Charcoal 12", size: 36, kind: "font", icon: "small-font" },
  { name: "Geneva 10", size: 32, kind: "font", icon: "small-font" },
  { name: "Geneva 9", size: 28, kind: "font", icon: "small-font" },
  { name: "Startup Chime", size: 64, kind: "sound", icon: "small-sound" },
  { name: "Alert Beep", size: 12, kind: "sound", icon: "small-sound" },
  { name: "Bevel Buttons", size: 8, kind: "picture", icon: "small-picture" },
  { name: "Checkboxes", size: 8, kind: "picture", icon: "small-picture" },
  { name: "Group Boxes", size: 4, kind: "picture", icon: "small-picture" },
  { name: "List Boxes", size: 8, kind: "picture", icon: "small-picture" },
  { name: "Pinstripes", size: 4, kind: "picture", icon: "small-picture" },
  { name: "Pop-up Menus", size: 8, kind: "picture", icon: "small-picture" },
  { name: "Progress Bars", size: 4, kind: "picture", icon: "small-picture" },
  { name: "Push Buttons", size: 8, kind: "picture", icon: "small-picture" },
  { name: "Scroll Bars", size: 12, kind: "picture", icon: "small-picture" },
  { name: "Sliders", size: 12, kind: "picture", icon: "small-picture" },
  { name: "controls.ts", size: 32, kind: "text document", icon: "small-text" },
  { name: "host.ts", size: 8, kind: "text document", icon: "small-text" },
  { name: "osmium.css", size: 28, kind: "text document", icon: "small-text" },
  { name: "OsmiumWindows.swift", size: 24, kind: "text document",
    icon: "small-text" },
  { name: "window.ts", size: 8, kind: "text document", icon: "small-text" },
];

const COLUMNS: readonly { id: Column; title: string }[] = [
  { id: "name", title: "Name" },
  { id: "size", title: "Size" },
  { id: "kind", title: "Kind" },
];

/** Row pitch: 18px rows and a white rule, as in Mac OS 8 list views. */
const ROW_H = 19;
/** Heights of the placard, the column headers and the horizontal
 * scroll bar's strip, which with the rows fill the content area. */
const PLACARD_H = 21;
const HEADS_H = 21;
const HBAR_H = 15;
/** Window height around the content area: titlebar, frame, edges. */
const FRAME_H = 28;

const byName = (a: Item, b: Item) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** The Finder's orders: names A to Z, the largest size first, kinds A
 * to Z; ties by name. */
function sortItems(items: readonly Item[], by: Column): Item[] {
  const order: Record<Column, (a: Item, b: Item) => number> = {
    name: byName,
    size: (a, b) => b.size - a.size || byName(a, b),
    kind: (a, b) => a.kind.localeCompare(b.kind) || byName(a, b),
  };
  return [...items].sort(order[by]);
}

function sizeLabel(k: number): string {
  return k >= 1024 ? `${(k / 1024).toFixed(1)} MB` : `${k}K`;
}

function row(it: Item): HTMLElement {
  const r = el("div", "fnd-row");
  r.dataset.name = it.name;
  const name = el("span", "fnd-cell fnd-name");
  const icon = el("span", "fnd-icon");
  icon.style.backgroundImage = sprite(it.icon);
  name.append(icon, el("span", "fnd-label", it.name));
  r.append(name, el("span", "fnd-cell fnd-size", sizeLabel(it.size)),
           el("span", "fnd-cell fnd-kind", it.kind));
  r.setAttribute("aria-label",
                 `${it.name}, ${sizeLabel(it.size)}, ${it.kind}`);
  return r;
}

export function buildFinder(content: HTMLElement,
                            env: WindowEnv): WindowContent {
  const root = el("div", "fnd");
  const placard = el("div", "osm-placard fnd-placard",
                     `${ITEMS.length} items, 312.4 MB available`);
  const heads = el("div", "osm-colheads fnd-heads");
  const listEl = el("div", "fnd-list");
  const hbar = el("div", "fnd-hbar");
  hbar.setAttribute("aria-hidden", "true");
  root.append(placard, heads, listEl, hbar);
  content.append(root);
  centerText(placard);

  let items: Item[] = [];
  const list = mountList(listEl, {
    rowHeight: ROW_H,
    label: "Osmium HD",
    onOpen(i) {
      const target = items[i]?.opens;
      if (target) env.open?.(target);
    },
  });

  const headEls = COLUMNS.map((c) => {
    const h = el("button", `osm-colhead fnd-h-${c.id}`, c.title);
    h.type = "button";
    h.setAttribute("aria-label", `Sort by ${c.title}`);
    h.addEventListener("click", (e) => {
      sort(c.id);
      // A mouse sort leaves the keyboard with the list, as in the Finder
      // (a pressed button would take it in Chromium and Firefox).
      if (e.detail > 0) listEl.focus({ preventScroll: true });
    });
    heads.append(h);
    return h;
  });

  // A new order keeps the selected item selected and in view.
  function sort(by: Column): void {
    COLUMNS.forEach((c, i) => {
      headEls[i]!.classList.toggle("osm-sorted", c.id === by);
      headEls[i]!.setAttribute("aria-pressed", String(c.id === by));
    });
    listEl.dataset.sort = by;
    const kept = items[list.selected];
    items = sortItems(ITEMS, by);
    list.setRows(items.map(row), { keep: kept ? items.indexOf(kept) : -1 });
  }
  sort("name");

  return {
    focus: () => listEl.focus({ preventScroll: true }),
    // Zoomed, the window keeps its width and shows every item.
    standardSize(current: Size): Size {
      return {
        w: current.w,
        h: PLACARD_H + HEADS_H + items.length * ROW_H + HBAR_H + FRAME_H,
      };
    },
  };
}

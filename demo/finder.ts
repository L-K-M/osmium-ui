// "Osmium HD": a Finder window in list view, on mountListView. A header
// placard, column headers that pick the sort column (the sorted
// column's header sinks and its cells shade), the sort order button
// that reverses the order (Finder 8.1), column dividers to drag (Finder
// 8.5), rows with small icons, both scroll bars and keyboard
// navigation. The columns keep their widths, so a narrow window scrolls
// sideways, headers and all. Double-clicking one of the demo's own
// items opens its window (the Read Me opens in Foolscap). While the
// window opens, chasing arrows turn in the header in place of its text,
// as Mac OS 8.0's Finder shows them while it reads a folder.
import {
  attachBalloon, centerText, mountChasingArrows, mountListView,
} from "../src/index.js";
import type { ListViewColumn, ListViewSort, Size } from "../src/index.js";
import type { DocumentId } from "./documents.js";
import { el } from "./dom.js";
import { sprite } from "./icons.js";
import type { SpriteName } from "./icons.js";
import type { WindowContent, WindowEnv, WindowId } from "./windows.js";

interface Item {
  readonly name: string;
  /** In K, rounded up the way the Finder shows it. */
  readonly size: number;
  readonly kind: string;
  readonly icon: SpriteName;
  /** The demo window a double-click opens. */
  readonly opens?: WindowId;
  /** The document it opens in that window's application. */
  readonly doc?: DocumentId;
}

const ITEMS: readonly Item[] = [
  { name: "About Osmium UI", size: 4, kind: "document", icon: "small-text",
    opens: "about" },
  { name: "Controls", size: 212, kind: "application program",
    icon: "small-app", opens: "controls" },
  { name: "Control Panel", size: 96, kind: "control panel",
    icon: "small-panel", opens: "panel" },
  { name: "Foolscap", size: 64, kind: "application program",
    icon: "small-foolscap", opens: "editor" },
  { name: "Read Me", size: 8, kind: "Foolscap document", icon: "small-text",
    opens: "editor", doc: "readme" },
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

/** Name widens with the window; below the columns' total width
 * (120 + 64 + 150) the rows and headers scroll sideways. */
const COLUMNS: readonly (ListViewColumn & { readonly title: string })[] = [
  { id: "name", title: "Name", width: 120, minWidth: 120, grow: 1,
    sort: "ascending" },
  { id: "size", title: "Size", width: 64, sort: "descending" },
  { id: "kind", title: "Kind", width: 150, sort: "ascending" },
];

/** Heights of the placard, the column headers and the horizontal
 * scroll bar's strip, which with the rows fill the content area. */
const PLACARD_H = 21;
const HEADS_H = 21;
const HBAR_H = 15;
/** Window height around the content area: titlebar, frame, edges. */
const FRAME_H = 28;
/** How long the window "reads the disk" when it opens: far longer than
 * the Finder takes over 26 items, so the arrows can be seen. */
const READ_MS = 2000;

const byName = (a: Item, b: Item) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** The Finder's normal orders: names A to Z, the largest size first,
 * kinds A to Z; ties by name. Reversed, the whole list turns over. */
function sortItems(items: readonly Item[], sort: ListViewSort): Item[] {
  const order: Record<string, (a: Item, b: Item) => number> = {
    name: byName,
    size: (a, b) => b.size - a.size || byName(a, b),
    kind: (a, b) => a.kind.localeCompare(b.kind) || byName(a, b),
  };
  const compare = order[sort.column] ?? byName;
  const sign = sort.order === "reversed" ? -1 : 1;
  return [...items].sort((a, b) => sign * compare(a, b));
}

function sizeLabel(k: number): string {
  return k >= 1024 ? `${(k / 1024).toFixed(1)} MB` : `${k}K`;
}

export function buildFinder(content: HTMLElement,
                            env: WindowEnv): WindowContent {
  const root = el("div", "fnd");
  const placard = el("div", "osm-placard fnd-placard");
  const arrowsEl = el("span");
  const status = document.createTextNode("");
  placard.append(arrowsEl, status);
  const listEl = el("div", "fnd-list");
  root.append(placard, listEl);
  content.append(root);
  const arrows = mountChasingArrows(arrowsEl);
  let reading: ReturnType<typeof setTimeout> | undefined;
  // Opening a window, the Finder blanks the header and turns the arrows
  // until the folder is read, then puts the header's text back.
  const readDisk = () => {
    clearTimeout(reading);
    status.data = "";
    arrows.start();
    reading = setTimeout(() => {
      arrows.stop();
      status.data = `${ITEMS.length} items, 312.4 MB available`;
      centerText(placard);
    }, READ_MS);
  };
  readDisk();
  attachBalloon(placard, { trigger: env.balloons, content: "Information " +
    "placard\n\nHow many items this window holds, and how much room is " +
    "left on the disk." });

  const list = mountListView<Item>(listEl, {
    label: "Osmium HD",
    columns: COLUMNS,
    key: (it) => it.name,
    cell: (it, col) => col.id === "size" ? sizeLabel(it.size)
      : col.id === "kind" ? it.kind : it.name,
    icon: (it) => ({ image: sprite(it.icon), label: it.kind }),
    highlight: "label",
    sort: { column: "name", order: "normal" },
    resize: "drag",
    // A new order keeps the selected item selected and in view.
    onSort: (s) => list.setRows(sortItems(ITEMS, s), { scroll: "top" }),
    onOpen(name) {
      const item = ITEMS.find((it) => it.name === name);
      if (item?.opens) env.open?.(item.opens, item.doc);
    },
  });
  list.setRows(sortItems(ITEMS, { column: "name", order: "normal" }));

  for (const c of COLUMNS) {
    const h = listEl.querySelector<HTMLElement>(
      `[data-column="${c.id}"] > .osm-colhead`);
    if (!h) continue;
    attachBalloon(h, { trigger: env.balloons, content: () =>
      h.classList.contains("osm-sorted")
        ? `${c.title} column\n\nThe items are sorted by ${
          c.title.toLowerCase()}.`
        : `${c.title} column\n\nTo sort the items by ${
          c.title.toLowerCase()}, click here.` });
  }
  const sortOrder = listEl.querySelector<HTMLElement>(".osm-lv-sortdir");
  if (sortOrder) {
    attachBalloon(sortOrder, { trigger: env.balloons, content:
      "Sort order button\n\nTo reverse the order of the items, click " +
      "here." });
  }

  return {
    focus: () => list.focus(),
    shown: readDisk,
    // Zoomed, the window keeps its width and shows every item.
    standardSize(current: Size): Size {
      return {
        w: current.w,
        h: PLACARD_H + HEADS_H + list.contentHeight + HBAR_H + FRAME_H,
      };
    },
  };
}

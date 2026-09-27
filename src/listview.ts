// List views over any data, the Mac OS 8 Finder's way: column headers
// that pick the sort column (Finder 8.0), the sort order ("pyramid")
// button over the vertical scroll bar (Finder 8.1), and optionally
// column widths dragged by the header dividers (Finder 8.5), with the
// List Manager's press tracking, keyboard moves and type-select. Rows
// are the app's data, matched by key: setRows keeps each row's element,
// its cells' nodes and the selection, so a list can be refilled many
// times a second (a network scan) without losing the reader's place.
//
// Mac OS 8 had no general table control. The Finder list view was the
// Finder's own; the List Manager drew one grid of equal cells without
// headers; the Data Browser came later with CarbonLib. This follows the
// Finder for looks and the List Manager for single selection.
//
// Markup (osmium.css, "list views"):
//
//   host.osm-listview
//     div.osm-lv-grid [grid, tabindex 0]       the keyboard target
//       div.osm-colheads.osm-lv-heads [row]
//         div.osm-lv-head [columnheader]       one per column, the last
//           button.osm-colhead | span.osm-colhead    taking the strip's
//           div.osm-lv-divider                 rest; resize "drag" only
//       div.osm-list.osm-lv-body               the scroll bars' host
//         div.osm-list-view                    the scroller
//           div.osm-lv-rows [rowgroup]
//             div.osm-lv-row [row] > div.osm-lv-cell [gridcell] ...
//     button.osm-lv-sortdir                    outside the grid, which
//     div.osm-list-empty.osm-lv-empty [status] may own only rows
import {
  attachScrollbar, centerText, part, stopCentering, trackPress,
} from "./controls.js";
import type { ListScrollbars } from "./controls.js";
import { installOsmium } from "./install.js";

/** Which way a column's values run in its normal order, for assistive
 * technology. The Finder's normal orders: names A to Z, sizes largest
 * first, dates newest first. */
export type SortDirection = "ascending" | "descending";

/** The list's order relative to the sort column's normal order, what the
 * sort order button flips (Finder 8.1 scripting calls it the window's
 * "sort direction"). */
export type SortOrder = "normal" | "reversed";

export interface ListViewSort {
  /** The sort column's id. */
  readonly column: string;
  readonly order: SortOrder;
}

/** Where a column's content sits. The Finder right-aligns sizes. */
export type ColumnAlign = "left" | "right";

/** Column widths: fixed (Finder 8.0 and 8.1) or dragged by the dividers
 * between header cells (Finder 8.5). */
export type ColumnResize = "fixed" | "drag";

/** The sort order button at the top right (Finder 8.1 and later). */
export type SortOrderButton = "shown" | "none";

/** How the selected row shows, in the highlight color
 * (--osm-highlight and --osm-highlight-text). */
export type RowHighlight =
  /** The whole row, as a List Manager list highlights its cell; cleared
   * while the window is inactive. */
  | "row"
  /** Only the primary column's label, its icon darkened, as in Finder
   * list views; kept while the window is inactive. */
  | "label";

/** Whether select() reports the change to onSelect. */
export type SelectMode = "notify" | "silent";

/** Where the scroll position lands when setRows replaces the rows. */
export type ListViewScroll =
  /** While the list is scrolled, the row at the top of the view stays
   * put as rows come and go above it. At the very top the list stays at
   * the top, so rows arriving there show. */
  | "anchor"
  /** Back to the first row, then just far enough to show the selection
   * (a new order). */
  | "top";

/** Which rows have elements in the DOM. */
export type RowRendering =
  /** Every row while there are at most 1000 (WINDOW_ABOVE), otherwise
   * as "window". */
  | "auto"
  /** Every row, so find-in-page sees them all, at the cost of time per
   * update and memory for long lists. */
  | "all"
  /** Only the rows in and near the view, the selected row, and rows a
   * press is on. Browser find-in-page doesn't see the others; assistive
   * technology hears the row count and each row's position. */
  | "window";

/** Whether the rows are still coming, for the placeholder text. */
export type ListLoadState = "loading" | "loaded";

export interface ListViewColumn {
  /** Stable id: the sort, the widths and the callbacks name columns by
   * it. */
  readonly id: string;
  /** Header title. A Node (an icon, say) needs `label`. */
  readonly title: string | Node;
  /** Accessible name of the column when the title is a Node. */
  readonly label?: string;
  /** Width in px, header cell included. */
  readonly width: number;
  /** Narrowest a divider drag makes the column. Default 24, or the
   * width if that is narrower (a guess: the Finder's limit was not
   * measured). */
  readonly minWidth?: number;
  /** Whole-pixel share of the width the list has beyond its columns'
   * total, weighted by this number, the last growing column taking the
   * remainder. Not Finder behavior (its columns keep their widths);
   * default 0. The first divider drag fixes every column. */
  readonly grow?: number;
  /** Default "left"; applies to the header title too. */
  readonly align?: ColumnAlign;
  /** The column's normal order; a column without one doesn't sort. */
  readonly sort?: SortDirection;
}

/** A row's small icon, shown before the primary column's label. */
export interface ListRowIcon {
  /** A CSS image: "var(--osm-sprite-small-app)" or "url(...)", drawn
   * 16x16. */
  readonly image: string;
  /** What the icon means ("Printer"), for assistive technology. */
  readonly label: string;
}

export interface ListViewOptions<T> {
  /** Accessible name of the list. */
  readonly label: string;
  readonly columns: readonly ListViewColumn[];
  /** A row's identity, unique among the rows. */
  key(row: T): string;
  /** The content of `row`'s cell in `column`, `width` px wide (the
   * Finder shortens dates as their column narrows). `current` is the
   * node this cell holds from an earlier call, or null. Return it,
   * updated in place, to keep it (a control keeps its focus and its
   * press); return a string or another node to replace it. Called when
   * a row gets its elements, when its object changes (by identity), for
   * every row on refresh(), and for a column's cells when its width
   * changes. Type-select may call it for the primary column of a row
   * that has no elements ("window" rendering), releasing a node at once.
   * It should be cheap: a scan calls it for every row that changed. */
  cell(row: T, column: ListViewColumn, width: number,
       current: Node | null): string | Node;
  /** A node from `cell` left the list for good (replaced, its row gone,
   * or the list destroyed): undo what building it set up. */
  release?(node: Node, column: ListViewColumn): void;
  /** Row pitch, the 1px white rule included. Default 19, the Finder's
   * 18px rows and rule. */
  readonly rowHeight?: number;
  /** Id of the column that gets the icon and the "label" highlight
   * (the Finder's Name). Default: the first column. */
  readonly primary?: string;
  icon?(row: T): ListRowIcon | null;
  /** App classes for a row's element (stale, hidden, new). Recomputed
   * with its cells. */
  rowClass?(row: T): readonly string[];
  /** The text type-select matches. Default: the primary column's text. */
  typeSelect?(row: T): string;
  /** Default "row". */
  readonly highlight?: RowHighlight;
  /** The sort shown at first; default none. */
  readonly sort?: ListViewSort | null;
  /** Default "shown". */
  readonly sortOrderButton?: SortOrderButton;
  /** Default "fixed". */
  readonly resize?: ColumnResize;
  /** Default "both", as in the Finder. */
  readonly scrollbars?: ListScrollbars;
  /** Default "auto". */
  readonly rendering?: RowRendering;
  /** Placeholder shown while there are no rows and loading is over. */
  readonly emptyText?: string;
  /** Placeholder shown while there are no rows yet (setLoading). */
  readonly loadingText?: string;
  /** The reader selected `key` (null: the selection was cleared). Once
   * per press, however many rows a drag crossed. */
  onSelect?(key: string | null): void;
  /** A double-click on the selected row, or Return. */
  onOpen?(key: string): void;
  /** A contextual menu request (Control-click, right-click, the menu
   * key) on row `key`, selected (and reported) first. The list has
   * called preventDefault(); `event` gives the position. */
  onContextMenu?(key: string, event: MouseEvent): void;
  /** The reader picked a sort: a header click (another column, same
   * order) or the sort order button (the other order). The headers
   * already show it; sort the rows by the column's normal order, turn
   * the whole order over if reversed, and pass them to setRows. */
  onSort?(sort: ListViewSort): void;
  /** A divider drag ended with column `id` at `width` px. */
  onColumnResize?(id: string, width: number): void;
}

export interface SetListViewRowsOptions {
  /** Default "anchor". */
  readonly scroll?: ListViewScroll;
}

export interface OsmiumListView<T> {
  readonly element: HTMLElement;
  /** The rows as last passed to setRows, in display order. */
  readonly rows: readonly T[];
  /** The selected key, or null. It may name a key no row has (filtered
   * out): nothing shows selected then, and it shows again if the row
   * comes back. */
  readonly selected: string | null;
  readonly sort: ListViewSort | null;
  /** Current widths by column id. */
  readonly columnWidths: Readonly<Record<string, number>>;
  /** The height the rows need (rows x pitch), or the placeholder's
   * while there are none. With viewportHeight, the difference a zoom box
   * or "resize to fit" adds to the window. */
  readonly contentHeight: number;
  /** The height the rows get now. */
  readonly viewportHeight: number;
  /** Replace the rows, in display order. Rows are matched by key; a row
   * whose object is the same (===) keeps its cells as they are. Never
   * reports the selection. Throws on a duplicate key. During a press in
   * the rows the page shows the old rows until the press (and its
   * click) is over, so nothing moves under the pointer. */
  setRows(rows: readonly T[], opts?: SetListViewRowsOptions): void;
  /** Render every row again (cells, icons, classes), after state the
   * renderers read changed (favorites, say). */
  refresh(): void;
  /** Select `key` (null clears) and scroll it into view. Default
   * "notify" reports it to onSelect. */
  select(key: string | null, mode?: SelectMode): void;
  /** Show `sort` in the headers, the shaded column and the sort order
   * button, without reporting it. Throws for a column that doesn't
   * sort. */
  setSort(sort: ListViewSort | null): void;
  /** Which placeholder shows while there are no rows. */
  setLoading(state: ListLoadState): void;
  /** Replace the text shown while there are no rows and loading is over
   * (emptyText), updating a shown placeholder in place; "" shows none. */
  setEmptyText(text: string): void;
  /** Replace the text shown while there are no rows yet (loadingText),
   * updating a shown placeholder in place; "" shows none. */
  setLoadingText(text: string): void;
  /** Give the list the keyboard. */
  focus(): void;
  /** Release every node from `cell`, destroy the scroll bars, stop
   * observing and listening, and empty the host. */
  destroy(): void;
}

/** The Finder's row pitch: an 18px row and a 1px white rule. */
const DEFAULT_ROW_H = 19;
/** Narrowest a dragged column gets unless it says otherwise (not
 * measured). */
const DEFAULT_MIN_WIDTH = 24;
/** Type-select starts over after this long without a key (mountList's
 * value; the List Manager ties it to the Delay Until Repeat setting). */
const TYPE_RESET_MS = 1000;
/** Above this many rows, "auto" rendering keeps only the rows near the
 * view in the DOM. Measured with osmium.css, six columns, every row in
 * the DOM: WebKit 26 took 24 ms per inserted row and 0.7 s to reorder
 * 4096 rows (about twice that without content-visibility, as in WebKit
 * before Safari 18), 6 ms and 0.16 s for 1000. Windowed, 4096 rows take
 * 2 to 5 ms per insert and 30 ms to reorder in Chromium, WebKit and
 * Firefox. */
const WINDOW_ABOVE = 1000;
/** How far the vertical scroll bar reaches into the list from its right
 * edge; the header strip runs on over it. */
const SCROLLBAR_W = 15;
/** Rows rendered beyond each edge of the view in "window" rendering, so
 * a short scroll shows rows that are already laid out. */
const OVERSCAN = 8;
/** Movement that turns a touch press into a scroll (as mountList). */
const TOUCH_SLOP = 6;
/** A touch this soon after a run of scrolls stops a coasting list
 * rather than choosing a row (as mountList). */
const SCROLL_SETTLE_MS = 100;

/** Content that handles its own presses. A press on it inside a cell is
 * not the list's: the selection stays, the list doesn't capture the
 * pointer, and double-clicks and Space go to the control. Mark other
 * interactive elements with data-osm-control. */
const CONTROL_SELECTOR = [
  "button", "input", "select", "textarea", "label", "a[href]",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']", "[role='checkbox']", "[role='switch']",
  "[data-osm-control]",
].join(", ");

/** Cell controls that leave the arrow keys to the list (buttons and
 * boxes, not fields). */
const KEY_PASSING_CONTROL = [
  "button", "input[type='checkbox']", "input[type='radio']",
  "[role='button']", "[role='checkbox']", "[role='switch']",
  "[data-osm-control]",
].join(", ");

/** Keys that move the selection. */
const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End", "PageDown",
                          "PageUp"]);

/** A row's elements, while it has them. */
interface RowDom {
  readonly el: HTMLElement;
  readonly cells: readonly HTMLElement[];
  /** Where the primary column's content and the "label" highlight go. */
  readonly label: HTMLElement;
  readonly icon: HTMLElement | null;
  /** What each cell holds, as `cell` returned it. */
  readonly content: (string | Node | null)[];
  classes: readonly string[];
  /** The icon's image class, or "". */
  iconClass: string;
}

interface Row<T> {
  readonly key: string;
  data: T;
  /** Position in display order. */
  index: number;
  /** Its elements, or null while "window" rendering leaves it out. */
  dom: RowDom | null;
  /** Lowercased type-select text, worked out when first needed. */
  text: string | null;
}

let viewSeq = 0;
let rowSeq = 0;

/** Column widths for a list `avail` px wide: each growing column gets a
 * whole-pixel share of the width beyond the columns' total, by weight,
 * and the last growing column the remainder, so no cell edge (and no
 * bitmap text) lands on a half pixel. */
export function growWidths(base: readonly number[], grow: readonly number[],
                           avail: number): number[] {
  const spare = avail - base.reduce((a, b) => a + b, 0);
  const weight = grow.reduce((a, b) => a + b, 0);
  if (spare <= 0 || weight <= 0) return [...base];
  const out = base.map((w, i) =>
    w + Math.floor(spare * (grow[i] ?? 0) / weight));
  const last = grow.reduce((l, g, i) => (g > 0 ? i : l), -1);
  out[last] = out[last]! + avail - out.reduce((a, b) => a + b, 0);
  return out;
}

/** Which entries of `seq` (current DOM positions, -1 for new rows) form
 * a longest increasing run: the rows that can stay where they are while
 * the others move around them, so a sorted insert moves one row, not
 * every row after it. */
export function stayingRows(seq: readonly number[]): boolean[] {
  const tails: number[] = [];
  const prev = new Array<number>(seq.length).fill(-1);
  seq.forEach((v, i) => {
    if (v < 0) return;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]!]! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  });
  const keep = new Array<boolean>(seq.length).fill(false);
  for (let i = tails.at(-1) ?? -1; i >= 0; i = prev[i]!) keep[i] = true;
  return keep;
}

/** The direction assistive technology hears for `sort`: the sort
 * column's normal direction, or its opposite when reversed. */
export function sortDirection(sort: ListViewSort,
                              columns: readonly ListViewColumn[]
                              ): SortDirection {
  const col = columns.find((c) => c.id === sort.column);
  if (!col?.sort)
    throw new RangeError(`column "${sort.column}" doesn't sort`);
  if (sort.order === "normal") return col.sort;
  return col.sort === "ascending" ? "descending" : "ascending";
}

function validateColumns(columns: readonly ListViewColumn[]): void {
  if (!columns.length) throw new Error("a list view needs a column");
  const ids = new Set<string>();
  for (const c of columns) {
    if (ids.has(c.id)) throw new Error(`duplicate column id "${c.id}"`);
    ids.add(c.id);
    const bad = (what: string) =>
      new RangeError(`column "${c.id}": ${what}`);
    if (!Number.isInteger(c.width) || c.width < 1)
      throw bad("width must be a whole number of pixels");
    if (c.minWidth !== undefined &&
        (!Number.isInteger(c.minWidth) || c.minWidth > c.width))
      throw bad("minWidth must be whole and at most its width");
    if (c.grow !== undefined && (!Number.isInteger(c.grow) || c.grow < 0))
      throw bad("grow must be a whole number, 0 or more");
    if (typeof c.title !== "string" && !c.label)
      throw new Error(`column "${c.id}": a Node title needs a label`);
  }
}

/** Mount a list view in `host`, which gets the headers, the rows and
 * their scroll bars; give it a size. Throws on no columns, duplicate
 * column ids, bad widths, an unknown `primary`, or a `sort` naming a
 * column that doesn't sort. */
export function mountListView<T>(host: HTMLElement,
                                 opts: ListViewOptions<T>
                                 ): OsmiumListView<T> {
  const columns = [...opts.columns];
  validateColumns(columns);
  const rowH = opts.rowHeight ?? DEFAULT_ROW_H;
  if (!Number.isInteger(rowH) || rowH < 2)
    throw new RangeError("rowHeight must be a whole number, 2 or more");
  const primaryId = opts.primary ?? columns[0]!.id;
  const primary = columns.findIndex((c) => c.id === primaryId);
  if (primary < 0) throw new Error(`no column "${primaryId}" to be primary`);
  let sort = opts.sort ?? null;
  if (sort) sortDirection(sort, columns);
  void installOsmium().catch(() => {}); // the sort order button's sprites

  // This list's number, for rules added later too (iconClass), when
  // other lists may have taken the next ones.
  const seq = ++viewSeq;
  const id = `osm-lv-${seq}`;
  host.classList.add("osm-listview");
  host.classList.toggle("osm-lv-has-icon", !!opts.icon);
  host.dataset["highlight"] = opts.highlight ?? "row";
  host.dataset["osmLv"] = String(seq);

  // Widths, the row pitch and icon images go in rules of the list's own
  // style sheet, shared by class: an inline style or var() per cell
  // would keep the browser from sharing styles across 4096 rows (it
  // made their layout about ten times slower in Chromium).
  const sheetEl = document.createElement("style");
  sheetEl.dataset["osmiumListView"] = id;
  document.head.append(sheetEl);
  const sheet = sheetEl.sheet!;
  const rule = (selector: string): CSSStyleRule => {
    const at = sheet.insertRule(
      `.osm-listview[data-osm-lv="${seq}"] ${selector} {}`,
      sheet.cssRules.length);
    return sheet.cssRules[at] as CSSStyleRule;
  };
  if (rowH !== DEFAULT_ROW_H) {
    rule(".osm-lv-row").style.height = `${rowH}px`;
    rule(".osm-lv-cell").style.height = `${rowH - 1}px`;
  }
  const widthRules = columns.map((_, i) => rule(`.osm-lv-c${i}`));
  // The last header runs on over the scroll bar, and into any width
  // beyond the columns, as the Finder's does: its right end is under
  // the sort order button.
  const lastHeadRule = rule(`.osm-lv-head.osm-lv-c${columns.length - 1}`);
  const iconClasses = new Map<string, string>();
  /** The class that draws `image`, one rule per distinct image. */
  const iconClass = (image: string): string => {
    let cls = iconClasses.get(image);
    if (cls) return cls;
    cls = `osm-lv-i${iconClasses.size}`;
    const r = rule(`.${cls}`);
    r.style.backgroundImage = image;
    if (!r.style.backgroundImage)
      throw new Error(`icon image "${image}" is not a CSS image`);
    iconClasses.set(image, cls);
    return cls;
  };

  const grid = part("div", "osm-lv-grid");
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", opts.label);
  grid.tabIndex = 0;
  const heads = part("div", "osm-colheads osm-lv-heads");
  heads.setAttribute("role", "row");
  const body = part("div", "osm-list osm-lv-body");
  const view = part("div", "osm-list-view");
  // The grid is the keyboard target; its scroller must not become a
  // second tab stop, and a click that focuses it hands focus back.
  view.tabIndex = -1;
  const rowsEl = part("div", "osm-lv-rows");
  rowsEl.setAttribute("role", "rowgroup");
  view.append(rowsEl);
  body.append(view);
  grid.append(heads, body);
  host.append(grid);
  const sb = attachScrollbar(body, view, rowH);
  const hsb = (opts.scrollbars ?? "both") === "both"
    ? attachScrollbar(body, view, rowH, "horizontal") : null;

  const empty = part("div", "osm-list-empty osm-lv-empty");
  empty.setAttribute("role", "status");
  empty.hidden = true;
  host.append(empty);

  /** Rows in display order, as they are in the DOM. */
  let shown: Row<T>[] = [];
  const byKey = new Map<string, Row<T>>();
  const byElement = new WeakMap<Element, Row<T>>();
  /** The rows as last passed in (ahead of `shown` during a press). */
  let data: readonly T[] = [];
  let pending: { rows: readonly T[]; keys: readonly string[];
                 scroll: ListViewScroll } | null = null;
  let pendingRefresh = false;
  let selectedKey: string | null = null;
  let loadState: ListLoadState = "loaded";
  let emptyText = opts.emptyText;
  let loadingText = opts.loadingText;
  let sortedIndex = -1;
  /** Rows with elements, in display order (all of `shown`, or the ones
   * "window" rendering keeps). */
  let rendered: Row<T>[] = [];
  const rendering = opts.rendering ?? "auto";
  let windowed = false;
  let destroyed = false;
  // The host's listeners, removed by destroy() (its children's go with
  // them).
  const listening = new AbortController();
  const signal = listening.signal;

  // ---- columns and widths ----------------------------------------------

  let base = columns.map((c) => c.width);
  let growing = columns.some((c) => (c.grow ?? 0) > 0);
  let widths = [...base];

  const headCells = columns.map((c, i) => {
    const wrap = part("div", "osm-lv-head");
    wrap.setAttribute("role", "columnheader");
    wrap.dataset["column"] = c.id;
    wrap.classList.add(`osm-lv-c${i}`);
    if (i === primary) wrap.classList.add("osm-lv-primary");
    if (c.align === "right") wrap.dataset["align"] = "right";
    const title = c.sort ? part("button", "osm-colhead")
      : part("span", "osm-colhead");
    if (typeof c.title === "string") title.textContent = c.title;
    else {
      title.append(c.title);
      (c.sort ? title : wrap).setAttribute("aria-label", c.label ?? "");
    }
    wrap.append(title);
    if (c.sort) {
      const b = title as HTMLButtonElement;
      b.type = "button";
      // A mouse sort leaves the keyboard with the list, as in the Finder.
      b.addEventListener("pointerdown", (e) => {
        if (e.button === 0) grid.focus({ preventScroll: true });
      });
      trackPress(b, () => pickColumn(c.id));
    }
    if (opts.resize === "drag") {
      const divider = part("div", "osm-lv-divider");
      divider.setAttribute("aria-hidden", "true");
      divider.addEventListener("pointerdown", (e) => dragDivider(i, e));
      wrap.append(divider);
    }
    heads.append(wrap);
    return { wrap, title };
  });

  function setWidths(next: number[]): void {
    const changed = next.flatMap((w, i) => (w !== widths[i] ? [i] : []));
    widths = next;
    widths.forEach((w, i) => { widthRules[i]!.style.width = `${w}px`; });
    lastHeadRule.style.minWidth = `${widths.at(-1)! + SCROLLBAR_W}px`;
    rowsEl.style.minWidth = `${widths.reduce((a, b) => a + b, 0)}px`;
    for (const i of changed)
      for (const r of rendered) if (r.dom) renderCell(r.dom, r.data, i);
  }
  widths = [];
  setWidths([...base]);

  const layout = () => {
    if (growing)
      setWidths(growWidths(base, columns.map((c) => c.grow ?? 0),
                           view.clientWidth));
    if (windowed) renderRows(); // the view's height may have changed
  };
  const ro = new ResizeObserver(layout);
  ro.observe(view);

  function dragDivider(i: number, e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const divider = e.currentTarget as HTMLElement;
    divider.setPointerCapture(e.pointerId);
    // The first drag fixes every column where it shows, as Finder
    // columns are fixed.
    base = [...widths];
    growing = false;
    const x0 = e.clientX;
    const w0 = widths[i]!;
    const min = columns[i]!.minWidth ??
      Math.min(DEFAULT_MIN_WIDTH, columns[i]!.width);
    const move = (ev: PointerEvent) => {
      base[i] = Math.max(min, Math.round(w0 + ev.clientX - x0));
      setWidths([...base]);
      sb.update();
      hsb?.update();
    };
    const end = () => {
      divider.removeEventListener("pointermove", move);
      divider.removeEventListener("pointerup", end);
      divider.removeEventListener("pointercancel", end);
      if (widths[i] !== w0) opts.onColumnResize?.(columns[i]!.id, widths[i]!);
    };
    divider.addEventListener("pointermove", move);
    divider.addEventListener("pointerup", end);
    divider.addEventListener("pointercancel", end);
  }

  // ---- sort ------------------------------------------------------------

  const sortButton = opts.sortOrderButton === "none" ? null
    : part("button", "osm-lv-sortdir") as HTMLButtonElement;
  if (sortButton) {
    sortButton.type = "button";
    sortButton.setAttribute("aria-label", "Reverse sort order");
    sortButton.addEventListener("pointerdown", (e) => {
      if (e.button === 0) grid.focus({ preventScroll: true });
    });
    trackPress(sortButton, flipOrder);
    host.append(sortButton);
  }

  function showSort(): void {
    const next = sort ? columns.findIndex((c) => c.id === sort!.column) : -1;
    headCells.forEach(({ wrap, title }, i) => {
      title.classList.toggle("osm-sorted", i === next);
      if (i === next && sort)
        wrap.setAttribute("aria-sort", sortDirection(sort, columns));
      else wrap.removeAttribute("aria-sort");
    });
    if (next !== sortedIndex) {
      for (const { dom } of rendered) {
        dom?.cells[sortedIndex]?.classList.remove("osm-lv-sorted");
        dom?.cells[next]?.classList.add("osm-lv-sorted");
      }
      sortedIndex = next;
    }
    if (sortButton) {
      sortButton.disabled = !sort;
      sortButton.setAttribute("aria-pressed",
                              String(sort?.order === "reversed"));
    }
  }

  /** A header click: another column, in the list's current order. The
   * already sorted column does nothing: no source shows the 8.x Finder
   * reversing on a second click (the sort order button does that). */
  function pickColumn(column: string): void {
    if (sort?.column === column) return;
    sort = { column, order: sort?.order ?? "normal" };
    showSort();
    opts.onSort?.(sort);
  }

  function flipOrder(): void {
    if (!sort) return;
    sort = { column: sort.column,
             order: sort.order === "normal" ? "reversed" : "normal" };
    showSort();
    opts.onSort?.(sort);
  }

  // ---- rows ------------------------------------------------------------

  const selectedRow = () =>
    selectedKey === null ? undefined : byKey.get(selectedKey);

  function createDom(r: Row<T>): RowDom {
    const el = part("div", "osm-lv-row");
    el.id = `${id}-r${++rowSeq}`;
    el.setAttribute("role", "row");
    el.setAttribute("aria-selected", String(r.key === selectedKey));
    el.classList.toggle("osm-selected", r.key === selectedKey);
    const label = part("span", "osm-lv-label");
    const icon = opts.icon ? part("span", "osm-lv-icon") : null;
    icon?.setAttribute("role", "img");
    const cells = columns.map((c, i) => {
      const cell = part("div", `osm-lv-cell osm-lv-c${i}`);
      cell.setAttribute("role", "gridcell");
      if (c.align === "right") cell.dataset["align"] = "right";
      if (i === sortedIndex) cell.classList.add("osm-lv-sorted");
      if (i === primary) {
        cell.classList.add("osm-lv-primary");
        if (icon) cell.append(icon);
        cell.append(label);
      }
      el.append(cell);
      return cell;
    });
    const dom: RowDom = {
      el, cells, label, icon, content: columns.map(() => null), classes: [],
      iconClass: "",
    };
    byElement.set(el, r);
    r.dom = dom;
    renderRow(r);
    return dom;
  }

  function renderCell(dom: RowDom, row: T, i: number): void {
    const col = columns[i]!;
    const target = i === primary ? dom.label : dom.cells[i]!;
    const prev = dom.content[i] ?? null;
    const next = opts.cell(row, col, widths[i]!,
                           prev instanceof Node ? prev : null);
    if (next === prev) {
      // The same node, updated in place; put it back if the app moved it.
      if (next instanceof Node && next.parentNode !== target)
        target.replaceChildren(next);
      return;
    }
    if (prev instanceof Node) opts.release?.(prev, col);
    if (typeof next === "string") target.textContent = next;
    else target.replaceChildren(next);
    dom.content[i] = next;
  }

  /** Render `r` from its data again (if it has elements). */
  function renderRow(r: Row<T>): void {
    r.text = null;
    const dom = r.dom;
    if (!dom) return;
    columns.forEach((_, i) => renderCell(dom, r.data, i));
    if (dom.icon) {
      const ic = opts.icon?.(r.data) ?? null;
      dom.icon.hidden = !ic;
      const cls = ic ? iconClass(ic.image) : "";
      if (cls !== dom.iconClass) {
        if (dom.iconClass) dom.icon.classList.remove(dom.iconClass);
        if (cls) dom.icon.classList.add(cls);
        dom.iconClass = cls;
      }
      if (ic) dom.icon.setAttribute("aria-label", ic.label);
      else dom.icon.removeAttribute("aria-label");
    }
    const classes = opts.rowClass?.(r.data) ?? [];
    for (const c of dom.classes)
      if (!classes.includes(c)) dom.el.classList.remove(c);
    for (const c of classes) dom.el.classList.add(c);
    dom.classes = [...classes];
  }

  function releaseDom(dom: RowDom): void {
    dom.content.forEach((c, i) => {
      if (c instanceof Node) opts.release?.(c, columns[i]!);
    });
  }

  function dropDom(r: Row<T>): void {
    if (!r.dom) return;
    releaseDom(r.dom);
    r.dom.el.remove();
    r.dom = null;
  }

  /** The lowercased text type-select matches for `r`. A row without
   * elements has its primary cell worked out for the purpose (and a
   * node from it released at once). */
  function textOf(r: Row<T>): string {
    if (r.text !== null) return r.text;
    let text: string;
    if (opts.typeSelect) text = opts.typeSelect(r.data);
    else {
      const col = columns[primary]!;
      const c = r.dom ? r.dom.content[primary] ?? ""
        : opts.cell(r.data, col, widths[primary]!, null);
      text = typeof c === "string" ? c : c.textContent ?? "";
      if (!r.dom && c instanceof Node) opts.release?.(c, col);
    }
    return (r.text = text.toLowerCase());
  }

  /** Put the rows' elements in `next`'s order, moving as few as it
   * takes. */
  function placeRows(next: readonly RowDom[]): void {
    if (!rowsEl.firstChild) {
      const frag = document.createDocumentFragment();
      for (const d of next) frag.append(d.el);
      rowsEl.append(frag);
      return;
    }
    const pos = new Map<Element, number>();
    let n = 0;
    for (let c = rowsEl.firstElementChild; c; c = c.nextElementSibling)
      pos.set(c, n++);
    const keep = stayingRows(next.map((d) => pos.get(d.el) ?? -1));
    let after: Element | null = null;
    for (let i = next.length - 1; i >= 0; i--) {
      const el = next[i]!.el;
      if (!keep[i]) rowsEl.insertBefore(el, after);
      after = el;
    }
  }

  /** Give elements to the rows that need them and take them from the
   * rest: every row, or with "window" rendering the rows in and near
   * the view, the selected row (the grid's active descendant) and,
   * while a press lasts, every row that has elements now. */
  function renderRows(): void {
    let lo = 0;
    let hi = shown.length - 1;
    if (windowed) {
      lo = Math.max(0, Math.floor(view.scrollTop / rowH) - OVERSCAN);
      hi = Math.min(hi, Math.ceil((view.scrollTop + view.clientHeight) / rowH)
                    - 1 + OVERSCAN);
    }
    const list = shown.slice(lo, hi + 1);
    const sel = selectedRow();
    const extra = sel && (sel.index < lo || sel.index > hi) ? [sel] : [];
    for (const r of rendered) {
      if (!r.dom || (r.index >= lo && r.index <= hi) || r === sel) continue;
      if (busy()) extra.push(r);
      else dropDom(r);
    }
    if (extra.length) {
      list.push(...extra);
      list.sort((a, b) => a.index - b.index);
    }
    const doms = list.map((r) => {
      const dom = r.dom ?? createDom(r);
      if (windowed) {
        const top = `${r.index * rowH}px`;
        if (dom.el.style.top !== top) dom.el.style.top = top;
        dom.el.setAttribute("aria-rowindex", String(r.index + 2));
      }
      return dom;
    });
    placeRows(doms);
    rendered = list;
  }

  function keysOf(rows: readonly T[]): string[] {
    const keys = rows.map((row) => opts.key(row));
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) throw new Error(`duplicate row key "${k}"`);
      seen.add(k);
    }
    return keys;
  }

  /** Switch between every row in the DOM and "window" rendering, whose
   * rows sit at fixed offsets in a box as tall as all of them. */
  function setWindowed(on: boolean): void {
    if (on === windowed) return;
    windowed = on;
    rowsEl.classList.toggle("osm-lv-windowed", on);
    if (on) {
      heads.setAttribute("aria-rowindex", "1");
      return;
    }
    rowsEl.style.removeProperty("height");
    grid.removeAttribute("aria-rowcount");
    heads.removeAttribute("aria-rowindex");
    for (const { dom } of rendered) {
      dom?.el.style.removeProperty("top");
      dom?.el.removeAttribute("aria-rowindex");
    }
  }

  function apply(rows: readonly T[], keys: readonly string[],
                 scroll: ListViewScroll, rerender: boolean): void {
    const top = view.scrollTop;
    let anchor: { key: string; offset: number } | null = null;
    if (scroll === "anchor" && top > 0 && shown.length) {
      const i = Math.min(shown.length - 1, Math.floor(top / rowH));
      anchor = { key: shown[i]!.key, offset: top - i * rowH };
    }

    const kept = new Set(keys);
    for (const r of shown) {
      if (kept.has(r.key)) continue;
      dropDom(r);
      byKey.delete(r.key);
    }
    shown = rows.map((row, i) => {
      const key = keys[i]!;
      let r = byKey.get(key);
      if (!r) {
        r = { key, data: row, index: i, dom: null, text: null };
        byKey.set(key, r);
      } else if (rerender || r.data !== row) {
        r.data = row;
        renderRow(r);
      }
      r.index = i;
      return r;
    });
    setWindowed(rendering === "window" ||
                (rendering === "auto" && shown.length > WINDOW_ABOVE));
    if (windowed) {
      rowsEl.style.height = `${shown.length * rowH}px`;
      grid.setAttribute("aria-rowcount", String(shown.length + 1));
    }

    const place = () => {
      if (scroll === "top") {
        view.scrollTop = 0;
        if (selectedKey !== null) reveal(selectedKey);
      } else if (anchor) {
        const r = byKey.get(anchor.key);
        view.scrollTop = r ? r.index * rowH + anchor.offset : top;
      }
    };
    // Windowed, the scroll position decides which rows to render; with
    // every row, the rows make the height the position needs.
    if (windowed) {
      place();
      renderRows();
    } else {
      renderRows();
      place();
    }
    showActive();
    showEmpty();
    sb.update();
    hsb?.update();
    heads.scrollLeft = view.scrollLeft;
  }

  // ---- presses in progress ---------------------------------------------
  // While a press that began in the rows lasts, and until its click has
  // been dispatched, rows are not rendered or moved: a control keeps its
  // node, its pointer capture and its click, and nothing slides under
  // the pointer. Updates wait and apply right after.

  const pressing = new Set<number>();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const busy = () => pressing.size > 0 || flushTimer !== undefined;

  const endPress = (e: Event) => {
    if (e instanceof PointerEvent) pressing.delete(e.pointerId);
    else pressing.clear(); // the window lost focus mid-press
    if (pressing.size) return;
    stopWatchingPress();
    // After this event's click (dispatched in the same task).
    flushTimer ??= setTimeout(flush, 0);
  };
  const stopWatchingPress = () => {
    window.removeEventListener("pointerup", endPress, true);
    window.removeEventListener("pointercancel", endPress, true);
    window.removeEventListener("blur", endPress);
  };

  function flush(): void {
    flushTimer = undefined;
    // Another press began meanwhile; its end flushes.
    if (destroyed || pressing.size) return;
    const p = pending;
    const again = pendingRefresh;
    pending = null;
    pendingRefresh = false;
    if (p) {
      apply(p.rows, p.keys, p.scroll, again);
      return;
    }
    if (again) rerenderAll();
    if (windowed) renderRows(); // let go of rows kept for the press
  }

  // Capture phase: trackPress stops pointerdown from bubbling.
  host.addEventListener("pointerdown", (e) => {
    if (!rowsEl.contains(e.target as Node)) return;
    if (!pressing.size) {
      window.addEventListener("pointerup", endPress, true);
      window.addEventListener("pointercancel", endPress, true);
      window.addEventListener("blur", endPress);
    }
    pressing.add(e.pointerId);
  }, { capture: true, signal });

  function rerenderAll(): void {
    for (const r of shown) renderRow(r);
  }

  // ---- selection -------------------------------------------------------

  function showActive(): void {
    const el = selectedRow()?.dom?.el;
    if (el) grid.setAttribute("aria-activedescendant", el.id);
    else grid.removeAttribute("aria-activedescendant");
  }

  function reveal(key: string): void {
    const r = byKey.get(key);
    if (!r) return;
    const y = r.index * rowH;
    if (y < view.scrollTop) view.scrollTop = y;
    else if (y + rowH > view.scrollTop + view.clientHeight)
      view.scrollTop = y + rowH - view.clientHeight;
  }

  function select(key: string | null, mode: SelectMode): void {
    if (key === selectedKey) {
      // Chosen again (type-select, an arrow key at the end, select()):
      // nothing to report, but it comes back into view.
      if (key !== null) reveal(key);
      return;
    }
    const old = selectedRow()?.dom?.el;
    old?.classList.remove("osm-selected");
    old?.setAttribute("aria-selected", "false");
    selectedKey = key;
    const el = selectedRow()?.dom?.el;
    el?.classList.add("osm-selected");
    el?.setAttribute("aria-selected", "true");
    if (key !== null) reveal(key);
    // Windowed, the selected row gets elements even out of view.
    if (windowed) renderRows();
    showActive();
    if (mode === "notify") opts.onSelect?.(key);
  }


  // ---- pointer ---------------------------------------------------------

  /** The row at client `y`, clamped to the rows with `clamp`. */
  function rowAt(y: number, clamp = false): Row<T> | undefined {
    const top = view.getBoundingClientRect().top;
    const i = Math.floor((y - top + view.scrollTop) / rowH);
    return shown[clamp ? Math.max(0, Math.min(shown.length - 1, i)) : i];
  }

  function cellControl(t: EventTarget | null): HTMLElement | null {
    if (!(t instanceof Element)) return null;
    const c = t.closest<HTMLElement>(CONTROL_SELECTOR);
    return c && rowsEl.contains(c) ? c : null;
  }

  view.addEventListener("focus", () => grid.focus({ preventScroll: true }));
  view.addEventListener("scroll", () => {
    heads.scrollLeft = view.scrollLeft;
    if (windowed) renderRows();
  }, { passive: true });

  // When the view last scrolled as part of a run of scrolls (a coasting
  // flick), as in mountList.
  let coastingAt = -Infinity;
  let scrolledAt = -Infinity;
  view.addEventListener("scroll", () => {
    const now = performance.now();
    if (now - scrolledAt < SCROLL_SETTLE_MS) coastingAt = now;
    scrolledAt = now;
  }, { passive: true });

  view.addEventListener("pointerdown", (e) => {
    // Control-click is the contextual menu's (contextmenu selects).
    if (e.button !== 0 || e.ctrlKey || cellControl(e.target)) return;
    if (e.pointerType !== "mouse") {
      // Touch and pen, as in mountList: a tap selects, a swipe scrolls,
      // and a tap on a coasting list only stops it.
      if (performance.now() - coastingAt < SCROLL_SETTLE_MS) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      view.setPointerCapture(e.pointerId);
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        view.removeEventListener("pointerup", up);
        view.removeEventListener("pointercancel", up);
        if (ev.type === "pointercancel" ||
            Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > TOUCH_SLOP)
          return;
        const r = rowAt(ev.clientY);
        if (!r) return;
        grid.focus({ preventScroll: true });
        select(r.key, "notify");
      };
      view.addEventListener("pointerup", up);
      view.addEventListener("pointercancel", up);
      return;
    }
    // The mouse, as the List Manager tracks it: the selection follows
    // the pointer while the button is down and is reported on release.
    grid.focus({ preventScroll: true });
    const before = selectedKey;
    const r = rowAt(e.clientY);
    if (r) select(r.key, "silent");
    view.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const m = rowAt(ev.clientY, true);
      if (m) select(m.key, "silent");
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerup", end);
      view.removeEventListener("pointercancel", end);
      if (selectedKey !== before) opts.onSelect?.(selectedKey);
    };
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
  });

  view.addEventListener("dblclick", (e) => {
    if (cellControl(e.target)) return;
    const r = rowAt(e.clientY);
    if (r && r.key === selectedKey) opts.onOpen?.(r.key);
  });

  host.addEventListener("contextmenu", (e) => {
    if (!opts.onContextMenu || e.defaultPrevented) return;
    const t = e.target as Node;
    // From the keyboard (the menu key) the event targets the grid.
    const rowEl = t instanceof Element && rowsEl.contains(t)
      ? t.closest(".osm-lv-row") : null;
    const r = t === grid ? selectedRow()
      : rowEl ? byElement.get(rowEl) : undefined;
    if (!r) return;
    e.preventDefault();
    select(r.key, "notify");
    opts.onContextMenu(r.key, e);
  }, { signal });

  // ---- keyboard --------------------------------------------------------

  let typed = "";
  let typedAt = -Infinity;
  const typing = () => typed !== "" && Date.now() - typedAt < TYPE_RESET_MS;

  /** Select the first row whose type-select text starts with what was
   * typed within the last second. Spaces count, so "apple e" reaches
   * "Apple Extras". */
  function typeSelect(ch: string): void {
    typed = (typing() ? typed : "") + ch.toLowerCase();
    typedAt = Date.now();
    const r = shown.find((s) => textOf(s).startsWith(typed));
    if (r) select(r.key, "notify");
  }

  grid.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey ||
        e.isComposing) return;
    const fromGrid = e.target === grid;
    // A focused button or checkbox in a cell passes the arrow keys on.
    const fromControl = !fromGrid && e.target instanceof Element &&
      rowsEl.contains(e.target) && e.target.matches(KEY_PASSING_CONTROL);
    if (!fromGrid && !(fromControl && NAV_KEYS.has(e.key))) return;
    if (NAV_KEYS.has(e.key)) {
      if (!shown.length) return;
      e.preventDefault();
      const at = selectedRow()?.index ?? -1;
      const last = shown.length - 1;
      const page = Math.max(1, Math.floor(view.clientHeight / rowH) - 1);
      const i = e.key === "ArrowDown" ? (at < 0 ? 0 : Math.min(last, at + 1))
        : e.key === "ArrowUp" ? (at < 0 ? last : Math.max(0, at - 1))
        : e.key === "Home" ? 0
        : e.key === "End" ? last
        : e.key === "PageDown" ? Math.min(last, Math.max(0, at) + page)
        : Math.max(0, (at < 0 ? last : at) - page);
      if (fromControl) grid.focus({ preventScroll: true });
      select(shown[i]!.key, "notify");
      return;
    }
    if (e.key === "Enter") {
      const r = selectedRow();
      if (!r || e.repeat) return;
      e.preventDefault();
      opts.onOpen?.(r.key);
      return;
    }
    if (e.key === " " && !typing()) {
      // The keyboard's way to a row's control (a favorite toggle): Space
      // clicks the selected row's first control, as a click would.
      const c = selectedRow()?.dom?.el
        .querySelector<HTMLElement>(CONTROL_SELECTOR);
      if (!c) return;
      e.preventDefault();
      if (!e.repeat) c.click();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      typeSelect(e.key);
    }
  });

  // ---- placeholder -----------------------------------------------------

  function showEmpty(): void {
    const text = shown.length ? ""
      : (loadState === "loading" ? loadingText : emptyText) ?? "";
    if (empty.textContent !== text) empty.textContent = text;
    empty.hidden = !text;
    if (text) centerText(empty);
  }

  showSort();
  showEmpty();
  sb.update();
  hsb?.update();

  const alive = () => {
    if (destroyed) throw new Error("this list view was destroyed");
  };

  return {
    element: host,
    get rows() { return data; },
    get selected() { return selectedKey; },
    get sort() { return sort; },
    get columnWidths() {
      return Object.fromEntries(columns.map((c, i) => [c.id, widths[i]!]));
    },
    get contentHeight() {
      if (data.length) return data.length * rowH;
      return empty.hidden ? 0 : empty.offsetHeight;
    },
    get viewportHeight() { return view.clientHeight; },
    setRows(rows, { scroll = "anchor" } = {}) {
      alive();
      const keys = keysOf(rows);
      data = rows;
      if (busy()) {
        // A later "anchor" mustn't undo a "top" still waiting.
        const s = pending?.scroll === "top" ? "top" : scroll;
        pending = { rows, keys, scroll: s };
        return;
      }
      apply(rows, keys, scroll, false);
    },
    refresh() {
      alive();
      if (busy()) pendingRefresh = true;
      else rerenderAll();
    },
    select(key, mode = "notify") {
      alive();
      select(key, mode);
    },
    setSort(next) {
      alive();
      if (next) sortDirection(next, columns);
      sort = next;
      showSort();
    },
    setLoading(state) {
      alive();
      loadState = state;
      showEmpty();
    },
    setEmptyText(text) {
      alive();
      emptyText = text;
      showEmpty();
    },
    setLoadingText(text) {
      alive();
      loadingText = text;
      showEmpty();
    },
    focus() {
      grid.focus({ preventScroll: true });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(flushTimer);
      flushTimer = undefined;
      stopWatchingPress();
      listening.abort();
      ro.disconnect();
      sb.destroy();
      hsb?.destroy();
      stopCentering(empty);
      for (const { dom } of rendered) if (dom) releaseDom(dom);
      shown = [];
      rendered = [];
      byKey.clear();
      host.replaceChildren();
      host.classList.remove("osm-listview", "osm-lv-has-icon");
      delete host.dataset["highlight"];
      delete host.dataset["osmLv"];
      sheetEl.remove();
    },
  };
}

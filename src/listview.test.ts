// @vitest-environment happy-dom
// happy-dom lays nothing out: every box is at the origin and 0 tall, so
// these tests stub the view's height where paging or scrolling matters,
// and treat client y as a position inside the rows (the view's top is
// 0). Pixels, fonts and the look are checked in a browser instead (see
// the CHANGELOG).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  growWidths, mountListView, sortDirection, stayingRows,
} from "./listview.js";
import type {
  ListViewColumn, ListViewOptions, OsmiumListView,
} from "./listview.js";
import { trackPress } from "./controls.js";

const ROW_H = 19;

interface Host { readonly ip: string; readonly name: string; ports: number }

const COLUMNS: readonly ListViewColumn[] = [
  { id: "fav", title: "Fav.", width: 24 },
  { id: "ip", title: "IP", width: 120, sort: "ascending" },
  { id: "name", title: "Name", width: 100, sort: "ascending" },
  { id: "ports", title: "Ports", width: 60, sort: "descending",
    align: "right" },
];

const hosts = (n: number, from = 0): Host[] =>
  Array.from({ length: n }, (_, i) => ({
    ip: `10.0.0.${from + i}`, name: `host ${from + i}`, ports: i,
  }));

/** A list of hosts whose "fav" cells hold a star button (native click)
 * that records its presses. */
function mount(extra: Partial<ListViewOptions<Host>> = {},
               rows: readonly Host[] = hosts(20)) {
  const host = document.createElement("div");
  document.body.append(host);
  const log = {
    selected: [] as (string | null)[], opened: [] as string[],
    starred: [] as string[], cellCalls: [] as string[],
    released: [] as Node[], sorts: [] as unknown[],
  };
  const list: OsmiumListView<Host> = mountListView<Host>(host, {
    label: "Hosts",
    columns: COLUMNS,
    primary: "ip",
    key: (h) => h.ip,
    cell(h, col, _w, current) {
      log.cellCalls.push(`${h.ip}/${col.id}`);
      if (col.id !== "fav") {
        return col.id === "ip" ? h.ip : col.id === "name" ? h.name
          : String(h.ports);
      }
      const b = (current as HTMLButtonElement | null) ??
        Object.assign(document.createElement("button"), { type: "button" });
      if (!current) b.addEventListener("click", () => log.starred.push(h.ip));
      b.tabIndex = -1;
      b.textContent = "*";
      return b;
    },
    release: (n) => log.released.push(n),
    onSelect: (k) => log.selected.push(k),
    onOpen: (k) => log.opened.push(k),
    onSort: (s) => log.sorts.push(s),
    ...extra,
  });
  const q = <E extends Element = HTMLElement>(s: string) =>
    host.querySelector<E>(s)!;
  const view = q(".osm-list-view");
  // Ten rows show; tests that page or scroll set their own.
  viewHeight(view, 190);
  list.setRows(rows);
  const grid = q(".osm-lv-grid");
  const rowEls = () =>
    Array.from(host.querySelectorAll<HTMLElement>(".osm-lv-row"));
  const rowEl = (ip: string) => rowEls().find((r) =>
    r.querySelector(".osm-lv-label")!.textContent === ip)!;
  return { host, list, log, view, grid, rowEls, rowEl, q };
}

function viewHeight(view: Element, h: number): void {
  Object.defineProperty(view, "clientHeight", { value: h,
                                                configurable: true });
}

function pointer(el: Element, type: string, y: number,
                 init: PointerEventInit = {}): PointerEvent {
  const e = new PointerEvent(type, {
    bubbles: true, cancelable: true, button: 0, pointerId: 1,
    pointerType: "mouse", clientX: 10, clientY: y, ...init,
  });
  el.dispatchEvent(e);
  return e;
}

function key(el: Element, k: string, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", {
    key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(e);
  return e;
}

/** Rows' keys in DOM order. */
const order = (els: HTMLElement[]) =>
  els.map((r) => r.querySelector(".osm-lv-label")!.textContent);

const settle = () => new Promise((r) => setTimeout(r, 150));

beforeEach(() => {
  document.body.textContent = "";
  Element.prototype.setPointerCapture ??= () => {};
});
afterEach(() => vi.restoreAllMocks());

describe("mountListView structure", () => {
  it("builds headers with valid grid semantics", () => {
    const { host, grid, q } = mount({ sort: { column: "ports",
                                              order: "normal" } });
    const heads = Array.from(host.querySelectorAll('[role="columnheader"]'));
    expect(heads.map((h) => h.textContent)).toEqual(
      ["Fav.", "IP", "Name", "Ports"]);
    // Sortable columns have buttons; others plain titles.
    expect(heads.map((h) => h.querySelector("button") !== null))
      .toEqual([false, true, true, true]);
    expect(q('[data-column="ports"]').getAttribute("aria-sort"))
      .toBe("descending");
    expect(q('[data-column="ports"]').dataset["align"]).toBe("right");
    expect(q('[data-column="ip"]').classList.contains("osm-lv-primary"))
      .toBe(true);
    // The grid owns rows only: the sort order button and the
    // placeholder live beside it.
    expect(grid.contains(q(".osm-lv-sortdir"))).toBe(false);
    expect(grid.contains(q(".osm-lv-empty"))).toBe(false);
    expect(grid.getAttribute("role")).toBe("grid");
    expect(q(".osm-lv-heads").getAttribute("role")).toBe("row");
    for (const r of Array.from(host.querySelectorAll(".osm-lv-row"))) {
      expect(r.getAttribute("role")).toBe("row");
      expect(Array.from(r.children).every((c) =>
        c.getAttribute("role") === "gridcell")).toBe(true);
    }
  });

  it("gives an icon's meaning to assistive technology", () => {
    const { rowEl } = mount({ icon: (h) => ({
      image: "url(x.png)", label: h.ports % 2 ? "Printer" : "Camera" }) });
    const icon = rowEl("10.0.0.1").querySelector(".osm-lv-icon")!;
    expect(icon.getAttribute("role")).toBe("img");
    expect(icon.getAttribute("aria-label")).toBe("Printer");
  });

  it("scopes an icon first shown later to its own list", () => {
    const icon = (h: Host) => ({ image: `url(i${h.ports}.png)`, label: "x" });
    const a = mount({ icon }, hosts(1));
    mount({ icon }, hosts(1));
    a.list.setRows(hosts(2));
    const at = a.host.dataset["osmLv"];
    const img = a.rowEl("10.0.0.1").querySelector(".osm-lv-icon")!;
    const cls = Array.from(img.classList).find((c) => /^osm-lv-i\d/.test(c));
    const sheet = document.querySelector<HTMLStyleElement>(
      `style[data-osmium-list-view="osm-lv-${at}"]`)!.sheet!;
    const rule = Array.from(sheet.cssRules).find((r) =>
      (r as CSSStyleRule).selectorText.endsWith(`.${cls}`)) as CSSStyleRule;
    expect(rule.selectorText).toContain(`[data-osm-lv="${at}"]`);
  });

  it("rejects bad options", () => {
    const host = document.createElement("div");
    const base = { label: "x", key: (h: Host) => h.ip, cell: () => "" };
    expect(() => mountListView(host, { ...base, columns: [] })).toThrow();
    expect(() => mountListView(host, { ...base,
      columns: [COLUMNS[0]!, COLUMNS[0]!] })).toThrow(/duplicate column/);
    expect(() => mountListView(host, { ...base, columns: COLUMNS,
      primary: "nope" })).toThrow(/primary/);
    expect(() => mountListView(host, { ...base, columns: COLUMNS,
      sort: { column: "fav", order: "normal" } })).toThrow(/doesn't sort/);
    expect(() => mountListView(host, { ...base, columns: [
      { id: "a", title: "A", width: 20, minWidth: 30 }] })).toThrow(/minWidth/);
    expect(() => mountListView(host, { ...base, columns: [
      { id: "a", title: document.createElement("i"), width: 20 }] }))
      .toThrow(/label/);
  });
});

describe("keyed rows", () => {
  it("keeps elements, cell nodes and the selection by key", () => {
    const { list, log, rowEl, rowEls, grid } = mount();
    list.select("10.0.0.3", "silent");
    const el3 = rowEl("10.0.0.3");
    const star3 = el3.querySelector("button");
    log.cellCalls.length = 0;

    const rows = hosts(20);
    const next = [...hosts(2, 100), ...rows.reverse()];
    list.setRows(next);
    expect(order(rowEls())).toEqual(next.map((h) => h.ip));
    expect(rowEl("10.0.0.3")).toBe(el3);
    expect(el3.querySelector("button")).toBe(star3);
    expect(el3.classList.contains("osm-selected")).toBe(true);
    expect(grid.getAttribute("aria-activedescendant")).toBe(el3.id);
    expect(list.selected).toBe("10.0.0.3");
    expect(log.selected).toEqual([]);
  });

  it("renders only new and changed rows, and all on refresh", () => {
    const rows = hosts(5);
    const { list, log } = mount({}, rows);
    log.cellCalls.length = 0;
    const changed = { ...rows[2]!, name: "renamed" };
    list.setRows([rows[0]!, rows[1]!, changed, rows[3]!, rows[4]!]);
    expect(new Set(log.cellCalls.map((c) => c.split("/")[0])))
      .toEqual(new Set(["10.0.0.2"]));
    log.cellCalls.length = 0;
    list.refresh();
    expect(log.cellCalls.length).toBe(5 * COLUMNS.length);
  });

  it("passes the current node back and releases what leaves", () => {
    const rows = hosts(3);
    const { list, log, rowEl, host } = mount({}, rows);
    const star = rowEl("10.0.0.1").querySelector("button")!;
    list.refresh();
    expect(rowEl("10.0.0.1").querySelector("button")).toBe(star);
    expect(log.released).toEqual([]);
    list.setRows([rows[0]!, rows[2]!]);
    expect(log.released).toEqual([star]);
    list.destroy();
    expect(log.released.length).toBe(3);
    expect(host.children.length).toBe(0);
    expect(() => list.setRows(rows)).toThrow(/destroyed/);
  });

  it("updates row classes", () => {
    let stale = new Set(["10.0.0.1"]);
    const { list, rowEl } = mount({ rowClass: (h) =>
      stale.has(h.ip) ? ["app-stale"] : [] }, hosts(3));
    expect(rowEl("10.0.0.1").classList.contains("app-stale")).toBe(true);
    stale = new Set(["10.0.0.2"]);
    list.refresh();
    expect(rowEl("10.0.0.1").classList.contains("app-stale")).toBe(false);
    expect(rowEl("10.0.0.2").classList.contains("app-stale")).toBe(true);
  });

  it("throws on a duplicate key and leaves the rows as they were", () => {
    const { list, rowEls } = mount({}, hosts(3));
    expect(() => list.setRows([...hosts(3), hosts(1)[0]!]))
      .toThrow(/duplicate row key "10.0.0.0"/);
    expect(rowEls().length).toBe(3);
  });

  it("moves one element for a sorted insert", () => {
    const { list, q } = mount({}, hosts(200));
    const rowsEl = q(".osm-lv-rows");
    const spy = vi.spyOn(rowsEl, "insertBefore");
    list.setRows([...hosts(100), ...hosts(1, 500), ...hosts(100, 100)]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(stayingRows([1, 2, 3, 0])).toEqual([true, true, true, false]);
    expect(stayingRows([-1, 0, 1])).toEqual([false, true, true]);
  });

  it("keeps the selection of a row that is filtered out", () => {
    const rows = hosts(5);
    const { list, grid, rowEl } = mount({}, rows);
    list.select("10.0.0.2", "silent");
    list.setRows(rows.filter((h) => h.ip !== "10.0.0.2"));
    expect(list.selected).toBe("10.0.0.2");
    expect(grid.hasAttribute("aria-activedescendant")).toBe(false);
    list.setRows(rows);
    expect(rowEl("10.0.0.2").getAttribute("aria-selected")).toBe("true");
  });
});

describe("scroll position", () => {
  it("anchors the top row while scrolled, and not at the top", () => {
    const rows = hosts(300);
    const { list, view } = mount({}, rows);
    viewHeight(view, 190);
    view.scrollTop = 100 * ROW_H + 5;
    list.setRows([...hosts(5, 1000), ...rows]);
    expect(view.scrollTop).toBe(105 * ROW_H + 5);

    // At the top, arrivals show.
    view.scrollTop = 0;
    list.setRows([...hosts(3, 2000), ...hosts(5, 1000), ...rows]);
    expect(view.scrollTop).toBe(0);

    // "top": back up, then to the selection.
    list.select("10.0.0.150", "silent");
    view.scrollTop = 40 * ROW_H;
    list.setRows([...rows].reverse(), { scroll: "top" });
    expect(view.scrollTop).toBe(149 * ROW_H + ROW_H - 190);
  });

  it("scrolls the selected row back into view when chosen again", () => {
    const { list, view, grid, log } = mount({}, hosts(300));
    list.select("10.0.0.150", "silent");
    view.scrollTop = 0;
    list.select("10.0.0.150");
    expect(view.scrollTop).toBe(150 * ROW_H + ROW_H - 190);
    // Type-select reaches it the same way, and reports nothing new.
    list.select("10.0.0.0", "silent");
    view.scrollTop = 100 * ROW_H;
    key(grid, "1");
    expect(list.selected).toBe("10.0.0.0");
    expect(view.scrollTop).toBe(0);
    expect(log.selected).toEqual([]);
  });

  it("reports what resize-to-fit needs", () => {
    const { list, view, q } = mount({ emptyText: "No hosts yet." },
                                    hosts(7));
    viewHeight(view, 100);
    expect(list.contentHeight).toBe(7 * ROW_H);
    expect(list.viewportHeight).toBe(100);
    list.setRows([]);
    Object.defineProperty(q(".osm-lv-empty"), "offsetHeight", { value: 61 });
    expect(list.contentHeight).toBe(61);
  });
});

describe("empty and loading", () => {
  it("shows the placeholder that fits, as a status", () => {
    const { list, q } = mount({ emptyText: "No hosts yet. Start a scan.",
                                loadingText: "Scanning..." }, []);
    const empty = q(".osm-lv-empty");
    expect(empty.getAttribute("role")).toBe("status");
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe("No hosts yet. Start a scan.");
    list.setLoading("loading");
    expect(empty.textContent).toBe("Scanning...");
    list.setRows(hosts(1));
    expect(empty.hidden).toBe(true);
  });
});

describe("pointer", () => {
  it("tracks a mouse press and reports once on release", () => {
    const { list, log, view } = mount();
    pointer(view, "pointerdown", 2 * ROW_H + 4);
    expect(list.selected).toBe("10.0.0.2");
    pointer(view, "pointermove", 5 * ROW_H + 4);
    expect(list.selected).toBe("10.0.0.5");
    expect(log.selected).toEqual([]);
    pointer(view, "pointerup", 5 * ROW_H + 4);
    expect(log.selected).toEqual(["10.0.0.5"]);
  });

  it("selects on a touch tap", async () => {
    const { log, view } = mount();
    await settle();
    pointer(view, "pointerdown", 3 * ROW_H + 4, { pointerType: "touch" });
    pointer(view, "pointerup", 3 * ROW_H + 4, { pointerType: "touch" });
    expect(log.selected).toEqual(["10.0.0.3"]);
  });

  it("opens the selected row on a double-click", () => {
    const { list, log, view } = mount();
    list.select("10.0.0.4", "silent");
    view.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true, clientY: 4 * ROW_H + 2 }));
    view.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true, clientY: 6 * ROW_H + 2 }));
    expect(log.opened).toEqual(["10.0.0.4"]);
  });
});

describe("controls in cells", () => {
  it("leave a press on a native button to the button", () => {
    const { list, log, rowEl, view } = mount();
    list.select("10.0.0.1", "silent");
    const star = rowEl("10.0.0.5").querySelector("button")!;
    const capture = vi.spyOn(view, "setPointerCapture");
    pointer(star, "pointerdown", 5 * ROW_H + 4);
    pointer(star, "pointerup", 5 * ROW_H + 4);
    star.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    star.dispatchEvent(new MouseEvent("dblclick", { bubbles: true,
                                                    clientY: 5 * ROW_H }));
    expect(log.starred).toEqual(["10.0.0.5"]);
    expect(list.selected).toBe("10.0.0.1");
    expect(log.selected).toEqual([]);
    expect(log.opened).toEqual([]);
    expect(capture).not.toHaveBeenCalled();
  });

  it("see presses trackPress keeps from bubbling", async () => {
    // A trackPress control stops pointerdown at itself; the list still
    // holds updates for the press, in the capture phase.
    const acted: string[] = [];
    const rows = hosts(3);
    const { list, log, host } = mount({ cell(h, col) {
      if (col.id !== "fav") return h.ip;
      const b = document.createElement("div");
      b.dataset["osmControl"] = "";
      b.textContent = "o";
      trackPress(b, () => acted.push(h.ip));
      return b;
    } }, rows);
    const ctl = host.querySelectorAll<HTMLElement>("[data-osm-control]")[1]!;
    const before = ctl.parentElement;
    pointer(ctl, "pointerdown", ROW_H + 4);
    list.setRows([...rows].reverse());
    // Nothing moved or re-rendered under the press.
    expect(ctl.parentElement).toBe(before);
    expect(order(Array.from(host.querySelectorAll<HTMLElement>(".osm-lv-row"))))
      .toEqual(rows.map((h) => h.ip));
    expect(log.selected).toEqual([]);
    ctl.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(acted).toEqual(["10.0.0.1"]);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(order(Array.from(host.querySelectorAll<HTMLElement>(".osm-lv-row"))))
      .toEqual([...rows].reverse().map((h) => h.ip));
  });

  it("defer updates to a pressed row until its click is over", async () => {
    const rows = hosts(3);
    const { list, log, rowEl } = mount({}, rows);
    const star = rowEl("10.0.0.1").querySelector("button")!;
    pointer(star, "pointerdown", ROW_H + 4);
    log.cellCalls.length = 0;
    list.setRows([rows[0]!, { ...rows[1]!, name: "changed" }, rows[2]!]);
    expect(log.cellCalls).toEqual([]);
    expect(list.rows[1]!.name).toBe("changed");
    pointer(star, "pointerup", ROW_H + 4);
    list.refresh(); // as a click handler would
    expect(log.cellCalls).toEqual([]);
    await new Promise((r) => setTimeout(r, 0));
    expect(log.cellCalls.length).toBe(3 * COLUMNS.length);
    expect(rowEl("10.0.0.1").querySelector("button")).toBe(star);
    expect(rowEl("10.0.0.1").textContent).toContain("changed");
  });

  it("take Space on the selected row from the keyboard", () => {
    const { list, log, grid } = mount();
    list.select("10.0.0.7", "silent");
    const e = key(grid, " ");
    expect(e.defaultPrevented).toBe(true);
    expect(log.starred).toEqual(["10.0.0.7"]);
  });
});

describe("keyboard", () => {
  it("moves the selection and opens with Return", () => {
    const { list, log, grid, view } = mount();
    viewHeight(view, 5 * ROW_H);
    key(grid, "ArrowDown");
    key(grid, "ArrowDown");
    key(grid, "ArrowUp");
    key(grid, "End");
    key(grid, "PageUp");
    key(grid, "Home");
    key(grid, "PageDown");
    expect(log.selected).toEqual(["10.0.0.0", "10.0.0.1", "10.0.0.0",
      "10.0.0.19", "10.0.0.15", "10.0.0.0", "10.0.0.4"]);
    key(grid, "Enter");
    expect(log.opened).toEqual(["10.0.0.4"]);
    key(grid, "ArrowDown", { metaKey: true });
    expect(list.selected).toBe("10.0.0.4");
  });

  it("starts arrows from a focused cell button and takes focus back", () => {
    const { list, grid, rowEl } = mount();
    list.select("10.0.0.2", "silent");
    const star = rowEl("10.0.0.2").querySelector("button")!;
    star.focus();
    key(star, "ArrowDown");
    expect(list.selected).toBe("10.0.0.3");
    expect(document.activeElement).toBe(grid);
  });

  it("type-selects names with spaces", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    const names = ["Apple Extras", "Apple Menu Items", "Applications",
                   "System Folder"];
    const { list, grid } = mount({ typeSelect: (h) => h.name },
      names.map((name, i) => ({ ip: `10.0.1.${i}`, name, ports: 0 })));
    for (const ch of "apple m") key(grid, ch);
    expect(list.selected).toBe("10.0.1.1");
    now.mockReturnValue(12_000); // a pause starts over
    for (const ch of "apple e") key(grid, ch);
    expect(list.selected).toBe("10.0.1.0");
    now.mockReturnValue(14_000);
    for (const ch of "sy") key(grid, ch);
    expect(list.selected).toBe("10.0.1.3");
  });
});

describe("context menu", () => {
  it("selects the row, then asks for the menu", () => {
    const calls: string[] = [];
    const { log, rowEl } = mount({
      onSelect: (k) => calls.push(`select ${k}`),
      onContextMenu: (k, e) => calls.push(`menu ${k} ${e.clientX}`),
    });
    const e = new MouseEvent("contextmenu", { bubbles: true,
      cancelable: true, clientX: 42 });
    rowEl("10.0.0.6").querySelector(".osm-lv-cell")!.dispatchEvent(e);
    expect(calls).toEqual(["select 10.0.0.6", "menu 10.0.0.6 42"]);
    expect(e.defaultPrevented).toBe(true);
    expect(log.selected).toEqual([]);
  });

  it("leaves the browser's menu alone without a handler", () => {
    const { rowEl } = mount();
    const e = new MouseEvent("contextmenu", { bubbles: true,
                                              cancelable: true });
    rowEl("10.0.0.6").dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe("sorting", () => {
  it("picks a column on a header click and keeps the order", () => {
    const { list, log, q, host } = mount({ sort: { column: "ip",
                                                   order: "reversed" } });
    q('[data-column="ports"] button').dispatchEvent(
      new MouseEvent("click", { detail: 0 }));
    expect(log.sorts).toEqual([{ column: "ports", order: "reversed" }]);
    expect(list.sort).toEqual({ column: "ports", order: "reversed" });
    // Ports' normal order is descending, so reversed reads ascending.
    expect(q('[data-column="ports"]').getAttribute("aria-sort"))
      .toBe("ascending");
    expect(q('[data-column="ip"]').hasAttribute("aria-sort")).toBe(false);
    expect(q('[data-column="ports"] button').classList
      .contains("osm-sorted")).toBe(true);
    const sorted = Array.from(host.querySelectorAll(".osm-lv-sorted"));
    expect(sorted.length).toBe(20);
    expect(sorted.every((c) => c.textContent === String(
      Number(c.parentElement!.querySelector(".osm-lv-label")!.textContent!
        .split(".")[3])))).toBe(true);
    // The sorted column again: nothing (the pyramid reverses).
    q('[data-column="ports"] button').dispatchEvent(
      new MouseEvent("click", { detail: 0 }));
    expect(log.sorts.length).toBe(1);
  });

  it("reverses with the sort order button", () => {
    const { list, log, q } = mount({ sort: { column: "name",
                                             order: "normal" } });
    const b = q<HTMLButtonElement>(".osm-lv-sortdir");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    b.dispatchEvent(new MouseEvent("click", { detail: 0 }));
    expect(log.sorts).toEqual([{ column: "name", order: "reversed" }]);
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(q('[data-column="name"]').getAttribute("aria-sort"))
      .toBe("descending");
    list.setSort(null);
    expect(b.disabled).toBe(true);
    expect(() => list.setSort({ column: "fav", order: "normal" }))
      .toThrow(/doesn't sort/);
  });

  it("maps orders to directions", () => {
    expect(sortDirection({ column: "ports", order: "normal" }, COLUMNS))
      .toBe("descending");
    expect(sortDirection({ column: "ip", order: "reversed" }, COLUMNS))
      .toBe("descending");
  });

  it("can go without the button", () => {
    const { host } = mount({ sortOrderButton: "none" });
    expect(host.querySelector(".osm-lv-sortdir")).toBeNull();
  });
});

describe("column widths", () => {
  it("splits spare width in whole pixels", () => {
    expect(growWidths([100, 50, 50], [25, 32, 43], 300))
      .toEqual([125, 82, 93]);
    expect(growWidths([100, 50], [1, 0], 120)).toEqual([100, 50]);
    const w = growWidths([10, 10, 10], [1, 1, 0], 37);
    expect(w.reduce((a, b) => a + b)).toBe(37);
    expect(w).toEqual([13, 14, 10]);
  });

  it("resizes a column by its divider", () => {
    const widths: number[] = [];
    const resized: [string, number][] = [];
    const { host, list, q } = mount({
      resize: "drag",
      onColumnResize: (id, w) => resized.push([id, w]),
      cell: (h, col, w) => {
        if (col.id === "name") widths.push(w);
        return col.id === "ip" ? h.ip : "x";
      },
    }, hosts(2));
    const divider = q('[data-column="name"] .osm-lv-divider');
    pointer(divider, "pointerdown", 0, { clientX: 100 });
    pointer(divider, "pointermove", 0, { clientX: 130 });
    expect(list.columnWidths["name"]).toBe(130);
    expect(widths.slice(-2)).toEqual([130, 130]);
    pointer(divider, "pointermove", 0, { clientX: -500 });
    expect(list.columnWidths["name"]).toBe(24);
    pointer(divider, "pointerup", 0, { clientX: -500 });
    expect(resized).toEqual([["name", 24]]);
  });

  it("has no dividers when fixed", () => {
    const { host } = mount();
    expect(host.querySelector(".osm-lv-divider")).toBeNull();
  });
});

describe("window rendering", () => {
  const rendered = (host: HTMLElement) =>
    order(Array.from(host.querySelectorAll<HTMLElement>(".osm-lv-row")));

  it("renders the rows near the view and says where they are", () => {
    const { host, grid, q } = mount({ rendering: "window" }, hosts(300));
    // Ten rows show from the top, eight more below them.
    expect(rendered(host)).toEqual(hosts(18).map((h) => h.ip));
    expect(grid.getAttribute("aria-rowcount")).toBe("301");
    expect(q(".osm-lv-heads").getAttribute("aria-rowindex")).toBe("1");
    const row5 = q(".osm-lv-row:nth-child(6)");
    expect(row5.getAttribute("aria-rowindex")).toBe("7");
    expect(row5.style.top).toBe(`${5 * ROW_H}px`);
    expect(q(".osm-lv-rows").style.height).toBe(`${300 * ROW_H}px`);
  });

  it("follows scrolling, releasing what leaves, keeping the selection", () => {
    const { host, list, log, view, grid } = mount({ rendering: "window" },
                                                  hosts(300));
    list.select("10.0.0.3", "silent");
    view.scrollTop = 100 * ROW_H;
    view.dispatchEvent(new Event("scroll"));
    expect(rendered(host)).toEqual(["10.0.0.3",
      ...hosts(26, 92).map((h) => h.ip)]);
    expect(log.released.length).toBe(17); // rows 0 to 17 but the selected
    const sel = host.querySelector(".osm-selected")!;
    expect(grid.getAttribute("aria-activedescendant")).toBe(sel.id);
    // Keys reach rows without elements.
    key(grid, "End");
    expect(list.selected).toBe("10.0.0.299");
    expect(grid.getAttribute("aria-activedescendant"))
      .toBe(host.querySelector(".osm-selected")!.id);
  });

  it("type-selects rows that have no elements", () => {
    const { list, grid } = mount({ rendering: "window" }, hosts(300));
    for (const ch of "10.0.0.250") key(grid, ch);
    expect(list.selected).toBe("10.0.0.250");
  });

  it("switches on above 1000 rows by default", () => {
    const { list, q } = mount({}, hosts(1000));
    expect(q(".osm-lv-rows").classList.contains("osm-lv-windowed"))
      .toBe(false);
    list.setRows(hosts(1001));
    expect(q(".osm-lv-rows").classList.contains("osm-lv-windowed"))
      .toBe(true);
    expect(q(".osm-lv-rows").children.length).toBeLessThan(40);
    list.setRows(hosts(20));
    expect(q(".osm-lv-rows").classList.contains("osm-lv-windowed"))
      .toBe(false);
    expect(q(".osm-lv-rows").children.length).toBe(20);
    expect(q(".osm-lv-row").hasAttribute("aria-rowindex")).toBe(false);
  });
});

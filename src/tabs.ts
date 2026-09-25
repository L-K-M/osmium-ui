// Mac OS 8 tab controls: a row of tabs over a pane that shows one
// panel at a time, as in Mac OS 8.5's Appearance control panel. Looks
// come from osmium.css. The tabs are native buttons in the WAI-ARIA
// tabs pattern: the front tab is the only tab stop, and the arrow
// keys, Home and End bring another tab to the front.
import { trackPress } from "./controls.js";

export interface TabsOptions {
  /** The tab in front to begin with. */
  selected: number;
  /** The reader brought tab `index` to the front. */
  onChange?(index: number): void;
  /** The tab list's accessible name. */
  label?: string;
}

export interface OsmiumTabs {
  readonly element: HTMLElement;
  /** The front tab's index. */
  readonly selected: number;
  /** Bring tab `index` to the front, reporting it to onChange unless
   * `notify` is false. Throws on an index with no tab. */
  select(index: number, notify?: boolean): void;
}

let tabsSeq = 0;

/** Wire the tab control in `host`: an .osm-tablist of button.osm-tab,
 * then an .osm-tab-pane whose children are the panels, one per tab in
 * the same order. A press brings a tab to the front if it's released
 * over the tab, the way the Control Manager tracks controls. Throws if
 * the markup is missing, the tabs and panels don't pair up, or
 * `selected` names no tab. */
export function mountTabs(host: HTMLElement, opts: TabsOptions): OsmiumTabs {
  const list = host.querySelector<HTMLElement>(":scope > .osm-tablist");
  const pane = host.querySelector<HTMLElement>(":scope > .osm-tab-pane");
  if (!list || !pane)
    throw new Error("a tab control needs an .osm-tablist and an .osm-tab-pane");
  const tabs = Array.from(
    list.querySelectorAll<HTMLButtonElement>(":scope > .osm-tab"));
  const panels = Array.from(pane.children) as HTMLElement[];
  if (!tabs.length || tabs.length !== panels.length)
    throw new Error(`${tabs.length} tabs for ${panels.length} panels`);

  const id = `osm-tabs-${++tabsSeq}`;
  host.classList.add("osm-tabs");
  list.setAttribute("role", "tablist");
  if (opts.label) list.setAttribute("aria-label", opts.label);
  let sel = -1;

  function select(i: number, notify = true): void {
    if (!tabs[i]) throw new RangeError(`no tab ${i} of ${tabs.length}`);
    if (i === sel) return;
    sel = i;
    tabs.forEach((t, k) => {
      t.setAttribute("aria-selected", String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      panels[k]!.hidden = k !== i;
    });
    if (notify) opts.onChange?.(i);
  }

  tabs.forEach((tab, i) => {
    const panel = panels[i]!;
    tab.type = "button";
    tab.id ||= `${id}-tab-${i}`;
    panel.id ||= `${id}-panel-${i}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    trackPress(tab, () => select(i));
  });

  list.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const last = tabs.length - 1;
    let i: number | null = null;
    if (e.key === "ArrowRight") i = sel === last ? 0 : sel + 1;
    else if (e.key === "ArrowLeft") i = sel === 0 ? last : sel - 1;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = last;
    if (i === null) return;
    e.preventDefault();
    select(i);
    tabs[i]!.focus();
  });

  select(opts.selected, false);
  return {
    element: host,
    get selected() { return sel; },
    select,
  };
}

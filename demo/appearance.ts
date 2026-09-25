// "Appearance": a tab control laid out like Mac OS 8.5's Appearance
// control panel, whose tabs osmium.css's are measured from. The tab
// control fills the window; each pane holds a few settings, a titled
// pop-up or a checkbox with a Geneva 9 caption under it. The settings
// are for show: choosing one changes nothing else.
import { mountPopup, mountTabs, trackHighlight } from "../src/index.js";
import { checkbox, el } from "./dom.js";
import type { WindowContent } from "./windows.js";

type Setting =
  | { kind: "popup"; title: string; items: readonly string[];
      caption: string }
  | { kind: "checkbox"; title: string; on: boolean; caption: string };

interface Tab { title: string; settings: readonly Setting[] }

const TABS: readonly Tab[] = [
  { title: "Appearance", settings: [
    { kind: "popup", title: "Appearance", items: ["Apple platinum"],
      caption: "for the overall look of menus, icons, windows, and controls" },
    { kind: "popup", title: "Highlight Color",
      items: ["Black & White", "Lavender", "Gold", "Rose", "Blue"],
      caption: "for selected text" },
    { kind: "popup", title: "Variation",
      items: ["Lavender", "Blue", "Gold", "Graphite", "Rose"],
      caption: "for menus and controls" },
  ] },
  { title: "Fonts", settings: [
    { kind: "popup", title: "Large System Font", items: ["Charcoal"],
      caption: "for menus and headings" },
    { kind: "popup", title: "Small System Font", items: ["Geneva"],
      caption: "for explanatory text and labels" },
    { kind: "popup", title: "Views Font", items: ["Geneva"],
      caption: "for lists and icons" },
  ] },
  { title: "Options", settings: [
    { kind: "checkbox", title: "Smart Scrolling", on: false,
      caption: "proportional scroll boxes, both arrows at one end" },
    { kind: "checkbox", title: "Double-click title bar to collapse windows",
      on: true, caption: "windowshade without the collapse box" },
  ] },
];

/** Settings rows, as in the Appearance tab: the first 21px into the
 * pane, one every 41px. */
const ROW_TOP = 21;
const ROW_PITCH = 41;

let popupSeq = 0;

function settingRow(s: Setting, i: number): HTMLElement {
  const row = el("div", "apr-row");
  row.style.top = `${ROW_TOP + i * ROW_PITCH}px`;
  if (s.kind === "popup") {
    const title = el("label", "osm-popup-title apr-title", `${s.title}:`);
    const pop = el("button", "osm-popup apr-pop");
    pop.type = "button";
    pop.id = `apr-pop-${++popupSeq}`;
    title.htmlFor = pop.id;
    row.append(title, pop);
    mountPopup(pop, {
      items: s.items, selected: 0, label: s.title, onChange: () => {},
    });
  } else {
    const box = checkbox(s.title, s.on);
    trackHighlight(box);
    row.classList.add("apr-check");
    row.append(box);
  }
  row.append(el("div", "osm-caption apr-caption", s.caption));
  return row;
}

export function buildAppearance(content: HTMLElement): WindowContent {
  const root = el("div", "apr");
  const list = el("div", "osm-tablist");
  const pane = el("div", "osm-tab-pane");
  for (const tab of TABS) {
    list.append(el("button", "osm-tab", tab.title));
    const panel = el("div", "apr-panel");
    tab.settings.forEach((s, i) => panel.append(settingRow(s, i)));
    pane.append(panel);
  }
  root.append(list, pane);
  content.append(root);
  mountTabs(root, { selected: 0, label: "Appearance" });
  return {};
}

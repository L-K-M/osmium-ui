// "Appearance": a tab control laid out like Mac OS 8.5's Appearance
// control panel, whose tabs osmium.css's are measured from. The tab
// control fills the window; each pane holds a few settings, a titled
// pop-up or a checkbox with a Geneva 9 caption under it. Highlight
// Color and Variation work: they call setAppearance, which recolors
// every window on the page. The other settings are for show.
//
// Mac OS 9.0's pop-ups show a 21 x 12 swatch beside each color name;
// Osmium's pop-ups have no item icons, so these list names only.
import {
  HIGHLIGHTS_85, VARIATIONS_85, attachBalloon, getAppearance, mountPopup,
  mountTabs, setAppearance, trackHighlight,
} from "../src/index.js";
import type {
  Highlight85, HighlightChoice, Popup, Variation85,
} from "../src/index.js";
import { checkbox, el } from "./dom.js";
import type { WindowContent, WindowEnv } from "./windows.js";

type Setting =
  | { kind: "popup"; title: string; items: readonly string[];
      caption: string }
  | { kind: "highlight"; title: string; caption: string }
  | { kind: "variation"; title: string; caption: string }
  | { kind: "checkbox"; title: string; on: boolean; caption: string };

interface Tab { title: string; settings: readonly Setting[] }

const TABS: readonly Tab[] = [
  { title: "Appearance", settings: [
    { kind: "popup", title: "Appearance", items: ["Apple platinum"],
      caption: "for the overall look of menus, icons, windows, and controls" },
    { kind: "highlight", title: "Highlight Color",
      caption: "for selected text" },
    { kind: "variation", title: "Variation",
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

// ---- Highlight Color -------------------------------------------------
// Mac OS 8.5's list ('hlit' 3000), then Other…. Black & White heads it
// although 8.5's list has none (8.0's does): it is the only highlight
// that inverts, and the demo keeps a way back to it.
const BLACK_WHITE = "Black & White";
const OTHER = "Other…";

/** The menu's items, with a custom color (chosen through Other…) as an
 * item of its own before Other…, so choosing Other… again reopens the
 * color input. */
function highlightItems(custom: string | null): string[] {
  return [BLACK_WHITE, ...HIGHLIGHTS_85, ...(custom ? [custom] : []), OTHER];
}

function mountHighlight(row: HTMLElement, pop: HTMLButtonElement,
                        label: string): void {
  const current: HighlightChoice = getAppearance().highlight;
  let custom = typeof current === "object" && "color" in current
    ? current.color : null;
  let items = highlightItems(custom);
  const index = (h: HighlightChoice) =>
    h === "black-white" ? 0
      : "color" in h ? items.indexOf(h.color)
      : Math.max(0, items.indexOf(h.name));
  // Mac OS opened the Color Picker ("Choose a highlight color:"). Osmium
  // has no Color Picker, so Other… opens the browser's color input.
  const picker = el("input", "apr-color");
  picker.type = "color";
  picker.tabIndex = -1;
  picker.setAttribute("aria-hidden", "true");
  row.append(picker);
  const popup: Popup = mountPopup(pop, {
    items, selected: index(current), label,
    onChange: (i) => {
      const name = items[i]!;
      if (name === OTHER) {
        // Nothing changes until a color is chosen.
        popup.setSelected(index(getAppearance().highlight));
        picker.value = getComputedStyle(document.documentElement)
          .getPropertyValue("--osm-highlight").trim();
        picker.click();
        return;
      }
      setAppearance({ highlight: name === BLACK_WHITE ? "black-white"
        : name === custom ? { color: name }
        : { release: "8.5", name: name as Highlight85 } });
    },
  });
  picker.addEventListener("input", () => {
    setAppearance({ highlight: { color: picker.value } });
    custom = picker.value;
    items = highlightItems(custom);
    popup.setItems(items, index(getAppearance().highlight));
  });
}

// ---- Variation ------------------------------------------------------
// Mac OS 8.5's 20 variations (Apple platinum 'tvar' 128). Its Black &
// White variation is left out: Osmium doesn't offer it (appearance.ts).
function mountVariation(pop: HTMLButtonElement, label: string): void {
  const accent = getAppearance().accent;
  const lavender = VARIATIONS_85.indexOf("Lavender");
  const selected = "name" in accent
    ? VARIATIONS_85.indexOf(accent.name as Variation85)
    : -1;
  mountPopup(pop, {
    items: VARIATIONS_85, selected: selected < 0 ? lavender : selected, label,
    onChange: (i) =>
      setAppearance({ accent: { release: "8.5", name: VARIATIONS_85[i]! } }),
  });
}

function settingRow(s: Setting, i: number): HTMLElement {
  const row = el("div", "apr-row");
  row.style.top = `${ROW_TOP + i * ROW_PITCH}px`;
  if (s.kind !== "checkbox") {
    const title = el("label", "osm-popup-title apr-title", `${s.title}:`);
    const pop = el("button", "osm-popup apr-pop");
    pop.type = "button";
    pop.id = `apr-pop-${++popupSeq}`;
    title.htmlFor = pop.id;
    row.append(title, pop);
    if (s.kind === "highlight") mountHighlight(row, pop, s.title);
    else if (s.kind === "variation") mountVariation(pop, s.title);
    else mountPopup(pop, {
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

export function buildAppearance(content: HTMLElement,
                                env: WindowEnv): WindowContent {
  const root = el("div", "apr");
  const list = el("div", "osm-tablist");
  const pane = el("div", "osm-tab-pane");
  for (const tab of TABS) {
    const t = el("button", "osm-tab", tab.title);
    list.append(t);
    attachBalloon(t, { trigger: env.balloons, content: () =>
      t.getAttribute("aria-selected") === "true"
        ? `${tab.title} tab\n\nIts settings are the ones showing.`
        : `${tab.title} tab\n\nTo see its settings, click here.` });
    const panel = el("div", "apr-panel");
    tab.settings.forEach((s, i) => panel.append(settingRow(s, i)));
    pane.append(panel);
  }
  root.append(list, pane);
  content.append(root);
  mountTabs(root, { selected: 0, label: "Appearance" });
  return {};
}

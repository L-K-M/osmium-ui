// "Control Panel": a Mac OS 8 control panel in the style of Monitors &
// Sound and Desktop Pictures. Bevel buttons down the left switch
// panes; a caption area along the bottom explains whatever the pointer
// (or the keyboard) is on, the way Balloon Help would.
//
//   Desktop   patterns in a list box beside a preview well; Set Desktop
//             paints the desktop page's background
//   Monitor   color depth and resolution lists, a gamma pop-up
//   Picture   sliders in group boxes adjusting a test card; Defaults
import {
  centerText, mountList, mountPopup, pushButton, setButtonTitle, trackPress,
} from "../src/index.js";
import { button, el, group, slider } from "./dom.js";
import { sprite } from "./icons.js";
import type { SpriteName } from "./icons.js";
import { PATTERNS } from "./patterns.js";
import type { WindowContent, WindowEnv } from "./windows.js";

type PaneId = "desktop" | "monitor" | "picture";

/** A caption: a bold head, then the explanation. */
type Help = () => readonly [head: string, text: string];

/** A pane's own push button, at the right of the caption area. */
interface PaneAction { title: string; run(): void }

interface Pane {
  id: PaneId;
  label: string;
  icon: SpriteName;
  el: HTMLElement;
  /** Caption while the pointer is on nothing in particular. */
  hint: string;
  action?: PaneAction;
}

/** List box row pitch (Charcoal 12 rows, as in Monitors & Sound). */
const ROW_H = 16;

const DEPTHS = ["Black & White", "4", "16", "256", "Thousands", "Millions"];
const RESOLUTIONS = [
  "512 x 384, 60Hz", "640 x 480, 67Hz", "640 x 870, 75Hz",
  "800 x 600, 75Hz", "832 x 624, 75Hz", "1024 x 768, 75Hz",
  "1152 x 870, 75Hz", "1280 x 960, 75Hz", "1280 x 1024, 75Hz",
  "1600 x 1200, 75Hz", "1856 x 1392, 75Hz", "1920 x 1440, 75Hz",
];
const GAMMAS = ["Mac Standard", "Uncorrected", "Page-White", "Linear"];

interface Adjustment {
  label: string;
  ends: readonly [string, string];
  /** Slider position (0..100) that leaves the test card unchanged. */
  neutral: number;
  text: string;
  /** The CSS filter function for a slider position. */
  filter(v: number): string;
}

const ADJUSTMENTS: readonly Adjustment[] = [
  { label: "Brightness", ends: ["Dim", "Bright"], neutral: 50,
    text: "How hard the beam drives the phosphors.",
    filter: (v) => `brightness(${0.5 + v / 100})` },
  { label: "Contrast", ends: ["Low", "High"], neutral: 50,
    text: "Separates bright from dark around the middle gray.",
    filter: (v) => `contrast(${0.5 + v / 100})` },
  { label: "Saturation", ends: ["Gray", "Vivid"], neutral: 50,
    text: "From shades of gray to colors stronger than life.",
    filter: (v) => `saturate(${v / 50})` },
  { label: "Warmth", ends: ["Neutral", "Warm"], neutral: 0,
    text: "Tints the picture toward an old photograph.",
    filter: (v) => `sepia(${v / 100})` },
];

/** List box rows (type-select matches their names). */
function listRows(names: readonly string[]): HTMLElement[] {
  return names.map((n) => {
    const r = el("div", "pnl-row", n);
    r.dataset.name = n;
    return r;
  });
}

/** A slider's value as a signed offset from its neutral position. */
function offset(v: number, neutral: number): string {
  const d = v - neutral;
  return d > 0 ? `+${d}` : String(d);
}

export function buildPanel(content: HTMLElement,
                           env: WindowEnv): WindowContent {
  const root = el("div", "pnl");
  const strip = el("div", "pnl-strip");
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-orientation", "vertical");
  strip.setAttribute("aria-label", "Settings");
  const panesEl = el("div", "pnl-panes");
  const foot = el("div", "pnl-foot");
  const desc = el("div", "pnl-desc");
  desc.setAttribute("aria-live", "polite");
  const actionBtn = button("", "pnl-action");
  foot.append(el("div", "osm-separator"), actionBtn, desc);
  root.append(strip, panesEl);
  content.append(root);

  // ---- the caption area ---------------------------------------------
  let described: Help | null = null;
  function describe(h: Help | null): void {
    described = h;
    desc.textContent = "";
    if (!h) {
      desc.textContent = current.hint;
      return;
    }
    const [head, text] = h();
    desc.append(el("span", "osm-label", head), ` ${text}`);
  }
  /** Caption `target` while the pointer or the keyboard is on it. */
  function help(target: HTMLElement, h: Help): void {
    const on = () => describe(h);
    const off = () => {
      if (described === h && !target.contains(document.activeElement) &&
          !target.matches(":hover")) describe(null);
    };
    target.addEventListener("pointerenter", on);
    target.addEventListener("focusin", on);
    target.addEventListener("pointerleave", off);
    target.addEventListener("focusout", () => setTimeout(off));
  }

  // ---- Desktop pane --------------------------------------------------
  const desktopPane = el("section", "pnl-pane pnl-desktop");
  const patternList = el("div", "pnl-patterns");
  const preview = el("div", "osm-well pnl-preview");
  preview.setAttribute("aria-hidden", "true");
  desktopPane.append(patternList, preview);
  let pattern = PATTERNS[0]!;
  const patterns = mountList(patternList, {
    rowHeight: ROW_H,
    label: "Patterns",
    onSelect(i) {
      pattern = PATTERNS[i] ?? pattern;
      preview.style.background = pattern.background;
      if (described) describe(described);
    },
    onOpen: () => env.setDesktop?.(pattern),
  });
  patterns.setRows(listRows(PATTERNS.map((p) => p.name)), { keep: 0 });
  preview.style.background = pattern.background;
  help(patternList, () => ["Patterns.",
    env.setDesktop ? "Choose one to preview it; Set Desktop (or a " +
      "double-click) paints the desktop with it."
      : "Choose one to preview it."]);
  help(preview, () => [`${pattern.name}.`,
    "The preview shows the pattern at its actual size."]);

  // ---- Monitor pane --------------------------------------------------
  const monitorPane = el("section", "pnl-pane pnl-monitor");
  const depthBox = group("Color Depth", "pnl-depth");
  const depthList = el("div", "pnl-list");
  depthBox.append(depthList);
  const resBox = group("Resolution", "pnl-res");
  const resList = el("div", "pnl-list");
  resBox.append(resList);
  const gammaRow = el("div", "pnl-gamma");
  const gammaTitle = el("label", "osm-popup-title", "Gamma:");
  const gammaPop = el("button", "osm-popup");
  gammaPop.type = "button";
  gammaPop.id = "pnl-gamma";
  gammaTitle.htmlFor = gammaPop.id;
  gammaRow.append(gammaTitle, gammaPop);
  monitorPane.append(depthBox, resBox, gammaRow);
  const depths = mountList(depthList, { rowHeight: ROW_H, label: "Color depth",
                                        onSelect: () => describe(described) });
  depths.setRows(listRows(DEPTHS), { keep: 5 });
  const resolutions = mountList(resList, {
    rowHeight: ROW_H, label: "Resolution",
    onSelect: () => describe(described),
  });
  resolutions.setRows(listRows(RESOLUTIONS), { keep: 5 });
  const gamma = mountPopup(gammaPop, {
    items: GAMMAS, selected: 0, label: "Gamma",
    onChange: () => describe(described),
  });
  help(depthBox, () => [`Colors: ${DEPTHS[depths.selected] ?? "none"}.`,
    "How many colors the screen shows at once."]);
  help(resBox, () => [`${RESOLUTIONS[resolutions.selected] ?? "None"}.`,
    "Pixels across and down, and how often the picture is redrawn. " +
    "Scroll for the larger sizes."]);
  help(gammaRow, () => [`Gamma: ${GAMMAS[gamma.selected]}.`,
    "The curve that maps color values to screen brightness."]);

  // ---- Picture pane --------------------------------------------------
  const picturePane = el("section", "pnl-pane pnl-picture");
  const card = el("div", "osm-well pnl-card");
  const cardImage = el("div", "pnl-card-image");
  card.append(cardImage);
  card.setAttribute("aria-hidden", "true");
  const inputs: HTMLInputElement[] = [];
  const applyFilter = () => {
    const f = ADJUSTMENTS.map((a, i) => a.filter(Number(inputs[i]!.value)));
    cardImage.style.filter = f.join(" ");
  };
  const groups = [group("Picture"), group("Color")];
  ADJUSTMENTS.forEach((a, i) => {
    const s = slider(a.label, a.ends, a.neutral);
    inputs.push(s.input);
    const h: Help = () => [
      `${a.label}: ${offset(Number(s.input.value), a.neutral)}.`, a.text];
    s.input.addEventListener("input", () => {
      applyFilter();
      if (described === h) describe(h);
    });
    help(s.unit, h);
    groups[i >> 1]!.append(s.unit);
  });
  picturePane.append(...groups, card);
  help(card, () => ["Test card.",
    "Color bars and a gray ramp, drawn through the sliders' settings."]);
  applyFilter();

  // ---- panes and pane buttons ------------------------------------------
  const PANES: readonly Pane[] = [
    { id: "desktop", label: "Desktop", icon: "pane-desktop", el: desktopPane,
      hint: env.setDesktop ? "Choose a pattern for the desktop."
        : "Browse the desktop patterns.",
      ...(env.setDesktop ? { action: { title: "Set Desktop",
        run: () => env.setDesktop?.(pattern) } } : {}) },
    { id: "monitor", label: "Monitor", icon: "pane-monitor", el: monitorPane,
      hint: "Settings for the monitor. Point at one to see what it does." },
    { id: "picture", label: "Picture", icon: "pane-picture",
      el: picturePane,
      hint: "The monitor's picture controls. Point at a slider to see " +
        "what it does.",
      action: { title: "Defaults", run: () => {
        ADJUSTMENTS.forEach((a, i) => { inputs[i]!.value = String(a.neutral); });
        applyFilter();
        if (described) describe(described);
      } } },
  ];
  let current: Pane = PANES[0]!;
  const tabs = PANES.map((p) => {
    const item = el("div", "pnl-tab");
    const tab = el("button", "osm-bevel");
    tab.type = "button";
    tab.id = `pnl-tab-${p.id}`;
    tab.setAttribute("role", "tab");
    tab.style.setProperty("--osm-icon", sprite(p.icon));
    const cap = el("span", "osm-bevel-caption", p.label);
    cap.id = `pnl-cap-${p.id}`;
    tab.setAttribute("aria-labelledby", cap.id);
    p.el.id = `pnl-pane-${p.id}`;
    p.el.setAttribute("role", "tabpanel");
    p.el.setAttribute("aria-labelledby", tab.id);
    tab.setAttribute("aria-controls", p.el.id);
    item.append(tab, cap);
    strip.append(item);
    panesEl.append(p.el);
    centerText(cap, true);
    // Pane buttons select on press, like radio buttons.
    trackPress(tab, () => showPane(p.id));
    return tab;
  });
  panesEl.append(foot);

  let action: PaneAction | undefined;
  pushButton(actionBtn, () => action?.run());
  function showPane(id: PaneId, focus = false): void {
    PANES.forEach((p, i) => {
      const on = p.id === id;
      const tab = tabs[i]!;
      tab.classList.toggle("osm-selected", on);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      p.el.hidden = !on;
      if (on) {
        current = p;
        if (focus) tab.focus();
      }
    });
    action = current.action;
    actionBtn.hidden = !action;
    if (action) setButtonTitle(actionBtn, action.title);
    describe(null);
  }
  // Arrow keys move between the pane buttons (a vertical tab list).
  strip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    const i = PANES.findIndex((p) => p.id === current.id);
    const d = e.key === "ArrowDown" ? 1 : PANES.length - 1;
    showPane(PANES[(i + d) % PANES.length]!.id, true);
  });
  showPane("desktop");

  return {
    // The visible pane's first list takes the keyboard.
    focus() {
      current.el.querySelector<HTMLElement>(".osm-list")
        ?.focus({ preventScroll: true });
    },
  };
}

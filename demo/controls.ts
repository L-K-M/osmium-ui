// "Controls": a dialog showing the kit's standard controls. Push
// buttons (Beep plays a system beep at the Volume slider's level),
// checkboxes, Keyboard-style sliders (Level drives the progress bar),
// a titled pop-up choosing the sample text shown in the three bitmap
// fonts, a separator, and Cancel / OK with the Return and Escape keys.
import {
  bindDialogKeys, centerText, mountPopup, pushButton, setEnabled,
  trackHighlight,
} from "../src/index.js";
import { button, checkbox, el, group, progress, slider } from "./dom.js";
import type { WindowContent, WindowEnv } from "./windows.js";

const SAMPLES: readonly { name: string; text: string }[] = [
  { name: "Pangram", text: "The quick brown fox jumps over the lazy dog." },
  { name: "Alphabet", text: "ABCDEFGHIJKLM nopqrstuvwxyz" },
  { name: "Digits", text: "0123456789 +-=≠≤≥ $%&@#*/()[]" },
  { name: "Accents", text: "Ça, déjà vu! Größe, Ñandú, Øre, Æsir…" },
];

const FONTS: readonly { name: string; cls: string }[] = [
  { name: "Charcoal 12", cls: "osm-system" },
  { name: "Geneva 10", cls: "osm-small" },
  { name: "Geneva 9", cls: "osm-caption" },
];

export function buildControls(content: HTMLElement,
                              env: WindowEnv): WindowContent {
  const root = el("div", "ctl");

  // Push buttons and checkboxes, side by side.
  const buttons = group("Push Buttons", "ctl-buttons");
  const beepBtn = button("Beep");
  const dimBtn = button("Disabled");
  dimBtn.disabled = true;
  buttons.append(beepBtn, dimBtn);

  const boxes = group("Checkboxes", "ctl-boxes");
  const sound = checkbox("Sound", true);
  const music = checkbox("Music", false);
  const dim = checkbox("Disabled", true);
  setEnabled(dim.querySelector("input")!, false);
  for (const c of [sound, music, dim]) trackHighlight(c);
  boxes.append(sound, music, dim);

  // Sliders and the progress bar the Level slider fills.
  const sliders = group("Sliders", "ctl-sliders");
  const volume = slider("Volume", ["Soft", "Loud"], 75);
  const level = slider("Level", ["Low", "High"], 60);
  const meter = el("div", "ctl-meter");
  const bar = progress(0.6);
  const pct = el("div", "osm-caption ctl-pct");
  meter.append(el("div", "osm-caption demo-slider-title", "Progress"), bar.bar,
               pct);
  const showLevel = () => {
    bar.set(Number(level.input.value) / 100);
    pct.textContent = `${level.input.value}%`;
    centerText(pct);
  };
  level.input.addEventListener("input", showLevel);
  showLevel();
  sliders.append(volume.unit, level.unit, meter);

  // The sample text, in each of the kit's three fonts.
  const sampleRow = el("div", "ctl-sample-row");
  const title = el("label", "osm-popup-title ctl-sample-title", "Sample:");
  const pop = el("button", "osm-popup ctl-sample-pop");
  pop.type = "button";
  pop.id = "ctl-sample";
  title.htmlFor = pop.id;
  sampleRow.append(title, pop);
  const well = el("div", "osm-well ctl-well");
  const lines = FONTS.map((f) => {
    const line = el("div", `ctl-line ${f.cls}`);
    const text = el("span", "ctl-text");
    line.append(el("span", "ctl-font", f.name), text);
    well.append(line);
    return text;
  });
  const showSample = (i: number) => {
    for (const t of lines) t.textContent = SAMPLES[i]!.text;
  };
  mountPopup(pop, {
    items: SAMPLES.map((s) => s.name), selected: 0, label: "Sample",
    onChange: showSample,
  });
  showSample(0);

  // The dialog's own buttons: Return presses OK, Escape Cancel. Both
  // dismiss the dialog (it keeps its settings).
  const cancel = button("Cancel", "ctl-cancel");
  const ok = button("OK", "osm-default ctl-ok");
  pushButton(cancel, env.close);
  pushButton(ok, env.close);
  bindDialogKeys(ok, cancel,
                 { ok: env.close, cancel: env.close, active: env.isActive });

  pushButton(beepBtn, () => beep(Number(volume.input.value) / 100));
  // Never enabled; pushButton still lays out its title.
  pushButton(dimBtn, () => {});

  root.append(buttons, boxes, sliders, sampleRow, well,
              el("div", "osm-separator ctl-rule"), cancel, ok);
  content.append(root);
  return {};
}

let audio: AudioContext | undefined;

/** A short square-wave beep, like Mac OS's Simple Beep, at `volume`
 * (0..1). Silent at zero. */
function beep(volume: number): void {
  if (volume <= 0) return;
  audio ??= new AudioContext();
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.12 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

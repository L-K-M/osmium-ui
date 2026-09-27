// "Controls": a dialog showing the kit's standard controls. Push
// buttons (Beep plays a system beep at the Volume slider's level),
// checkboxes, Keyboard-style sliders (Level drives the progress bar),
// a titled pop-up choosing the sample text shown in the three bitmap
// fonts, a separator, and Cancel / OK with the Return and Escape keys.
// Every control has a help balloon; Beep's opens on hover even while
// Balloon Help is off, the way an app without a Help menu would use it.
import {
  attachBalloon, bindDialogKeys, centerText, mountPopup, pushButton,
  setEnabled, trackHighlight,
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

  const trigger = env.balloons;
  attachBalloon(beepBtn, {
    trigger: "hover",
    content: "Beep button\n\nClick to hear a beep at the Volume " +
      "setting.\n\nThis balloon opens whenever the pointer rests here, " +
      "even with Balloon Help off.",
  });
  attachBalloon(dimBtn, {
    trigger,
    content: "Disabled button\n\nThis button is dimmed because it " +
      "never has anything to do.",
  });
  // Balloons go on the focusable controls, whose description they
  // become; a control's <label> opens its balloon too. A checkbox's
  // balloon follows its state, as Apple's did.
  for (const [box, what] of [[sound, "sound"], [music, "music"]] as const) {
    const input = box.querySelector("input")!;
    attachBalloon(input, { trigger, content: () => input.checked
      ? `${box.textContent} checkbox\n\nChecked. To turn ${what} off, ` +
        "click here."
      : `${box.textContent} checkbox\n\nUnchecked. To turn ${what} on, ` +
        "click here." });
  }
  attachBalloon(dim.querySelector("input")!, { trigger, content:
    "Disabled checkbox\n\nThis checkbox is dimmed, so it can't be " +
    "changed." });
  attachBalloon(volume.input, { trigger, content: "Volume slider\n\nDrag " +
    "the slider to set how loud the Beep button is." });
  attachBalloon(level.input, { trigger, content: "Level slider\n\nDrag " +
    "the slider to fill the progress bar." });
  // The progress bar's state lives in the slider, so the slider
  // refreshes its message.
  const progressHelp = () => "Progress bar\n\n" +
    `Shows the Level slider's setting, now ${level.input.value}%.`;
  const meterBalloon = attachBalloon(meter, { trigger,
                                             content: progressHelp });
  level.input.addEventListener("input",
                               () => meterBalloon.setContent(progressHelp));
  attachBalloon(pop, { trigger, content: "Sample pop-up menu\n\n" +
    "Choose the text shown below in each of the kit's three fonts." });
  attachBalloon(cancel, { trigger, variant: "bottom-left",
    content: "Cancel button\n\nTo close this dialog box, click here or " +
      "press Esc." });
  attachBalloon(ok, { trigger, variant: "bottom-left",
    content: "OK button\n\nTo close this dialog box, click here or " +
      "press Return." });
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

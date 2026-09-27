// "Alerts": push buttons that bring up each kind of alert showAlert
// draws, over this window: stop, caution and note, a plain one with
// the demo's own icon, and variations (three buttons, a destructive
// action whose default is Cancel, text long enough to grow the alert,
// a movable alert). The status line along the bottom names the button
// that ended the last one, the way a Mac OS 8 application reports an
// outcome in its window rather than in a notification.
import { centerText, pushButton, showAlert } from "../src/index.js";
import type { AlertOptions, AlertResult } from "../src/index.js";
import { beep } from "./controls.js";
import { button, el, group } from "./dom.js";
import type { WindowContent, WindowEnv } from "./windows.js";

type Demo = Omit<AlertOptions, "parent" | "position" | "onBeep">;

const KINDS: readonly [string, Demo][] = [
  ["Stop…", {
    kind: "stop",
    message: "“Tank Log” can’t be opened, because no application on " +
      "this disk can read it.",
  }],
  ["Caution…", {
    kind: "caution",
    message: "Put every setting in this window back the way it came?",
    explanation: "Settings you changed yourself will be lost.",
    buttons: { ok: "Reset", cancel: "Cancel" },
  }],
  ["Note…", {
    kind: "note",
    message: "The aquarium has been cleaned.",
    explanation: "None of the fish noticed.",
  }],
  ["Plain…", {
    kind: "plain", icon: "icon-osmium",
    message: "This alert has no kind of its own, so it shows the " +
      "application’s icon instead.",
  }],
];

const VARIATIONS: readonly [string, Demo][] = [
  ["Save Changes…", {
    kind: "caution",
    message: "Do you want to keep the changes you made to “Tank Log”?",
    explanation: "If you don’t save them, they will be lost.",
    buttons: { ok: "Save", cancel: "Cancel", other: "Don’t Save" },
  }],
  ["Delete…", {
    kind: "caution",
    message: "Delete the tank “Reef” and all of its fish?",
    explanation: "This can’t be undone.",
    buttons: { ok: "Delete", cancel: "Cancel" },
    defaultButton: "cancel",
  }],
  ["Long Text…", {
    kind: "stop",
    message: "The tank “Deep Water Research Station Seven” couldn’t be " +
      "refilled, because the pump reported an error while its valves " +
      "were still closed.",
    explanation: "Open the valves and try again. If the pump keeps " +
      "reporting errors, look in its log:\n" +
      "Osmium HD:Preferences:Pumps:Pump Log",
  }],
  ["Movable…", {
    kind: "note", modality: "movable",
    message: "You can drag this alert by its title bar.",
    explanation: "The rest of the page still waits for you to press OK.",
  }],
];

/** The Controls window's Simple Beep, at a moderate level. */
const BEEP_VOLUME = 0.5;
/** How long the status line keeps its report. */
const STATUS_MS = 4000;

export function buildAlerts(content: HTMLElement,
                            env: WindowEnv): WindowContent {
  const root = el("div", "alr");
  const status = el("div", "osm-placard alr-status");
  status.setAttribute("role", "status");
  let clear: ReturnType<typeof setTimeout> | undefined;

  const report = (demo: Demo, r: AlertResult) => {
    const title = r === "dismissed" ? null
      : demo.buttons?.[r] ?? (r === "ok" ? "OK" : null);
    status.textContent = title ? `You pressed “${title}”.` : "";
    centerText(status);
    clearTimeout(clear);
    clear = setTimeout(() => { status.textContent = ""; }, STATUS_MS);
  };

  const column = (title: string, cls: string,
                  demos: readonly [string, Demo][]) => {
    const box = group(title, cls);
    for (const [label, demo] of demos) {
      const b = button(label);
      b.dataset["width"] = "121";
      pushButton(b, () => {
        const parent = env.window();
        const alert = showAlert({
          ...demo,
          ...(parent ? { parent, position: "parent" as const } : {}),
          onBeep: () => beep(BEEP_VOLUME),
        });
        void alert.result.then((r) => report(demo, r));
      });
      box.append(b);
    }
    return box;
  };

  root.append(column("Kinds", "alr-kinds", KINDS),
              column("Variations", "alr-variations", VARIATIONS), status);
  content.append(root);
  return {};
}

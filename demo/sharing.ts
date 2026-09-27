// "File Sharing": edit text the way Mac OS 8 control panels used it,
// in a panel styled after File Sharing's Network Identity group. It
// copies no captured panel, and the idle and message rows are made
// up. Labeled one-line fields (one of them a password), a 20px field
// paired with a pop-up in a checkbox's row, and a multi-line message
// with a scroll bar. Spacing follows the HIG: labels 5px from their
// field, fields 6px apart, a field and its pop-up 4px apart. Return in
// a one-line field presses OK and Escape Cancel, as ModalDialog has
// it; Return in the message starts a new line. The settings are for
// show.
import {
  bindDialogKeys, mountPopup, mountTextArea, pushButton, setEnabled,
  trackHighlight,
} from "../src/index.js";
import { button, checkbox, el, group } from "./dom.js";
import type { WindowContent, WindowEnv } from "./windows.js";

const IDENTITY: readonly { label: string; value: string; width: number;
                           type?: "password" }[] = [
  { label: "Owner Name:", value: "Osmium User", width: 200 },
  { label: "Owner Password:", value: "platinum", width: 120,
    type: "password" },
  { label: "Computer Name:", value: "Osmium Mac", width: 200 },
];

const MESSAGE = "Welcome to Osmium Mac.\n" +
  "Files in the Drop Box are cleared every Friday, so copy anything " +
  "you want to keep.\nPlease disconnect when you are done.";

let fieldSeq = 0;

/** A field and its label, the label right-aligned on the column's
 * shared edge. */
function identityRow(label: string, value: string, width: number,
                     type = "text"): HTMLElement {
  const row = el("div", "shr-row");
  const input = el("input", "osm-edit");
  input.type = type;
  input.value = value;
  input.spellcheck = false;
  input.id = `shr-field-${++fieldSeq}`;
  input.style.width = `${width}px`;
  const title = el("label", "osm-system shr-label", label);
  title.htmlFor = input.id;
  row.append(title, input);
  return row;
}

export function buildSharing(content: HTMLElement,
                             env: WindowEnv): WindowContent {
  const root = el("div", "shr");

  const identity = group("Network Identity", "shr-identity");
  for (const f of IDENTITY)
    identity.append(identityRow(f.label, f.value, f.width, f.type));

  // A checkbox whose title reads on into a short field and the unit
  // pop-up paired with it; unchecked, both dim.
  const idle = el("div", "shr-idle");
  const idleBox = checkbox("Disconnect idle users after", true);
  trackHighlight(idleBox);
  const idleOn = idleBox.querySelector("input")!;
  const minutes = el("input", "osm-edit osm-compact shr-minutes");
  minutes.value = "10";
  minutes.inputMode = "numeric";
  minutes.setAttribute("aria-label", "Idle time");
  const unit = el("button", "osm-popup shr-unit");
  unit.type = "button";
  mountPopup(unit, {
    items: ["minutes", "hours"], selected: 0, label: "Idle time unit",
    onChange: () => {},
  });
  idleOn.addEventListener("change", () => {
    setEnabled(minutes, idleOn.checked);
    unit.disabled = !idleOn.checked;
  });
  idle.append(idleBox, minutes, unit);

  // The message users see as they connect: longer than its three lines,
  // so the scroll bar has something to do.
  const messageTitle = el("label", "osm-system shr-message-title",
                          "Connection message:");
  const message = el("div", "shr-message");
  const text = el("textarea");
  text.id = "shr-message";
  text.value = MESSAGE;
  messageTitle.htmlFor = text.id;
  message.append(text);

  const cancel = button("Cancel", "shr-cancel");
  const ok = button("OK", "osm-default shr-ok");
  pushButton(cancel, env.close);
  pushButton(ok, env.close);
  bindDialogKeys(ok, cancel,
                 { ok: env.close, cancel: env.close, active: env.isActive });

  root.append(identity, idle, messageTitle, message,
              el("div", "osm-separator shr-rule"), cancel, ok);
  content.append(root);
  // In the document, so the scroll bar can read the text's line height.
  mountTextArea(message);

  // The keyboard goes back to the field that last had it when the
  // window comes forward again; the first field to begin with.
  let last: HTMLInputElement | HTMLTextAreaElement =
    identity.querySelector("input")!;
  root.addEventListener("focusin", (e) => {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLInputElement && t.classList.contains("osm-edit")))
      last = t;
  });
  return {
    // The idle field may have been disabled since it had the keyboard;
    // the first field then takes it.
    focus: () => {
      const target = last.disabled ? identity.querySelector("input")! : last;
      target.focus({ preventScroll: true });
    },
  };
}

// @vitest-environment happy-dom
// Edit text wiring: the multi-line text area (mountTextArea), setEnabled
// on fields, and the dialog keys a single-line field passes on. happy-dom
// lays nothing out and draws nothing, so the frame, ring and text
// placement (osmium.css) are checked by rendering the demo in real
// engines instead; here the text's extent is stubbed where the scroll
// bar needs it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachScrollbar, bindDialogKeys, setEnabled } from "./controls.js";
import { mountTextArea } from "./edittext.js";
import { hostWindow } from "./host.js";
import type { WindowOp } from "./host.js";

/** A framed text area whose textarea reports `content` px of text in a
 * `view` px tall box. */
function mountArea(content: number, view = 64, style = "") {
  const host = document.createElement("div");
  const ta = document.createElement("textarea");
  if (style) ta.setAttribute("style", style);
  host.append(ta);
  document.body.append(host);
  let h = content;
  Object.defineProperty(ta, "scrollHeight",
                        { get: () => h, configurable: true });
  Object.defineProperty(ta, "clientHeight",
                        { get: () => view, configurable: true });
  const area = mountTextArea(host);
  const bar = host.querySelector(".osm-scrollbar")!;
  return { host, ta, area, bar, setContent: (n: number) => { h = n; } };
}

describe("mountTextArea", () => {
  beforeEach(() => {
    document.body.textContent = "";
    // happy-dom has no pointer capture; the scroll bar only needs it to
    // exist.
    Element.prototype.setPointerCapture ??= () => {};
  });

  it("needs a textarea and leaves a bad host untouched", () => {
    const host = document.createElement("div");
    host.append(document.createElement("input"));
    expect(() => mountTextArea(host)).toThrow(/textarea/);
    expect(host.className).toBe("");
    expect(host.children).toHaveLength(1);
  });

  it("frames the textarea and hangs a hidden scroll bar on it", () => {
    const { host, bar, area, ta } = mountArea(32);
    expect(host.classList.contains("osm-edit-area")).toBe(true);
    expect(host.classList.contains("osm-has-scrollbar")).toBe(true);
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(area.element).toBe(host);
    expect(area.textarea).toBe(ta);
  });

  it("dims the bar until the text overflows, following typing", () => {
    const { ta, bar, setContent } = mountArea(32);
    expect(bar.classList.contains("osm-sb-off")).toBe(true);
    setContent(200);
    ta.dispatchEvent(new Event("input"));
    expect(bar.classList.contains("osm-sb-off")).toBe(false);
    setContent(40);
    ta.dispatchEvent(new Event("input"));
    expect(bar.classList.contains("osm-sb-off")).toBe(true);
  });

  it("re-reads the text on update() after a scripted change", () => {
    const { area, bar, setContent } = mountArea(32);
    setContent(200);
    area.update();
    expect(bar.classList.contains("osm-sb-off")).toBe(false);
  });

  it("steps one line of the text area's font per arrow press", () => {
    vi.useFakeTimers();
    try {
      const { ta, bar } = mountArea(400, 64, "line-height: 13px");
      const down = bar.querySelector(".osm-sb-down")!;
      for (const type of ["pointerdown", "pointerup"])
        down.dispatchEvent(new PointerEvent(type, { button: 0, pointerId: 1 }));
      expect(ta.scrollTop).toBe(13);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("attachScrollbar's destroy", () => {
  beforeEach(() => {
    document.body.textContent = "";
    Element.prototype.setPointerCapture ??= () => {};
  });

  it("ends an arrow press still repeating", () => {
    vi.useFakeTimers();
    try {
      const { host, ta } = mountArea(400);
      // mountArea's bar is left alone; this one is the one destroyed.
      const sb = attachScrollbar(host, ta, 13);
      const down = host.querySelectorAll(".osm-sb-down")[1]!;
      vi.spyOn(down, "getBoundingClientRect")
        .mockReturnValue(new DOMRect(0, 0, 16, 16));
      down.dispatchEvent(new PointerEvent("pointerdown", {
        button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
      vi.advanceTimersByTime(1000);
      const at = ta.scrollTop;
      expect(at).toBeGreaterThan(13);
      // Taken down mid-press: the pointerup never reaches the bar.
      sb.destroy();
      vi.advanceTimersByTime(1000);
      expect(ta.scrollTop).toBe(at);
      expect(down.classList.contains("osm-pressed")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("setEnabled on edit text", () => {
  beforeEach(() => { document.body.textContent = ""; });

  it("dims a text area's whole control", () => {
    const { host, ta } = mountArea(32);
    setEnabled(ta, false);
    expect(ta.disabled).toBe(true);
    expect(host.classList.contains("osm-disabled")).toBe(true);
    setEnabled(ta, true);
    expect(ta.disabled).toBe(false);
    expect(host.classList.contains("osm-disabled")).toBe(false);
  });

  it("disables a bare field, which osmium.css dims through :disabled", () => {
    const field = document.createElement("input");
    field.className = "osm-edit";
    document.body.append(field);
    setEnabled(field, false);
    expect(field.disabled).toBe(true);
    expect(field.classList.contains("osm-disabled")).toBe(false);
  });
});

/** The dialog's fields and buttons, bound with bindDialogKeys. */
function dialog(active = true) {
  document.body.innerHTML =
    '<input id="edit" class="osm-edit">' +
    '<input id="search" class="osm-edit" type="search">' +
    '<input id="plain">' +
    '<textarea id="area"></textarea>' +
    '<label class="osm-checkbox"><input id="box" type="checkbox"></label>' +
    '<button id="ok">OK</button><button id="cancel">Cancel</button>';
  const ok = document.getElementById("ok") as HTMLButtonElement;
  const cancel = document.getElementById("cancel") as HTMLButtonElement;
  // happy-dom lays nothing out: give the buttons a box, as shown
  // buttons have.
  for (const b of [ok, cancel])
    b.getClientRects =
      () => [new DOMRect(0, 0, 59, 20)] as unknown as DOMRectList;
  const pressed: string[] = [];
  bindDialogKeys(ok, cancel, {
    ok: () => pressed.push("ok"),
    cancel: () => pressed.push("cancel"),
    active: () => active,
  });
  return pressed;
}

/** A keydown on the element with `id`, then the button flash. */
function key(id: string, k: string, init: KeyboardEventInit = {}): void {
  document.getElementById(id)!.dispatchEvent(new KeyboardEvent("keydown", {
    key: k, bubbles: true, cancelable: true, ...init,
  }));
  vi.advanceTimersByTime(200);
}

describe("bindDialogKeys with edit text", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("presses the default button for Return in a one-line field", () => {
    const pressed = dialog();
    key("edit", "Enter");
    expect(pressed).toEqual(["ok"]);
  });

  it("presses Cancel for Escape and Command-period in a one-line field", () => {
    const pressed = dialog();
    key("edit", "Escape");
    key("edit", ".", { metaKey: true });
    // A search field too: as in ModalDialog, the dialog's filter sees
    // the key before the field does.
    key("search", "Escape");
    expect(pressed).toEqual(["cancel", "cancel", "cancel"]);
  });

  it("flashes the button before pressing it", () => {
    const pressed = dialog();
    const ok = document.getElementById("ok")!;
    document.getElementById("edit")!.dispatchEvent(new KeyboardEvent(
      "keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(ok.classList.contains("osm-pressed")).toBe(true);
    expect(pressed).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(ok.classList.contains("osm-pressed")).toBe(false);
    expect(pressed).toEqual(["ok"]);
  });

  it("leaves text areas and other text fields their keys", () => {
    const pressed = dialog();
    key("area", "Enter");
    key("area", "Escape");
    key("plain", "Enter");
    key("plain", "Escape");
    expect(pressed).toEqual([]);
  });

  it("leaves a focused button its own Return", () => {
    const pressed = dialog();
    key("cancel", "Enter");
    expect(pressed).toEqual([]);
  });

  it("still works from a checkbox", () => {
    const pressed = dialog();
    key("box", "Enter");
    expect(pressed).toEqual(["ok"]);
  });

  it("leaves the Return that ends a composition to the input method", () => {
    const pressed = dialog();
    key("edit", "Enter", { isComposing: true });
    // Safari's last composition keydown: keyCode 229, not isComposing.
    key("edit", "Enter", { keyCode: 229 });
    expect(pressed).toEqual([]);
  });

  it("yields to a field's own handler that calls preventDefault", () => {
    const pressed = dialog();
    const saved: string[] = [];
    document.getElementById("edit")!.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      saved.push("saved");
    });
    key("edit", "Enter");
    expect(saved).toEqual(["saved"]);
    expect(pressed).toEqual([]);
  });

  it("does nothing while its window is inactive", () => {
    const pressed = dialog(false);
    key("edit", "Enter");
    key("edit", "Escape");
    expect(pressed).toEqual([]);
  });
});

describe("a hosted window's Escape with edit text", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // happy-dom has no FontFace: mountWindow reports the fonts missing.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function hosted() {
    document.body.innerHTML =
      '<div id="win"><div class="osm-content">' +
      '<input id="edit" class="osm-edit"><button id="cancel">Cancel</button>' +
      "</div></div>";
    const ops: WindowOp[] = [];
    hostWindow(document.getElementById("win")!,
               { title: "Dialog", post: (op) => ops.push(op) });
    return ops;
  }
  const closes = (ops: WindowOp[]) =>
    ops.filter((op) => op.op === "winClose").length;

  it("doesn't close the window from a field", () => {
    const ops = hosted();
    key("edit", "Escape");
    expect(closes(ops)).toBe(0);
  });

  it("lets a dialog take Escape from a field to press Cancel", () => {
    const ops = hosted();
    const cancel = document.getElementById("cancel") as HTMLButtonElement;
    cancel.getClientRects =
      () => [new DOMRect(0, 0, 59, 20)] as unknown as DOMRectList;
    const pressed: string[] = [];
    bindDialogKeys(null, cancel, { cancel: () => pressed.push("cancel") });
    key("edit", "Escape");
    expect(pressed).toEqual(["cancel"]);
    expect(closes(ops)).toBe(0);
  });
});

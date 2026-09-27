// @vitest-environment happy-dom
// The text view's behavior: TextEdit-style undo groups, read-only
// documents, the length limit, the clipboard commands' honest failures
// and the outline geometry. happy-dom lays nothing out, so edits are
// driven the way the browser reports them (beforeinput, the change,
// input) and the rendered view is checked against SimpleText captures
// in a real engine instead.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  highlightBands, mountTextView, outlineRects, trimTrailingSpace,
} from "./textview.js";
import type { OsmiumTextView, TextViewOptions } from "./textview.js";

function mount(opts: Partial<TextViewOptions> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const view = mountTextView(host, { label: "Doc", ...opts });
  return { host, view, ta: view.textarea };
}

/** Type `text` at the selection the way the browser reports it. */
function type(ta: HTMLTextAreaElement, text: string,
              inputType = "insertText"): boolean {
  const e = new InputEvent("beforeinput", {
    inputType, data: text, cancelable: true, bubbles: true,
  });
  if (!ta.dispatchEvent(e)) return false;
  const s = ta.selectionStart, t = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(t);
  ta.setSelectionRange(s + text.length, s + text.length);
  ta.dispatchEvent(new InputEvent("input", { inputType, data: text }));
  return true;
}

function backspace(ta: HTMLTextAreaElement): void {
  ta.dispatchEvent(new InputEvent("beforeinput", {
    inputType: "deleteContentBackward", cancelable: true,
  }));
  const s = ta.selectionStart;
  ta.value = ta.value.slice(0, s - 1) + ta.value.slice(s);
  ta.setSelectionRange(s - 1, s - 1);
  ta.dispatchEvent(new InputEvent("input", {
    inputType: "deleteContentBackward",
  }));
}

const keydown = (ta: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent("keydown", {
    key, bubbles: true, cancelable: true, ...init,
  });
  ta.dispatchEvent(e);
  return e;
};

describe("mountTextView", () => {
  beforeEach(() => {
    document.body.textContent = "";
    Element.prototype.setPointerCapture ??= () => {};
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds the view: text area, strip and a hidden scroll bar", () => {
    const { host, ta, view } = mount({ text: "Hello" });
    expect(host.classList.contains("osm-textview")).toBe(true);
    expect(ta.getAttribute("aria-label")).toBe("Doc");
    expect(ta.value).toBe("Hello");
    expect(host.dataset["font"]).toBe("geneva-12");
    expect(host.dataset["mode"]).toBe("editable");
    expect(host.querySelector(".osm-textview-strip")).not.toBeNull();
    expect(host.querySelector(".osm-scrollbar")!.getAttribute("aria-hidden"))
      .toBe("true");
    expect(view.canUndo).toBe(false);
  });

  it("rejects unknown modes and fonts", () => {
    expect(() => mount({ mode: "locked" as never })).toThrow(/mode/);
    expect(() => mount({ font: "toString" as never })).toThrow(/font/);
    const { view } = mount();
    expect(() => view.setFont("monaco-9" as never)).toThrow(/font/);
    expect(view.font).toBe("geneva-12");
  });

  it("undoes a run of typing as one edit, and redoes it", () => {
    const { ta, view } = mount({ text: "Hi" });
    ta.setSelectionRange(2, 2);
    type(ta, " t");
    type(ta, "here");
    backspace(ta);
    expect(ta.value).toBe("Hi ther");
    view.undo();
    expect(ta.value).toBe("Hi");
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([2, 2]);
    view.undo();
    expect(ta.value).toBe("Hi ther");
  });

  it("starts a new edit when the caret moves or a paste comes", () => {
    const { ta, view } = mount({ text: "ab" });
    ta.setSelectionRange(2, 2);
    type(ta, "c");
    ta.setSelectionRange(0, 0);
    type(ta, "x");
    view.undo();
    expect(ta.value).toBe("abc");
    view.undo();
    type(ta, "y", "insertFromPaste");
    expect(ta.value).toBe("xyabc");
    view.undo();
    expect(ta.value).toBe("xabc");
  });

  it("routes Command-Z and the browser's Undo to its own undo", () => {
    const { ta } = mount({ text: "" });
    type(ta, "abc");
    const e = keydown(ta, "z", { ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(ta.value).toBe("");
    // Shift-Command-Z redoes only after an undo.
    keydown(ta, "Z", { metaKey: true, shiftKey: true });
    expect(ta.value).toBe("abc");
    keydown(ta, "Z", { metaKey: true, shiftKey: true });
    expect(ta.value).toBe("abc");
    const undo = new InputEvent("beforeinput", {
      inputType: "historyUndo", cancelable: true,
    });
    ta.dispatchEvent(undo);
    expect(undo.defaultPrevented).toBe(true);
    expect(ta.value).toBe("");
    ta.dispatchEvent(new InputEvent("beforeinput", {
      inputType: "historyRedo", cancelable: true,
    }));
    expect(ta.value).toBe("abc");
  });

  it("forgets undo on setText and reports edits to onChange", () => {
    const onChange = vi.fn();
    const { ta, view } = mount({ onChange });
    type(ta, "x");
    expect(onChange).toHaveBeenCalledTimes(1);
    view.setText("new\ntext");
    expect(view.canUndo).toBe(false);
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([0, 0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    view.undo();
    expect(ta.value).toBe("new\ntext");
  });

  it("refuses typing past maxLength and says so", () => {
    const onLimit = vi.fn();
    const { ta } = mount({ text: "abcd", maxLength: 5, onLimit });
    ta.setSelectionRange(4, 4);
    expect(type(ta, "e")).toBe(true);
    expect(type(ta, "f")).toBe(false);
    expect(ta.value).toBe("abcde");
    expect(onLimit).toHaveBeenCalledTimes(1);
    // Replacing a selection may keep the length.
    ta.setSelectionRange(0, 2);
    expect(type(ta, "XY")).toBe(true);
    expect(ta.value).toBe("XYcde");
  });

  it("takes back an input method's overflow it couldn't cancel", () => {
    const onLimit = vi.fn();
    const { ta } = mount({ text: "ab", maxLength: 3, onLimit });
    ta.setSelectionRange(2, 2);
    ta.dispatchEvent(new InputEvent("beforeinput", {
      inputType: "insertCompositionText", data: "cd", cancelable: false,
    }));
    ta.value = "abcd";
    ta.dispatchEvent(new InputEvent("input", {
      inputType: "insertCompositionText",
    }));
    expect(ta.value).toBe("ab");
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it("shows a read-only document without letting it change", () => {
    const onRejectedEdit = vi.fn();
    const { ta, view, host } = mount({
      text: "Read me", mode: "read-only", onRejectedEdit,
    });
    expect(ta.readOnly).toBe(true);
    expect(host.dataset["mode"]).toBe("read-only");
    keydown(ta, "a");
    keydown(ta, "Enter");
    keydown(ta, "Backspace");
    expect(onRejectedEdit).toHaveBeenCalledTimes(3);
    // Command keys and arrows aren't edits.
    keydown(ta, "c", { metaKey: true });
    keydown(ta, "ArrowDown");
    keydown(ta, "a", { repeat: true });
    expect(onRejectedEdit).toHaveBeenCalledTimes(3);
    expect(() => view.clear()).toThrow(/read-only/);
    return Promise.all([
      expect(view.cut()).rejects.toThrow(/read-only/),
      expect(view.paste()).rejects.toThrow(/read-only/),
    ]);
  });

  it("switches mode and font", () => {
    const { ta, view, host } = mount({ text: "x" });
    view.setMode("read-only");
    expect(ta.readOnly).toBe(true);
    view.setMode("editable");
    expect(ta.readOnly).toBe(false);
    view.setFont("charcoal-12");
    expect(host.dataset["font"]).toBe("charcoal-12");
    expect(view.font).toBe("charcoal-12");
  });

  it("clears the selection as one undoable edit", () => {
    const onChange = vi.fn();
    const { ta, view } = mount({ text: "one two", onChange });
    ta.setSelectionRange(3, 7);
    expect(view.hasSelection).toBe(true);
    view.clear();
    expect(ta.value).toBe("one");
    expect(onChange).toHaveBeenCalled();
    view.undo();
    expect(ta.value).toBe("one two");
  });

  it("rejects a copy or cut the browser refuses, keeping the text", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: {
      writeText: () => Promise.reject(new DOMException("no", "NotAllowedError")),
    } });
    const { ta, view } = mount({ text: "keep me" });
    ta.setSelectionRange(0, 4);
    await expect(view.copy()).rejects.toThrow(/write to the clipboard/);
    await expect(view.cut()).rejects.toThrow(/write to the clipboard/);
    expect(ta.value).toBe("keep me");
  });

  it("cuts through the Clipboard API when the browser has no command", async () => {
    const written: string[] = [];
    vi.stubGlobal("navigator", { ...navigator, clipboard: {
      writeText: (t: string) => { written.push(t); return Promise.resolve(); },
    } });
    const { ta, view } = mount({ text: "cut this" });
    ta.setSelectionRange(3, 8);
    await view.cut();
    expect(written).toEqual([" this"]);
    expect(ta.value).toBe("cut");
    view.undo();
    expect(ta.value).toBe("cut this");
  });

  it("pastes what the clipboard gives, or says it couldn't", async () => {
    const onLimit = vi.fn();
    let text: Promise<string> = Promise.resolve("pasted");
    vi.stubGlobal("navigator", { ...navigator, clipboard: {
      readText: () => text,
    } });
    const { ta, view } = mount({ text: "[]", maxLength: 10, onLimit });
    ta.setSelectionRange(1, 1);
    await view.paste();
    expect(ta.value).toBe("[pasted]");
    text = Promise.resolve("far too long");
    await view.paste();
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(ta.value).toBe("[pasted]");
    text = Promise.reject(new DOMException("no", "NotAllowedError"));
    await expect(view.paste()).rejects.toThrow(/read the clipboard/);
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    await expect(view.paste()).rejects.toThrow(/doesn't let the page/);
    expect(ta.value).toBe("[pasted]");
  });

  it("selects all", () => {
    const { ta, view } = mount({ text: "all of it" });
    view.selectAll();
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([0, 9]);
  });
});

describe("trimTrailingSpace", () => {
  it("drops the spaces after a double-clicked word", () => {
    expect(trimTrailingSpace("The quick brown", 4, 10)).toBe(9);
    expect(trimTrailingSpace("a\t\tb", 0, 3)).toBe(1);
    expect(trimTrailingSpace("quick", 0, 5)).toBe(5);
    // A selection of spaces alone stays.
    expect(trimTrailingSpace("a   b", 1, 4)).toBe(4);
  });
});

describe("TextEdit highlight outline", () => {
  const W = 548;
  it("frames a selection within one line as a rectangle", () => {
    const bands = highlightBands({ x: 27, line: 0 }, { x: 60, line: 0 },
                                 false, W, 16);
    expect(bands).toEqual([{ top: 0, bottom: 16, x0: 27, x1: 60 }]);
    expect(outlineRects(bands)).toEqual([
      { x: 27, y: 0, w: 33, h: 1 }, { x: 27, y: 15, w: 33, h: 1 },
      { x: 27, y: 0, w: 1, h: 16 }, { x: 59, y: 0, w: 1, h: 16 },
    ]);
  });

  it("runs to the right edge when the selection goes on", () => {
    const bands = highlightBands({ x: 27, line: 0 }, { x: 80, line: 2 },
                                 false, W, 16);
    expect(bands).toEqual([
      { top: 0, bottom: 16, x0: 27, x1: W },
      { top: 16, bottom: 32, x0: 0, x1: W },
      { top: 32, bottom: 48, x0: 0, x1: 80 },
    ]);
    const rects = outlineRects(bands);
    // Between the first and second bands only the part left of the
    // start is an edge; between the second and last, right of the end.
    expect(rects).toContainEqual({ x: 0, y: 16, w: 27, h: 1 });
    expect(rects).toContainEqual({ x: 80, y: 31, w: W - 80, h: 1 });
    expect(rects).not.toContainEqual(expect.objectContaining({ y: 15 }));
  });

  it("keeps two lines that don't overlap as two frames", () => {
    const bands = highlightBands({ x: 300, line: 0 }, { x: 100, line: 1 },
                                 false, W, 16);
    const rows = outlineRects(bands).filter((r) => r.h === 1);
    expect(rows).toContainEqual({ x: 300, y: 15, w: W - 300, h: 1 });
    expect(rows).toContainEqual({ x: 0, y: 16, w: 100, h: 1 });
  });

  it("drops an empty last band", () => {
    expect(highlightBands({ x: 10, line: 0 }, { x: 0, line: 1 }, false,
                          W, 16)).toHaveLength(1);
  });
});

// A view reused across documents (the demo's editor) keeps working.
it("reuses one view for several documents", () => {
  document.body.textContent = "";
  const host = document.createElement("div");
  document.body.append(host);
  const view: OsmiumTextView = mountTextView(host, { label: "Doc" });
  view.setText("first");
  view.setMode("read-only");
  view.setText("second");
  expect(view.text).toBe("second");
  expect(view.mode).toBe("read-only");
});

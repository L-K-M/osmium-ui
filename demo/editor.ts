// "Foolscap": a small text editor in the manner of TeachText 7.0, built
// on the kit's text view (mountTextView). Like TeachText it holds one
// document at a time (New and Open… are dimmed while one is open), so
// its window is the document's. While the window is in front the
// desktop's menu bar shows Foolscap's menus (WindowContent.app):
//
//   File   New, Open… (a dialog of sample documents, or a text file
//          from the reader's disk), Close, Save and Save As… (which
//          download the text as a .txt file: a page can't write to the
//          disk), Quit
//   Edit   the text view's own Undo, Cut, Copy, Paste, Clear and Select
//          All; the keyboard's Cut, Copy and Paste stay the browser's,
//          which need no clipboard permission
//   Font   Charcoal and Geneva, and Size 9, 10 and 12, as far as the kit
//          has the strike
//   Help   Show Balloons / Hide Balloons and the Read Me
//
// The Read Me is read-only, as SimpleText's ttro documents are: typing
// in it brings up a movable stop alert (in words of the demo's own, not
// Apple's). Closing a document with changes asks Save, Don't Save or
// Cancel. In a one-window page (the native demo app) there is no menu
// bar: the window holds a new document, with the text view's own keys.
import {
  MENU_SEPARATOR, attachBalloon, balloonMenuItem, mountList, mountTextView,
  pushButton, showAlert,
} from "../src/index.js";
import type {
  AlertOptions, Menu, MenuEntry, OsmiumWindow, Size, TextViewFont,
  TextViewMode,
} from "../src/index.js";
import { beep } from "./controls.js";
import { openDialog } from "./dialog.js";
import type { DemoDialog } from "./dialog.js";
import { DOCUMENTS } from "./documents.js";
import type { DocumentId } from "./documents.js";
import { button, el } from "./dom.js";
import { sprite } from "./icons.js";
import type { WindowContent, WindowEnv } from "./windows.js";

/** TextEdit's limit: a TERec's length is a signed 16-bit integer. */
const TEXTEDIT_MAX = 32767;
const UNTITLED = "untitled";
/** The alert beep's level, as the Alerts window uses it. */
const BEEP_VOLUME = 0.5;

/** The font families and the sizes the kit has a strike for. */
const FAMILIES: readonly { name: string;
                           sizes: Readonly<Record<number, TextViewFont>> }[] = [
  { name: "Charcoal", sizes: { 12: "charcoal-12" } },
  { name: "Geneva", sizes: { 9: "geneva-9", 10: "geneva-10", 12: "geneva-12" } },
];
const SIZES = [9, 10, 12] as const;

/** Where a document came from, which decides what Save does. */
type Origin =
  /** New: Save asks for a name first. */
  | "new"
  /** A sample, a file from disk or a name the reader gave: Save
   * downloads it under its name. */
  | "named";

interface OpenDocument {
  name: string;
  origin: Origin;
  mode: TextViewMode;
  /** The sample it came from, if any. */
  readonly id: DocumentId | null;
  /** The text as opened or last saved: the document has changes while
   * the view's text differs, so undoing back to it leaves none. */
  saved: string;
}

export function buildEditor(content: HTMLElement,
                            env: WindowEnv): WindowContent {
  const host = el("div", "edt");
  content.append(host);
  let doc: OpenDocument | null = null;

  const view = mountTextView(host, {
    label: UNTITLED,
    maxLength: TEXTEDIT_MAX,
    onLimit: () => void alert({
      kind: "stop",
      message: `“${doc?.name ?? UNTITLED}” can’t hold any more text.`,
      explanation: "A Foolscap document holds up to 32,767 characters, " +
        "as much as TextEdit can.",
    }),
    onRejectedEdit: () => void alert({
      kind: "stop", modality: "movable",
      message: `“${doc?.name ?? ""}” is a read-only document.`,
      explanation: "You can scroll it, select its text and copy it, but " +
        "you can’t change it.",
    }),
  });
  attachBalloon(view.textarea, { trigger: env.balloons, tip: "pointer",
    content: () => view.mode === "read-only"
      ? "Read-only text\n\nThis document can’t be changed. Drag across " +
        "text to select it, then copy it with the Edit menu."
      : "Document text\n\nType here. Drag across text to select it, or " +
        "double-click a word. The Edit menu undoes your last change." });

  // ---- alerts ---------------------------------------------------------------

  let alertUp = false;
  /** An alert over the document window. One at a time: a key held down
   * in a read-only document would otherwise stack them. */
  async function alert(opts: AlertOptions): Promise<string> {
    if (alertUp) return "dismissed";
    alertUp = true;
    const parent = env.window();
    try {
      return await showAlert({
        ...opts, ...(parent ? { parent } : {}),
        onBeep: () => beep(BEEP_VOLUME),
      }).result;
    } finally {
      alertUp = false;
    }
  }

  /** Say that the browser refused the clipboard, rather than pretend. */
  function clipboardFailed(err: unknown, keys: string): void {
    void alert({
      kind: "note",
      message: err instanceof Error ? err.message
                                    : "The clipboard isn’t available.",
      explanation: `Use the keyboard instead (${keys}): the browser’s ` +
        "own clipboard commands need no permission.",
    });
  }

  /** The document window, for a dialog to draw inactive while it's up
   * (only while the window is shown: Open… comes with no document). */
  function parentOf(): { parent?: OsmiumWindow } {
    const w = env.window();
    return w && doc ? { parent: w } : {};
  }

  // ---- documents ------------------------------------------------------------

  function show(next: Omit<OpenDocument, "saved">, text: string): void {
    view.setText(text);
    doc = { ...next, saved: view.text };
    view.setMode(next.mode);
    view.textarea.setAttribute("aria-label", next.name);
    env.window()?.setTitle(next.name);
    env.show?.();
    view.focus();
  }

  const newDocument = () => show({
    name: UNTITLED, origin: "new", mode: "editable", id: null,
  }, "");

  function openSample(id: DocumentId): void {
    const d = DOCUMENTS[id];
    show({ name: d.name, origin: "named", mode: d.mode, id }, d.text);
  }

  /** Download the text as `<name>.txt`. The browser decides where the
   * file goes (or asks); the demo can't tell whether it was kept. */
  function download(name: string): void {
    const url = URL.createObjectURL(
      new Blob([view.text], { type: "text/plain;charset=utf-8" }));
    const a = el("a");
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Save: resolves to whether the document was saved. */
  async function save(): Promise<boolean> {
    if (!doc || doc.mode === "read-only") return false;
    if (doc.origin === "new") return saveAs();
    download(doc.name);
    doc.saved = view.text;
    return true;
  }

  function saveAs(): Promise<boolean> {
    const current = doc;
    if (!current || current.mode === "read-only") return Promise.resolve(false);
    return new Promise((resolve) => {
      const dlg = openDialog({ title: "Save As", width: 321, height: 161,
                               ...parentOf(), onBeep: () => beep(BEEP_VOLUME) });
      const root = el("div", "dlg-save");
      const label = el("label", "osm-system dlg-save-label",
                       "Save this document as:");
      const field = el("input", "osm-edit dlg-save-name");
      field.id = "dlg-save-name";
      label.htmlFor = field.id;
      field.value = current.origin === "new" ? UNTITLED : current.name;
      field.spellcheck = false;
      const note = el("p", "osm-caption dlg-save-note",
        "Foolscap saves by downloading a text file. Your browser decides " +
        "where it goes.");
      const cancel = button("Cancel", "dlg-save-cancel");
      const ok = button("Save", "osm-default dlg-save-ok");
      root.append(label, field, note, cancel, ok);
      dlg.content.append(root);
      const done = (saved: boolean) => { dlg.close(); resolve(saved); };
      const accept = () => {
        const name = field.value.trim();
        if (!name) { beep(BEEP_VOLUME); return; }
        download(name);
        current.name = name;
        current.origin = "named";
        current.saved = view.text;
        view.textarea.setAttribute("aria-label", name);
        env.window()?.setTitle(name);
        done(true);
      };
      pushButton(ok, accept);
      pushButton(cancel, () => done(false));
      dlg.bindKeys(ok, cancel, { ok: accept, cancel: () => done(false) });
      field.focus();
      field.select();
    });
  }

  /** Whether the open document may go: asks about unsaved changes. */
  async function mayClose(): Promise<boolean> {
    if (!doc || view.text === doc.saved) return true;
    const r = await alert({
      kind: "caution",
      message: `Do you want to save the changes you made to “${doc.name}”?`,
      explanation: "If you don’t save them, they will be lost.",
      buttons: { ok: "Save", cancel: "Cancel", other: "Don’t Save" },
    });
    if (r === "ok") return save();
    return r === "other";
  }

  /** Close the document and its window; resolves to whether it did. */
  async function close(): Promise<boolean> {
    if (!(await mayClose())) return false;
    doc = null;
    view.setText("");
    env.close();
    return true;
  }

  async function quit(): Promise<void> {
    if (doc && !(await close())) return;
    env.quit?.();
  }

  async function launch(id?: DocumentId): Promise<void> {
    if (!id) {
      if (doc) env.show?.();
      else newDocument();
      return;
    }
    if (doc?.id === id) { env.show?.(); return; }
    if (doc) {
      env.show?.();
      if (!(await mayClose())) return;
    }
    openSample(id);
  }

  // ---- the Open dialog ------------------------------------------------------
  // Standard File's list of documents, reduced to the demo's samples, and
  // From Disk… for a text file of the reader's own.

  function openFromDisk(file: File): void {
    void file.text().then((text) => {
      if (text.length > TEXTEDIT_MAX) {
        void alert({ kind: "stop",
          message: `“${file.name}” is too long for Foolscap.`,
          explanation: `It has ${text.length.toLocaleString("en-US")} ` +
            "characters; a Foolscap document holds up to 32,767." });
        return;
      }
      show({ name: file.name.replace(/\.txt$/i, ""), origin: "named",
             mode: "editable", id: null }, text);
    }, () => void alert({ kind: "stop",
      message: `“${file.name}” couldn’t be read.` }));
  }

  function openDialogBox(): void {
    const ids = Object.keys(DOCUMENTS) as DocumentId[];
    const dlg: DemoDialog = openDialog({ title: "Open", width: 341,
      height: 201, ...parentOf(), onBeep: () => beep(BEEP_VOLUME) });
    const root = el("div", "dlg-open");
    const listEl = el("div", "dlg-open-list");
    const disk = button("From Disk…", "dlg-open-disk");
    const cancel = button("Cancel", "dlg-open-cancel");
    const ok = button("Open", "osm-default dlg-open-ok");
    const file = el("input", "dlg-open-file");
    file.type = "file";
    file.accept = ".txt,text/plain";
    file.tabIndex = -1;
    file.setAttribute("aria-hidden", "true");
    root.append(listEl, el("div", "osm-separator dlg-open-rule"), disk,
                cancel, ok, file);
    dlg.content.append(root);

    const accept = () => {
      const id = ids[list.selected];
      if (!id) return;
      dlg.close();
      openSample(id);
    };
    const list = mountList(listEl, {
      rowHeight: 16, label: "Documents", onOpen: accept,
    });
    list.setRows(ids.map((id) => {
      const row = el("div", "dlg-open-row", DOCUMENTS[id].name);
      row.dataset["name"] = DOCUMENTS[id].name;
      row.style.setProperty("--dlg-icon", sprite("small-text"));
      return row;
    }), { keep: 0 });
    pushButton(ok, accept);
    pushButton(cancel, () => dlg.close());
    pushButton(disk, () => file.click());
    file.addEventListener("change", () => {
      const f = file.files?.[0];
      if (!f) return;
      dlg.close();
      openFromDisk(f);
    });
    dlg.bindKeys(ok, cancel, { ok: accept, cancel: () => dlg.close() });
    listEl.focus();
  }

  // ---- menus ----------------------------------------------------------------

  const editable = () => doc?.mode === "editable";
  /** The keyboard's Cut, Copy and Paste stay the browser's while the
   * text has the keyboard; the menu items use the text view's. */
  const clipboardKeys = () =>
    document.activeElement === view.textarea ? "browser" as const
                                             : "action" as const;
  const when = (on: boolean, action: () => void) => on ? { action } : {};

  function family() {
    return FAMILIES.find((f) => Object.values(f.sizes).includes(view.font))!;
  }
  function size(): number {
    return Number(Object.entries(family().sizes)
      .find(([, f]) => f === view.font)![0]);
  }

  function menus(): readonly Menu[] {
    return [
      { title: "File", items: (): MenuEntry[] => [
        { title: "New", key: "N", ...when(!doc, newDocument) },
        { title: "Open…", key: "O", ...when(!doc, openDialogBox) },
        MENU_SEPARATOR,
        { title: "Close", key: "W", ...when(!!doc, () => void close()) },
        { title: "Save", key: "S", ...when(editable(), () => void save()) },
        { title: "Save As…", ...when(editable(), () => void saveAs()) },
        MENU_SEPARATOR,
        { title: "Quit", key: "Q", action: () => void quit() },
      ] },
      { title: "Edit", items: (): MenuEntry[] => {
        const sel = !!doc && view.hasSelection;
        const keys = clipboardKeys();
        const mod = /Mac|iPhone|iPad/.test(navigator.platform)
          ? "Command" : "Control";
        return [
          { title: "Undo", key: "Z",
            ...when(editable() && view.canUndo, () => view.undo()) },
          MENU_SEPARATOR,
          { title: "Cut", key: "X", keyDispatch: keys,
            ...when(editable() && sel, () => void view.cut().catch(
              (e: unknown) => clipboardFailed(e, `${mod}-X`))) },
          { title: "Copy", key: "C", keyDispatch: keys,
            ...when(sel, () => void view.copy().catch(
              (e: unknown) => clipboardFailed(e, `${mod}-C`))) },
          { title: "Paste", key: "V", keyDispatch: keys,
            ...when(editable(), () => void view.paste().catch(
              (e: unknown) => clipboardFailed(e, `${mod}-V`))) },
          { title: "Clear", ...when(editable() && sel, () => view.clear()) },
          MENU_SEPARATOR,
          { title: "Select All", key: "A",
            ...when(!!doc, () => view.selectAll()) },
        ];
      } },
      { title: "Font", items: () => FAMILIES.map((f) => ({
        title: f.name, checked: f === family(),
        ...when(!!doc && editable(), () => {
          view.setFont(f.sizes[size()] ?? f.sizes[12]!);
        }),
      })) },
      { title: "Size", items: () => SIZES.map((n) => {
        const target = family().sizes[n];
        return {
          title: String(n), checked: n === size(),
          ...(target && doc && editable()
            ? { action: () => view.setFont(target) } : {}),
        };
      }) },
      { title: "Help", items: () => [
        balloonMenuItem(),
        MENU_SEPARATOR,
        { title: "Foolscap Read Me", action: () => void launch("readme") },
      ] },
    ];
  }

  // A one-window page has no menu bar and no desktop: it is a new
  // document from the start.
  if (!env.show) newDocument();

  return {
    focus: () => view.focus(),
    // The zoom box fills the desktop (the desktop keeps the window on
    // screen, inside its margins).
    standardSize: (): Size => ({ w: window.innerWidth, h: window.innerHeight }),
    requestClose: () => void close(),
    app: {
      name: "Foolscap",
      about: () => void alert({
        kind: "plain", icon: "icon-foolscap",
        message: "Foolscap 1.0",
        explanation: "A plain text editor in the manner of TeachText, " +
          "built on Osmium UI’s text view. One document at a time, Geneva " +
          "12, up to 32,767 characters.",
      }),
      menus,
      launch: (id) => void launch(id),
    },
  };
}

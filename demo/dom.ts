// Small DOM helpers shared by the demo's windows.

/** A new element with an optional class list and text. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** A push button (type=button, so it never submits anything). */
export function button(title: string, cls = ""): HTMLButtonElement {
  const b = el("button", `osm-button ${cls}`.trim(), title);
  b.type = "button";
  return b;
}

/** A labeled checkbox; the label is the control's hit area. */
export function checkbox(title: string, checked: boolean): HTMLLabelElement {
  const label = el("label", "osm-checkbox");
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  label.append(input, title);
  return label;
}

/** Keyboard-style slider parts: caption above, ticked track, end
 * captions below. Returns the unit and its range input (0..100). */
export function slider(title: string, ends: readonly [string, string],
                       value: number): { unit: HTMLElement;
                                         input: HTMLInputElement } {
  const unit = el("div", "demo-slider");
  const input = el("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.value = String(value);
  input.id = `slider-${++sliderSeq}`;
  const label = el("label", "osm-caption demo-slider-title", title);
  label.htmlFor = input.id;
  const track = el("div", "osm-slider");
  track.append(input);
  const endsRow = el("div", "osm-caption demo-slider-ends");
  endsRow.setAttribute("aria-hidden", "true");
  endsRow.append(el("span", "", ends[0]), el("span", "", ends[1]));
  unit.append(label, track, endsRow);
  return { unit, input };
}
let sliderSeq = 0;

/** A titled group box. */
export function group(title: string, cls = ""): HTMLElement {
  const box = el("div", `osm-group ${cls}`.trim());
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", title);
  box.append(el("div", "osm-group-title", title));
  return box;
}

/** A progress bar showing `value` (0..1). */
export function progress(value: number): { bar: HTMLElement;
                                           set(v: number): void } {
  const bar = el("div", "osm-progress");
  const track = el("div", "osm-progress-track");
  track.append(el("div", "osm-progress-fill"));
  bar.append(track);
  const set = (v: number) =>
    bar.style.setProperty("--osm-value", String(Math.min(1, Math.max(0, v))));
  set(value);
  return { bar, set };
}

/** Eat the click that follows a press, so a press that only closed a
 * menu or activated a window can't also press what was under it. */
export function swallowClick(): void {
  const eat = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
    done();
  };
  const done = () => {
    document.removeEventListener("click", eat, true);
    document.removeEventListener("pointerdown", done, true);
  };
  document.addEventListener("click", eat, true);
  // A press that never becomes a click mustn't eat the next one.
  setTimeout(() => document.addEventListener("pointerdown", done, true));
}

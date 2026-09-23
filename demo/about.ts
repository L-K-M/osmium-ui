// "About Osmium UI": an information window laid out like Get Info. The
// icon and name at the top, then bold labels on a shared right edge
// with their values (the kit's .osm-fields), then a short description.
import { el } from "./dom.js";
import { sprite } from "./icons.js";
import type { WindowContent } from "./windows.js";

/** Set at build time from package.json (demo/build.mjs). */
declare const OSMIUM_VERSION: string;

const FIELDS: readonly [label: string, value: string][] = [
  ["Kind", "user interface kit"],
  ["Version", OSMIUM_VERSION],
  ["License", "The Unlicense (public domain)"],
  ["Fonts", "Charcoal 12, Geneva 10, Geneva 9"],
  ["Where", "github.com/L-K-M/osmium-ui"],
];

export function buildAbout(content: HTMLElement): WindowContent {
  const root = el("div", "abt");
  const head = el("div", "abt-head");
  const icon = el("div", "abt-icon");
  icon.style.backgroundImage = sprite("icon-osmium");
  head.append(icon, el("div", "osm-system abt-name", "Osmium UI"));
  const fields = el("div", "osm-fields abt-fields");
  for (const [label, value] of FIELDS)
    fields.append(el("span", "osm-label", `${label}:`), el("span", "", value));
  root.append(head, el("div", "osm-separator"), fields,
              el("p", "abt-text", "The Mac OS 8 look for web pages, pixel " +
                 "for pixel, and a native window host for WKWebView apps."));
  content.append(root);
  return {};
}

// Osmium UI: the Mac OS 8 look for web pages, pixel for pixel. Link
// osmium.css, then build windows and controls with these functions;
// installOsmium() (called by mountWindow and the controls) registers
// the bitmap fonts and sprites the stylesheet draws with.
export { installOsmium, registerSprites } from "./install.js";
export { spriteSvg, spriteUrl } from "./sprites.js";
export type { Palette } from "./sprites.js";
export { mountWindow } from "./window.js";
export type { Activation, OsmiumWindow, WindowOptions } from "./window.js";
export { hostWindow } from "./host.js";
export type {
  EscapeKey, HostOptions, HostedWindow, Size, WindowOp,
} from "./host.js";
export {
  attachScrollbar, bindDialogKeys, centerText, fitButton, mountList,
  mountPopup, pushButton, setButtonTitle, setEnabled, trackHighlight,
  trackPress,
} from "./controls.js";
export type {
  ListOptions, ListScroll, OsmiumList, Popup, PopupOptions, Scrollbar,
  SetRowsOptions,
} from "./controls.js";

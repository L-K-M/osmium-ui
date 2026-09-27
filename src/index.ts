// Osmium UI: the Mac OS 8 look for web pages, pixel for pixel. Link
// osmium.css, then build windows and controls with these functions;
// installOsmium() (called by mountWindow and the controls) registers
// the bitmap fonts and sprites the stylesheet draws with.
export { installOsmium, registerSprites } from "./install.js";
export { spriteSvg, spriteUrl } from "./sprites.js";
export type { Palette } from "./sprites.js";
export type { SpriteAccent } from "./install.js";
export {
  HIGHLIGHTS_85, VARIATIONS_85, getAppearance, nearestAccent, setAppearance,
} from "./appearance.js";
export type {
  Accent80, AccentChoice, Appearance, AppearanceRelease, Highlight80,
  Highlight85, HighlightChoice, Variation85,
} from "./appearance.js";
export { mountWindow } from "./window.js";
export type { Activation, OsmiumWindow, WindowOptions } from "./window.js";
export { hostWindow } from "./host.js";
export type {
  EscapeKey, HostOptions, HostedWindow, Size, WindowOp,
} from "./host.js";
export {
  MENU_SEPARATOR, attachScrollbar, bindDialogKeys, centerText, fitButton,
  mountList, mountPopup, pushButton, setButtonTitle, setEnabled,
  trackHighlight, trackPress,
} from "./controls.js";
export type {
  ListOptions, ListScroll, ListScrollbars, MenuSeparator, OsmiumList, Popup,
  PopupItem, PopupOptions, ScrollAxis, Scrollbar, SetRowsOptions,
} from "./controls.js";
export { mountListView } from "./listview.js";
export type {
  ColumnAlign, ColumnResize, ListLoadState, ListRowIcon, ListViewColumn,
  ListViewOptions, ListViewScroll, ListViewSort, OsmiumListView, RowHighlight,
  RowRendering, SelectMode, SetListViewRowsOptions, SortDirection, SortOrder,
  SortOrderButton,
} from "./listview.js";
export { mountMenuBar } from "./menubar.js";
export type {
  CommandKey, KeyDispatch, Menu, MenuBarOptions, MenuEntry, MenuItem,
  OsmiumMenuBar,
} from "./menubar.js";
export { showContextMenu } from "./contextmenu.js";
export type {
  ContextMenuOptions, MenuPoint, OsmiumContextMenu,
} from "./contextmenu.js";
export { mountTabs } from "./tabs.js";
export type { OsmiumTabs, TabsOptions } from "./tabs.js";
export { mountTextArea } from "./edittext.js";
export type { OsmiumTextArea } from "./edittext.js";
export { mountTextView } from "./textview.js";
export type {
  OsmiumTextView, TextViewFont, TextViewMode, TextViewOptions,
} from "./textview.js";
export {
  attachBalloon, balloonHelp, balloonMenuItem, onBalloonHelpChange,
  setBalloonHelp,
} from "./balloon.js";
export type {
  BalloonContent, BalloonHelpState, BalloonOptions, BalloonTip,
  BalloonTrigger, BalloonVariant, OsmiumBalloon,
} from "./balloon.js";
export { isModal, onModalChange } from "./modal.js";
export { showAlert } from "./alert.js";
export type {
  AlertButton, AlertButtons, AlertKind, AlertModality, AlertOptions,
  AlertPosition, AlertResult, OsmiumAlert,
} from "./alert.js";

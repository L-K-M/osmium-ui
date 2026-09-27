# Changelog

## Unreleased

- Add alert boxes (`showAlert`): stop, caution and note alerts with a
  message, an optional explanation and up to three buttons, which hold
  the page until a button is pressed. Return and Enter press the
  default button, Escape and Command-period the cancel button, and Tab
  stays inside the alert; the page behind is inert, menu bar titles dim
  and the parent window draws inactive. The frame, the stop and caution
  icons and the layout are measured from Mac OS 8.0's Finder alerts
  (Chromium's rendering of both matches the captures pixel for pixel),
  and the placement from its Stickies, Process Manager and AppleCD
  Audio Player alerts. Not captured from a running system: the movable
  alert's title bar and the note icon come from the Mac OS 8 HIG's
  figures, and StandardAlert's own layout was never seen, so the
  explanation's spacing, the third button's place, button widths past
  59px and the growth rules are derived. Unlike Mac OS 8.0, menu bar
  icon titles keep their colors, the Help menu doesn't stay enabled,
  movable alerts drag live rather than as an outline, and no sound
  plays (`onBeep` is the hook). The demo has an Alerts window, also as
  a one-window page, and Special > Empty Trash….
- `bindDialogKeys` returns a function that removes its key handling.
- The native window host clips each window to its outline and drop
  shadow, so WebKit's white backdrop no longer shows as a stray pixel
  beside the shadow's ends (top right and bottom left).
- Add tab controls (`mountTabs`), measured from Mac OS 8.5's
  Appearance control panel: slanted Platinum tabs over a pane that
  shows one panel at a time, following the WAI-ARIA tabs pattern. The
  demo has a tabbed Appearance window. Pressed tabs and tabs in an
  inactive window weren't captured, so they keep the normal look.
- Add horizontal scroll bars: `attachScrollbar` takes an axis, and
  `mountList` a `scrollbars: "both"` option and a `header` whose column
  headers scroll sideways with the rows. The demo's Finder scrolls
  sideways when narrow instead of truncating its columns.
- Add menu separators (`MENU_SEPARATOR`) to pop-up menus, and the menu
  bar (`mountMenuBar`), which moves into the kit from the demo.
- Center bevel button icons, so bevel buttons can be wider than 40px,
  such as Desktop Pictures' 54 x 40 pane buttons.
- Lists no longer select a row when a tap only stops a scroll on a
  touch screen.
- Prepare the Swift window host and the demo app for Swift 6: they are
  explicitly main-actor isolated, and CI builds them in Swift 6
  language mode.
- Import the Mac OS 8 appearance kit from Finsical as Osmium UI: document
  windows with titlebar boxes, pinstripes, grow box and windowshade, plus
  the full control set, pixel-faithful in HTML and CSS.
- Ship the classic behaviour: mouse tracking, default-button pulses, and
  the rest of the interaction model from Mac OS 8.
- Add `osmium.css` with the one-window page layout and the demo pages:
  desktop, controls, Finder list view, control panel and About window.
- Add the Swift package (`macos/OsmiumWindows.swift`) wrapping the web UI
  for WKWebView apps, and a demo macOS app.
- Add pixel fonts (Geneva 9/10, Charcoal 12) as TypeScript data.
- Add CI (web checks on Ubuntu, SwiftPM compile and demo build on macOS).

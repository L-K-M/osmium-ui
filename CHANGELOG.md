# Changelog

## Unreleased

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

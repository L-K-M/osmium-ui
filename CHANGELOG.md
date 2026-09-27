# Changelog

## Unreleased

- Add list views (`mountListView`): a Finder list view over any data,
  with column headers that pick the sort column, a sort order that
  applies to the whole list (normal or reversed, as Finder 8.1's), the
  sort order button above the vertical scroll bar, optional column
  resizing by the header dividers (Finder 8.5), small icons with
  accessible labels, app classes per row, controls inside cells, empty
  and loading placeholders, and `contentHeight` for resize to fit. Rows
  are keyed: `setRows` keeps each row's elements, its cells' nodes, the
  selection and the reader's place, and holds updates back while a
  press in the rows lasts. Keyboard: arrows, Home, End, Page keys,
  Return, Space for the selected row's control, and type-select that
  takes spaces. Screen readers get a grid with a status placeholder.
  The sort order button is measured from Mac OS 9.0 (Finder and
  Sherlock 2 agree pixel for pixel, and its 16th column is the list's
  black edge, as in the Finder); no 8.x list view capture was found.
  Not captured and approximated: the reversed button (the pyramid
  upside down, its steps keeping their shading), pressed headers and
  button (not drawn pressed), the divider's hit zone, cursor and
  narrowest width. Not Mac OS 8: `grow` widths, the placeholders, icon
  headers, Home, End and Page keys moving the selection, and a mouse
  drag moving the one selected row where the Finder selects a group.
  Measured with `osmium.css` at 4096 rows of six columns, every row in
  the DOM took Chromium 10 ms and WebKit 24 ms per inserted row and 0.2
  s and 0.7 s to reorder; above 1000 rows only the rows near the view
  get elements, which brings 4096 rows to 2 to 5 ms per insert and
  about 30 ms per reorder in Chromium, WebKit and Firefox, at the cost
  of find-in-page (`rendering: "all"` keeps every row).
- Add edit text: `<input class="osm-edit">` draws the Platinum field
  (22px, or 20px with `osm-compact`) with its bevel, the lavender focus
  ring and the Black & White text highlight, and
  `<div class="osm-edit-area">` frames a multi-line `<textarea>`, to
  which `mountTextArea` adds a scroll bar. Measured from Mac OS 8.0
  Find File in an emulator (active and inactive) and Mac OS 9.0 Date
  Formats (focus ring). The disabled look wasn't captured and copies
  the inactive one; the bevel's top-right and bottom-left pixels are
  left open where Find File draws them gray; the caret sits one pixel
  right of TextEdit's; the selection doesn't run on to the field's
  right edge. A dimmed text area's scroll bar is blank and edged in
  the frame's gray, not captured either; labels beside fields stay
  black in an inactive window, where Mac OS 8.0 dims them. Placeholder
  text is an addition Mac OS 8 didn't have. The demo has a File
  Sharing window.
- `setEnabled` takes text fields and text areas.
- `bindDialogKeys` passes Return, Enter and Escape typed in a one-line
  edit text (`input.osm-edit`) on to the dialog's buttons, as the
  Dialog Manager does, unless the field's own handler calls
  `preventDefault()` or an input method is composing. Other text
  fields and text areas keep their keys, as before.
- Edit text shows its focus ring on any focus, not only while you use
  the keyboard: the ring marks where typing goes.
- Add Balloon Help (`attachBalloon`, `setBalloonHelp`, `balloonHelp`,
  `onBalloonHelpChange` and `balloonMenuItem` for a Help menu's Show
  Balloons / Hide Balloons). The balloon's body, its eight tails, its
  Geneva 9 text layout and its golden-ratio sizing are measured from
  Mac OS 8.0 in an emulator; rendered balloons match 13 captures with 0
  differing pixels. Not Mac OS: a `"hover"` trigger for apps without a
  Help menu, keyboard-focus balloons and Escape. Approximations: the
  order variants are tried in, the `"pointer"` tip, and the styling of
  rich (Node) content, including its synthesized bold Geneva 9, which
  `installOsmium` now registers. The sizing doesn't reproduce the Hide
  Balloons item's own balloon. The demo desktop has a Help menu and
  balloons on its controls, windows and icons.
- Add alert boxes (`showAlert`): stop, caution and note alerts with a
  message, an optional explanation and up to three buttons, which hold
  the page until a button is pressed. Return and Enter press the
  default button, Escape and Command-period the cancel button, and Tab
  stays inside the alert; the page behind is inert, menu bar titles dim
  and the parent window draws inactive. The frame, the stop and caution
  icons and the layout are measured from Mac OS 8.0's Finder alerts
  (Chromium's rendering of both, with grayscale text antialiasing,
  matches the captures pixel for pixel),
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

// Foolscap's sample documents: the demo's Read Me, which is read-only
// like SimpleText's ttro documents, and two ordinary documents for the
// Open dialog. Geneva 12 was captured for ASCII and a few punctuation
// marks only (src/fonts/geneva12.ts), so the texts keep to those: no
// command key symbol, no accented letters.
import type { TextViewMode } from "../src/index.js";

export type DocumentId = "readme" | "pancakes" | "letter";

export interface SampleDocument {
  readonly name: string;
  readonly mode: TextViewMode;
  readonly text: string;
}

const README = `Welcome to the Osmium UI demo

This is a Read Me. Like the read-only documents SimpleText showed in Mac OS 8, you can read it, scroll it, select its text and copy it, but not change it: try typing, and Foolscap tells you so. To write something of your own, choose Quit from the File menu, then double-click the Foolscap icon on the desktop.

Everything on this screen is drawn by Osmium UI, a kit that recreates the Mac OS 8 look pixel for pixel in HTML and CSS. Here is where to find each part of it.

Windows
Drag a window by its title bar. The close box (left) puts it away; its desktop icon brings it back. The collapse box (far right) folds it up to its title bar. The Osmium HD and Foolscap windows also have a zoom box and a grow box in their bottom-right corner. Windows behind the front one draw inactive: gray frame, no stripes, no boxes. A click in one brings it forward. Special > Clean Up puts every window back where it started.

The menu bar
Menus stay open after a click and follow the pointer, or you can drag to an item and let go. Items with a keyboard equivalent show it at the right: hold down the Command key (Control on Windows and Linux) and type the letter. While a Foolscap window is in front, the menu bar holds Foolscap's own menus; click the desktop or another window and the Finder's come back. The crystal at the left end of the menu bar is the Apple menu: it lists every window in the demo, whichever application is in front.

Balloon Help
Choose Show Balloons from the Help menu, then rest the pointer on a control, a window's title bar or a desktop icon. Choose Hide Balloons to stop.

Controls (desktop icon: Controls)
Push buttons with the default button's ring, checkboxes, sliders with tick marks, a progress bar the Level slider drives, an indeterminate progress bar, a pop-up menu, and the three bitmap fonts: Charcoal 12, Geneva 10 and Geneva 9. Return presses OK and Escape presses Cancel, each flashing its button.

Control Panel (desktop icon: Control Panel)
Bevel buttons down the left switch panes. The Desktop pane has a list box of patterns (type a name to jump to it) and Set Desktop paints the desktop. Monitor has two list boxes and a pop-up; Picture has sliders in group boxes.

Appearance (desktop icon: Appearance)
Tabs, as in Mac OS 8.5's Appearance control panel. The Variation and Highlight Color pop-ups really work: they recolor menus, scroll bars, sliders, progress bars, focus rings and selections everywhere on the page.

File Sharing (desktop icon: File Sharing)
Edit text: labeled fields, a password field, a short field beside a pop-up menu that dims with its checkbox, and a message area with its own scroll bar. Return in a one-line field presses OK.

Alerts (desktop icon: Alerts)
Stop, caution and note alerts, a plain one with the application's icon, a three-button Save Changes alert, a movable alert and one whose long text makes it grow. Special > Empty Trash... puts up the Finder's caution alert. While an alert is up nothing else on the page responds.

Osmium HD (desktop icon: Osmium HD)
A Finder list view. Click a column header to sort by it; the button above the scroll bar reverses the order. Drag the lines between headers to resize columns. The selected name takes the highlight color, as in the Finder. Type a name to select it, and double-click an item to open it. Make the window narrow and the list scrolls sideways, headers and all.

Foolscap (desktop icon: Foolscap)
A small text editor in the manner of TeachText, built on Osmium UI's text view. Its text is Geneva 12 on 16-pixel lines, wraps to the window and rewraps as you resize it. It holds one document at a time. Undo takes back your last change, and choosing it again redoes it. Cut, Copy and Paste in the Edit menu use the clipboard as far as your browser allows; the keyboard equivalents always work. Paste from the menu may ask for your permission. Save downloads your document as a text file, since a web page can't write to your disk. Open... offers sample documents and text files from your disk. The Font and Size menus switch between the bitmap fonts Osmium UI has. A document holds up to 32,767 characters, TextEdit's own limit. Click another window and look at this one: the selection turns into an outline, as TextEdit draws it.

About Osmium UI (desktop icon: About Osmium UI)
An information window laid out like Get Info.

On a Mac, the same windows also run as native windows: make -C demo/macos run.

Osmium UI is public domain. Mac OS, Charcoal and Geneva are trademarks of Apple Inc.; Osmium UI is not affiliated with Apple.
`;

const PANCAKES = `Pancakes

1 cup flour
2 tablespoons sugar
2 teaspoons baking powder
a pinch of salt
1 cup milk
1 egg
2 tablespoons melted butter

Whisk the dry things together. Beat the milk, egg and butter, pour them in and stir just until the flour is wet; a few lumps are fine. Let it rest for five minutes.

Heat a pan over medium heat and butter it. Pour in a quarter cup of batter for each pancake. Turn it when bubbles cover the top and the edges look dry, and cook the other side until golden.
`;

const LETTER = `Dear Sam,

Thank you for the postcard from the coast. The lighthouse looks just the way you described it, and the fish on the stamp made everyone here laugh.

The aquarium is doing well. The new filter is quiet, the snails have multiplied, and the angelfish has decided that the castle belongs to her alone.

Write again soon, and bring the photographs when you visit.

Yours,
Alex
`;

export const DOCUMENTS: Readonly<Record<DocumentId, SampleDocument>> = {
  readme: { name: "Read Me", mode: "read-only", text: README },
  pancakes: { name: "Pancakes", mode: "editable", text: PANCAKES },
  letter: { name: "Letter to Sam", mode: "editable", text: LETTER },
};

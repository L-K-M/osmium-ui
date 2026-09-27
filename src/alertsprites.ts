// Mac OS 8 alert icons, 32 x 32, in sprites.ts's palette keys ('.' is
// transparent). The stop and caution icons were captured from Mac OS
// 8.0 running in Infinite Mac (infinitemac.org, "Mac OS 8.0", a 640 x
// 480 screen at 1:1), gamma-corrected back to the Mac palette; the
// note icon comes from the Mac OS 8 Human Interface Guidelines.
// alert.ts shows each as its alert kind's icon.

// Finder, a duplicate-name alert: icon at screen x 156..187, y
// 100..131. Identical in a Stickies 1.0 alert (x 193..224, y 95..126)
// and in HIG figure 3-8. The Process Manager's "needs a PowerPC"
// alert draws a different 30 x 30 stop icon, not used here.
const ALERT_STOP = [
  "........RRRRRRRRRRRRRRRR........",
  ".......RRPPPPPPPPPPPPPPRM.......",
  "......RRPRRRRRRRRRRRRRRRRM......",
  ".....RRPRRRRRRRRRRRRRRRRRRM.....",
  "....RRPRRRRRRRYkRRRRRRRRRRRM....",
  "...RRPRRRRRRRRKkRRRRRRRRRRRRM...",
  "..RRPRRRRRRYkRKkRYkRRRRRRRRRRM..",
  ".RRPRRRRRRRKkRKkRKkRRRRRRRRRRRM.",
  "RRPRRRRRRRRKkRKkRKkRRRRRRRRRRRMN",
  "RPRRRRRRYkRKkRKkRKkRRRRRRRRRRRMN",
  "RPRRRRRRKkRKkRKkRKkRRRRRRRRRRRMN",
  "RPRRRRRRKkRKkRKkRKkRRRRRRRRRRRMN",
  "RPRRRRRRKkRKkRKkRKkRRRRRRRRRRRMN",
  "RPRRRRRRKkRKkRKkRKkRRRRRRRRRRRMN",
  "RPRRRRRRKkRKkKYkKYkRRRRkKRRRRRMN",
  "RPRRRRRRKkKYKKKKKKkRRRkYkRRRRRMN",
  "RPRRRRRRKKKKKKKKKKkkRkYkkRRRRRMN",
  "RPRRRRRRKKKKKKKKKKKkkKKkRRRRRRMN",
  "RPRRRRRRKKKKKKKKKKKKKKkkRRRRRRMN",
  "RPRRRRRRKKKKKKKKKKKKKKkRRRRRRRMN",
  "RPRRRRRRKKKKKKKKKKKKKkkRRRRRRRMN",
  "RPRRRRRRkKKKKKKKKKKKKkRRRRRRRRMN",
  "RPRRRRRRkKKKKKKKKKKKkkRRRRRRRRMN",
  "RPRRRRRRRKKKKKKKKKKKkRRRRRRRRRMN",
  "fRRRRRRRRkKKKKKKKKKkkRRRRRRRRMNf",
  ".fMRRRRRRRkKKKKKKKkkRRRRRRRRMNf.",
  "..fMRRRRRRRkkkkkkkkRRRRRRRRMNf..",
  "...fMRRRRRRRRRRRRRRRRRRRRRMNf...",
  "....fMRRRRRRRRRRRRRRRRRRRMNf....",
  ".....fMRRRRRRRRRRRRRRRRRMNf.....",
  "......fMRMMMMMMMMMMMMMMMNf......",
  ".......fMNNNNNNNNNNNNNNNf.......",
];

// Finder, the Empty Trash alert: icon at screen x 156..187, y
// 100..131. Identical in an AppleCD Audio Player alert (x 180..211, y
// 97..128), in the Chooser's AppleTalk dialog on a white face (so the
// transparent pixels are the mask's), in HIG figures 3-4 and 3-7, and
// in a Mac OS 9.0 logout alert (guidebookgallery.org).
const ALERT_CAUTION = [
  "...............00...............",
  "..............0000..............",
  "..............0880..............",
  ".............00yf00.............",
  ".............08yf80.............",
  "............00yfyk00............",
  "............08yfyy80............",
  "...........00yfyyyk00...........",
  "...........08yfyyyy80...........",
  "..........00yfyyyyyk00..........",
  "..........08yf8448yy80..........",
  ".........00yfy4004yyk00.........",
  ".........08yfy0000yyy80.........",
  "........00yfyy0000yyyk00........",
  "........08yfyy0000yyyy80........",
  ".......00yfyyy0000yyyyk00.......",
  ".......08yfyyy0000yyyyy80.......",
  "......00yfyyyy0000yyyyyk00......",
  "......08yfyyyy0000yyyyyy80......",
  ".....00yfyyyyy4004yyyyyyk00.....",
  ".....08yfyyyyy8008yyyyyyy80.....",
  "....00yfyyyyyyy44yyyyyyyyk00....",
  "....08yfyyyyyyyyyyyyyyyyyy80....",
  "...00yfyyyyyyyyyyyyyyyyyyyk00...",
  "...08yfyyyyyyy8008yyyyyyyyy80...",
  "..00yfyyyyyyyy0000yyyyyyyyyk00..",
  "..08yfyyyyyyyy0000yyyyyyyyyy80..",
  ".00yfyyyyyyyyy8008yyyyyyyyyyk00.",
  ".08yfyyyyyyyyyyyyyyyyyyyyyyyy80.",
  "00kkkkkkkkkkkkkkkkkkkkkkkkkkkk00",
  "00555555555555555555555555555500",
  ".000000000000000000000000000000.",
];

// Not captured from a running system: no Mac OS 8.0 alert I could
// bring up showed it. From the Mac OS 8 HIG (1997), figure 3-6
// (graphics/HIG_CG-082.gif, a 1:1 GIF), x 23..54, y 34..65; the same
// figure's frame and stop icon match the 8.0 captures pixel for pixel.
// Mac OS 9.0's note icon (guidebookgallery.org shutdown window) has an
// ee highlight instead of white along its top row and left column.
const ALERT_NOTE = [
  "22222222222222222222222222222222",
  "2fffffffK44444444444444444444442",
  "2fKKKKKKk22222222222222222222220",
  "2fKKKKKKk22222222222222222222220",
  "2fKKKKKKk22222222222222222222220",
  "2fKkkKKKk22222222mqqqqqpNN222220",
  "2fKk0fKKk222222mqffffffqppN22220",
  "2fKk0fKKk22222mqffqqqqqqqpmN2220",
  "2fKk0fKKk2222mqffqqqqqqqqqpmN220",
  "2fKKffKKk2222qffqqqqqqqqqqqpm220",
  "2fKKKKKKk222mffqqqqqqqqqqqqqmN20",
  "2fKKKKKKk222qffqqqqqqqqqqqqqpm20",
  "2fKKKKKKk222qfq000q000q000qqpm20",
  "2fKKKKKKk222qfqqqqqqqqqqqqqqpm20",
  "2fKKKKKKk222qfqqqqqqqqqqqqqqpm20",
  "2fKKKKKKk222qfq000q000q0q0qqpm20",
  "2fKKKKKKk222qfqqqqqqqqqqqqqqpm20",
  "2fKKKKKKk222qfqqqqqqqqqqqqqqpm20",
  "2fKKKKKKk222qfq000q0q000qqqqpm20",
  "2fKKKkkkk222qfqqqqqqqqqqqqqqpm20",
  "2fKKK2222222qfqqqqqqqqqqqqqqpm20",
  "2fKKKKk22222qfq0000q000q00qqpm20",
  "2fKKKKk22222qfqqqqqqqqqqqqqppN20",
  "2fKKKKk22222qfqqqqqqqqqqqqppm220",
  "2fKKKKk2222mqfqqqqqqqqqqqppmN220",
  "2fKKkkk222mqqppppppppppppmmN2220",
  "2fKK22222mmmmmmmmmmmmmmmNNN22220",
  "2fKKKKk2222222222222222222222220",
  "2fKKKKk2222222222222222222222220",
  "2fKKKKk2222222222222222222222220",
  "2Kkkkkk2222222222222222222222220",
  "20000000000000000000000000000000",
];

/** Name -> grid, published as --osm-sprite-<name> by spriteCss(). */
export const ALERT_SPRITES: Record<string, readonly string[]> = {
  "alert-stop": ALERT_STOP,
  "alert-caution": ALERT_CAUTION,
  "alert-note": ALERT_NOTE,
};

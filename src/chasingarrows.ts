// Chasing arrows, the Appearance Manager's asynchronous arrows
// (kControlChasingArrowsProc): a 16 x 16 circle of two arrows that
// turns while an operation of unknown length runs, as in a Mac OS 8
// Finder window's header while the window fills. Looks come from
// osmium.css (.osm-arrows) and the eight frames in controlsprites.ts,
// Mac OS 8.0's own bitmaps.
//
// Mac OS 8.0 (Appearance Extension, CDEF 7) and what it means here:
// - The control starts on frame 0 and steps through frames 0 to 7 and
//   round again, one frame per step, always forward. Stopped, Mac OS
//   apps remove the arrows, so a stopped control draws nothing.
//   (Opening a window, the Finder blanked its header for them and put
//   the text back after; expanding all folders, it blanked the header
//   too; expanding one folder, it kept the text beside them.)
// - The CDEF steps only when its application idles it, and then only
//   once at least 2 ticks have passed since its last step. The pace is
//   the application's: Mac OS 8.0's Finder stepped every 6 ticks
//   (99.75 ms) whenever it wasn't busy, which is the pace here, in
//   whole milliseconds (FRAME_MS). Of 120 steps captured in an
//   emulator, 63 took 6 ticks, 2 took 5, 14 took 7 and 41 took 8 or
//   more while the Finder was busy. Osmium never stalls the way a busy
//   Finder did.
// - An inactive window's arrows keep turning, drawn in 88 instead of
//   black (the CDEF's own gray, and the Finder's measured behavior):
//   osmium.css switches frames under .osm-inactive.
// - With prefers-reduced-motion, the running arrows hold frame 0.
//   Mac OS had no such setting.
import { installOsmium } from "./install.js";

/** Mac OS ticks: 60.15 a second. */
const TICK_MS = 1000 / 60.15;
/** Ticks between frames: the Finder 8.0's pace (see above). */
const FRAME_TICKS = 6;
/** 6 ticks in whole milliseconds, 100. Browsers truncate a timer's
 * delay to an integer, so 99.75 would run at 99; 100 is nearer. */
const FRAME_MS = Math.round(FRAME_TICKS * TICK_MS);
/** Frames in a turn, 0 to 7 (CDEF 7 wraps its frame index at 8). */
const FRAME_COUNT = 8;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export interface OsmiumChasingArrows {
  /** Whether the arrows are showing: from start() until stop() or
   * destroy(), even while reduced motion holds them on frame 0. */
  readonly running: boolean;
  /** Show the arrows on frame 0 and turn them. Does nothing while
   * running; throws after destroy(). */
  start(): void;
  /** Take the arrows away (the element keeps its 16 x 16 box, blank).
   * Does nothing while stopped. */
  stop(): void;
  /** Stop, and let go of the element and the reduced-motion listener.
   * The element keeps its class, role and label, and stays blank and
   * `aria-hidden`. */
  destroy(): void;
}

const mounted = new WeakSet<HTMLElement>();

/** Turn `el`, a `<span class="osm-arrows" role="img"
 * aria-label="Working">`, into chasing arrows, stopped. Adds the class,
 * `role="img"` and `aria-label="Working"` where they're missing. While
 * stopped the element is `aria-hidden`, as there is nothing to see.
 * Throws if `el` already has chasing arrows (destroy them first). */
export function mountChasingArrows(el: HTMLElement): OsmiumChasingArrows {
  if (mounted.has(el)) throw new Error("this element has chasing arrows");
  mounted.add(el);
  void installOsmium().catch(() => {}); // the frames are sprites
  el.classList.add("osm-arrows");
  if (!el.hasAttribute("role")) el.setAttribute("role", "img");
  if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "Working");

  const motion = typeof matchMedia === "function"
    ? matchMedia(REDUCED_MOTION) : null;
  let running = false;
  let destroyed = false;
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function show(k: number): void {
    frame = k;
    el.dataset["frame"] = String(k);
  }

  /** Turn while running without reduced motion; otherwise hold. */
  function pace(): void {
    const turn = running && !motion?.matches;
    if (turn && timer === undefined) {
      timer = setInterval(() => show((frame + 1) % FRAME_COUNT),
                          FRAME_MS);
    } else if (!turn && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    // Reduced motion shows the first frame, not wherever the turn was.
    if (running && !turn) show(0);
  }

  function blank(): void {
    delete el.dataset["frame"];
    el.setAttribute("aria-hidden", "true");
  }

  function start(): void {
    if (destroyed) throw new Error("these chasing arrows were destroyed");
    if (running) return;
    running = true;
    el.removeAttribute("aria-hidden");
    show(0);
    pace();
  }

  function stop(): void {
    if (!running) return;
    running = false;
    pace();
    blank();
  }

  const onMotion = () => pace();
  motion?.addEventListener("change", onMotion);
  blank();

  return {
    get running() { return running; },
    start,
    stop,
    destroy() {
      if (destroyed) return;
      stop();
      destroyed = true;
      motion?.removeEventListener("change", onMotion);
      mounted.delete(el);
    },
  };
}

// ---- module-internal, exported for tests only (not from index.ts) --------
export const ARROWS_FRAME_MS = FRAME_MS;

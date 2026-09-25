import Cocoa
import WebKit

// Osmium UI's native window host. Each Osmium window is a borderless
// NSWindow filled by a transparent WKWebView whose page draws the whole
// Mac OS 8 window (osmium.css, src/host.ts): frame, pinstripe titlebar,
// boxes and the 1px drop shadow. The page can't move, fold or close its
// own NSWindow, so its boxes post window ops back, which this host
// applies to the window that sent them:
//
//   winClose            close the window
//   winZoom             toggle between the user and standard frames
//   winShade {on}       fold to the titlebar (windowshade) and back
//   winGrow             track the grow box (bottom-right resize)
//   dragWindow          move the window with the mouse
//
// By default the host listens for them on the "osmium" script message
// handler, which is where hostWindow() in src/host.ts sends them. Apps
// that relay page messages themselves pass nil and call handle(_:from:).
//
// Everything that touches a window or a web view is isolated to the
// main actor, where AppKit and WebKit call it; the code builds in
// Swift 6 language mode as well as Swift 5.

/// A borderless window that behaves like a titled one. Borderless
/// NSWindows can't become key by default, and with no close or zoom
/// button AppKit's Window-menu actions beep — these overrides route
/// them to the same behavior as the page's boxes.
public final class OsmiumWindow: NSWindow {
    /// The zoom box's frame toggle; nil for a fixed-size window.
    public var zoomAction: (@MainActor () -> Void)?
    public override var canBecomeKey: Bool { true }
    public override var canBecomeMain: Bool { true }
    public override func performClose(_ sender: Any?) {
        if delegate?.windowShouldClose?(self) == false { return }
        close()
    }
    public override func performZoom(_ sender: Any?) { zoomAction?() }
    public override func performMiniaturize(_ sender: Any?) {
        miniaturize(sender)
    }
    public override func validateMenuItem(_ item: NSMenuItem) -> Bool {
        switch item.action {
        case #selector(performClose(_:)), #selector(performMiniaturize(_:)):
            return true
        case #selector(performZoom(_:)):
            return zoomAction != nil
        default:
            return super.validateMenuItem(item)
        }
    }
}

/// The page draws its own title bar, so a press there on an inactive
/// window has to reach the page: one gesture then activates and drags
/// the window, as in Mac OS 8. WebKit would otherwise spend the first
/// click on activation alone; content clicks still do.
public final class OsmiumWebView: WKWebView {
    /// The title bar's height (osmium.css).
    private let titleBarH: CGFloat = 22
    public override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        // Only a left press drags; others just activate.
        guard let e = event, e.type == .leftMouseDown else { return false }
        let p = convert(e.locationInWindow, from: nil)
        return (isFlipped ? p.y : bounds.height - p.y) < titleBarH
    }

    /// The drop shadow's width, and how far in from the window's corner
    /// each shadow edge starts. Keep in step with .osm-window::before and
    /// ::after in osmium.css, or the backdrop shows past the shadow again.
    private let shadowW: CGFloat = 1
    private let shadowInset: CGFloat = 2

    /// Clip to the page window's silhouette: its box, plus the shadow
    /// along its right and bottom edges. WebKit can still paint its
    /// white backdrop where the page is transparent, even with
    /// drawsBackground off, which showed as two white pixels beside the
    /// shadow's ends (top right, bottom left). Outside the silhouette
    /// the page draws nothing, so the clip hides only that backdrop.
    public override func layout() {
        super.layout()
        wantsLayer = true
        guard let layer else { return }
        let w = bounds.width, h = bounds.height
        // Top-down points; layer space is flipped only when the view is.
        let flipped = layer.isGeometryFlipped
        let top: [(CGFloat, CGFloat)] = [
            (0, 0), (w - shadowW, 0), (w - shadowW, shadowInset),
            (w, shadowInset), (w, h), (shadowInset, h),
            (shadowInset, h - shadowW), (0, h - shadowW)]
        let pts = top.map { CGPoint(x: $0.0, y: flipped ? $0.1 : h - $0.1) }
        let path = CGMutablePath()
        path.addLines(between: pts)
        path.closeSubpath()
        // Reuse the mask layer: layout runs on every resize tick.
        let mask = layer.mask as? CAShapeLayer ?? CAShapeLayer()
        // A mask layer has no view delegate to suppress implicit actions:
        // without this its frame and path would animate behind a resize.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        mask.frame = CGRect(origin: .zero, size: bounds.size)
        mask.contentsScale = layer.contentsScale
        mask.path = path
        layer.mask = mask
        CATransaction.commit()
    }

    // A move to a display of another density: re-rasterize the mask.
    public override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        needsLayout = true
    }
}

/// What a hosted window shows and how big it is.
public struct OsmiumWindowSpec: Sendable {
    /// The page: an app URL scheme, http(s), or a file URL.
    public let url: URL
    /// For the Window menu and Mission Control (the page draws its own).
    public let title: String
    /// Frame persistence key (see OsmiumFrameStore).
    public let frameKey: String
    /// Standard content size — the page's window plus its 1px drop
    /// shadow; the zoom box's standard state and the initial size.
    public let size: NSSize
    /// Smallest expanded size, which also gives the window its zoom
    /// and grow boxes; nil for a fixed-size window.
    public let minSize: NSSize?
    /// For a file URL, the folder the page may read from (its own
    /// folder by default); nil for other URLs.
    public let readAccessURL: URL?

    public init(url: URL, title: String, frameKey: String, size: NSSize,
                minSize: NSSize? = nil, readAccessURL: URL? = nil) {
        self.url = url
        self.title = title
        self.frameKey = frameKey
        self.size = size
        self.minSize = minSize
        self.readAccessURL = readAccessURL
    }
}

/// A window the host manages, created on first show and reused after a
/// close.
@MainActor
public final class OsmiumHostedWindow {
    public let spec: OsmiumWindowSpec
    public internal(set) var window: OsmiumWindow?
    public internal(set) var webView: WKWebView?
    /// Frame height before a windowshade collapse — restored on expand.
    var preShadeH: CGFloat?
    var preShadeMinH: CGFloat?
    /// Bumped on every shade/expand so a stale expand-completion can't
    /// clear state a newer toggle already replaced.
    var shadeGen = 0
    /// The frame to go back to from the standard size (Mac OS 8 user
    /// state); set when the zoom box zooms out.
    var userFrame: NSRect?

    init(_ spec: OsmiumWindowSpec) { self.spec = spec }
}

/// Saves window frames in UserDefaults under `prefix + key`.
public final class OsmiumFrameStore: Sendable {
    public let prefix: String

    public init(prefix: String = "OsmiumFrame.") { self.prefix = prefix }

    /// Put `w` at its saved frame, or center it on first launch.
    /// Not setFrameUsingName: its restore constrains the frame to the
    /// window's current screen — the main display this early — so a
    /// window parked on a second monitor got dragged back to display 1.
    /// The saved rect is applied verbatim when it intersects any
    /// attached screen; a frame left on a detached display falls back
    /// to centered rather than stranding the window offscreen.
    @MainActor
    public func restore(_ w: NSWindow, key: String) {
        if let f = frame(for: key),
           NSScreen.screens.contains(where: { $0.frame.intersects(f) }) {
            w.setFrame(f, display: false)
        } else {
            w.center()
        }
    }

    /// The frame saved for `key`, if any. Falls back to AppKit's own
    /// autosave key, so apps that used setFrameAutosaveName keep the
    /// placements they already saved.
    public func frame(for key: String) -> NSRect? {
        let defaults = UserDefaults.standard
        return (defaults.string(forKey: prefix + key)
                ?? defaults.string(forKey: "NSWindow Frame \(key)"))
            .flatMap(OsmiumFrameStore.parse)
    }

    public func save(_ frame: NSRect, key: String) {
        UserDefaults.standard.set(NSStringFromRect(frame), forKey: prefix + key)
    }

    /// Our values are NSStringFromRect output ("{{x, y}, {w, h}}");
    /// AppKit's autosave value is "x y w h sx sy sw sh" — take its first
    /// four fields and ignore the screen descriptor.
    static func parse(_ s: String) -> NSRect? {
        var f = NSRectFromString(s)
        if f.width <= 0 || f.height <= 0 {
            let parts = s.split(separator: " ")
            guard parts.count >= 4,
                  let x = Double(parts[0]), let y = Double(parts[1]),
                  let w = Double(parts[2]), let h = Double(parts[3]),
                  x.isFinite, y.isFinite, w.isFinite, h.isFinite
            else { return nil }
            f = NSRect(x: x, y: y, width: w, height: h)
        }
        return f.width > 0 && f.height > 0 ? f : nil
    }
}

/// Opens Osmium windows and applies their pages' window ops.
@MainActor
public final class OsmiumWindowHost: NSObject, NSWindowDelegate,
                                     WKScriptMessageHandler {
    public let frames: OsmiumFrameStore
    public private(set) var windows: [OsmiumHostedWindow] = []
    private let makeConfiguration: @MainActor () -> WKWebViewConfiguration
    private let prepare: @MainActor (WKWebView) -> Void
    private let messageHandlerName: String?
    /// Windowshaded height: the page's 22px collapsed window plus the
    /// 1px drop shadow it draws below itself.
    private let shadedH: CGFloat = 23

    /// - Parameters:
    ///   - frames: where window frames persist.
    ///   - configuration: a fresh configuration for each window's web
    ///     view (URL scheme handlers, the app's own message handlers).
    ///   - messageHandlerName: the script message handler the host adds
    ///     to each configuration to receive window ops; nil when the app
    ///     relays them to handle(_:from:) itself.
    ///   - prepare: called with each new web view (delegates, say).
    public init(frames: OsmiumFrameStore = OsmiumFrameStore(),
                configuration: @escaping @MainActor () -> WKWebViewConfiguration =
                    { WKWebViewConfiguration() },
                messageHandlerName: String? = "osmium",
                prepare: @escaping @MainActor (WKWebView) -> Void = { _ in }) {
        self.frames = frames
        self.makeConfiguration = configuration
        self.messageHandlerName = messageHandlerName
        self.prepare = prepare
    }

    /// Register a window; it opens with show(_:).
    @discardableResult
    public func add(_ spec: OsmiumWindowSpec) -> OsmiumHostedWindow {
        let hw = OsmiumHostedWindow(spec)
        windows.append(hw)
        return hw
    }

    /// The hosted window showing `webView`, if any.
    public func hosted(for webView: WKWebView?) -> OsmiumHostedWindow? {
        guard let webView else { return nil }
        return windows.first { $0.webView === webView }
    }

    /// Open (or bring back) a window.
    public func show(_ hw: OsmiumHostedWindow) {
        if hw.window == nil { create(hw) }
        guard let w = hw.window else { return }
        if let h = hw.preShadeH {
            // Reopening a window closed while shaded: expand it here —
            // reopening is only knowable at the shell. The page clears
            // its own fold when the viewport grows past titlebar size.
            w.minSize = NSSize(width: w.minSize.width,
                               height: hw.preShadeMinH ?? w.minSize.height)
            let f = w.frame
            w.setFrame(NSRect(x: f.minX, y: f.maxY - h,
                              width: f.width, height: h), display: true)
            hw.preShadeH = nil
            hw.preShadeMinH = nil
        } else if w.frame.height < 40 {
            // A titlebar sliver saved while shaded (by a build that
            // didn't save the expanded frame): grow it back to the
            // standard height, top edge pinned.
            let f = w.frame, h = hw.spec.size.height
            w.setFrame(NSRect(x: f.minX, y: f.maxY - h,
                              width: f.width, height: h), display: true)
        }
        w.makeKeyAndOrderFront(nil)
    }

    private func create(_ hw: OsmiumHostedWindow) {
        let spec = hw.spec
        let config = makeConfiguration()
        if let name = messageHandlerName {
            // Adding a name twice raises: the app may share one content
            // controller across windows, so replace any earlier one.
            let ucc = config.userContentController
            ucc.removeScriptMessageHandler(forName: name)
            ucc.add(WeakMessageHandler(self), name: name)
        }
        let v = OsmiumWebView(frame: .init(origin: .zero, size: spec.size),
                              configuration: config)
        // The page's painted window edge is the only visible surface:
        // underPageBackgroundColor is the public lever, drawsBackground
        // the longstanding SPI that stops any backing paint (guarded,
        // in case the key ever vanishes).
        v.underPageBackgroundColor = .clear
        if v.responds(to: NSSelectorFromString("setDrawsBackground:")) {
            v.setValue(false, forKey: "drawsBackground")
        }
        prepare(v)
        var style: NSWindow.StyleMask = [.borderless, .miniaturizable]
        if spec.minSize != nil { style.insert(.resizable) }
        let w = OsmiumWindow(contentRect: v.frame, styleMask: style,
                             backing: .buffered, defer: false)
        w.title = spec.title // Window menu, Mission Control
        w.isOpaque = false
        w.backgroundColor = .clear
        // Mac OS 8 windows cast a hard 1px shadow, which the page draws;
        // a soft AppKit shadow would ring it.
        w.hasShadow = false
        if let m = spec.minSize {
            w.minSize = m
            w.zoomAction = { [weak self, unowned hw] in self?.zoom(hw) }
        }
        w.contentView = v
        w.isReleasedWhenClosed = false // reopen reuses the window
        w.initialFirstResponder = v
        w.delegate = self
        frames.restore(w, key: spec.frameKey)
        if spec.minSize == nil {
            // Fixed size: a saved frame only places it.
            let f = w.frame
            w.setFrame(NSRect(x: f.minX, y: f.maxY - spec.size.height,
                              width: spec.size.width,
                              height: spec.size.height),
                       display: false)
        }
        hw.window = w
        hw.webView = v
        if spec.url.isFileURL {
            v.loadFileURL(spec.url, allowingReadAccessTo:
                            spec.readAccessURL
                            ?? spec.url.deletingLastPathComponent())
        } else {
            v.load(URLRequest(url: spec.url))
        }
    }

    /// Apply a window op a page posted; false when `body` isn't one or
    /// `webView` isn't a hosted window's.
    @discardableResult
    public func handle(_ body: Any, from webView: WKWebView?) -> Bool {
        guard let msg = body as? [String: Any],
              let op = msg["op"] as? String,
              let hw = hosted(for: webView), let w = hw.window
        else { return false }
        switch op {
        case "winClose": w.close()
        case "winShade": shade(hw, msg["on"] as? Bool == true)
        case "winZoom": zoom(hw)
        case "winGrow": grow(hw)
        case "dragWindow": OsmiumWindowHost.drag(w, firstResponder: hw.webView)
        default: return false
        }
        return true
    }

    public func userContentController(_ controller: WKUserContentController,
                                      didReceive message: WKScriptMessage) {
        handle(message.body, from: message.webView)
    }

    /// Move `w` with the mouse, as for a press on its title bar: a page
    /// asks for this from a pointerdown, so synthesize the leftMouseDown
    /// performDrag expects at the cursor's position.
    public static func drag(_ w: NSWindow, firstResponder: NSView?) {
        let loc = w.convertPoint(fromScreen: NSEvent.mouseLocation)
        guard let ev = NSEvent.mouseEvent(with: .leftMouseDown,
            location: loc, modifierFlags: [], timestamp: 0,
            windowNumber: w.windowNumber, context: nil,
            eventNumber: 0, clickCount: 1, pressure: 0)
        else { return }
        w.performDrag(with: ev)
        // Dragging leaves first responder off the web view (the page's
        // keys would go dead) — hand it back.
        w.makeFirstResponder(firstResponder)
    }

    // MARK: windowshade, zoom, grow

    /// Windowshade: fold the window to its titlebar and back.
    private func shade(_ hw: OsmiumHostedWindow, _ on: Bool) {
        guard let w = hw.window else { return }
        let f = w.frame
        // Each shade/expand supersedes the previous animation — the
        // expand's deferred clear must not fire for a state a newer
        // toggle already replaced.
        hw.shadeGen += 1
        let gen = hw.shadeGen
        if on {
            // A page reload while shaded resends on:true — keep the
            // first captured height or unshade restores 23. Clamp to
            // minSize so a rapid toggle can't capture a mid-animation
            // frame and shrink the restore.
            if hw.preShadeH == nil {
                hw.preShadeH = max(f.height, hw.spec.minSize?.height ??
                                              hw.spec.size.height)
            }
            // Programmatic setFrame can clamp to minSize; drop the floor
            // while folded and restore it on expand.
            if hw.preShadeMinH == nil { hw.preShadeMinH = w.minSize.height }
            w.minSize = NSSize(width: w.minSize.width, height: shadedH)
            w.setFrame(NSRect(x: f.minX, y: f.maxY - shadedH,
                              width: f.width, height: shadedH),
                       display: true, animate: true)
        } else if let h = hw.preShadeH {
            w.minSize = NSSize(width: w.minSize.width,
                               height: hw.preShadeMinH ?? w.minSize.height)
            // Clear the saved height only when the expand actually lands
            // — a shade clicked mid-animation must keep the real height,
            // not the partial frame. AppKit calls the completion handler
            // on the main thread, but its type doesn't say so.
            NSAnimationContext.runAnimationGroup({ _ in
                w.animator().setFrame(
                    NSRect(x: f.minX, y: f.maxY - h,
                           width: f.width, height: h),
                    display: true)
            }, completionHandler: {
                MainActor.assumeIsolated {
                    if gen == hw.shadeGen && abs(w.frame.height - h) < 0.5 {
                        hw.preShadeH = nil
                        hw.preShadeMinH = nil
                    }
                }
            })
        }
    }

    /// Zoom box, decided the way the Mac OS 8 Window Manager does it: a
    /// window at its standard size goes back to the user state; any
    /// other frame becomes the user state and zooms to standard. So a
    /// move, an edge resize or tiling needs no bookkeeping.
    private func zoom(_ hw: OsmiumHostedWindow) {
        guard let w = hw.window, hw.preShadeH == nil,
              hw.spec.minSize != nil else { return }
        let std = standardFrame(hw, w)
        let atStd = abs(w.frame.width - std.width) < 0.5 &&
                    abs(w.frame.height - std.height) < 0.5
        if atStd {
            guard let uf = hw.userFrame else { return } // nowhere to go
            hw.userFrame = nil
            w.setFrame(uf, display: true, animate: true)
        } else {
            hw.userFrame = w.frame
            w.setFrame(std, display: true, animate: true)
        }
    }

    /// The standard state: the standard size with the top-left corner
    /// pinned, shifted onto the screen's visible area when it would run
    /// under the Dock or off an edge (AppKit doesn't constrain
    /// borderless windows).
    private func standardFrame(_ hw: OsmiumHostedWindow,
                               _ w: NSWindow) -> NSRect {
        let f = w.frame, s = hw.spec.size
        var r = NSRect(x: f.minX, y: f.maxY - s.height,
                       width: s.width, height: s.height)
        guard let vis = (w.screen ?? NSScreen.main)?.visibleFrame
        else { return r }
        r.origin.x = max(vis.minX, min(r.minX, vis.maxX - r.width))
        r.origin.y = min(vis.maxY - r.height, max(r.minY, vis.minY))
        return r
    }

    /// Grow box: a modal mouse-tracking loop like AppKit's own resize —
    /// the bottom-right drag adjusts width and height with the top edge
    /// pinned. Polls pressedMouseButtons so an already-released click
    /// can't wedge the loop.
    private func grow(_ hw: OsmiumHostedWindow) {
        guard let w = hw.window, hw.spec.minSize != nil else { return }
        let f0 = w.frame, p0 = NSEvent.mouseLocation
        while NSEvent.pressedMouseButtons & 1 != 0 {
            guard let ev = NSApp.nextEvent(
                matching: [.leftMouseDragged, .leftMouseUp],
                until: Date(timeIntervalSinceNow: 0.1),
                inMode: .eventTracking, dequeue: true)
            else { continue }
            if ev.type == .leftMouseUp { break }
            let p = NSEvent.mouseLocation
            let nw = max(w.minSize.width, f0.width + p.x - p0.x)
            let nh = max(w.minSize.height, f0.height - (p.y - p0.y))
            w.setFrame(NSRect(x: f0.minX, y: f0.maxY - nh,
                              width: nw, height: nh),
                       display: true)
        }
    }

    // MARK: frame persistence

    /// Every move and resize rewrites the saved frame, so the value on
    /// disk is always where the user last left the window.
    public func windowDidMove(_ notification: Notification) {
        persist(notification.object)
    }

    public func windowDidResize(_ notification: Notification) {
        persist(notification.object)
    }

    private func persist(_ object: Any?) {
        guard let w = object as? NSWindow,
              let hw = windows.first(where: { $0.window === w }) else { return }
        var f = w.frame
        // A windowshaded window saves its expanded frame: quitting while
        // folded must not bring it back as a titlebar sliver.
        if let h = hw.preShadeH {
            f = NSRect(x: f.minX, y: f.maxY - h, width: f.width, height: h)
        }
        frames.save(f, key: hw.spec.frameKey)
    }
}

/// WKUserContentController retains its handlers; this keeps it from
/// retaining the host (which retains the web views) in a cycle.
@MainActor
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) { self.target = target }

    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

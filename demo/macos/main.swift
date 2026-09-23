import Cocoa
import WebKit

// Osmium Demo: the web demo's one-window pages as native Mac OS 8
// windows. The build copies demo/dist/ into Resources/web/, and
// OsmiumWindowHost (macos/OsmiumWindows.swift, compiled into this
// binary) opens each page from there in a borderless window that the
// page draws completely. The page's boxes post window ops (close,
// zoom, windowshade, grow, drag) to the host's "osmium" message
// handler, which applies them to the window. The Finder page asks for
// other demo windows on a "demo" handler of the app's own.

/// One of the demo's windows.
enum DemoPage: Int, CaseIterable {
    case controls, finder, controlPanel, about

    /// The page's window id (demo/windows.ts), as the Finder page names
    /// the window it wants opened.
    var id: String {
        switch self {
        case .controls: return "controls"
        case .finder: return "finder"
        case .controlPanel: return "panel"
        case .about: return "about"
        }
    }

    /// The page in Resources/web/.
    var file: String {
        switch self {
        case .controls: return "controls.html"
        case .finder: return "finder.html"
        case .controlPanel: return "panel.html"
        case .about: return "about.html"
        }
    }

    /// For the Demo and Window menus: the title the page draws
    /// (demo/windows.ts).
    var title: String {
        switch self {
        case .controls: return "Controls"
        case .finder: return "Osmium HD"
        case .controlPanel: return "Control Panel"
        case .about: return "About Osmium UI"
        }
    }

    /// Saved-frame key. Persisted, so it must not follow case renames.
    var frameKey: String {
        switch self {
        case .controls: return "Controls"
        case .finder: return "Finder"
        case .controlPanel: return "ControlPanel"
        case .about: return "About"
        }
    }

    /// The standard size (the zoom box's, and the first size of a
    /// window that isn't in the launch layout): the window plus the 1px
    /// drop shadow the page paints below and to the right of it. The
    /// Finder's shows all 24 items.
    var size: NSSize {
        switch self {
        case .controls: return NSSize(width: 461, height: 331)
        case .finder: return NSSize(width: 501, height: 542)
        case .controlPanel: return NSSize(width: 521, height: 381)
        case .about: return NSSize(width: 341, height: 221)
        }
    }

    /// The size the window first opens at: shorter than standard for
    /// the Finder, so its zoom box has somewhere to go.
    var launchSize: NSSize {
        self == .finder ? NSSize(width: 501, height: 321) : size
    }

    /// The smallest size of a resizable window (zoom and grow boxes);
    /// nil for a fixed-size one.
    var minSize: NSSize? {
        self == .finder ? NSSize(width: 301, height: 181) : nil
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate,
                         WKScriptMessageHandler {
    /// Each window's web view also gets the "demo" handler, for the
    /// Finder's requests to open other windows.
    private lazy var host = OsmiumWindowHost(
        frames: OsmiumFrameStore(prefix: "OsmiumDemoFrame."),
        configuration: { [unowned self] in
            let config = WKWebViewConfiguration()
            config.userContentController.add(self, name: "demo")
            return config
        })
    /// Filled at launch, once the pages are known to be in the bundle.
    private var windows: [DemoPage: OsmiumHostedWindow] = [:]

    /// The windows opened at launch, back to front, and where each one's
    /// top-left corner sits relative to the group's (y grows downward):
    /// a cascade whose title bars all stay visible, overlapping a little
    /// like windows left open on a desktop.
    private let launchLayout: [(page: DemoPage, offset: NSPoint)] = [
        (.controls, NSPoint(x: 0, y: 0)),
        (.finder, NSPoint(x: 430, y: 80)),
        (.controlPanel, NSPoint(x: 180, y: 300)),
    ]

    func applicationWillFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = makeMainMenu()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // A missing page would open as an invisible window (the host's
        // windows are transparent until their page paints), so the demo
        // would seem to launch into nothing. Say what's wrong instead.
        guard let web = Bundle.main.url(forResource: "web",
                                        withExtension: nil) else {
            quit(because: "The app has no Resources/web folder.")
            return
        }
        let missing = DemoPage.allCases.map(\.file).filter {
            !FileManager.default.fileExists(
                atPath: web.appendingPathComponent($0).path)
        }
        guard missing.isEmpty else {
            quit(because: "Resources/web lacks "
                 + missing.joined(separator: ", ") + ".")
            return
        }

        for page in DemoPage.allCases {
            windows[page] = host.add(OsmiumWindowSpec(
                url: web.appendingPathComponent(page.file),
                title: page.title, frameKey: page.frameKey,
                size: page.size, minSize: page.minSize))
        }
        seedLaunchFrames()
        for (page, _) in launchLayout { open(page) }
    }

    /// Mac OS 8 applications stay open with no windows; the Demo menu
    /// brings them back.
    func applicationShouldTerminateAfterLastWindowClosed(
        _ sender: NSApplication) -> Bool {
        false
    }

    /// Opts in to secure state restoration; without this, macOS 14 and
    /// later log a warning at launch.
    func applicationSupportsSecureRestorableState(
        _ app: NSApplication) -> Bool {
        true
    }

    /// The Demo menu's items and About: open the item's window, or
    /// bring it to the front.
    @objc func openPage(_ sender: NSMenuItem) {
        if let page = DemoPage(rawValue: sender.tag) { open(page) }
    }

    private func open(_ page: DemoPage) {
        if let hw = windows[page] { host.show(hw) }
    }

    /// {op: "open", id}: the Finder page double-clicked a demo item.
    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              body["op"] as? String == "open",
              let id = body["id"] as? String,
              let page = DemoPage.allCases.first(where: { $0.id == id })
        else { return }
        open(page)
    }

    /// Give each launch window that has no saved frame yet its place in
    /// the cascade, centered as a group on the main screen. The frame
    /// store would otherwise center every window, stacking all three
    /// exactly on top of each other. Frames the user saved by moving a
    /// window are left alone.
    private func seedLaunchFrames() {
        guard let vis = NSScreen.main?.visibleFrame else { return }
        let groupW = launchLayout
            .map { $0.offset.x + $0.page.launchSize.width }.max() ?? 0
        let groupH = launchLayout
            .map { $0.offset.y + $0.page.launchSize.height }.max() ?? 0
        // Whole points keep the pixel art sharp. On a screen smaller
        // than the group, its top-left corner stays visible.
        let left = max(vis.minX, (vis.midX - groupW / 2).rounded(.down))
        let top = min(vis.maxY, (vis.midY + groupH / 2).rounded(.down))
        for (page, offset) in launchLayout {
            guard host.frames.frame(for: page.frameKey) == nil
            else { continue }
            let size = page.launchSize
            host.frames.save(NSRect(x: left + offset.x,
                                    y: top - offset.y - size.height,
                                    width: size.width, height: size.height),
                             key: page.frameKey)
        }
    }

    /// Explain why the demo can't run, then quit.
    private func quit(because reason: String) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Osmium Demo can't open its windows."
        alert.informativeText = reason
            + " Rebuild the app with make -C demo/macos."
        alert.runModal()
        NSApp.terminate(nil)
    }

    // MARK: menus

    /// The menu bar. Items without a target go up the responder chain:
    /// editing commands to the key window's web view, the Window menu to
    /// the OsmiumWindow (its overrides stand in for the title bar
    /// buttons a borderless window lacks), Quit to NSApp.
    private func makeMainMenu() -> NSMenu {
        let bar = NSMenu()

        let appMenu = submenu("Osmium Demo", in: bar)
        appMenu.addItem(pageItem(.about, key: ""))
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Osmium Demo",
                        action: #selector(NSApplication.terminate(_:)),
                        keyEquivalent: "q")

        let editMenu = submenu("Edit", in: bar)
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)),
                         keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)),
                         keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste",
                         action: #selector(NSText.paste(_:)),
                         keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All",
                         action: #selector(NSText.selectAll(_:)),
                         keyEquivalent: "a")

        // ⌘1 to ⌘4, in DemoPage order.
        let demoMenu = submenu("Demo", in: bar)
        for (i, page) in DemoPage.allCases.enumerated() {
            demoMenu.addItem(pageItem(page, key: String(i + 1)))
        }

        let windowMenu = submenu("Window", in: bar)
        windowMenu.addItem(withTitle: "Close",
                           action: #selector(NSWindow.performClose(_:)),
                           keyEquivalent: "w")
        windowMenu.addItem(withTitle: "Minimize",
                           action: #selector(NSWindow.performMiniaturize(_:)),
                           keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom",
                           action: #selector(NSWindow.performZoom(_:)),
                           keyEquivalent: "")
        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "Bring All to Front",
                           action: #selector(NSApplication.arrangeInFront(_:)),
                           keyEquivalent: "")
        // AppKit lists the open windows below these items.
        NSApp.windowsMenu = windowMenu

        return bar
    }

    private func submenu(_ title: String, in bar: NSMenu) -> NSMenu {
        let menu = NSMenu(title: title)
        bar.addItem(withTitle: title, action: nil, keyEquivalent: "")
            .submenu = menu
        return menu
    }

    private func pageItem(_ page: DemoPage, key: String) -> NSMenuItem {
        let item = NSMenuItem(title: page.title,
                              action: #selector(openPage(_:)),
                              keyEquivalent: key)
        item.target = self
        item.tag = page.rawValue
        return item
    }
}

// Top-level code runs on the main thread; Swift 6's isolation checks
// don't assume it, so say so.
MainActor.assumeIsolated {
    let app = NSApplication.shared
    let appDelegate = AppDelegate()
    app.delegate = appDelegate
    app.setActivationPolicy(.regular)
    app.activate(ignoringOtherApps: true)
    // NSApplication.delegate is weak: keep the delegate, and through it
    // the window host, alive for the app's lifetime.
    withExtendedLifetime(appDelegate) { app.run() }
}

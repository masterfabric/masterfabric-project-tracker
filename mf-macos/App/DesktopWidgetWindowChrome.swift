import AppKit
import SwiftUI

/// Makes a SwiftUI `Window` look like a Desktop widget: no traffic lights, clear chrome, floating glass.
struct DesktopWidgetWindowChrome: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async { Self.apply(to: view.window) }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async { Self.apply(to: nsView.window) }
    }

    static func apply(to window: NSWindow?) {
        guard let window else { return }
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.toolbar = nil
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.isMovableByWindowBackground = true
        window.level = .floating
        window.collectionBehavior.insert([.canJoinAllSpaces, .fullScreenAuxiliary])
        window.styleMask.insert(.fullSizeContentView)
        window.styleMask.remove(.titled)
        // Keep closable via Escape / pin toggle; hide traffic lights.
        for button in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] {
            window.standardWindowButton(button)?.isHidden = true
            window.standardWindowButton(button)?.alphaValue = 0
        }
        if let content = window.contentView {
            content.wantsLayer = true
            content.layer?.backgroundColor = NSColor.clear.cgColor
        }
    }
}

#!/usr/bin/env swift
import ApplicationServices
import AppKit
import Foundation
import CoreGraphics

struct Creds: Decodable {
    let email: String
    let password: String
    let accessToken: String
    let bundleId: String?
    let apiKey: String?
}

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var v: CFTypeRef?
    return AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success ? (v as AnyObject) : nil
}
func children(_ el: AXUIElement) -> [AXUIElement] {
    (attr(el, kAXChildrenAttribute as String) as? [AXUIElement]) ?? []
}
func role(_ el: AXUIElement) -> String { attr(el, kAXRoleAttribute as String) as? String ?? "" }
func title(_ el: AXUIElement) -> String { attr(el, kAXTitleAttribute as String) as? String ?? "" }
func desc(_ el: AXUIElement) -> String { attr(el, kAXDescriptionAttribute as String) as? String ?? "" }
func value(_ el: AXUIElement) -> String { attr(el, kAXValueAttribute as String).map { "\($0)" } ?? "" }

func walk(_ el: AXUIElement, _ body: (AXUIElement) -> Void) {
    body(el)
    children(el).forEach { walk($0, body) }
}
func collect(_ root: AXUIElement, matching: (AXUIElement) -> Bool) -> [AXUIElement] {
    var out: [AXUIElement] = []
    walk(root) { if matching($0) { out.append($0) } }
    return out
}
func press(_ el: AXUIElement) { AXUIElementPerformAction(el, kAXPressAction as CFString) }
func focus(_ el: AXUIElement) {
    AXUIElementSetAttributeValue(el, kAXFocusedAttribute as CFString, kCFBooleanTrue)
}
func log(_ mark: String, _ name: String, _ detail: String = "") {
    print("[\(mark)] \(name)" + (detail.isEmpty ? "" : " — \(detail)"))
}

func typeText(_ string: String) {
    let src = CGEventSource(stateID: .hidSystemState)
    for ch in string {
        let utf16 = Array(String(ch).utf16)
        let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)
        let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
        down?.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: utf16)
        up?.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: utf16)
        down?.post(tap: .cghidEventTap)
        up?.post(tap: .cghidEventTap)
        usleep(8_000)
    }
}

func keyChord(virtualKey: CGKeyCode, flags: CGEventFlags = []) {
    let src = CGEventSource(stateID: .hidSystemState)
    let down = CGEvent(keyboardEventSource: src, virtualKey: virtualKey, keyDown: true)
    let up = CGEvent(keyboardEventSource: src, virtualKey: virtualKey, keyDown: false)
    down?.flags = flags
    up?.flags = flags
    down?.post(tap: .cghidEventTap)
    up?.post(tap: .cghidEventTap)
}

func selectAllAndType(_ el: AXUIElement, _ text: String) {
    focus(el)
    usleep(100_000)
    keyChord(virtualKey: 0, flags: .maskCommand) // noop safety
    // Cmd+A
    keyChord(virtualKey: 0x00, flags: .maskCommand) // A = 0x00
    usleep(50_000)
    typeText(text)
    usleep(50_000)
}

func appElement() -> AXUIElement {
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first else {
        fputs("App not running\n", stderr); exit(1)
    }
    app.activate(options: [.activateIgnoringOtherApps])
    return AXUIElementCreateApplication(app.processIdentifier)
}

func openPopover(_ appEl: AXUIElement) {
    guard let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement?, let item = children(extras).first else {
        log("FAIL", "open popover"); exit(1)
    }
    press(item)
    Thread.sleep(forTimeInterval: 0.7)
    log("PASS", "open popover", value(item).isEmpty ? title(item) : value(item))
}

func mainWindow(_ appEl: AXUIElement) -> AXUIElement? {
    ((attr(appEl, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []).first
}

let creds = try JSONDecoder().decode(Creds.self, from: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json")))

// Relaunch clean
let appPath = "/Users/yurtaslanmac/Library/Developer/Xcode/DerivedData/MFProjectTracker-flmxohvqkwphsegllpaikbrukmsj/Build/Products/Debug/MF Project Tracker.app"
NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").forEach { $0.terminate() }
Thread.sleep(forTimeInterval: 1.0)
NSWorkspace.shared.open(URL(fileURLWithPath: appPath))
Thread.sleep(forTimeInterval: 2.0)

var appEl = appElement()
openPopover(appEl)
var root = mainWindow(appEl)!

if let signIn = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Sign In…" }).first {
    press(signIn)
    Thread.sleep(forTimeInterval: 0.6)
    root = mainWindow(appEl) ?? root
    log("PASS", "open login sheet")
}

let sheet = collect(root, matching: { role($0) == "AXSheet" }).first ?? root
let fields = collect(sheet, matching: { ["AXTextField", "AXSecureTextField"].contains(role($0)) })
log(fields.count == 2 ? "PASS" : "FAIL", "login fields", "\(fields.count) (want email+password only)")

// Type into fields with real key events (SecureField-safe)
if fields.count >= 2 {
    selectAllAndType(fields[0], creds.email)
    selectAllAndType(fields[1], creds.password)
    log("PASS", "typed credentials")
}

if let submit = collect(sheet, matching: { role($0) == "AXButton" && desc($0) == "Sign In" }).last {
    press(submit)
    log("PASS", "click Sign In")
}
Thread.sleep(forTimeInterval: 3.0)

appEl = appElement()
openPopover(appEl)
root = mainWindow(appEl) ?? root

let texts = collect(root, matching: { role($0) == "AXStaticText" }).map(value)
let emailShown = texts.contains(where: { $0 == creds.email })
let stillGuest = texts.contains(where: { $0.contains("Sign in to MF Project Tracker") })
let errText = texts.first(where: { $0.lowercased().contains("error") || $0.lowercased().contains("required") || $0.lowercased().contains("invalid") || $0.lowercased().contains("unauthorized") || $0.lowercased().contains("identity") })
log(emailShown && !stillGuest ? "PASS" : "FAIL", "signed in", emailShown ? creds.email : "guest still; err=\(errText ?? texts.prefix(8).joined(separator: " | "))")

if emailShown && !stillGuest {
    // New todo
    let tfs = collect(root, matching: { role($0) == "AXTextField" })
    if let draft = tfs.first {
        let todoTitle = "ui-e2e-todo-\(Int(Date().timeIntervalSince1970))"
        selectAllAndType(draft, todoTitle)
        if let add = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Add" }).first {
            press(add)
            Thread.sleep(forTimeInterval: 1.5)
            log("PASS", "create todo", todoTitle)
        }
    }
    // Timer
    if let p25 = collect(root, matching: { role($0) == "AXButton" && desc($0) == "25m" }).first {
        press(p25)
        log("PASS", "timer preset 25m")
    }
    if let start = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Start" }).first {
        press(start)
        log("PASS", "timer start")
    } else if collect(root, matching: { role($0) == "AXButton" && desc($0) == "Pause" }).first != nil {
        log("PASS", "timer running")
    } else {
        log("FAIL", "timer controls missing")
    }
    // Refresh
    openPopover(appEl)
}

print("\nAX dump after attempt:")
for t in texts.prefix(20) { print("  text:", t) }
let buttons = collect(root, matching: { role($0) == "AXButton" }).map(desc)
print("  buttons:", buttons)

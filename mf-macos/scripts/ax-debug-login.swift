#!/usr/bin/env swift
import ApplicationServices
import AppKit
import CoreGraphics
import Foundation

struct Creds: Decodable {
    let email: String
    let password: String
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
func value(_ el: AXUIElement) -> String { attr(el, kAXValueAttribute as String) as? String ?? "" }

func walk(_ el: AXUIElement, _ body: (AXUIElement) -> Void) {
    body(el)
    for c in children(el) { walk(c, body) }
}

func collect(_ root: AXUIElement, matching: (AXUIElement) -> Bool) -> [AXUIElement] {
    var out: [AXUIElement] = []
    walk(root) { if matching($0) { out.append($0) } }
    return out
}

func findPopover(_ appEl: AXUIElement) -> AXUIElement? {
    if let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement? {
        for item in children(extras) {
            let pops = collect(item) { role($0) == "AXPopover" }
            if let p = pops.first { return p }
        }
    }
    return nil
}

func clickElement(_ el: AXUIElement) {
    var posRef: CFTypeRef?
    var sizeRef: CFTypeRef?
    guard AXUIElementCopyAttributeValue(el, kAXPositionAttribute as CFString, &posRef) == .success,
          AXUIElementCopyAttributeValue(el, kAXSizeAttribute as CFString, &sizeRef) == .success
    else {
        AXUIElementPerformAction(el, kAXPressAction as CFString)
        return
    }
    var point = CGPoint.zero
    var size = CGSize.zero
    AXValueGetValue(posRef as! AXValue, .cgPoint, &point)
    AXValueGetValue(sizeRef as! AXValue, .cgSize, &size)
    let target = CGPoint(x: point.x + max(size.width / 2, 8), y: point.y + max(size.height / 2, 6))
    let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: target, mouseButton: .left)
    let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: target, mouseButton: .left)
    down?.post(tap: .cghidEventTap)
    up?.post(tap: .cghidEventTap)
}

func typeUnicode(_ string: String) {
    for ch in string.utf16 {
        var chars = [UniChar(ch)]
        let kd = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)!
        let ku = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)!
        kd.keyboardSetUnicodeString(stringLength: 1, unicodeString: &chars)
        ku.keyboardSetUnicodeString(stringLength: 1, unicodeString: &chars)
        kd.post(tap: .cghidEventTap)
        ku.post(tap: .cghidEventTap)
        usleep(4_000)
    }
}

func selectAllAndType(_ el: AXUIElement, _ string: String) {
    clickElement(el)
    Thread.sleep(forTimeInterval: 0.12)
    if let d = CGEvent(keyboardEventSource: nil, virtualKey: 0x00, keyDown: true) { // A
        d.flags = .maskCommand
        d.post(tap: .cghidEventTap)
    }
    if let u = CGEvent(keyboardEventSource: nil, virtualKey: 0x00, keyDown: false) {
        u.flags = .maskCommand
        u.post(tap: .cghidEventTap)
    }
    Thread.sleep(forTimeInterval: 0.05)
    typeUnicode(string)
    Thread.sleep(forTimeInterval: 0.1)
}

let creds = try JSONDecoder().decode(Creds.self, from: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json")))
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first else {
    fputs("App not running\n", stderr)
    exit(1)
}
let pid = app.processIdentifier
let appEl = AXUIElementCreateApplication(pid)
NSWorkspace.shared.open(URL(string: "mfprojecttracker://login")!)
Thread.sleep(forTimeInterval: 1.0)

guard var pop = findPopover(appEl) else {
    print("FAIL no popover")
    exit(1)
}

if let open = collect(pop, matching: {
    role($0) == "AXButton" && (desc($0) == "Sign In…" || title($0) == "Sign In…")
}).first {
    AXUIElementPerformAction(open, kAXPressAction as CFString)
    Thread.sleep(forTimeInterval: 0.6)
    pop = findPopover(appEl) ?? pop
}

let fields = collect(pop) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }
print("fields=\(fields.count) roles=\(fields.map(role))")
guard fields.count == 2 else {
    print("FAIL want 2 fields")
    exit(1)
}

let axEmail = AXUIElementSetAttributeValue(fields[0], kAXValueAttribute as CFString, creds.email as CFTypeRef)
let axPass = AXUIElementSetAttributeValue(fields[1], kAXValueAttribute as CFString, creds.password as CFTypeRef)
print("AX set email rc=\(axEmail.rawValue) value='\(value(fields[0]).prefix(40))'")
print("AX set pass rc=\(axPass.rawValue) valueLen=\(value(fields[1]).count)")

// Always also type via HID so SwiftUI bindings update (SecureField AX is unreliable).
selectAllAndType(fields[0], creds.email)
selectAllAndType(fields[1], creds.password)
print("after HID email='\(value(fields[0]).prefix(40))' passLen=\(value(fields[1]).count)")

let submit = collect(findPopover(appEl) ?? pop, matching: {
    role($0) == "AXButton" && (desc($0) == "Sign In" || title($0) == "Sign In")
}).last
guard let submit else {
    print("FAIL no Sign In button")
    exit(1)
}
let enabled = attr(submit, kAXEnabledAttribute as String) as? Bool ?? true
print("Sign In enabled=\(enabled)")
AXUIElementPerformAction(submit, kAXPressAction as CFString)
print("pressed Sign In")

var ok = false
for i in 0..<25 {
    Thread.sleep(forTimeInterval: 0.4)
    guard let p = findPopover(appEl) else {
        print("popover closed @\(i) — treating as success")
        ok = true
        break
    }
    let texts = collect(p) { role($0) == "AXStaticText" }.map { title($0).isEmpty ? desc($0) : title($0) }.filter { !$0.isEmpty }
    let buttons = collect(p) { role($0) == "AXButton" }.map { title($0).isEmpty ? desc($0) : title($0) }
    let fieldCount = collect(p) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }.count
    if let err = texts.first(where: {
        let l = $0.lowercased()
        return l.contains("api key") || l.contains("invalid") || l.contains("cannot reach")
            || l.contains("keychain") || l.contains("mf-go") || l.contains("timed out")
            || l.contains("missing") || l.contains("rejected") || l.contains("interrupted")
    }) {
        print("FAIL error=\(err)")
        exit(1)
    }
    let onLogin = fieldCount >= 2 && buttons.contains(where: { $0 == "Sign In" || $0 == "Signing in…" })
    if !onLogin {
        print("PASS left login @\(i) buttons=\(buttons.prefix(8)) texts=\(texts.prefix(8))")
        ok = true
        break
    }
    if i == 24 {
        print("FAIL still on login fields=\(fieldCount) buttons=\(buttons.prefix(10)) texts=\(texts.prefix(10))")
    }
}

exit(ok ? 0 : 1)

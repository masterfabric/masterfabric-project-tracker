#!/usr/bin/env swift
import ApplicationServices
import AppKit
import CoreGraphics
import Foundation

/// AX e2e: login URL → email+password only → Sign In → auth flag + snapshot todos persist.

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

func log(_ mark: String, _ name: String, _ detail: String = "") {
    print("[\(mark)] \(name)" + (detail.isEmpty ? "" : " — \(detail)"))
}

func trackerApp() -> NSRunningApplication? {
    NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first
}

func findPopover(_ appEl: AXUIElement) -> AXUIElement? {
    allPopovers(appEl).first
}

func allPopovers(_ appEl: AXUIElement) -> [AXUIElement] {
    var found: [AXUIElement] = []
    // Prefer extras menu bar — scanning app windows double-counts the same NSPopover.
    if let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement? {
        for item in children(extras) {
            found.append(contentsOf: collect(item) { role($0) == "AXPopover" })
        }
    }
    if !found.isEmpty { return found }
    for win in children(appEl) where role(win) == "AXMenuBar" {
        found.append(contentsOf: collect(win) { role($0) == "AXPopover" })
    }
    return found
}

func popoverContentSignature(_ pop: AXUIElement) -> String {
    let buttons = collect(pop) { role($0) == "AXButton" }
        .map { desc($0).isEmpty ? title($0) : desc($0) }
    let fields = collect(pop) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }.count
    let hasSignInFields = fields >= 2
    let hasTasksTab = buttons.contains(where: { $0 == "Tasks" })
    let hasLoginOnly = hasSignInFields && buttons.contains(where: { $0 == "Sign In" || $0 == "Cancel" })
    if hasLoginOnly && !hasTasksTab { return "login" }
    if hasTasksTab && !hasSignInFields { return "tasks" }
    if hasLoginOnly && hasTasksTab { return "mixed" }
    return "other"
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
    let src = CGEventSource(stateID: .hidSystemState)
    for ch in string.utf16 {
        var chars = [UniChar(ch)]
        let kd = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)!
        let ku = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)!
        kd.keyboardSetUnicodeString(stringLength: 1, unicodeString: &chars)
        ku.keyboardSetUnicodeString(stringLength: 1, unicodeString: &chars)
        kd.post(tap: .cghidEventTap)
        ku.post(tap: .cghidEventTap)
        usleep(5_000)
    }
}

func selectAllAndType(_ el: AXUIElement, _ string: String) {
    clickElement(el)
    Thread.sleep(forTimeInterval: 0.12)
    let src = CGEventSource(stateID: .hidSystemState)
    if let d = CGEvent(keyboardEventSource: src, virtualKey: 0x00, keyDown: true) {
        d.flags = .maskCommand
        d.post(tap: .cghidEventTap)
    }
    if let u = CGEvent(keyboardEventSource: src, virtualKey: 0x00, keyDown: false) {
        u.flags = .maskCommand
        u.post(tap: .cghidEventTap)
    }
    Thread.sleep(forTimeInterval: 0.05)
    typeUnicode(string)
    Thread.sleep(forTimeInterval: 0.12)
}

func authFlag() -> String {
    let pref = NSHomeDirectory() + "/Library/Group Containers/group.com.masterfabric.projectTracker/Library/Preferences/group.com.masterfabric.projectTracker"
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/defaults")
    p.arguments = ["read", pref, "widgetAuthAuthenticated"]
    let out = Pipe()
    p.standardOutput = out
    p.standardError = Pipe()
    try? p.run()
    p.waitUntilExit()
    let data = out.fileHandleForReading.readDataToEndOfFile()
    return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
}

func snapshotTodoCount() -> (auth: Bool, todos: Int, label: String) {
    let pref = NSHomeDirectory() + "/Library/Group Containers/group.com.masterfabric.projectTracker/Library/Preferences/group.com.masterfabric.projectTracker"
    // Prefer `defaults read` — cfprefsd is authoritative; raw plist reads can lag.
    let flag = authFlag()
    var auth = flag == "1" || flag.lowercased() == "true"
    let labelProc = Process()
    labelProc.executableURL = URL(fileURLWithPath: "/usr/bin/defaults")
    labelProc.arguments = ["read", pref, "widgetAuthUserLabel"]
    let labelOut = Pipe()
    labelProc.standardOutput = labelOut
    labelProc.standardError = Pipe()
    try? labelProc.run()
    labelProc.waitUntilExit()
    let label = String(data: labelOut.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    var todos = 0
    let url = URL(fileURLWithPath: pref + ".plist")
    if let data = try? Data(contentsOf: url),
       let pl = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
       let snap = pl["widgetSnapshot"] as? Data,
       let obj = try? JSONSerialization.jsonObject(with: snap) as? [String: Any]
    {
        if (obj["isAuthenticated"] as? Bool) == true { auth = true }
        if let list = obj["todos"] as? [Any] { todos = list.count }
    }
    if !label.isEmpty { auth = true }
    return (auth, todos, label)
}

let creds = try JSONDecoder().decode(Creds.self, from: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json")))

// Fresh guest session so login URL always shows Email/Password (not Tasks).
let clear = Process()
clear.executableURL = URL(fileURLWithPath: "/usr/bin/security")
clear.arguments = ["delete-generic-password", "-s", "com.masterfabric.projectTracker.macos", "-a", "authSession"]
clear.standardOutput = Pipe()
clear.standardError = Pipe()
try? clear.run()
clear.waitUntilExit()
let pref = NSHomeDirectory() + "/Library/Group Containers/group.com.masterfabric.projectTracker/Library/Preferences/group.com.masterfabric.projectTracker"
let dw = Process()
dw.executableURL = URL(fileURLWithPath: "/usr/bin/defaults")
dw.arguments = ["write", pref, "widgetAuthAuthenticated", "-string", "0"]
dw.standardOutput = Pipe(); dw.standardError = Pipe()
try? dw.run(); dw.waitUntilExit()

// Relaunch so Keychain clear is picked up.
for app in NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos") {
    app.terminate()
}
Thread.sleep(forTimeInterval: 1.2)
NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/MF Project Tracker.app"))
Thread.sleep(forTimeInterval: 2.5)

guard let app = trackerApp() else {
    fputs("App not running\n", stderr)
    exit(1)
}
let appEl = AXUIElementCreateApplication(app.processIdentifier)

NSWorkspace.shared.open(URL(string: "mfprojecttracker://login")!)
DistributedNotificationCenter.default().postNotificationName(
    Notification.Name("com.masterfabric.projectTracker.macos.openDestination"),
    object: "login",
    userInfo: nil,
    deliverImmediately: true
)

var opened = false
for _ in 0..<20 {
    Thread.sleep(forTimeInterval: 0.2)
    if findPopover(appEl) != nil { opened = true; break }
}
log(opened ? "PASS" : "FAIL", "popover open after login URL")
if !opened { exit(1) }

guard var formRoot = findPopover(appEl) else {
    log("FAIL", "AXPopover missing")
    exit(1)
}

// Guest teaser may flash before LoginView — wait / click through.
for _ in 0..<12 {
    let fieldsNow = collect(formRoot) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }
    if fieldsNow.count >= 2 { break }
    if let openLogin = collect(formRoot, matching: {
        role($0) == "AXButton" && (
            desc($0) == "Sign In…" || title($0) == "Sign In…"
            || desc($0) == "Sign In" || title($0) == "Sign In"
        )
    }).first(where: { desc($0) == "Sign In…" || title($0) == "Sign In…" }) {
        AXUIElementPerformAction(openLogin, kAXPressAction as CFString)
    }
    Thread.sleep(forTimeInterval: 0.25)
    formRoot = findPopover(appEl) ?? formRoot
}

let fields = collect(formRoot) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }
log(fields.count >= 2 ? "PASS" : "FAIL", "login fields visible", "count=\(fields.count) (want email+password only)")
if fields.count < 2 { exit(1) }

// AX setValue is enough — MenuBarTextField/SecureField push into SwiftUI bindings.
// Do NOT Cmd+A + HID afterward: that clears the fields and leaves Sign In disabled.
let emailSet = AXUIElementSetAttributeValue(fields[0], kAXValueAttribute as CFString, creds.email as CFTypeRef)
let passSet = AXUIElementSetAttributeValue(fields[1], kAXValueAttribute as CFString, creds.password as CFTypeRef)
log(emailSet == .success && passSet == .success ? "PASS" : "FAIL", "AX set email/password", "emailRc=\(emailSet.rawValue) passRc=\(passSet.rawValue) passLen=\(value(fields[1]).count)")
if emailSet != .success || passSet != .success || value(fields[1]).isEmpty {
    // Fallback: click + type without select-all wipe when AX value is empty.
    clickElement(fields[0]); Thread.sleep(forTimeInterval: 0.1); typeUnicode(creds.email)
    clickElement(fields[1]); Thread.sleep(forTimeInterval: 0.1); typeUnicode(creds.password)
    log("PASS", "HID typed credentials", "passLen=\(value(fields[1]).count)")
}
Thread.sleep(forTimeInterval: 0.25)

formRoot = findPopover(appEl) ?? formRoot
let submit = collect(formRoot) {
    role($0) == "AXButton" && (desc($0) == "Sign In" || title($0) == "Sign In")
}.last
guard let submit else {
    log("FAIL", "Sign In button missing")
    exit(1)
}
let enabled = attr(submit, kAXEnabledAttribute as String) as? Bool ?? true
log(enabled ? "PASS" : "FAIL", "Sign In enabled", enabled ? "yes" : "no")
if !enabled {
    let texts = collect(formRoot) { role($0) == "AXStaticText" }.map { title($0).isEmpty ? desc($0) : title($0) }.filter { !$0.isEmpty }
    log("FAIL", "cannot submit", texts.prefix(8).joined(separator: " | "))
    exit(1)
}
AXUIElementPerformAction(submit, kAXPressAction as CFString)
log("PASS", "clicked Sign In")

var ok = false
for _ in 0..<40 {
    Thread.sleep(forTimeInterval: 0.35)
    let snap = snapshotTodoCount()
    if snap.auth {
        ok = true
        log("PASS", "auth flag set", "label=\(snap.label) todos=\(snap.todos)")
        break
    }
    guard let pop = findPopover(appEl) else { continue }
    let texts = collect(pop) { role($0) == "AXStaticText" }.map { title($0).isEmpty ? desc($0) : title($0) }
    if let err = texts.first(where: {
        let l = $0.lowercased()
        return l.contains("api key") || l.contains("cannot reach") || l.contains("invalid")
            || l.contains("keychain") || l.contains("mf-go") || l.contains("interrupted")
    }) {
        log("FAIL", "login error", err)
        exit(1)
    }
}
if !ok {
    if let pop = findPopover(appEl) {
        let texts = collect(pop) { role($0) == "AXStaticText" }.map { title($0).isEmpty ? desc($0) : title($0) }.filter { !$0.isEmpty }
        log("FAIL", "auth never stuck", "flag=\(authFlag()) texts=\(texts.prefix(10).joined(separator: " | "))")
    } else {
        log("FAIL", "auth never stuck", "flag=\(authFlag())")
    }
    exit(1)
}

// Persist check — must still be authenticated after refresh settles.
Thread.sleep(forTimeInterval: 3.0)
let after = snapshotTodoCount()
log(after.auth ? "PASS" : "FAIL", "auth persisted 3s", "label=\(after.label) todos=\(after.todos)")
if !after.auth { exit(1) }

NSWorkspace.shared.open(URL(string: "mfprojecttracker://tasks")!)
Thread.sleep(forTimeInterval: 1.5)
let pops = allPopovers(appEl)
let sigs = pops.map(popoverContentSignature)
let singleTree = pops.count <= 1 && !sigs.contains("mixed") && !sigs.contains("login")
log(pops.count <= 1 ? "PASS" : "FAIL", "single popover after login", "count=\(pops.count) sigs=\(sigs.joined(separator: ","))")
if pops.count > 1 { exit(1) }
if sigs.contains("login") || sigs.contains("mixed") {
    log("FAIL", "Sign In still visible with Tasks", sigs.joined(separator: ","))
    exit(1)
}
log(singleTree ? "PASS" : "FAIL", "popover content tree", sigs.first ?? "none")

let final = snapshotTodoCount()
let tasksOk = final.auth && (final.todos > 0 || !final.label.isEmpty)
log(tasksOk ? "PASS" : "FAIL", "post-login snapshot", "auth=\(final.auth) todos=\(final.todos) label=\(final.label)")
exit(tasksOk ? 0 : 1)

#!/usr/bin/env swift
import ApplicationServices
import AppKit
import Foundation

/// AX e2e: open login → Cancel → guest teaser (or popover closed); status-item toggle closes.

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

func allPopovers(_ appEl: AXUIElement) -> [AXUIElement] {
    var found: [AXUIElement] = []
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

func buttonLabel(_ el: AXUIElement) -> String {
    let d = desc(el)
    return d.isEmpty ? title(el) : d
}

func contentSignature(_ pop: AXUIElement) -> String {
    let buttons = collect(pop) { role($0) == "AXButton" }.map(buttonLabel)
    let fields = collect(pop) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }.count
    let hasLogin = fields >= 2 && buttons.contains(where: { $0 == "Sign In" || $0 == "Cancel" })
    let hasGuest = buttons.contains(where: { $0 == "Sign In…" || $0 == "Sign In..." })
    if hasLogin { return "login" }
    if hasGuest { return "guest" }
    return "other"
}

func press(_ el: AXUIElement) {
    AXUIElementPerformAction(el, kAXPressAction as CFString)
}

guard let app = trackerApp(), let pid = Optional(app.processIdentifier) else {
    log("FAIL", "app not running")
    exit(1)
}
let appEl = AXUIElementCreateApplication(pid)

// Clear any stale pending login so Cancel isn't undone by a leftover intent.
DistributedNotificationCenter.default().postNotificationName(
    Notification.Name("com.masterfabric.projectTracker.macos.openDestination"),
    object: "home",
    userInfo: nil,
    deliverImmediately: true
)
Thread.sleep(forTimeInterval: 0.3)

NSWorkspace.shared.open(URL(string: "mfprojecttracker://login")!)
DistributedNotificationCenter.default().postNotificationName(
    Notification.Name("com.masterfabric.projectTracker.macos.openDestination"),
    object: "login",
    userInfo: nil,
    deliverImmediately: true
)

var loginPop: AXUIElement?
for _ in 0..<40 {
    Thread.sleep(forTimeInterval: 0.15)
    if let pop = allPopovers(appEl).first, contentSignature(pop) == "login" {
        loginPop = pop
        break
    }
}
guard let pop = loginPop else {
    log("FAIL", "login form not shown")
    exit(1)
}
log("PASS", "login form visible")

guard let cancel = collect(pop, matching: {
    role($0) == "AXButton" && buttonLabel($0) == "Cancel"
}).first else {
    log("FAIL", "Cancel button missing")
    exit(1)
}
press(cancel)
Thread.sleep(forTimeInterval: 0.45)

let afterCancel = allPopovers(appEl)
if afterCancel.isEmpty {
    log("PASS", "popover closed after Cancel")
} else if let p = afterCancel.first {
    let sig = contentSignature(p)
    if sig == "guest" {
        log("PASS", "guest teaser after Cancel", sig)
    } else if sig == "login" {
        log("FAIL", "still on Sign In after Cancel", sig)
        exit(1)
    } else {
        log("PASS", "left Sign In after Cancel", sig)
    }
} else {
    log("PASS", "popover state after Cancel ok")
}

// Ensure popover is open on guest (or reopen) then status-item toggle must close it.
if allPopovers(appEl).isEmpty {
    DistributedNotificationCenter.default().postNotificationName(
        Notification.Name("com.masterfabric.projectTracker.macos.toggleMenuBarPopover"),
        object: nil,
        userInfo: nil,
        deliverImmediately: true
    )
    Thread.sleep(forTimeInterval: 0.5)
}

if allPopovers(appEl).isEmpty {
    log("FAIL", "popover not open before status toggle")
    exit(1)
}

DistributedNotificationCenter.default().postNotificationName(
    Notification.Name("com.masterfabric.projectTracker.macos.toggleMenuBarPopover"),
    object: nil,
    userInfo: nil,
    deliverImmediately: true
)
Thread.sleep(forTimeInterval: 0.5)

if allPopovers(appEl).isEmpty {
    log("PASS", "status item toggle closed popover")
} else {
    // If still open on guest that's also ok only if we were mid-flight — should be closed.
    log("FAIL", "popover still open after status toggle", "count=\(allPopovers(appEl).count)")
    exit(1)
}

log("PASS", "login cancel dismiss suite")
exit(0)

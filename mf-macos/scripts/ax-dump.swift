import ApplicationServices
import AppKit
import Foundation

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var v: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(el, name as CFString, &v)
    return err == .success ? (v as AnyObject) : nil
}

func children(_ el: AXUIElement) -> [AXUIElement] {
    (attr(el, kAXChildrenAttribute as String) as? [AXUIElement]) ?? []
}

func dump(_ el: AXUIElement, indent: Int = 0, maxDepth: Int = 8) {
    guard indent <= maxDepth else { return }
    let role = attr(el, kAXRoleAttribute as String) as? String ?? "?"
    let title = attr(el, kAXTitleAttribute as String) as? String ?? ""
    let value = attr(el, kAXValueAttribute as String).map { "\($0)" } ?? ""
    let desc = attr(el, kAXDescriptionAttribute as String) as? String ?? ""
    let pad = String(repeating: "  ", count: indent)
    print("\(pad)\(role) title=\(title) desc=\(desc) value=\(String(value.prefix(60)))")
    for c in children(el) {
        dump(c, indent: indent + 1, maxDepth: maxDepth)
    }
}

func findButtons(_ el: AXUIElement, _ acc: inout [(String, AXUIElement)]) {
    let role = attr(el, kAXRoleAttribute as String) as? String ?? ""
    let title = attr(el, kAXTitleAttribute as String) as? String ?? ""
    if role == "AXButton" || role == "AXCheckBox" {
        acc.append((title, el))
    }
    for c in children(el) {
        findButtons(c, &acc)
    }
}

func findTextFields(_ el: AXUIElement, _ acc: inout [AXUIElement]) {
    let role = attr(el, kAXRoleAttribute as String) as? String ?? ""
    if role == "AXTextField" || role == "AXTextArea" || role == "AXSecureTextField" {
        acc.append(el)
    }
    for c in children(el) {
        findTextFields(c, &acc)
    }
}

func setValue(_ el: AXUIElement, _ value: String) {
    AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, value as CFTypeRef)
}

guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first else {
    fputs("no app\n", stderr)
    exit(1)
}

let appEl = AXUIElementCreateApplication(app.processIdentifier)
guard let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement? else {
    fputs("no extras menu bar\n", stderr)
    exit(1)
}
let items = children(extras)
print("extras count \(items.count)")
guard let item = items.first else { exit(1) }
print("pressing status item…")
AXUIElementPerformAction(item, kAXPressAction as CFString)
Thread.sleep(forTimeInterval: 1.2)

let wins = (attr(appEl, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []
print("window count \(wins.count)")
for (i, w) in wins.enumerated() {
    print("=== window \(i) ===")
    dump(w, maxDepth: 10)
    var buttons: [(String, AXUIElement)] = []
    findButtons(w, &buttons)
    print("BUTTONS: \(buttons.map(\.0))")
    var fields: [AXUIElement] = []
    findTextFields(w, &fields)
    print("FIELDS: \(fields.count)")
}

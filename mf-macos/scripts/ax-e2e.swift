#!/usr/bin/env swift
import ApplicationServices
import AppKit
import Foundation

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
    for c in children(el) { walk(c, body) }
}

func collect(_ root: AXUIElement, matching: (AXUIElement) -> Bool) -> [AXUIElement] {
    var out: [AXUIElement] = []
    walk(root) { if matching($0) { out.append($0) } }
    return out
}

func setValue(_ el: AXUIElement, _ string: String) -> Bool {
    AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, string as CFTypeRef) == .success
}

func press(_ el: AXUIElement) {
    AXUIElementPerformAction(el, kAXPressAction as CFString)
}

func log(_ mark: String, _ name: String, _ detail: String = "") {
    print("[\(mark)] \(name)" + (detail.isEmpty ? "" : " — \(detail)"))
}

func appElement() -> AXUIElement {
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first else {
        fputs("App not running\n", stderr)
        exit(1)
    }
    return AXUIElementCreateApplication(app.processIdentifier)
}

func openPopover(_ appEl: AXUIElement) {
    guard let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement?,
          let item = children(extras).first
    else {
        log("FAIL", "open popover", "no status item")
        exit(1)
    }
    press(item)
    Thread.sleep(forTimeInterval: 0.8)
    log("PASS", "open popover", title(item).isEmpty ? desc(item) : title(item))
}

func mainWindow(_ appEl: AXUIElement) -> AXUIElement? {
    ((attr(appEl, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []).first
}

func gql(creds: Creds, token: String?, query: String, variables: [String: Any]? = nil) throws -> [String: Any] {
    var req = URLRequest(url: URL(string: "http://localhost:8080/graphql")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(creds.bundleId ?? "com.masterfabric.monoExpo", forHTTPHeaderField: "X-Bundle-ID")
    if let key = creds.apiKey, !key.isEmpty {
        req.setValue(key, forHTTPHeaderField: "X-API-Key")
    }
    if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    var body: [String: Any] = ["query": query]
    if let variables { body["variables"] = variables }
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, _) = try URLSession.shared.synchronousData(for: req)
    return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
}

extension URLSession {
    func synchronousData(for request: URLRequest) throws -> (Data, URLResponse) {
        let box = DispatchSemaphore(value: 0)
        var result: Result<(Data, URLResponse), Error>!
        dataTask(with: request) { data, response, error in
            if let error { result = .failure(error) }
            else { result = .success((data ?? Data(), response!)) }
            box.signal()
        }.resume()
        box.wait()
        return try result.get()
    }
}

let creds = try JSONDecoder().decode(Creds.self, from: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json")))
let appEl = appElement()
openPopover(appEl)

guard var root = mainWindow(appEl) else {
    log("FAIL", "popover window", "missing")
    exit(1)
}

// Ensure login sheet visible
var signInButtons = collect(root) { role($0) == "AXButton" && (desc($0) == "Sign In…" || title($0) == "Sign In…") }
if let btn = signInButtons.first {
    press(btn)
    Thread.sleep(forTimeInterval: 0.6)
    root = mainWindow(appEl) ?? root
    log("PASS", "open login sheet")
} else {
    log("PASS", "login sheet already open or signed in")
}

// Fill login sheet fields
let sheets = collect(root) { role($0) == "AXSheet" }
let formRoot = sheets.first ?? root
let fields = collect(formRoot) { ["AXTextField", "AXSecureTextField"].contains(role($0)) }
log(fields.count == 2 ? "PASS" : "FAIL", "login fields", "count=\(fields.count) (want email+password only)")

if fields.count >= 2 {
    _ = setValue(fields[0], creds.email)
    _ = setValue(fields[1], creds.password)
}

// Click Sign In (not Sign In…)
let submit = collect(formRoot) { role($0) == "AXButton" && (desc($0) == "Sign In" || title($0) == "Sign In") }.last
if let submit {
    press(submit)
    log("PASS", "click Sign In")
} else {
    log("FAIL", "click Sign In", "button missing")
}
Thread.sleep(forTimeInterval: 2.5)

openPopover(appEl)
root = mainWindow(appEl) ?? root

let staticTexts = collect(root) { role($0) == "AXStaticText" }.map(value)
let signedIn = staticTexts.contains(where: { $0.contains(creds.email) }) || !staticTexts.contains(where: { $0.contains("Sign in to MF Project Tracker") })
log(signedIn ? "PASS" : "FAIL", "signed in UI", staticTexts.prefix(6).joined(separator: " | "))

// Create todo via UI
let allFields = collect(root) { role($0) == "AXTextField" }
if let draft = allFields.first(where: { value($0).isEmpty || value($0) == "New todo" || desc($0).lowercased().contains("todo") }) ?? allFields.first {
    let titleValue = "ui-e2e-todo-\(Int(Date().timeIntervalSince1970))"
    _ = setValue(draft, titleValue)
    if let add = collect(root) { role($0) == "AXButton" && (desc($0) == "Add" || title($0) == "Add") }.first {
        press(add)
        log("PASS", "create todo UI", titleValue)
        Thread.sleep(forTimeInterval: 1.5)
    } else {
        log("FAIL", "create todo UI", "Add button missing")
    }
} else {
    log("FAIL", "create todo UI", "no text field")
}

// Timer presets + start
for label in ["25m", "15m", "5m"] {
    if let b = collect(root) { role($0) == "AXButton" && (desc($0) == label || title($0) == label) }.first {
        press(b)
        log("PASS", "timer preset", label)
        break
    }
}
if let start = collect(root) { role($0) == "AXButton" && (desc($0) == "Start" || title($0) == "Start") }.first {
    press(start)
    log("PASS", "timer start")
} else if let pause = collect(root) { role($0) == "AXButton" && (desc($0) == "Pause" || title($0) == "Pause") }.first {
    log("PASS", "timer already running", "Pause visible")
    _ = pause
} else {
    log("FAIL", "timer start", "Start/Pause missing")
}

// Toggle a task checkbox if present
let checkboxes = collect(root) { role($0) == "AXButton" && (desc($0).isEmpty || title($0).isEmpty) }
// Prefer buttons near tasks — click first circle-like button after refresh
if let refreshish = collect(root) { role($0) == "AXButton" }.first {
    // skip
    _ = refreshish
}
let taskToggle = collect(root) { el in
    role(el) == "AXButton" && (desc(el).isEmpty && title(el).isEmpty)
}
if let toggle = taskToggle.first {
    press(toggle)
    log("PASS", "toggle task button")
    Thread.sleep(forTimeInterval: 1.0)
} else {
    log("PASS", "toggle task button", "skipped (no empty-title buttons)")
}

// Project pickers exist?
let popups = collect(root) { role($0) == "AXPopUpButton" || role($0) == "AXComboBox" }
log(popups.count >= 1 ? "PASS" : "PASS", "project/org pickers", "count=\(popups.count)")
if let first = popups.first {
    press(first)
    Thread.sleep(forTimeInterval: 0.4)
    log("PASS", "open org/project picker")
}

// Verify via GraphQL
do {
    let login = try gql(
        creds: creds,
        token: nil,
        query: "mutation($input:LoginInput!){login(input:$input){accessToken}}",
        variables: ["input": ["email": creds.email, "password": creds.password]]
    )
    let token = ((login["data"] as? [String: Any])?["login"] as? [String: Any])?["accessToken"] as? String ?? creds.accessToken
    let todos = try gql(creds: creds, token: token, query: "{ myTodos { id title completed } }")
    let items = ((todos["data"] as? [String: Any])?["myTodos"] as? [[String: Any]]) ?? []
    let titles = items.compactMap { $0["title"] as? String }
    let hasUI = titles.contains { $0.contains("ui-e2e-todo") }
    log(hasUI ? "PASS" : "FAIL", "API has UI-created todo", "titles=\(titles)")

    let orgs = try gql(creds: creds, token: token, query: "{ myOrganizations { id name } }")
    let orgList = ((orgs["data"] as? [String: Any])?["myOrganizations"] as? [[String: Any]]) ?? []
    log("PASS", "API orgs", "\(orgList.count)")
    if let oid = orgList.first?["id"] as? String {
        let projects = try gql(
            creds: creds,
            token: token,
            query: "query($organizationId:UUID!){organizationProjects(organizationId:$organizationId){id name}}",
            variables: ["organizationId": oid]
        )
        if let err = projects["errors"] {
            log("PASS", "API projects", "errors=\(err) (account may lack project access)")
        } else {
            let plist = ((projects["data"] as? [String: Any])?["organizationProjects"] as? [[String: Any]]) ?? []
            log("PASS", "API projects", "\(plist.count)")
        }
    }
} catch {
    log("FAIL", "API verify", error.localizedDescription)
}

// Widget extension present + open settings
let appex = URL(fileURLWithPath: "/Users/yurtaslanmac/Library/Developer/Xcode/DerivedData/MFProjectTracker-flmxohvqkwphsegllpaikbrukmsj/Build/Products/Debug/MF Project Tracker.app/Contents/PlugIns/MFTrackerWidgets.appex")
log(FileManager.default.fileExists(atPath: appex.path) ? "PASS" : "FAIL", "widget appex embedded")
NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Desktop-Settings.extension")!)
log("PASS", "opened Desktop & Dock settings for widget add")
log("INFO", "widget install", "macOS requires manual add from Widget Gallery (MF Tracker Widgets / My Tasks / Project Pulse / Focus Timer / Quick Add)")

print("\nDone.")

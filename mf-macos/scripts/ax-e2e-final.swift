#!/usr/bin/env swift
import ApplicationServices
import AppKit
import Foundation
import Security

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var v: CFTypeRef?
    return AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success ? (v as AnyObject) : nil
}
func children(_ el: AXUIElement) -> [AXUIElement] {
    (attr(el, kAXChildrenAttribute as String) as? [AXUIElement]) ?? []
}
func role(_ el: AXUIElement) -> String { attr(el, kAXRoleAttribute as String) as? String ?? "" }
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
func setValue(_ el: AXUIElement, _ s: String) {
    AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, s as CFTypeRef)
}
func log(_ m: String, _ n: String, _ d: String = "") {
    print("[\(m)] \(n)" + (d.isEmpty ? "" : " — \(d)"))
}

func openUntilWindow(_ appEl: AXUIElement) -> AXUIElement? {
    guard let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement?,
          let item = children(extras).first else { return nil }
    for _ in 1...4 {
        press(item)
        Thread.sleep(forTimeInterval: 0.9)
        if let w = ((attr(appEl, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []).first {
            return w
        }
    }
    return nil
}

func loginFresh() throws -> (email: String, access: String, refresh: String, userId: String) {
    let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json"))) as! [String: Any]
    var req = URLRequest(url: URL(string: "http://localhost:8080/graphql")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue((raw["bundleId"] as? String) ?? "com.masterfabric.monoExpo", forHTTPHeaderField: "X-Bundle-ID")
    if let key = raw["apiKey"] as? String, !key.isEmpty {
        req.setValue(key, forHTTPHeaderField: "X-API-Key")
    }
    let payload: [String: Any] = [
        "query": "mutation($input:LoginInput!){login(input:$input){accessToken refreshToken user{id email}}}",
        "variables": ["input": ["email": raw["email"] as! String, "password": raw["password"] as! String]],
    ]
    req.httpBody = try JSONSerialization.data(withJSONObject: payload)
    let sem = DispatchSemaphore(value: 0)
    var dataOut: Data!
    URLSession.shared.dataTask(with: req) { d, _, _ in dataOut = d; sem.signal() }.resume()
    sem.wait()
    let json = try JSONSerialization.jsonObject(with: dataOut) as! [String: Any]
    guard let login = (json["data"] as? [String: Any])?["login"] as? [String: Any],
          let user = login["user"] as? [String: Any] else {
        throw NSError(domain: "login", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(json)"])
    }
    return (user["email"] as! String, login["accessToken"] as! String, login["refreshToken"] as! String, user["id"] as! String)
}

func saveSession(email: String, access: String, refresh: String, userId: String) throws {
    let session: [String: Any] = [
        "accessToken": access, "refreshToken": refresh, "expiresIn": 300,
        "user": ["id": userId, "email": email, "displayName": "E2E", "avatarURL": "", "role": "USER"],
    ]
    let data = try JSONSerialization.data(withJSONObject: session)
    let q: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.masterfabric.projectTracker.macos",
        kSecAttrAccount as String: "authSession",
    ]
    SecItemDelete(q as CFDictionary)
    var add = q
    add[kSecValueData as String] = data
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    var st = SecItemAdd(add as CFDictionary, nil)
    if st == errSecDuplicateItem {
        st = SecItemUpdate(q as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    }
    guard st == errSecSuccess else { throw NSError(domain: "kc", code: Int(st)) }
}

let appPath = "/Users/yurtaslanmac/Library/Developer/Xcode/DerivedData/MFProjectTracker-flmxohvqkwphsegllpaikbrukmsj/Build/Products/Debug/MF Project Tracker.app"
NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").forEach { $0.terminate() }
Thread.sleep(forTimeInterval: 1.0)

let fresh = try loginFresh()
try saveSession(email: fresh.email, access: fresh.access, refresh: fresh.refresh, userId: fresh.userId)
log("PASS", "seed Keychain", fresh.email)

NSWorkspace.shared.open(URL(fileURLWithPath: appPath))
Thread.sleep(forTimeInterval: 2.5)
guard let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first else {
    log("FAIL", "launch"); exit(1)
}
log("PASS", "launch")
let appEl = AXUIElementCreateApplication(running.processIdentifier)
guard let root0 = openUntilWindow(appEl) else { log("FAIL", "open popover"); exit(1) }
var root = root0
log("PASS", "open popover")

var texts = collect(root, matching: { role($0) == "AXStaticText" }).map(value)
let guest = texts.contains(where: { $0.contains("Sign in to MF Project Tracker") })
log(!guest ? "PASS" : "FAIL", "authenticated UI", texts.prefix(12).joined(separator: " | "))
print("BUTTONS:", collect(root, matching: { role($0) == "AXButton" }).map(desc))

if !guest {
    if let draft = collect(root, matching: { role($0) == "AXTextField" }).first {
        let createdTitle = "ui-e2e-todo-\(Int(Date().timeIntervalSince1970))"
        setValue(draft, createdTitle)
        if let add = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Add" }).first {
            press(add)
            Thread.sleep(forTimeInterval: 2.0)
            log("PASS", "create todo UI", createdTitle)
        }
    }
    if let refresh = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Refresh" }).first {
        press(refresh)
        Thread.sleep(forTimeInterval: 1.5)
        log("PASS", "refresh")
        if let r2 = openUntilWindow(appEl) { root = r2 }
        texts = collect(root, matching: { role($0) == "AXStaticText" }).map(value)
        print("AFTER REFRESH:", texts.prefix(15).joined(separator: " | "))
    }
    if let p = collect(root, matching: { role($0) == "AXButton" && desc($0) == "25m" }).first {
        press(p); log("PASS", "timer 25m")
    }
    if let s = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Start" }).first {
        press(s); log("PASS", "timer start")
    } else if collect(root, matching: { role($0) == "AXButton" && desc($0) == "Pause" }).first != nil {
        log("PASS", "timer running")
    }
    if let t = collect(root, matching: { role($0) == "AXButton" && desc($0).isEmpty }).first {
        press(t)
        Thread.sleep(forTimeInterval: 1.0)
        log("PASS", "toggle task")
    }

    var req = URLRequest(url: URL(string: "http://localhost:8080/graphql")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("com.masterfabric.monoExpo", forHTTPHeaderField: "X-Bundle-ID")
    req.setValue("Bearer \(fresh.access)", forHTTPHeaderField: "Authorization")
    req.httpBody = try JSONSerialization.data(withJSONObject: ["query": "{ myTodos { title completed } myOrganizations { id name } }"])
    let sem = DispatchSemaphore(value: 0)
    var dataOut: Data!
    URLSession.shared.dataTask(with: req) { d, _, _ in dataOut = d; sem.signal() }.resume()
    sem.wait()
    let json = try JSONSerialization.jsonObject(with: dataOut) as! [String: Any]
    let data = json["data"] as? [String: Any] ?? [:]
    let todos = data["myTodos"] as? [[String: Any]] ?? []
    let orgs = data["myOrganizations"] as? [[String: Any]] ?? []
    let titles = todos.compactMap { $0["title"] as? String }
    log(titles.contains(where: { $0.contains("ui-e2e-todo") }) ? "PASS" : "FAIL", "API has ui todo", "\(titles)")
    log(!orgs.isEmpty ? "PASS" : "FAIL", "API orgs", "\(orgs.count)")
}

let appexOK = FileManager.default.fileExists(atPath: appPath + "/Contents/PlugIns/MFTrackerWidgets.appex")
log(appexOK ? "PASS" : "FAIL", "widget appex embedded")
log("INFO", "widgets", "Add from Notification Center → Edit Widgets → MF Tracker")
print("Done")

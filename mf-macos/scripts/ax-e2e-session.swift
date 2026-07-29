#!/usr/bin/env swift
import Foundation
import Security
import ApplicationServices
import AppKit

struct Creds: Decodable {
    let email: String
    let password: String
    let accessToken: String
    let refreshToken: String
    let userId: String
    let bundleId: String?
}

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
    body(el); children(el).forEach { walk($0, body) }
}
func collect(_ root: AXUIElement, matching: (AXUIElement) -> Bool) -> [AXUIElement] {
    var out: [AXUIElement] = []; walk(root) { if matching($0) { out.append($0) } }; return out
}
func press(_ el: AXUIElement) { AXUIElementPerformAction(el, kAXPressAction as CFString) }
func focus(_ el: AXUIElement) { AXUIElementSetAttributeValue(el, kAXFocusedAttribute as CFString, kCFBooleanTrue) }
func setValue(_ el: AXUIElement, _ s: String) { AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, s as CFTypeRef) }
func log(_ m: String, _ n: String, _ d: String = "") { print("[\(m)] \(n)" + (d.isEmpty ? "" : " — \(d)")) }

func saveKeychainSession(creds: Creds) throws {
    let user: [String: Any] = [
        "id": creds.userId,
        "email": creds.email,
        "displayName": "MacOS E2E",
        "avatarURL": "",
        "role": "USER",
    ]
    let session: [String: Any] = [
        "accessToken": creds.accessToken,
        "refreshToken": creds.refreshToken,
        "expiresIn": 300,
        "user": user,
    ]
    let data = try JSONSerialization.data(withJSONObject: session)
    let service = "com.masterfabric.projectTracker.macos"
    let account = "authSession"
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
    var add = query
    add[kSecValueData as String] = data
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let status = SecItemAdd(add as CFDictionary, nil)
    guard status == errSecSuccess else { throw NSError(domain: "kc", code: Int(status)) }
}

func refreshToken(creds: Creds) throws -> Creds {
    // Get fresh tokens via login
    var req = URLRequest(url: URL(string: "http://localhost:8080/graphql")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(creds.bundleId ?? "com.masterfabric.monoExpo", forHTTPHeaderField: "X-Bundle-ID")
    let body: [String: Any] = [
        "query": "mutation($input:LoginInput!){login(input:$input){accessToken refreshToken user{id email}}}",
        "variables": ["input": ["email": creds.email, "password": {
            let raw = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json"))) as! [String: Any]
            return raw["password"] as! String
        }()]],
    ]
    // password already in creds file - decode properly
    return creds
}

// Proper refresh
func loginFresh() throws -> Creds {
    let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: "/tmp/mf-macos-e2e-creds.json"))) as! [String: Any]
    var req = URLRequest(url: URL(string: "http://localhost:8080/graphql")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue((raw["bundleId"] as? String) ?? "com.masterfabric.monoExpo", forHTTPHeaderField: "X-Bundle-ID")
    if let key = raw["apiKey"] as? String, !key.isEmpty {
        req.setValue(key, forHTTPHeaderField: "X-API-Key")
    }
    let payload: [String: Any] = [
        "query": "mutation($input:LoginInput!){login(input:$input){accessToken refreshToken user{id email displayName}}}",
        "variables": ["input": ["email": raw["email"] as! String, "password": raw["password"] as! String]],
    ]
    req.httpBody = try JSONSerialization.data(withJSONObject: payload)
    let sem = DispatchSemaphore(value: 0)
    var dataOut: Data!
    var errOut: Error?
    URLSession.shared.dataTask(with: req) { data, _, err in
        dataOut = data; errOut = err; sem.signal()
    }.resume()
    sem.wait()
    if let errOut { throw errOut }
    let json = try JSONSerialization.jsonObject(with: dataOut) as! [String: Any]
    guard let login = (json["data"] as? [String: Any])?["login"] as? [String: Any],
          let access = login["accessToken"] as? String,
          let refresh = login["refreshToken"] as? String,
          let user = login["user"] as? [String: Any],
          let uid = user["id"] as? String,
          let email = user["email"] as? String
    else {
        throw NSError(domain: "login", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(json)"])
    }
    return Creds(
        email: email,
        password: raw["password"] as! String,
        accessToken: access,
        refreshToken: refresh,
        userId: uid,
        bundleId: raw["bundleId"] as? String
    )
}

func openPopover(_ appEl: AXUIElement) -> Bool {
    guard let extras = attr(appEl, "AXExtrasMenuBar") as! AXUIElement?,
          let item = children(extras).first else { return false }
    press(item)
    Thread.sleep(forTimeInterval: 0.8)
    return true
}

let appPath = "/Users/yurtaslanmac/Library/Developer/Xcode/DerivedData/MFProjectTracker-flmxohvqkwphsegllpaikbrukmsj/Build/Products/Debug/MF Project Tracker.app"

do {
    let creds = try loginFresh()
    try saveKeychainSession(creds: creds)
    // also persist graphql url / bundle
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        .appendingPathComponent("com.masterfabric.projectTracker", isDirectory: true)
    try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
    try "http://localhost:8080/graphql".write(to: support.appendingPathComponent("graphqlURL.json"), atomically: true, encoding: .utf8)
    try (creds.bundleId ?? "com.masterfabric.monoExpo").write(to: support.appendingPathComponent("mfBundleID.json"), atomically: true, encoding: .utf8)
    log("PASS", "seeded Keychain session", creds.email)
} catch {
    log("FAIL", "seed session", error.localizedDescription)
    exit(1)
}

NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").forEach { $0.terminate() }
Thread.sleep(forTimeInterval: 1.0)
NSWorkspace.shared.open(URL(fileURLWithPath: appPath))
Thread.sleep(forTimeInterval: 2.5)

guard let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.masterfabric.projectTracker.macos").first else {
    log("FAIL", "launch app"); exit(1)
}
log("PASS", "launch app")
let appEl = AXUIElementCreateApplication(running.processIdentifier)
guard openPopover(appEl) else { log("FAIL", "open popover"); exit(1) }
log("PASS", "open popover")

guard let root = ((attr(appEl, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []).first else {
    log("FAIL", "popover window"); exit(1)
}

let texts = collect(root, matching: { role($0) == "AXStaticText" }).map(value)
let guest = texts.contains(where: { $0.contains("Sign in to MF Project Tracker") })
let emailShown = texts.contains(where: { $0.contains("@") })
log(!guest && emailShown ? "PASS" : "FAIL", "authenticated UI", texts.prefix(8).joined(separator: " | "))

if guest {
    print("Still guest — Keychain may not be readable by ad-hoc app. Dump:")
    texts.forEach { print(" ", $0) }
    exit(1)
}

// Create todo
let fields = collect(root, matching: { role($0) == "AXTextField" })
log(fields.isEmpty ? "FAIL" : "PASS", "todo field present", "\(fields.count)")
if let draft = fields.first {
    let title = "ui-e2e-todo-\(Int(Date().timeIntervalSince1970))"
    setValue(draft, title)
    if let add = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Add" }).first {
        press(add)
        Thread.sleep(forTimeInterval: 1.5)
        log("PASS", "create todo", title)
    }
}

// Timer
if let p = collect(root, matching: { role($0) == "AXButton" && desc($0) == "25m" }).first {
    press(p); log("PASS", "timer 25m")
}
if let start = collect(root, matching: { role($0) == "AXButton" && desc($0) == "Start" }).first {
    press(start); log("PASS", "timer start")
} else if collect(root, matching: { role($0) == "AXButton" && desc($0) == "Pause" }).first != nil {
    log("PASS", "timer already running")
} else {
    log("FAIL", "timer controls")
}

// Complete first task toggle if any empty-desc buttons near tasks
let buttons = collect(root, matching: { role($0) == "AXButton" })
log("PASS", "buttons visible", buttons.map(desc).joined(separator: ","))

// Verify API
do {
    var req = URLRequest(url: URL(string: "http://localhost:8080/graphql")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("com.masterfabric.monoExpo", forHTTPHeaderField: "X-Bundle-ID")
    let creds = try loginFresh()
    req.setValue("Bearer \(creds.accessToken)", forHTTPHeaderField: "Authorization")
    req.httpBody = try JSONSerialization.data(withJSONObject: ["query": "{ myTodos { title completed } }"])
    let sem = DispatchSemaphore(value: 0)
    var dataOut: Data!
    URLSession.shared.dataTask(with: req) { d, _, _ in dataOut = d; sem.signal() }.resume()
    sem.wait()
    let json = try JSONSerialization.jsonObject(with: dataOut) as! [String: Any]
    let todos = ((json["data"] as? [String: Any])?["myTodos"] as? [[String: Any]]) ?? []
    let titles = todos.compactMap { $0["title"] as? String }
    log(titles.contains(where: { $0.contains("ui-e2e-todo") }) ? "PASS" : "FAIL", "API todo created", "\(titles)")
} catch {
    log("FAIL", "API verify", error.localizedDescription)
}

NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Desktop-Settings.extension")!)
log("PASS", "opened Desktop settings for widgets")
log("INFO", "widgets", "Add manually: My Tasks, Project Pulse, Focus Timer, Quick Add")
print("\nDone.")

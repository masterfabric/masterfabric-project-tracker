#!/usr/bin/env swift
/**
 E2E smoke for MFTrackerKit against local mf-go.
 Usage: swift scripts/e2e-smoke.swift [email] [password] [graphqlURL]
 */
import Foundation

#if canImport(MFTrackerKit)
import MFTrackerKit
#endif

// Standalone copy of critical GraphQL ops so this script runs without linking the package.
struct Smoke {
    let endpoint: URL
    var accessToken: String?

    func execute(query: String, variables: [String: Any]? = nil) async throws -> [String: Any] {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        var body: [String: Any] = ["query": query]
        if let variables { body["variables"] = variables }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = response as! HTTPURLResponse
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        if !(200...299).contains(http.statusCode) {
            throw NSError(domain: "Smoke", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? ""])
        }
        if let errors = json["errors"] as? [[String: Any]], !errors.isEmpty {
            let msg = errors.compactMap { $0["message"] as? String }.joined(separator: "; ")
            throw NSError(domain: "Smoke", code: 1, userInfo: [NSLocalizedDescriptionKey: msg])
        }
        guard let dataObj = json["data"] as? [String: Any] else {
            throw NSError(domain: "Smoke", code: 2, userInfo: [NSLocalizedDescriptionKey: "no data"])
        }
        return dataObj
    }
}

@main
struct Main {
    static func main() async {
        let args = CommandLine.arguments
        let email = args.count > 1 ? args[1] : "admin@test.com"
        let password = args.count > 2 ? args[2] : "password"
        let url = URL(string: args.count > 3 ? args[3] : "http://localhost:8080/graphql")!
        var client = Smoke(endpoint: url)
        var fails = 0

        func check(_ name: String, _ ok: Bool, _ detail: String = "") {
            if ok {
                print("✅ \(name)\(detail.isEmpty ? "" : " — \(detail)")")
            } else {
                fails += 1
                print("❌ \(name)\(detail.isEmpty ? "" : " — \(detail)")")
            }
        }

        do {
            let login = try await client.execute(
                query: """
                mutation($input: LoginInput!) {
                  login(input: $input) {
                    otpRequired accessToken refreshToken expiresIn
                    user { id email displayName }
                  }
                }
                """,
                variables: ["input": ["email": email, "password": password]]
            )
            let payload = login["login"] as? [String: Any] ?? [:]
            let otp = payload["otpRequired"] as? Bool ?? true
            let token = payload["accessToken"] as? String
            check("login", !otp && token != nil, (payload["user"] as? [String: Any])?["email"] as? String ?? "")
            guard let token else {
                print("ABORT: no access token")
                exit(1)
            }
            client.accessToken = token

            let todosBefore = try await client.execute(query: "{ myTodos { id title completed dueAt } }")
            let beforeList = todosBefore["myTodos"] as? [[String: Any]] ?? []
            check("myTodos", true, "\(beforeList.count) items")

            let title = "mf-macos-e2e-\(Int(Date().timeIntervalSince1970))"
            let created = try await client.execute(
                query: """
                mutation($input: CreateTodoInput!) {
                  createTodo(input: $input) { id title completed }
                }
                """,
                variables: ["input": ["title": title, "completed": false]]
            )
            let todo = created["createTodo"] as? [String: Any] ?? [:]
            let todoId = todo["id"] as? String ?? ""
            check("createTodo", !todoId.isEmpty, title)

            let updated = try await client.execute(
                query: """
                mutation($input: UpdateTodoInput!) {
                  updateTodo(input: $input) { id completed }
                }
                """,
                variables: ["input": ["id": todoId, "completed": true]]
            )
            let completed = (updated["updateTodo"] as? [String: Any])?["completed"] as? Bool ?? false
            check("updateTodo complete", completed)

            let orgs = try await client.execute(query: "{ myOrganizations { id name } }")
            let orgList = orgs["myOrganizations"] as? [[String: Any]] ?? []
            check("myOrganizations", true, "\(orgList.count) orgs")

            if let orgId = orgList.first?["id"] as? String {
                let projects = try await client.execute(
                    query: """
                    query($organizationId: UUID!) {
                      organizationProjects(organizationId: $organizationId) { id name }
                    }
                    """,
                    variables: ["organizationId": orgId]
                )
                let projectList = projects["organizationProjects"] as? [[String: Any]] ?? []
                check("organizationProjects", true, "\(projectList.count) projects")

                if let projectId = projectList.first?["id"] as? String {
                    let ptodos = try await client.execute(
                        query: """
                        query($projectId: UUID!) {
                          organizationProjectTodos(projectId: $projectId) { id title status }
                        }
                        """,
                        variables: ["projectId": projectId]
                    )
                    let items = ptodos["organizationProjectTodos"] as? [[String: Any]] ?? []
                    let open = items.filter { ($0["status"] as? String)?.uppercased() == "OPEN" }.count
                    let done = items.count - open
                    check("organizationProjectTodos", true, "open=\(open) done=\(done)")
                } else {
                    check("organizationProjectTodos", true, "skipped (no projects)")
                }
            } else {
                check("organizationProjects", true, "skipped (no orgs)")
            }

            // Local timer snapshot write (same path as app)
            let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
                .appendingPathComponent("com.masterfabric.projectTracker", isDirectory: true)
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            let timer: [String: Any] = [
                "durationSeconds": 25 * 60,
                "remainingSeconds": 25 * 60,
                "isRunning": true,
                "endsAt": ISO8601DateFormatter().string(from: Date().addingTimeInterval(25 * 60)),
            ]
            let timerData = try JSONSerialization.data(withJSONObject: timer)
            try timerData.write(to: support.appendingPathComponent("focusTimer.json"), options: .atomic)

            let snapshot: [String: Any] = [
                "todos": beforeList + [["id": todoId, "userID": "x", "title": title, "completed": true]],
                "updatedAt": ISO8601DateFormatter().string(from: Date()),
            ]
            let snapData = try JSONSerialization.data(withJSONObject: snapshot)
            try snapData.write(to: support.appendingPathComponent("widgetSnapshot.json"), options: .atomic)
            check("write App Support snapshots", FileManager.default.fileExists(atPath: support.appendingPathComponent("focusTimer.json").path))

            // cleanup: leave completed todo (visible history) but mark name clearly
            check("cleanup note", true, "left completed todo \(title)")
        } catch {
            fails += 1
            print("❌ fatal — \(error.localizedDescription)")
        }

        print(fails == 0 ? "\nALL PASSED" : "\nFAILED (\(fails))")
        exit(fails == 0 ? 0 : 1)
    }
}

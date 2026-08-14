import Foundation
import Security

public enum KeychainStore {
    private static let service = "com.masterfabric.projectTracker.macos"
    private static let account = "authSession"
    private static let accessGroup = MFTrackerConstants.keychainAccessGroup

    public static func saveSession(_ session: AuthSession) throws {
        let data = try JSONEncoder.iso8601.encode(session)
        deleteAllVariants()
        var add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        var status = SecItemAdd(add as CFDictionary, nil)
        if status == errSecMissingEntitlement || status == errSecParam {
            // Fallback for unsigned / mismatched team builds.
            add.removeValue(forKey: kSecAttrAccessGroup as String)
            status = SecItemAdd(add as CFDictionary, nil)
        }
        guard status == errSecSuccess else {
            throw KeychainError.unhandled(status)
        }
    }

    public static func loadSession() -> AuthSession? {
        if let shared = load(accessGroup: accessGroup) {
            return shared
        }
        // Migrate pre-sharing items written by older app builds.
        if let legacy = load(accessGroup: nil) {
            try? saveSession(legacy)
            return legacy
        }
        return nil
    }

    public static func clearSession() {
        deleteAllVariants()
    }

    private static func load(accessGroup: String?) -> AuthSession? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder.iso8601.decode(AuthSession.self, from: data)
    }

    private static func deleteAllVariants() {
        var withGroup: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        SecItemDelete(withGroup as CFDictionary)
        let legacy: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(legacy as CFDictionary)
        _ = withGroup
    }
}

public enum KeychainError: Error {
    case unhandled(OSStatus)
}

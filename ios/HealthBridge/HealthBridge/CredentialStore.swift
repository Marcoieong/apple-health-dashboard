import Foundation
import Security

enum CredentialStoreError: LocalizedError {
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .keychain:
            return "無法安全儲存同步金鑰。"
        }
    }
}

final class CredentialStore {
    static let shared = CredentialStore()

    private let service = "org.pui-pui.HealthBridge"
    private let tokenAccount = "health-sync-token"
    private let defaults = UserDefaults.standard

    var deviceInstallationId: String {
        if let existing = defaults.string(forKey: "deviceInstallationId") {
            return existing
        }
        let created = UUID().uuidString
        defaults.set(created, forKey: "deviceInstallationId")
        return created
    }

    var baseURL: URL {
        get {
            guard let value = defaults.string(forKey: "healthSyncBaseURL"),
                  let url = URL(string: value) else {
                return AppConfiguration.defaultBaseURL
            }
            return url
        }
        set { defaults.set(newValue.absoluteString, forKey: "healthSyncBaseURL") }
    }

    var cursor: String? {
        get { defaults.string(forKey: "healthSyncCursor") }
        set { defaults.set(newValue, forKey: "healthSyncCursor") }
    }

    var lastSyncAt: Date? {
        get { defaults.object(forKey: "lastHealthSyncAt") as? Date }
        set { defaults.set(newValue, forKey: "lastHealthSyncAt") }
    }

    func loadToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func saveToken(_ token: String) throws {
        let data = Data(token.utf8)
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = identity
            attributes.forEach { insertion[$0.key] = $0.value }
            let insertStatus = SecItemAdd(insertion as CFDictionary, nil)
            guard insertStatus == errSecSuccess else {
                throw CredentialStoreError.keychain(insertStatus)
            }
        } else if status != errSecSuccess {
            throw CredentialStoreError.keychain(status)
        }
    }

    func clearToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount
        ]
        SecItemDelete(query as CFDictionary)
        cursor = nil
        lastSyncAt = nil
    }
}

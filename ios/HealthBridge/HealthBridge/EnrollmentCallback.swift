import Foundation

struct EnrollmentCallbackPayload: Equatable {
    let token: String
    let baseURL: URL
}

enum EnrollmentCallbackError: LocalizedError, Equatable {
    case missingCallback
    case wrongScheme
    case wrongHost
    case missingState
    case stateMismatch
    case missingFragment
    case missingToken
    case missingDeviceId
    case deviceMismatch
    case missingBaseURL
    case invalidBaseURL
    case unexpectedBaseURL

    var errorDescription: String? {
        switch self {
        case .missingCallback:
            return "登入已完成，但沒有收到 HealthBridge 回調。"
        case .wrongScheme, .wrongHost:
            return "收到的配對回調不是由 HealthBridge 處理。"
        case .missingState, .stateMismatch:
            return "配對安全驗證失敗，沒有儲存金鑰。請重新開始。"
        case .missingFragment:
            return "配對回調沒有包含加密金鑰資料。"
        case .missingToken:
            return "配對回調缺少裝置金鑰。"
        case .missingDeviceId, .deviceMismatch:
            return "配對回調不屬於這部 iPhone。"
        case .missingBaseURL, .invalidBaseURL:
            return "配對回調包含無效的同步網址。"
        case .unexpectedBaseURL:
            return "配對回調來自未預期的同步主機。"
        }
    }
}

enum EnrollmentCallbackParser {
    static func parse(
        callbackURL: URL?,
        expectedState: String,
        expectedDeviceId: String,
        expectedBaseURL: URL,
        callbackScheme: String
    ) throws -> EnrollmentCallbackPayload {
        guard let callbackURL else {
            throw EnrollmentCallbackError.missingCallback
        }
        guard callbackURL.scheme?.lowercased() == callbackScheme.lowercased() else {
            throw EnrollmentCallbackError.wrongScheme
        }
        guard callbackURL.host?.lowercased() == "enroll" else {
            throw EnrollmentCallbackError.wrongHost
        }
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw EnrollmentCallbackError.missingCallback
        }
        guard let returnedState = value(named: "state", in: components.queryItems) else {
            throw EnrollmentCallbackError.missingState
        }
        guard !expectedState.isEmpty, returnedState == expectedState else {
            throw EnrollmentCallbackError.stateMismatch
        }
        guard let encodedFragment = components.percentEncodedFragment,
              !encodedFragment.isEmpty,
              let fragmentComponents = URLComponents(
                  string: "https://healthbridge.invalid/?\(encodedFragment)"
              ) else {
            throw EnrollmentCallbackError.missingFragment
        }
        guard let token = value(named: "token", in: fragmentComponents.queryItems),
              token.count >= 32 else {
            throw EnrollmentCallbackError.missingToken
        }
        guard let deviceId = value(
            named: "device_installation_id",
            in: fragmentComponents.queryItems
        ) else {
            throw EnrollmentCallbackError.missingDeviceId
        }
        guard deviceId == expectedDeviceId else {
            throw EnrollmentCallbackError.deviceMismatch
        }
        guard let baseURLValue = value(named: "base_url", in: fragmentComponents.queryItems) else {
            throw EnrollmentCallbackError.missingBaseURL
        }
        let baseURL = try normalizedHTTPSOrigin(from: baseURLValue)
        let expectedOrigin = try normalizedHTTPSOrigin(from: expectedBaseURL.absoluteString)
        guard baseURL == expectedOrigin else {
            throw EnrollmentCallbackError.unexpectedBaseURL
        }
        return EnrollmentCallbackPayload(token: token, baseURL: baseURL)
    }

    private static func value(named name: String, in items: [URLQueryItem]?) -> String? {
        items?.first(where: { $0.name == name })?.value
    }

    private static func normalizedHTTPSOrigin(from value: String) throws -> URL {
        guard var components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              components.host != nil,
              components.user == nil,
              components.password == nil else {
            throw EnrollmentCallbackError.invalidBaseURL
        }
        components.scheme = "https"
        components.path = "/"
        components.query = nil
        components.fragment = nil
        guard let url = components.url else {
            throw EnrollmentCallbackError.invalidBaseURL
        }
        return url
    }
}

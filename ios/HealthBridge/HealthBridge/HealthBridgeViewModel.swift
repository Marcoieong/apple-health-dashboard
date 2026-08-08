import AuthenticationServices
import Combine
import Foundation
import UIKit

@MainActor
final class HealthBridgeViewModel: NSObject, ObservableObject {
    @Published private(set) var isPaired: Bool
    @Published private(set) var healthAccessRequested = false
    @Published private(set) var isWorking = false
    @Published private(set) var statusMessage = "尚未連接"
    @Published private(set) var lastSyncAt: Date?
    @Published private(set) var lastAcceptedDays: Int?
    @Published var alertMessage: String?

    private let credentialStore = CredentialStore.shared
    private let healthKit = HealthKitService()
    private let syncClient = HealthSyncClient()
    private var webAuthenticationSession: ASWebAuthenticationSession?
    private var expectedState: String?

    override init() {
        isPaired = CredentialStore.shared.loadToken() != nil
        lastSyncAt = CredentialStore.shared.lastSyncAt
        super.init()
        statusMessage = isPaired ? "已配對，等待 Apple Health 授權" : "尚未連接"
    }

    func pairDevice() {
        let state = UUID().uuidString.replacingOccurrences(of: "-", with: "") +
            UUID().uuidString.replacingOccurrences(of: "-", with: "")
        guard let enrollmentURL = URL(
            string: AppConfiguration.enrollmentPath,
            relativeTo: credentialStore.baseURL
        )?.absoluteURL else {
            alertMessage = "無法建立配對網址。"
            return
        }
        var components = URLComponents(url: enrollmentURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "device_installation_id", value: credentialStore.deviceInstallationId),
            URLQueryItem(name: "state", value: state)
        ]
        guard let url = components?.url else {
            alertMessage = "無法建立配對網址。"
            return
        }
        expectedState = state
        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: AppConfiguration.callbackScheme
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                self?.finishPairing(callbackURL: callbackURL, error: error)
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        webAuthenticationSession = session
        isWorking = true
        statusMessage = "等待帳戶確認"
        if !session.start() {
            isWorking = false
            alertMessage = "無法開啟安全登入視窗。"
        }
    }

    func requestHealthAccess() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await healthKit.requestAuthorization()
            healthAccessRequested = true
            statusMessage = "已要求 Apple Health 權限，可以同步"
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    func syncNow() async {
        guard let token = credentialStore.loadToken() else {
            alertMessage = "請先授權這部 iPhone。"
            return
        }
        isWorking = true
        statusMessage = "正在讀取最近 30 日匯總"
        defer { isWorking = false }
        do {
            let days = try await healthKit.loadRecentDays()
            statusMessage = "正在安全上傳 \(days.count) 日資料"
            let result = try await syncClient.upload(
                days: days,
                token: token,
                deviceInstallationId: credentialStore.deviceInstallationId,
                previousCursor: credentialStore.cursor,
                baseURL: credentialStore.baseURL
            )
            credentialStore.cursor = result.cursor
            credentialStore.lastSyncAt = Date()
            lastSyncAt = credentialStore.lastSyncAt
            lastAcceptedDays = result.acceptedDays
            statusMessage = "同步完成：接受 \(result.acceptedDays) 日，更新 \(result.changedDays) 日"
        } catch {
            statusMessage = "同步未完成"
            alertMessage = error.localizedDescription
        }
    }

    private func finishPairing(callbackURL: URL?, error: Error?) {
        defer {
            isWorking = false
            webAuthenticationSession = nil
        }
        if let authenticationError = error as? ASWebAuthenticationSessionError,
           authenticationError.code == .canceledLogin {
            statusMessage = "已取消配對"
            return
        }
        guard error == nil,
              let callbackURL,
              callbackURL.scheme == AppConfiguration.callbackScheme,
              callbackURL.host == "enroll",
              let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              components.queryItems?.first(where: { $0.name == "state" })?.value == expectedState,
              let fragment = components.fragment,
              let fragmentComponents = URLComponents(string: "healthbridge://fragment?\(fragment)"),
              let token = fragmentComponents.queryItems?.first(where: { $0.name == "token" })?.value,
              let deviceId = fragmentComponents.queryItems?.first(where: { $0.name == "device_installation_id" })?.value,
              deviceId == credentialStore.deviceInstallationId,
              let baseURLValue = fragmentComponents.queryItems?.first(where: { $0.name == "base_url" })?.value,
              let baseURL = URL(string: baseURLValue) else {
            statusMessage = "配對未完成"
            alertMessage = "配對回應無效，沒有儲存任何金鑰。"
            return
        }
        do {
            try credentialStore.saveToken(token)
            credentialStore.baseURL = baseURL
            isPaired = true
            statusMessage = "帳戶配對完成"
        } catch {
            alertMessage = error.localizedDescription
        }
    }
}

extension HealthBridgeViewModel: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

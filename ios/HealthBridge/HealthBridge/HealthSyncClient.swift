import Foundation

enum HealthSyncClientError: LocalizedError {
    case invalidEndpoint
    case rejected(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint:
            return "同步網址不正確。"
        case .rejected(let reason):
            return "伺服器拒絕同步：\(reason)"
        case .invalidResponse:
            return "伺服器回應格式不正確。"
        }
    }
}

struct HealthSyncClient {
    func upload(
        days: [HealthSyncDay],
        token: String,
        deviceInstallationId: String,
        previousCursor: String?,
        baseURL: URL
    ) async throws -> HealthSyncResponse {
        guard let endpoint = URL(string: AppConfiguration.syncPath, relativeTo: baseURL)?.absoluteURL else {
            throw HealthSyncClientError.invalidEndpoint
        }
        let payload = HealthSyncPayload(
            syncId: UUID().uuidString.lowercased(),
            deviceInstallationId: deviceInstallationId,
            previousCursor: previousCursor,
            collectedAt: ISO8601.formatter.string(from: Date()),
            days: days
        )
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HealthSyncClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let reason = (try? JSONDecoder().decode(HealthSyncErrorResponse.self, from: data).error)
                ?? "HTTP \(http.statusCode)"
            throw HealthSyncClientError.rejected(reason)
        }
        return try JSONDecoder().decode(HealthSyncResponse.self, from: data)
    }
}

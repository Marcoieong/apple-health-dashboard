import Foundation

struct HealthMetrics: Codable, Equatable {
    var steps: Int?
    var activeEnergyKcal: Double?
    var exerciseMinutes: Double?
    var sleepHours: Double?
    var weightKg: Double?
    var bodyFatPercent: Double?

    enum CodingKeys: String, CodingKey {
        case steps
        case activeEnergyKcal = "active_energy_kcal"
        case exerciseMinutes = "exercise_minutes"
        case sleepHours = "sleep_hours"
        case weightKg = "weight_kg"
        case bodyFatPercent = "body_fat_percent"
    }

    var hasValue: Bool {
        steps != nil || activeEnergyKcal != nil || exerciseMinutes != nil ||
        sleepHours != nil || weightKg != nil || bodyFatPercent != nil
    }
}

struct HealthSyncDay: Codable, Equatable {
    let localDate: String
    let timezone: String
    let sourceUpdatedAt: String
    let metrics: HealthMetrics

    enum CodingKeys: String, CodingKey {
        case localDate = "local_date"
        case timezone
        case sourceUpdatedAt = "source_updated_at"
        case metrics
    }
}

struct HealthSyncPayload: Codable {
    let schemaVersion = 1
    let syncId: String
    let deviceInstallationId: String
    let previousCursor: String?
    let collectedAt: String
    let days: [HealthSyncDay]

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "schema_version"
        case syncId = "sync_id"
        case deviceInstallationId = "device_installation_id"
        case previousCursor = "previous_cursor"
        case collectedAt = "collected_at"
        case days
    }
}

struct HealthSyncResponse: Decodable {
    let status: String
    let acceptedDays: Int
    let changedDays: Int
    let cursor: String
    let serverTime: String

    enum CodingKeys: String, CodingKey {
        case status
        case acceptedDays = "accepted_days"
        case changedDays = "changed_days"
        case cursor
        case serverTime = "server_time"
    }
}

struct HealthSyncErrorResponse: Decodable {
    let error: String
}

enum ISO8601 {
    static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

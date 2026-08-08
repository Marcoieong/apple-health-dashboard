import Foundation

enum AppConfiguration {
    static let defaultBaseURL = URL(
        string: "https://apple-health-dashboard-git-codex-health-sync-phase2-marco-315e.vercel.app"
    )!
    static let callbackScheme = "healthbridge"
    static let syncPath = "/api/health-sync/v1/days"
    static let enrollmentPath = "/api/health-sync/enroll"
}

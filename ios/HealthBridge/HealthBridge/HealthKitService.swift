import Foundation
import HealthKit

enum HealthKitServiceError: LocalizedError {
    case unavailable
    case noData

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "這部裝置未能使用 Apple Health。"
        case .noData:
            return "Apple Health 沒有可同步的資料，或尚未允許讀取。"
        }
    }
}

final class HealthKitService {
    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        let identifiers: [HKQuantityTypeIdentifier] = [
            .stepCount,
            .activeEnergyBurned,
            .appleExerciseTime,
            .bodyMass,
            .bodyFatPercentage
        ]
        var result = Set<HKObjectType>(
            identifiers.compactMap(HKObjectType.quantityType(forIdentifier:))
        )
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            result.insert(sleep)
        }
        return result
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitServiceError.unavailable
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func loadRecentDays(count: Int = 30) async throws -> [HealthSyncDay] {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitServiceError.unavailable
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .autoupdatingCurrent
        let today = calendar.startOfDay(for: Date())
        let firstDay = calendar.date(byAdding: .day, value: -(count - 1), to: today)!
        let sourceUpdatedAt = ISO8601.formatter.string(from: Date())
        let timezone = calendar.timeZone.identifier
        let dateFormatter = DateFormatter()
        dateFormatter.calendar = calendar
        dateFormatter.timeZone = calendar.timeZone
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.dateFormat = "yyyy-MM-dd"

        var days: [HealthSyncDay] = []
        for offset in 0..<count {
            guard let start = calendar.date(byAdding: .day, value: offset, to: firstDay),
                  let end = calendar.date(byAdding: .day, value: 1, to: start) else { continue }

            async let steps = cumulativeValue(.stepCount, unit: .count(), start: start, end: end)
            async let energy = cumulativeValue(
                .activeEnergyBurned,
                unit: .kilocalorie(),
                start: start,
                end: end
            )
            async let exercise = cumulativeValue(
                .appleExerciseTime,
                unit: .minute(),
                start: start,
                end: end
            )
            async let sleep = sleepHours(start: start, end: end)
            async let weight = latestQuantity(
                .bodyMass,
                unit: .gramUnit(with: .kilo),
                start: start,
                end: end
            )
            async let bodyFatFraction = latestQuantity(
                .bodyFatPercentage,
                unit: .percent(),
                start: start,
                end: end
            )

            let values = try await (
                steps: steps,
                energy: energy,
                exercise: exercise,
                sleep: sleep,
                weight: weight,
                bodyFatFraction: bodyFatFraction
            )
            let metrics = HealthMetrics(
                steps: values.steps.map { Int($0.rounded()) },
                activeEnergyKcal: values.energy.map(rounded),
                exerciseMinutes: values.exercise.map(rounded),
                sleepHours: values.sleep.map(rounded),
                weightKg: values.weight.map(rounded),
                bodyFatPercent: values.bodyFatFraction.map { rounded($0 * 100) }
            )
            guard metrics.hasValue else { continue }
            days.append(
                HealthSyncDay(
                    localDate: dateFormatter.string(from: start),
                    timezone: timezone,
                    sourceUpdatedAt: sourceUpdatedAt,
                    metrics: metrics
                )
            )
        }
        guard !days.isEmpty else { throw HealthKitServiceError.noData }
        return days
    }

    private func cumulativeValue(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date
    ) async throws -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, statistics, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: statistics?.sumQuantity()?.doubleValue(for: unit))
            }
            store.execute(query)
        }
    }

    private func latestQuantity(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date
    ) async throws -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            ) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                let sample = samples?.first as? HKQuantitySample
                continuation.resume(returning: sample?.quantity.doubleValue(for: unit))
            }
            store.execute(query)
        }
    }

    private func sleepHours(start: Date, end: Date) async throws -> Double? {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let intervals: [DateInterval] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                let result = (samples as? [HKCategorySample] ?? []).compactMap { sample -> DateInterval? in
                    guard sample.value != HKCategoryValueSleepAnalysis.inBed.rawValue,
                          sample.value != HKCategoryValueSleepAnalysis.awake.rawValue else { return nil }
                    let clippedStart = max(sample.startDate, start)
                    let clippedEnd = min(sample.endDate, end)
                    return clippedEnd > clippedStart
                        ? DateInterval(start: clippedStart, end: clippedEnd)
                        : nil
                }
                continuation.resume(returning: result)
            }
            store.execute(query)
        }
        guard !intervals.isEmpty else { return nil }
        let sorted = intervals.sorted { $0.start < $1.start }
        var merged: [DateInterval] = []
        for interval in sorted {
            guard let last = merged.last, interval.start <= last.end else {
                merged.append(interval)
                continue
            }
            merged[merged.count - 1] = DateInterval(
                start: last.start,
                end: max(last.end, interval.end)
            )
        }
        return merged.reduce(0) { $0 + $1.duration } / 3_600
    }

    private func rounded(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}

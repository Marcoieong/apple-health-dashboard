import SwiftUI

struct ContentView: View {
    @StateObject private var model = HealthBridgeViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    statusCard
                    stepsCard
                    privacyCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("HealthBridge")
            .alert(
                "未能完成",
                isPresented: Binding(
                    get: { model.alertMessage != nil },
                    set: { if !$0 { model.alertMessage = nil } }
                )
            ) {
                Button("好", role: .cancel) { model.alertMessage = nil }
            } message: {
                Text(model.alertMessage ?? "")
            }
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(
                model.isPaired ? "已連接私人 Dashboard" : "等待連接",
                systemImage: model.isPaired ? "checkmark.shield.fill" : "iphone.and.arrow.forward"
            )
            .font(.headline)
            .foregroundStyle(model.isPaired ? .green : .primary)
            Text(model.statusMessage)
                .font(.body)
            if let date = model.lastSyncAt {
                Text("上次同步：\(date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Text("尚未傳送 Apple Health 資料")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if model.isWorking {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("處理中")
            }
        }
        .healthCard()
    }

    private var stepsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("首次同步")
                .font(.title2.bold())

            actionRow(
                number: "1",
                title: "授權這部 iPhone",
                detail: "使用家庭帳戶登入並建立裝置專用金鑰",
                completed: model.isPaired
            ) {
                model.pairDevice()
            }

            actionRow(
                number: "2",
                title: "允許 Apple Health 唯讀權限",
                detail: "由 iOS 顯示原生權限清單，可逐項決定",
                completed: model.healthAccessRequested
            ) {
                Task { await model.requestHealthAccess() }
            }

            actionRow(
                number: "3",
                title: "同步最近 30 日",
                detail: "只傳每日匯總，不傳原始樣本或來源裝置資料",
                completed: model.lastSyncAt != nil
            ) {
                Task { await model.syncNow() }
            }
        }
        .healthCard()
    }

    private var privacyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("資料邊界", systemImage: "lock.shield")
                .font(.headline)
            Text("只讀取步數、活動能量、運動分鐘、睡眠、體重及體脂率。Dashboard 與 ChatGPT 只能讀取已同步的每日匯總。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .healthCard()
    }

    private func actionRow(
        number: String,
        title: String,
        detail: String,
        completed: Bool,
        action: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(completed ? "✓" : number)
                .font(.headline)
                .frame(width: 32, height: 32)
                .background(completed ? Color.green.opacity(0.16) : Color.accentColor.opacity(0.14))
                .clipShape(Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(detail).font(.caption).foregroundStyle(.secondary)
                Button(completed ? "重新設定" : "開始", action: action)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .padding(.top, 4)
                    .disabled(model.isWorking)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension View {
    func healthCard() -> some View {
        padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

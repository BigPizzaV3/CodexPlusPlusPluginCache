import Foundation

@main
@MainActor
struct CompatibilityTests {
    static func main() throws {
        guard CommandLine.arguments.count == 2 else {
            throw CompatibilityFailure("Usage: compatibility-tests /path/to/state.json")
        }
        let source = URL(fileURLWithPath: CommandLine.arguments[1])
        let fileManager = FileManager.default
        let workspace = fileManager.temporaryDirectory
            .appendingPathComponent("career-command-center-compatibility-\(UUID().uuidString)", isDirectory: true)
        defer { try? fileManager.removeItem(at: workspace) }
        let stateDirectory = workspace.appendingPathComponent("State", isDirectory: true)
        try fileManager.createDirectory(at: stateDirectory, withIntermediateDirectories: true)
        try fileManager.copyItem(
            at: source,
            to: stateDirectory.appendingPathComponent("cv_command_center_state.json")
        )

        let sourceData = try Data(contentsOf: source)
        let sourceJSON = try JSONSerialization.jsonObject(with: sourceData) as? [String: Any]
        let sourceLeads = sourceJSON?["leads"] as? [[String: Any]] ?? []
        let expectedCount = sourceLeads.count
        let expectedHidden = sourceLeads.filter { ($0["status"] as? String) == "hidden" }.count

        let store = AppStore(workspaceOverride: workspace)
        try expect(store.state.version == 3, "state upgrades to version 3")
        try expect(store.state.leads.count == expectedCount, "lead count survives migration")
        try expect(store.state.leads.filter { $0.status == .archived }.count >= expectedHidden, "hidden records become archived")
        try expect(store.state.leads.contains { $0.string("status") == "hidden" } == false, "no hidden status remains")
        try expect(Set(store.state.leads.map(\.id)).count == expectedCount, "lead IDs remain unique")
        try expect(store.state.leads.allSatisfy { $0.raw["assessment_schema_version"]?.intValue == 2 }, "all active leads use structured assessments")
        try expect(store.state.leads.allSatisfy { lead in
            !lead.fitGaps.contains { gap in
                let text = gap.lowercased()
                return text.contains("transcript") || text.contains("degree certificate") || text.contains("upload")
            }
        }, "application logistics are absent from migrated fit gaps")

        if let lead = store.state.leads.first(where: { $0.status == .toApply }) {
            let originalCount = store.state.leads.count
            store.archive(lead.id)
            try expect(store.state.leads.first(where: { $0.id == lead.id })?.status == .archived, "archive works on migrated lead")
            store.deleteLead(lead.id)
            try expect(store.state.leads.count == originalCount - 1, "delete removes migrated lead from active state")
            try expect(store.state.deletedLeads.contains(where: { $0.id == lead.id }), "delete remains recoverable")
            store.restoreDeleted(lead.id)
            try expect(store.state.leads.count == originalCount, "restore recovers migrated lead")
        }

        print("Compatibility tests passed: \(expectedCount) leads, \(expectedHidden) legacy hidden records")
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        if !condition() { throw CompatibilityFailure(message) }
    }

    private struct CompatibilityFailure: Error, CustomStringConvertible {
        let description: String
        init(_ description: String) { self.description = "Compatibility test failed: \(description)" }
    }
}

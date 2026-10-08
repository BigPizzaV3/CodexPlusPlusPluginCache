import Foundation

@main
@MainActor
struct CoreTests {
    static func main() throws {
        let fileManager = FileManager.default
        let root = fileManager.temporaryDirectory
            .appendingPathComponent("career-command-center-tests-\(UUID().uuidString)", isDirectory: true)
        defer { try? fileManager.removeItem(at: root) }

        let stateDirectory = root.appendingPathComponent("State", isDirectory: true)
        try fileManager.createDirectory(at: stateDirectory, withIntermediateDirectories: true)
        let stateURL = stateDirectory.appendingPathComponent("cv_command_center_state.json")
        let fixture: [String: Any] = [
            "version": 1,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
            "notes": [],
            "leads": [
                [
                    "id": "hidden-lead",
                    "source_job_id": "source:hidden",
                    "title": "Hidden Role",
                    "organization": "Example A",
                    "status": "hidden",
                    "unknown_payload": ["preserve": true]
                ],
                [
                    "id": "manual-lead",
                    "source_job_id": "source:manual",
                    "title": "Manual Role",
                    "organization": "Example B",
                    "status": "manual_check",
                    "rationale": "Python validation work supports the analysis workflow.",
                    "concerns": "No direct GMP ownership is demonstrated; Upload transcripts and a degree certificate through the portal."
                ],
                [
                    "id": "active-lead",
                    "source_job_id": "source:active",
                    "title": "Active Role",
                    "organization": "Example C",
                    "status": "to_apply",
                    "score": 91
                ]
            ]
        ]
        let fixtureData = try JSONSerialization.data(withJSONObject: fixture, options: [.prettyPrinted])
        try fixtureData.write(to: stateURL)

        let evidenceDirectory = root.appendingPathComponent("Evidence_Bank", isDirectory: true)
        try fileManager.createDirectory(at: evidenceDirectory, withIntermediateDirectories: true)
        let questionsURL = evidenceDirectory.appendingPathComponent("personalized_questions.json")
        let questionFixture: [String: Any] = [
            "version": 1,
            "generation_id": "test-audit",
            "audit_status": "current",
            "source_change_note": "",
            "generated_at": "2026-01-02T00:00:00Z",
            "updated_at": "2026-01-02T00:00:00Z",
            "questions": [
                [
                    "id": "project-metric-baseline",
                    "priority": "critical",
                    "category": "metric",
                    "question": "Was the reported 40% reduction measured, estimated, or proposed as a target?",
                    "why_it_matters": "The classification determines whether the figure can be presented as a result.",
                    "source_refs": [
                        [
                            "path": "Projects/Test/report.pdf",
                            "label": "Test Project Report",
                            "locator": "Discussion, page 12",
                            "context": "The percentage appears without a measurement baseline."
                        ]
                    ],
                    "related_evidence_ids": [],
                    "status": "open",
                    "answer": "",
                    "generated_at": "2026-01-02T00:00:00Z",
                    "answered_at": "",
                    "reviewed_at": "",
                    "review_note": ""
                ],
                [
                    "id": "project-personal-ownership",
                    "priority": "high",
                    "category": "ownership",
                    "question": "Which implementation and testing tasks did you personally complete?",
                    "why_it_matters": "Individual ownership must be clear before approving project evidence.",
                    "source_refs": [
                        [
                            "path": "Projects/Test/presentation.pdf",
                            "label": "Test Project Presentation",
                            "locator": "Methods, slides 5-9",
                            "context": "The slides describe team outputs without task attribution."
                        ]
                    ],
                    "related_evidence_ids": [],
                    "status": "answered",
                    "answer": "I implemented the controller and ran the validation tests.",
                    "generated_at": "2026-01-02T00:00:00Z",
                    "answered_at": "2026-01-03T00:00:00Z",
                    "reviewed_at": "",
                    "review_note": ""
                ]
            ]
        ]
        let questionData = try JSONSerialization.data(withJSONObject: questionFixture, options: [.prettyPrinted])
        try questionData.write(to: questionsURL)

        let store = AppStore(workspaceOverride: root)
        try expect(store.state.version == 3, "state migrates to version 3")
        try expect(store.state.leads.first(where: { $0.id == "hidden-lead" })?.status == .archived, "hidden migrates to archive")
        try expect(store.state.leads.first(where: { $0.id == "manual-lead" })?.status == .toApply, "manual check migrates to to_apply")
        try expect(store.state.leads.first(where: { $0.id == "hidden-lead" })?.raw["unknown_payload"] != nil, "unknown lead fields survive decoding")
        let migratedAssessment = store.state.leads.first(where: { $0.id == "manual-lead" })
        try expect(migratedAssessment?.matchStrengths.count == 1, "legacy rationale becomes match evidence")
        try expect(migratedAssessment?.fitGaps.contains(where: { $0.localizedCaseInsensitiveContains("GMP") }) == true, "genuine capability gap remains a fit gap")
        try expect(migratedAssessment?.applicationRequirements.contains(where: { $0.localizedCaseInsensitiveContains("transcript") }) == true, "submission documents become application requirements")
        try expect(migratedAssessment?.fitGaps.contains(where: { $0.localizedCaseInsensitiveContains("transcript") }) == false, "submission documents never remain fit gaps")
        try expect(migratedAssessment?.raw["assessment_schema_version"]?.intValue == 2, "assessment schema is versioned")

        try expect(store.config.search.countries.isEmpty, "fresh setup assumes no country")
        try expect(store.config.search.opportunityTypes.isEmpty, "fresh setup assumes no opportunity format")
        try expect(store.config.search.roleFamilies.isEmpty, "fresh setup assumes no profession")
        try expect(store.config.search.inferRoleFamilies, "fresh setup infers role families only after evidence intake")
        try expect(store.config.cv.targetLanguage == "Auto", "fresh setup chooses CV language per application")
        try expect(store.config.cv.includePhoto == false, "fresh setup assumes no photograph policy")
        try expect(store.config.automation.frequency == "manual" && !store.config.automation.enabled, "fresh setup does not schedule recurring searches")
        try expect(store.questionsNeedingAnswer.count == 1, "open personalized question is loaded")
        try expect(store.questionsAwaitingReview.count == 1, "answered personalized question awaits review")
        try expect(store.actionableQuestionCount == 2, "question sidebar count includes open and review states")
        try expect(store.questionBank.auditStatus == .current, "generated question bank starts current")

        let manuallyAddedProject = root.appendingPathComponent("Projects/Manual Import/notes.txt")
        try fileManager.createDirectory(
            at: manuallyAddedProject.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try "new project evidence".write(to: manuallyAddedProject, atomically: true, encoding: .utf8)
        store.refreshQuestions(showConfirmation: false)
        try expect(store.questionBank.auditStatus == .needsRefresh, "manual source changes invalidate the prior audit")

        var resetQuestionFixture = questionFixture
        resetQuestionFixture["generated_at"] = AppStore.timestamp()
        resetQuestionFixture["updated_at"] = AppStore.timestamp()
        resetQuestionFixture["audit_status"] = "current"
        let resetQuestionData = try JSONSerialization.data(withJSONObject: resetQuestionFixture, options: [.prettyPrinted])
        try resetQuestionData.write(to: questionsURL)
        store.refreshQuestions(showConfirmation: false)
        try expect(store.questionBank.auditStatus == .current, "fresh generation clears the source-change marker")
        store.saveEvidenceAnswers()
        try expect(store.questionBank.auditStatus == .needsRefresh, "changed background answers invalidate the prior audit")

        store.saveQuestionResponse(
            "project-metric-baseline",
            answer: "The figure was estimated from the documented workflow steps.",
            status: .answered
        )
        try expect(store.questionsNeedingAnswer.isEmpty, "saved response leaves the answer queue")
        try expect(store.questionsAwaitingReview.count == 2, "saved response enters the review queue")
        let savedQuestionData = try Data(contentsOf: questionsURL)
        let savedQuestionBank = try JSONDecoder().decode(PersonalizedQuestionBank.self, from: savedQuestionData)
        let savedMetric = savedQuestionBank.questions.first { $0.id == "project-metric-baseline" }
        try expect(savedMetric?.status == .answered, "question response status persists")
        try expect(savedMetric?.answer.contains("estimated") == true, "question response text persists")

        store.reopenQuestion("project-metric-baseline")
        try expect(store.questionsNeedingAnswer.count == 1, "review response can be reopened")
        store.saveQuestionResponse("project-metric-baseline", answer: "", status: .unableToVerify)
        try expect(
            store.questionBank.questions.first { $0.id == "project-metric-baseline" }?.status == .unableToVerify,
            "unable-to-verify response records an evidence boundary"
        )

        store.restoreArchived("hidden-lead")
        try expect(store.state.leads.first(where: { $0.id == "hidden-lead" })?.status == .toApply, "archive restore returns to active queue")

        store.deleteLead("active-lead")
        try expect(store.state.leads.contains(where: { $0.id == "active-lead" }) == false, "delete removes active record")
        try expect(store.state.deletedLeads.contains(where: { $0.id == "active-lead" }), "delete creates recoverable record")
        try expect(store.state.tombstones.contains(where: { $0.id == "active-lead" }), "delete creates dedupe tombstone")

        store.restoreDeleted("active-lead")
        try expect(store.state.leads.contains(where: { $0.id == "active-lead" }), "deleted record restores")
        try expect(store.state.tombstones.contains(where: { $0.id == "active-lead" }) == false, "restore removes tombstone")

        store.saveForLater("active-lead")
        store.archive("active-lead")
        store.restoreArchived("active-lead")
        try expect(store.state.leads.first(where: { $0.id == "active-lead" })?.status == .monitor, "archive restore returns to its original queue")
        try expect(store.selectedSection == .monitor, "archive restore opens the restored queue")

        store.markApplied("active-lead")
        try expect(store.state.leads.first(where: { $0.id == "active-lead" })?.appliedAt.isEmpty == false, "mark applied records a timestamp")
        store.moveToApply("active-lead")
        try expect(store.state.leads.first(where: { $0.id == "active-lead" })?.appliedAt.isEmpty == true, "leaving Applied clears the stale timestamp")

        store.archive("active-lead")
        store.deleteLead("active-lead")
        store.restoreDeleted("active-lead")
        try expect(store.state.leads.first(where: { $0.id == "active-lead" })?.status == .archived, "deleted archive record restores to Archive")
        try expect(store.selectedSection == .archive, "deleted archive restore opens Archive")
        store.restoreArchived("active-lead")

        store.deleteLead("active-lead")
        store.permanentlyDelete("active-lead")
        try expect(store.state.deletedLeads.contains(where: { $0.id == "active-lead" }) == false, "permanent delete removes details")
        try expect(store.state.tombstones.contains(where: { $0.id == "active-lead" }), "permanent delete retains dedupe marker")

        let reloaded = AppStore(workspaceOverride: root)
        try expect(reloaded.state.tombstones.contains(where: { $0.id == "active-lead" }), "tombstone persists after reload")
        try expect(reloaded.state.leads.first(where: { $0.id == "hidden-lead" })?.raw["unknown_payload"] != nil, "unknown data persists after save")
        try expect(reloaded.questionsAwaitingReview.count == 2, "question responses persist after reload")

        reloaded.config.profile.fullName = "Test Candidate"
        reloaded.config.automation.needsCodexSync = false
        reloaded.config.search.includeKeywords = "validation"
        reloaded.saveConfig()
        var configData = try Data(contentsOf: reloaded.configURL)
        var config = try JSONDecoder().decode(AppConfig.self, from: configData)
        try expect(config.automation.needsCodexSync == false, "ordinary search settings are read at run time and do not dirty the schedule")

        reloaded.saveConfig(markAutomationDirty: true)
        configData = try Data(contentsOf: reloaded.configURL)
        config = try JSONDecoder().decode(AppConfig.self, from: configData)
        try expect(config.profile.fullName == "Test Candidate", "config persists")
        try expect(config.automation.needsCodexSync, "schedule changes mark Codex sync required")

        let legacyWorkspace = root.appendingPathComponent("Legacy Workspace", isDirectory: true)
        let legacyStore = AppStore(workspaceOverride: legacyWorkspace)
        try expect(
            fileManager.fileExists(atPath: legacyStore.questionsURL.path),
            "opening an older workspace creates the personalized question bank"
        )
        try expect(legacyStore.questionBank.auditStatus == .notStarted, "older workspace starts with a pending evidence audit")

        print("Core tests passed")
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        if !condition() { throw TestFailure(message: message) }
    }

    private struct TestFailure: Error, CustomStringConvertible {
        let message: String
        var description: String { "Test failed: \(message)" }
    }
}

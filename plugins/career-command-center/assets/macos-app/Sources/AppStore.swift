import AppKit
import Foundation
import SwiftUI

@MainActor
final class AppStore: ObservableObject {
    @Published var config = AppConfig()
    @Published var state = CommandCenterState()
    @Published var selectedSection: AppSection = .toApply
    @Published var selectedLeadID: String?
    @Published var searchText = ""
    @Published var documentItems: [DocumentItem] = []
    @Published var questionBank = PersonalizedQuestionBank()
    @Published var selectedQuestionID: String?
    @Published var toastMessage = ""
    @Published var errorMessage = ""
    @Published var isBusy = false

    private(set) var workspaceURL: URL
    private let fileManager = FileManager.default
    private let encoder: JSONEncoder
    private let decoder = JSONDecoder()
    private let previewMode: Bool

    static let workspacePreferenceKey = "CareerCommandCenter.workspacePath"

    init(workspaceOverride: URL? = nil, preview: Bool = false) {
        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        previewMode = preview
        workspaceURL = workspaceOverride ?? Self.resolveWorkspace()

        if preview {
            config = Self.previewConfig(workspaceURL: workspaceURL)
            state = Self.previewState()
            documentItems = Self.previewDocuments(workspaceURL: workspaceURL)
            questionBank = Self.previewQuestionBank()
            selectedLeadID = state.leads.first?.id
            selectedQuestionID = questionBank.questions.first?.id
            return
        }

        ensureWorkspaceStructure()
        loadConfig()
        loadState()
        refreshDocuments()
        loadQuestions()
    }

    var stateURL: URL {
        workspaceURL.appendingPathComponent("State/cv_command_center_state.json")
    }

    var configURL: URL {
        workspaceURL.appendingPathComponent("Config/command_center_config.json")
    }

    var automationStatusURL: URL {
        workspaceURL.appendingPathComponent("Automation/automation_status.json")
    }

    var questionsURL: URL {
        workspaceURL.appendingPathComponent("Evidence_Bank/personalized_questions.json")
    }

    var selectedLead: LeadRecord? {
        let source = selectedSection == .deleted ? state.deletedLeads : state.leads
        return source.first { $0.id == selectedLeadID }
    }

    var visibleLeads: [LeadRecord] {
        let source: [LeadRecord]
        if selectedSection == .deleted {
            source = state.deletedLeads
        } else if let status = selectedSection.leadStatus {
            source = state.leads.filter { $0.status == status }
        } else {
            source = []
        }

        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let filtered = query.isEmpty ? source : source.filter { lead in
            ([lead.title, lead.organization, lead.location, lead.type] +
                lead.summary + lead.requirements + lead.matchStrengths + lead.fitGaps)
                .joined(separator: " ")
                .lowercased()
                .contains(query)
        }

        return filtered.sorted { lhs, rhs in
            let left = lhs.score ?? -1
            let right = rhs.score ?? -1
            if left != right { return left > right }
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    var selectedQuestion: EvidenceQuestion? {
        questionBank.questions.first { $0.id == selectedQuestionID }
    }

    var questionsNeedingAnswer: [EvidenceQuestion] {
        sortedQuestions(questionBank.questions.filter { $0.status.needsUserAnswer })
    }

    var questionsAwaitingReview: [EvidenceQuestion] {
        sortedQuestions(questionBank.questions.filter { $0.status.awaitsCodexReview })
    }

    var questionHistory: [EvidenceQuestion] {
        sortedQuestions(questionBank.questions.filter { $0.status.isHistory })
    }

    var actionableQuestionCount: Int {
        questionsNeedingAnswer.count + questionsAwaitingReview.count
    }

    var questionSidebarCount: Int {
        max(actionableQuestionCount, questionBank.auditStatus.needsAudit ? 1 : 0)
    }

    func count(for section: AppSection) -> Int {
        if section == .deleted { return state.deletedLeads.count }
        if section == .questions { return questionSidebarCount }
        guard let status = section.leadStatus else { return 0 }
        return state.leads.filter { $0.status == status }.count
    }

    func reload() {
        loadConfig()
        loadState()
        refreshDocuments()
        loadQuestions()
        showToast("Workspace refreshed")
    }

    func saveConfig(markAutomationDirty: Bool = false) {
        if markAutomationDirty {
            config.automation.needsCodexSync = true
        }
        config.updatedAt = Self.timestamp()
        do {
            try atomicWrite(config, to: configURL)
        } catch {
            errorMessage = "Could not save settings: \(error.localizedDescription)"
        }
    }

    func finishOnboarding() {
        config.onboardingCompleted = true
        config.onboardingCompletedAt = Self.timestamp()
        config.workspacePath = workspaceURL.path
        config.automation.needsCodexSync = true
        UserDefaults.standard.set(workspaceURL.path, forKey: Self.workspacePreferenceKey)
        saveConfig(markAutomationDirty: true)
        writeIntakeSummary()
        markQuestionAuditStale("Initial intake is ready for a source-specific evidence audit.")
        showToast("Setup saved. Return to Codex to audit the files and generate your questions.")
    }

    func saveEvidenceAnswers() {
        saveConfig()
        writeIntakeSummary()
        markQuestionAuditStale("Background answers changed after the previous evidence audit.")
        showToast("Evidence answers saved")
    }

    func refreshQuestions(showConfirmation: Bool = true) {
        if previewMode { return }
        loadQuestions()
        if showConfirmation { showToast("Questions refreshed") }
    }

    func saveQuestionResponse(_ questionID: String, answer: String, status: EvidenceQuestionStatus) {
        guard [.answered, .unableToVerify, .notApplicable].contains(status),
              let index = questionBank.questions.firstIndex(where: { $0.id == questionID }) else { return }
        let cleaned = answer.trimmingCharacters(in: .whitespacesAndNewlines)
        if status == .answered && cleaned.isEmpty {
            errorMessage = "Write an answer before marking this question ready for review."
            return
        }
        questionBank.questions[index].answer = cleaned
        questionBank.questions[index].status = status
        questionBank.questions[index].answeredAt = Self.timestamp()
        questionBank.questions[index].reviewedAt = ""
        questionBank.questions[index].reviewNote = ""
        saveQuestions()
        switch status {
        case .answered: showToast("Answer saved for Codex review")
        case .unableToVerify: showToast("Evidence boundary recorded")
        case .notApplicable: showToast("Question marked not applicable")
        default: break
        }
    }

    func reopenQuestion(_ questionID: String) {
        guard let index = questionBank.questions.firstIndex(where: { $0.id == questionID }) else { return }
        questionBank.questions[index].status = .open
        questionBank.questions[index].reviewedAt = ""
        questionBank.questions[index].reviewNote = ""
        saveQuestions()
        showToast("Question reopened")
    }

    func restartOnboarding() {
        config.onboardingCompleted = false
        config.onboardingCompletedAt = ""
        saveConfig()
    }

    func setWorkspace(_ url: URL) {
        workspaceURL = url.standardizedFileURL
        config.workspacePath = workspaceURL.path
        UserDefaults.standard.set(workspaceURL.path, forKey: Self.workspacePreferenceKey)
        ensureWorkspaceStructure()
        loadConfig()
        loadState()
        refreshDocuments()
        loadQuestions()
    }

    func chooseWorkspaceFolder() {
        let panel = NSOpenPanel()
        panel.title = "Choose a Career Command Center workspace"
        panel.prompt = "Use Folder"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = workspaceURL.deletingLastPathComponent()
        guard panel.runModal() == .OK, let url = panel.url else { return }
        setWorkspace(url)
    }

    func createWorkspaceInDocuments() {
        let url = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Documents/Career Command Center", isDirectory: true)
        setWorkspace(url)
    }

    func markApplied(_ leadID: String) {
        mutateLead(leadID) { lead in
            lead.status = .applied
            lead.remove("archived_at")
            lead.remove("previous_status")
            lead.set("applied_at", Self.timestamp())
            lead.set("updated_at", Self.timestamp())
        }
        selectedSection = .applied
        showToast("Marked as applied")
    }

    func moveToApply(_ leadID: String) {
        mutateLead(leadID) { lead in
            lead.status = .toApply
            lead.remove("applied_at")
            lead.remove("archived_at")
            lead.remove("previous_status")
            lead.set("updated_at", Self.timestamp())
        }
        selectedSection = .toApply
        showToast("Moved to To Apply")
    }

    func saveForLater(_ leadID: String) {
        mutateLead(leadID) { lead in
            lead.status = .monitor
            lead.remove("applied_at")
            lead.remove("archived_at")
            lead.remove("previous_status")
            lead.set("updated_at", Self.timestamp())
        }
        selectedSection = .monitor
        showToast("Saved for later")
    }

    func archive(_ leadID: String) {
        mutateLead(leadID) { lead in
            lead.previousStatus = lead.status
            lead.status = .archived
            lead.set("archived_at", Self.timestamp())
            lead.set("updated_at", Self.timestamp())
        }
        selectedLeadID = nil
        showToast("Moved to Archive")
    }

    func restoreArchived(_ leadID: String) {
        var restoredStatus = LeadStatus.toApply
        mutateLead(leadID) { lead in
            let destination = lead.previousStatus == .archived || lead.previousStatus == .deleted
                ? LeadStatus.toApply
                : lead.previousStatus
            restoredStatus = destination
            lead.status = destination
            lead.remove("archived_at")
            lead.remove("previous_status")
            lead.set("updated_at", Self.timestamp())
        }
        selectedSection = section(for: restoredStatus)
        showToast("Restored from Archive")
    }

    func deleteLead(_ leadID: String) {
        guard let index = state.leads.firstIndex(where: { $0.id == leadID }) else { return }
        var lead = state.leads.remove(at: index)
        let deletedAt = Self.timestamp()
        lead.previousStatus = lead.status
        lead.status = .deleted
        lead.set("deleted_at", deletedAt)
        lead.set("updated_at", deletedAt)
        state.deletedLeads.removeAll { $0.id == lead.id }
        state.deletedLeads.append(lead)
        addTombstone(for: lead, deletedAt: deletedAt)
        saveState()
        selectedLeadID = nil
        showToast("Moved to Recently Deleted")
    }

    func restoreDeleted(_ leadID: String) {
        guard let index = state.deletedLeads.firstIndex(where: { $0.id == leadID }) else { return }
        var lead = state.deletedLeads.remove(at: index)
        let destination = lead.previousStatus == .deleted ? LeadStatus.toApply : lead.previousStatus
        lead.status = destination
        lead.remove("deleted_at")
        lead.remove("previous_status")
        lead.set("updated_at", Self.timestamp())
        state.leads.removeAll { $0.id == lead.id }
        state.leads.append(lead)
        state.tombstones.removeAll { !$0.dedupeKeys.isDisjoint(with: lead.dedupeKeys) }
        saveState()
        selectedSection = section(for: destination)
        selectedLeadID = lead.id
        showToast("Opportunity restored")
    }

    func permanentlyDelete(_ leadID: String) {
        guard let lead = state.deletedLeads.first(where: { $0.id == leadID }) else { return }
        state.deletedLeads.removeAll { $0.id == leadID }
        if !state.tombstones.contains(where: { !$0.dedupeKeys.isDisjoint(with: lead.dedupeKeys) }) {
            addTombstone(for: lead, deletedAt: lead.deletedAt.isEmpty ? Self.timestamp() : lead.deletedAt)
        }
        saveState()
        selectedLeadID = nil
        showToast("Posting details deleted; dedupe marker retained")
    }

    func updateUserNotes(_ leadID: String, notes: String) {
        if selectedSection == .deleted {
            guard let index = state.deletedLeads.firstIndex(where: { $0.id == leadID }) else { return }
            state.deletedLeads[index].set("user_notes", notes)
            saveState()
            return
        }
        mutateLead(leadID) { lead in
            lead.set("user_notes", notes)
            lead.set("updated_at", Self.timestamp())
        }
    }

    func importDocuments(category: DocumentCategory) {
        let panel = NSOpenPanel()
        panel.title = "Add \(category.rawValue)"
        panel.prompt = "Import"
        panel.canChooseFiles = true
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = true
        guard panel.runModal() == .OK else { return }
        isBusy = true
        defer { isBusy = false }

        let destination = documentDirectory(for: category)
        do {
            try fileManager.createDirectory(at: destination, withIntermediateDirectories: true)
            for source in panel.urls {
                try copyItemUniquely(from: source, to: destination)
            }
            refreshDocuments()
            markQuestionAuditStale("New or changed documents were imported after the previous evidence audit.")
            showToast("Documents imported")
        } catch {
            errorMessage = "Could not import documents: \(error.localizedDescription)"
        }
    }

    func importProjectFolder() {
        let panel = NSOpenPanel()
        panel.title = "Add project reports and source material"
        panel.prompt = "Import Project"
        panel.canChooseDirectories = true
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = true
        guard panel.runModal() == .OK else { return }
        let destination = workspaceURL.appendingPathComponent("Projects", isDirectory: true)
        do {
            try fileManager.createDirectory(at: destination, withIntermediateDirectories: true)
            for source in panel.urls {
                try copyItemUniquely(from: source, to: destination)
            }
            markQuestionAuditStale("New or changed project material was imported after the previous evidence audit.")
            showToast("Project material imported")
        } catch {
            errorMessage = "Could not import project material: \(error.localizedDescription)"
        }
    }

    func refreshDocuments() {
        var items: [DocumentItem] = []
        for category in DocumentCategory.allCases {
            let directory = documentDirectory(for: category)
            guard let enumerator = fileManager.enumerator(
                at: directory,
                includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey],
                options: [.skipsHiddenFiles]
            ) else { continue }
            for case let url as URL in enumerator {
                guard let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey]),
                      values.isRegularFile == true else { continue }
                items.append(
                    DocumentItem(
                        url: url,
                        category: category,
                        modifiedAt: values.contentModificationDate ?? .distantPast,
                        byteCount: Int64(values.fileSize ?? 0)
                    )
                )
            }
        }
        documentItems = items.sorted { $0.modifiedAt > $1.modifiedAt }
    }

    func documentCount(for category: DocumentCategory) -> Int {
        documentItems.filter { $0.category == category }.count
    }

    func revealWorkspace() {
        NSWorkspace.shared.activateFileViewerSelecting([workspaceURL])
    }

    func revealDocumentInbox() {
        let url = workspaceURL.appendingPathComponent("Documents", isDirectory: true)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func revealProjects() {
        let url = workspaceURL.appendingPathComponent("Projects", isDirectory: true)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func open(path: String) {
        guard !path.isEmpty else { return }
        NSWorkspace.shared.open(URL(fileURLWithPath: path))
    }

    func reveal(path: String) {
        guard !path.isEmpty else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }

    func openWeb(_ value: String) {
        guard let url = URL(string: value), !value.isEmpty else { return }
        NSWorkspace.shared.open(url)
    }

    func openQuestionSource(_ source: EvidenceQuestionSource) {
        let path = NSString(string: source.path).expandingTildeInPath
        let url = path.hasPrefix("/")
            ? URL(fileURLWithPath: path)
            : workspaceURL.appendingPathComponent(path)
        guard fileManager.fileExists(atPath: url.path) else {
            errorMessage = "The cited source could not be found at \(source.path)."
            return
        }
        NSWorkspace.shared.open(url)
    }

    func copyCodexRequest(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        if let url = URL(string: "codex://") {
            NSWorkspace.shared.open(url)
        }
        showToast("Codex request copied")
    }

    func automationSyncRequest() -> String {
        "Sync my Career Command Center automation with the settings in \(configURL.path)."
    }

    func runSearchRequest() -> String {
        "Run my Career Command Center job and PhD search now using \(configURL.path)."
    }

    func questionGenerationRequest() -> String {
        "Audit my Career Command Center CVs, project files, transcripts, and intake answers. Generate only source-specific, high-impact evidence questions in \(questionsURL.path) using the plugin question standard and question_cli.py."
    }

    func questionReviewRequest() -> String {
        "Review my answered Career Command Center evidence questions in \(questionsURL.path). Update the verified evidence ledger and approved evidence, resolve each reviewed response through question_cli.py, and generate only necessary cited follow-ups."
    }

    func showToast(_ message: String) {
        toastMessage = message
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2.4))
            if toastMessage == message { toastMessage = "" }
        }
    }

    private func mutateLead(_ leadID: String, mutation: (inout LeadRecord) -> Void) {
        guard let index = state.leads.firstIndex(where: { $0.id == leadID }) else { return }
        mutation(&state.leads[index])
        saveState()
    }

    private func section(for status: LeadStatus) -> AppSection {
        switch status {
        case .toApply: return .toApply
        case .monitor: return .monitor
        case .applied: return .applied
        case .archived: return .archive
        case .deleted: return .deleted
        }
    }

    private func addTombstone(for lead: LeadRecord, deletedAt: String) {
        let tombstone = LeadTombstone(lead: lead, deletedAt: deletedAt)
        state.tombstones.removeAll { !$0.dedupeKeys.isDisjoint(with: tombstone.dedupeKeys) }
        state.tombstones.append(tombstone)
    }

    private func saveState() {
        state.version = max(state.version, 3)
        state.updatedAt = Self.timestamp()
        do {
            try atomicWrite(state, to: stateURL)
        } catch {
            errorMessage = "Could not save application state: \(error.localizedDescription)"
        }
    }

    private func saveQuestions() {
        questionBank.version = 1
        questionBank.updatedAt = Self.timestamp()
        do {
            try atomicWrite(questionBank, to: questionsURL)
        } catch {
            errorMessage = "Could not save evidence questions: \(error.localizedDescription)"
        }
    }

    private func markQuestionAuditStale(_ note: String) {
        questionBank.auditStatus = questionBank.generationID.isEmpty ? .notStarted : .needsRefresh
        questionBank.sourceChangeNote = note
        saveQuestions()
    }

    private func loadQuestions() {
        do {
            if fileManager.fileExists(atPath: questionsURL.path) {
                let data = try Data(contentsOf: questionsURL)
                questionBank = try decoder.decode(PersonalizedQuestionBank.self, from: data)
            } else {
                questionBank = PersonalizedQuestionBank()
                saveQuestions()
            }
            markQuestionAuditStaleIfSourcesChanged()
            if !questionBank.questions.contains(where: { $0.id == selectedQuestionID }) {
                selectedQuestionID = questionsNeedingAnswer.first?.id
                    ?? questionsAwaitingReview.first?.id
                    ?? questionHistory.first?.id
            }
        } catch {
            errorMessage = "Could not read evidence questions: \(error.localizedDescription)"
            questionBank = PersonalizedQuestionBank()
            selectedQuestionID = nil
        }
    }

    private func markQuestionAuditStaleIfSourcesChanged() {
        guard questionBank.auditStatus == .current,
              let auditedAt = ISO8601DateFormatter().date(from: questionBank.generatedAt),
              let newestSource = newestEvidenceSourceDate(),
              newestSource.timeIntervalSince(auditedAt) > 2 else { return }
        questionBank.auditStatus = .needsRefresh
        questionBank.sourceChangeNote = "Source files changed after the previous evidence audit."
        saveQuestions()
    }

    private func newestEvidenceSourceDate() -> Date? {
        let roots = [
            workspaceURL.appendingPathComponent("Documents", isDirectory: true),
            workspaceURL.appendingPathComponent("Projects", isDirectory: true),
        ]
        var newest: Date?
        for root in roots {
            guard let enumerator = fileManager.enumerator(
                at: root,
                includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey],
                options: [.skipsHiddenFiles]
            ) else { continue }
            for case let url as URL in enumerator {
                guard let values = try? url.resourceValues(
                    forKeys: [.contentModificationDateKey, .isRegularFileKey]
                ), values.isRegularFile == true, let modifiedAt = values.contentModificationDate else { continue }
                if newest == nil || modifiedAt > newest! { newest = modifiedAt }
            }
        }
        let intakeURL = workspaceURL.appendingPathComponent("Evidence_Bank/intake_answers.md")
        if let values = try? intakeURL.resourceValues(forKeys: [.contentModificationDateKey]),
           let modifiedAt = values.contentModificationDate,
           newest == nil || modifiedAt > newest! {
            newest = modifiedAt
        }
        return newest
    }

    private func sortedQuestions(_ questions: [EvidenceQuestion]) -> [EvidenceQuestion] {
        let rank: [EvidenceQuestionPriority: Int] = [.critical: 0, .high: 1, .medium: 2]
        return questions.sorted { lhs, rhs in
            let left = rank[lhs.priority] ?? 3
            let right = rank[rhs.priority] ?? 3
            if left != right { return left < right }
            return lhs.generatedAt > rhs.generatedAt
        }
    }

    private func loadState() {
        do {
            if fileManager.fileExists(atPath: stateURL.path) {
                let data = try Data(contentsOf: stateURL)
                state = try decoder.decode(CommandCenterState.self, from: data)
            } else {
                state = CommandCenterState()
                saveState()
            }
            migrateStateSchema()
            if selectedLeadID == nil {
                selectedLeadID = visibleLeads.first?.id
            }
        } catch {
            errorMessage = "Could not read application state: \(error.localizedDescription)"
            state = CommandCenterState()
        }
    }

    private func loadConfig() {
        do {
            if fileManager.fileExists(atPath: configURL.path) {
                let data = try Data(contentsOf: configURL)
                config = try decoder.decode(AppConfig.self, from: data)
                if config.version < 2 {
                    config.version = 2
                    saveConfig()
                }
            } else {
                config = AppConfig()
                config.workspacePath = workspaceURL.path
                prefillProfileFromEvidenceBank()
                detectExistingAutomation()
                saveConfig()
            }
        } catch {
            errorMessage = "Could not read settings: \(error.localizedDescription)"
            config = AppConfig()
            config.workspacePath = workspaceURL.path
        }
    }

    private func migrateStateSchema() {
        var changed = state.version < 3
        for index in state.leads.indices {
            let old = state.leads[index].string("status")?.lowercased()
            if old == "hidden" || old == "dismissed" {
                state.leads[index].status = .archived
                state.leads[index].set("migrated_from_status", old ?? "hidden")
                changed = true
            } else if old == "manual_check" || old == "manual check" {
                state.leads[index].status = .toApply
                state.leads[index].set("migrated_from_status", old ?? "manual_check")
                changed = true
            }
            if migrateAssessment(&state.leads[index]) {
                changed = true
            }
        }
        for index in state.deletedLeads.indices {
            if migrateAssessment(&state.deletedLeads[index]) {
                changed = true
            }
        }
        if changed { saveState() }
    }

    private func migrateAssessment(_ lead: inout LeadRecord) -> Bool {
        let structuredKeys = [
            "match_strengths",
            "fit_gaps",
            "eligibility_constraints",
            "application_requirements",
            "search_notes"
        ]
        let hadStructuredAssessment = structuredKeys.contains { lead.raw[$0] != nil }
        let previousVersion = lead.raw["assessment_schema_version"]?.intValue ?? 0
        var strengths = lead.stringArray("match_strengths")
        var gaps = lead.stringArray("fit_gaps")
        var eligibility = lead.stringArray("eligibility_constraints")
        var application = lead.stringArray("application_requirements")
        var notes = lead.stringArray("search_notes")

        if strengths.isEmpty, !lead.rationale.isEmpty {
            strengths = [lead.rationale]
        }
        if !hadStructuredAssessment, !lead.concerns.isEmpty {
            for rawClause in assessmentClauses(lead.concerns) {
                let clause = cleanedAssessmentClause(rawClause)
                guard !clause.isEmpty else { continue }
                switch assessmentBucket(for: clause) {
                case .application: application.append(clause)
                case .eligibility: eligibility.append(clause)
                case .note: notes.append(clause)
                case .gap: gaps.append(clause)
                }
            }
        }

        var correctedGaps: [String] = []
        for gap in gaps {
            if assessmentBucket(for: gap) == .application {
                application.append(gap)
            } else {
                correctedGaps.append(gap)
            }
        }

        strengths = uniqueAssessmentItems(strengths)
        gaps = uniqueAssessmentItems(correctedGaps)
        eligibility = uniqueAssessmentItems(eligibility)
        application = uniqueAssessmentItems(application)
        notes = uniqueAssessmentItems(notes)

        lead.set("match_strengths", strengths)
        lead.set("fit_gaps", gaps)
        lead.set("eligibility_constraints", eligibility)
        lead.set("application_requirements", application)
        lead.set("search_notes", notes)
        lead.set("assessment_schema_version", 2)
        return previousVersion < 2 || !hadStructuredAssessment
    }

    private enum AssessmentBucket: Equatable {
        case application
        case eligibility
        case note
        case gap
    }

    private func assessmentBucket(for value: String) -> AssessmentBucket {
        let text = value.lowercased()
        let applicationTerms = [
            "transcript", "degree certificate", "diploma", "referee", "reference letter",
            "merged application pdf", "application pdf", "upload", "online submission",
            "application asks", "application form", "application is by email", "apply flow",
            "fallback email", "cover letter", "motivation letter", "letter of motivation",
            "curriculum vitae", "submit a cv", "requires a cv", "portfolio", "publication list",
            "supporting document", "application material", "writing sample", "research proposal",
            "statement of purpose", "academic record", "proof of degree", "deadline"
        ]
        if applicationTerms.contains(where: text.contains) { return .application }

        let noteTerms = [
            "legacy package", "do not reuse", "keep as monitor", "manual review", "package deferred",
            "human review", "not an automatic", "worth reviewing", "lower strategic priority",
            "review project fit", "original job", "security checkpoint", "canonical lead",
            "confirm the target job", "apply only if", "not a first-priority"
        ]
        if noteTerms.contains(where: text.contains) { return .note }

        let eligibilityTerms = [
            "contract role", "fixed-term", "temporary", "maternity-cover", "maternity cover",
            "on-site", "onsite", "relocation", "travel", "driving licence", "driver licence",
            "driver's license", "munich-only", "full-time", "part-time", "six-month",
            "work permit", "sponsorship", "german is", "german required", "french required",
            "fluent german", "german proficiency", "german level", "fluent french",
            "french proficiency", "french level", "italian required", "citizenship",
            "appointment is 70 percent", "four on-site days"
        ]
        if eligibilityTerms.contains(where: text.contains) { return .eligibility }
        return .gap
    }

    private func assessmentClauses(_ value: String) -> [String] {
        value
            .replacingOccurrences(of: "; ", with: ";\n")
            .replacingOccurrences(of: ". ", with: ".\n")
            .split(separator: "\n")
            .map(String.init)
    }

    private func cleanedAssessmentClause(_ value: String) -> String {
        var result = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let prefixes = [
            "Manual check before applying:",
            "Manual check:",
            "Stretch role:",
            "High stretch:"
        ]
        for prefix in prefixes where result.lowercased().hasPrefix(prefix.lowercased()) {
            result = String(result.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            break
        }
        return result
    }

    private func uniqueAssessmentItems(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { value in
            let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { return nil }
            let key = cleaned.lowercased()
            guard seen.insert(key).inserted else { return nil }
            return cleaned
        }
    }

    private func prefillProfileFromEvidenceBank() {
        let url = workspaceURL.appendingPathComponent("Evidence_Bank/approved_evidence.json")
        guard let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let facts = root["profile_facts"] as? [String: Any] else { return }
        config.profile.fullName = facts["name"] as? String ?? config.profile.fullName
        config.profile.location = facts["location"] as? String ?? config.profile.location
        config.profile.workAuthorization = facts["permit_line"] as? String ?? config.profile.workAuthorization
        if let languages = facts["languages"] as? [String] {
            config.profile.languages = languages.joined(separator: "; ")
        }
        if let masters = root["approved_master_cvs"] as? [String: String] {
            config.cv.selectedMasterPaths = masters.keys.sorted().compactMap { masters[$0] }
        }
    }

    private func detectExistingAutomation() {
        let root = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent(".codex/automations", isDirectory: true)
        guard let directories = try? fileManager.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else { return }

        for directory in directories {
            let file = directory.appendingPathComponent("automation.toml")
            guard let text = try? String(contentsOf: file, encoding: .utf8),
                  text.contains(workspaceURL.path) else { continue }
            let identifier = text
                .split(separator: "\n")
                .first { $0.trimmingCharacters(in: .whitespaces).hasPrefix("id =") }
                .map(String.init)?
                .split(separator: "=", maxSplits: 1)
                .last?
                .trimmingCharacters(in: CharacterSet(charactersIn: " \t\""))
            if let identifier, !identifier.isEmpty {
                config.automation.automationID = identifier
                config.automation.needsCodexSync = true
                config.automation.lastSyncedAt = ""
                return
            }
        }
    }

    private func ensureWorkspaceStructure() {
        let directories = [
            "Applications",
            "Automation",
            "Config",
            "Documents",
            "Evidence_Bank",
            "Job_Postings",
            "Logs",
            "Projects",
            "State"
        ] + DocumentCategory.allCases.map { "Documents/\($0.rawValue)" }

        do {
            for path in directories {
                try fileManager.createDirectory(
                    at: workspaceURL.appendingPathComponent(path, isDirectory: true),
                    withIntermediateDirectories: true
                )
            }
        } catch {
            errorMessage = "Could not prepare workspace: \(error.localizedDescription)"
        }
    }

    private func documentDirectory(for category: DocumentCategory) -> URL {
        workspaceURL.appendingPathComponent("Documents/\(category.rawValue)", isDirectory: true)
    }

    private func copyItemUniquely(from source: URL, to destination: URL) throws {
        var candidate = destination.appendingPathComponent(source.lastPathComponent)
        let stem = source.deletingPathExtension().lastPathComponent
        let ext = source.pathExtension
        var counter = 2
        while fileManager.fileExists(atPath: candidate.path) {
            let name = ext.isEmpty ? "\(stem) \(counter)" : "\(stem) \(counter).\(ext)"
            candidate = destination.appendingPathComponent(name)
            counter += 1
        }
        try fileManager.copyItem(at: source, to: candidate)
    }

    private func writeIntakeSummary() {
        let lines = [
            "# Career Command Center Intake",
            "",
            "Generated: \(Self.timestamp())",
            "",
            "## Candidate",
            "- Name: \(config.profile.fullName)",
            "- Location: \(config.profile.location)",
            "- Work authorisation: \(config.profile.workAuthorization)",
            "- Languages: \(config.profile.languages)",
            "",
            "## Search",
            "- Countries: \(config.search.countries.joined(separator: ", "))",
            "- Opportunity types: \(config.search.opportunityTypes.joined(separator: ", "))",
            "- Work arrangements: \(config.search.workArrangements.joined(separator: ", "))",
            "- Seniority: \(config.search.seniority.joined(separator: ", "))",
            "- Target direction: \(config.search.targetRoleDescription)",
            "- Role families: \(config.search.inferRoleFamilies ? "Infer from evidence" : config.search.roleFamilies.joined(separator: ", "))",
            "- Include: \(config.search.includeKeywords)",
            "- Exclude: \(config.search.excludeKeywords)",
            "",
            "## Evidence answers",
            "### Education and experience",
            config.evidence.educationAndExperience,
            "",
            "### Career direction",
            config.evidence.careerDirection,
            "",
            "### Strongest work",
            config.evidence.strongestWork,
            "",
            "### Ownership boundaries",
            config.evidence.ownershipBoundaries,
            "",
            "### Verified metrics",
            config.evidence.verifiedMetrics,
            "",
            "### Project context",
            config.evidence.projectContext,
            "",
            "### Constraints and recurring concerns",
            config.evidence.roleConcerns,
            "",
            "### Claims to avoid",
            config.evidence.claimsToAvoid,
            ""
        ]
        let url = workspaceURL.appendingPathComponent("Evidence_Bank/intake_answers.md")
        do {
            try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
        } catch {
            errorMessage = "Could not save intake answers: \(error.localizedDescription)"
        }
    }

    private func atomicWrite<T: Encodable>(_ value: T, to url: URL) throws {
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try encoder.encode(value)
        try data.write(to: url, options: .atomic)
    }

    private static func resolveWorkspace() -> URL {
        let arguments = CommandLine.arguments
        if let index = arguments.firstIndex(of: "--workspace"), arguments.indices.contains(index + 1) {
            return URL(fileURLWithPath: arguments[index + 1], isDirectory: true)
        }
        if let saved = UserDefaults.standard.string(forKey: workspacePreferenceKey), !saved.isEmpty {
            return URL(fileURLWithPath: saved, isDirectory: true)
        }
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home.appendingPathComponent("Documents/Career Command Center", isDirectory: true)
    }

    static func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}

extension AppStore {
    static func previewConfig(workspaceURL: URL) -> AppConfig {
        var config = AppConfig()
        config.onboardingCompleted = true
        config.workspacePath = workspaceURL.path
        config.profile = CandidateProfile(
            fullName: "Alex Morgan",
            email: "alex@example.com",
            phone: "+31 6 00000000",
            location: "Rotterdam, Netherlands",
            workAuthorization: "EU work authorisation recorded",
            linkedinURL: "https://linkedin.com/in/alex",
            githubURL: "https://github.com/alex",
            languages: "English: fluent; Dutch: B2"
        )
        config.search = SearchPreferences(
            countries: ["Netherlands", "Belgium"],
            opportunityTypes: ["Job", "Graduate programme"],
            workArrangements: ["On-site", "Hybrid"],
            roleFamilies: ["Systems engineering", "Applied data analysis"],
            inferRoleFamilies: false,
            targetRoleDescription: "Evidence-led engineering and analytical roles",
            seniority: ["Graduate", "Junior"],
            includeKeywords: "",
            excludeKeywords: "",
            minimumScore: 82
        )
        return config
    }

    static func previewState() -> CommandCenterState {
        let leads = [
            LeadRecord(raw: [
                "id": .string("preview-1"),
                "title": .string("Systems Integration Engineer"),
                "organization": .string("Atlas Instruments"),
                "location": .string("Eindhoven, Netherlands"),
                "type": .string("Job"),
                "score": .integer(94),
                "tier": .string("A"),
                "status": .string("to_apply"),
                "deadline": .string("28 July 2026"),
                "match_strengths": .array([
                    .string("Structured validation work aligns with the system-integration responsibilities."),
                    .string("Python analysis and technical documentation support the role's engineering workflow.")
                ]),
                "fit_gaps": .array([
                    .string("Formal ownership of product-certification work is not yet demonstrated.")
                ]),
                "application_requirements": .array([
                    .string("Upload a CV, degree certificate, and transcript through the employer portal.")
                ]),
                "assessment_schema_version": .integer(2),
                "job_url": .string("https://example.com/job/1"),
                "apply_url": .string("https://example.com/job/1/apply"),
                "key_requirements": .array([
                    .string("MSc in mechanical, electrical, or systems engineering."),
                    .string("Hands-on integration, verification, and technical documentation."),
                    .string("Python or MATLAB for engineering analysis.")
                ]),
                "job_summary": .array([
                    .string("Integrate and validate electromechanical subsystems for an industrial sensing platform.")
                ])
            ]),
            LeadRecord(raw: [
                "id": .string("preview-2"),
                "title": .string("Graduate Data Analyst"),
                "organization": .string("Civic Metrics Lab"),
                "location": .string("Brussels, Belgium"),
                "type": .string("Graduate programme"),
                "score": .integer(91),
                "tier": .string("A"),
                "status": .string("to_apply"),
                "match_strengths": .array([
                    .string("Python analysis, statistical modelling, and clear reporting support the core project work.")
                ]),
                "assessment_schema_version": .integer(2),
                "job_url": .string("https://example.com/job/2")
            ]),
            LeadRecord(raw: [
                "id": .string("preview-3"),
                "title": .string("Product Development Engineer"),
                "organization": .string("Northstar Manufacturing"),
                "location": .string("Ghent, Belgium"),
                "type": .string("Job"),
                "score": .integer(87),
                "tier": .string("B"),
                "status": .string("monitor"),
                "match_strengths": .array([
                    .string("CAD, prototyping, and test planning support the product-development workflow.")
                ]),
                "assessment_schema_version": .integer(2),
                "job_url": .string("https://example.com/job/3")
            ])
        ]
        return CommandCenterState(leads: leads)
    }

    static func previewDocuments(workspaceURL: URL) -> [DocumentItem] {
        [
            DocumentItem(
                url: workspaceURL.appendingPathComponent("Documents/CVs/Master_CV.pdf"),
                category: .cvs,
                modifiedAt: Date(),
                byteCount: 410_000
            ),
            DocumentItem(
                url: workspaceURL.appendingPathComponent("Documents/Transcripts/MSc_Transcript.pdf"),
                category: .transcripts,
                modifiedAt: Date().addingTimeInterval(-3600),
                byteCount: 280_000
            )
        ]
    }

    static func previewQuestionBank() -> PersonalizedQuestionBank {
        PersonalizedQuestionBank(
            generationID: "preview-audit-1",
            auditStatus: .current,
            generatedAt: timestamp(),
            questions: [
                EvidenceQuestion(
                    id: "logitech-configuration-time-baseline",
                    priority: .critical,
                    category: .metric,
                    question: "The workflow report projects a 50% reduction in configuration time. Was that figure measured against a baseline, estimated from the process, or proposed as a target?",
                    whyItMatters: "The classification determines whether the CV can present the figure as a result, an estimate, or a design target.",
                    sourceRefs: [
                        EvidenceQuestionSource(
                            path: "Projects/Workflow Automation/Final Report.pdf",
                            label: "Workflow Automation Final Report",
                            locator: "Discussion, page 18",
                            context: "The report gives the 50% figure without identifying a measured baseline or validation run."
                        )
                    ],
                    generatedAt: timestamp()
                ),
                EvidenceQuestion(
                    id: "microfluidics-design-decision",
                    priority: .high,
                    category: .outcome,
                    question: "Which channel or pillar geometry did your final microfluidic analysis support, and what simulation result drove that choice?",
                    whyItMatters: "A concrete engineering decision would make the project evidence stronger than a description of the modelling workflow alone.",
                    sourceRefs: [
                        EvidenceQuestionSource(
                            path: "Projects/Microfluidics/Project Report.pdf",
                            label: "Capillary Microfluidics Project Report",
                            locator: "Results and conclusion, pages 21-24",
                            context: "Several geometries are compared, but the report does not clearly state the candidate's final design recommendation."
                        )
                    ],
                    generatedAt: timestamp()
                ),
                EvidenceQuestion(
                    id: "robot-gripper-personal-ownership",
                    priority: .high,
                    category: .ownership,
                    question: "For the robotic gripper, which CAD, fabrication, control, and testing tasks did you personally complete?",
                    whyItMatters: "The report uses team language, so individual ownership must be separated before project bullets are approved.",
                    sourceRefs: [
                        EvidenceQuestionSource(
                            path: "Projects/Robotic Gripper/Final Presentation.pdf",
                            label: "Robotic Gripper Final Presentation",
                            locator: "Design and testing slides 6-14",
                            context: "The presentation describes team outputs without assigning the main implementation tasks to individual members."
                        )
                    ],
                    status: .answered,
                    answer: "I designed the finger linkage and servo mount in Fusion 360, prepared the PETG prints, integrated the Arduino servo control, and ran the object-grasp tests. The PMMA frame layout was shared.",
                    generatedAt: timestamp(),
                    answeredAt: timestamp()
                )
            ]
        )
    }
}

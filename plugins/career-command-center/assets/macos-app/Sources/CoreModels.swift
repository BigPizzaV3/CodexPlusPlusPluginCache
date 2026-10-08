import Foundation

enum JSONValue: Codable, Hashable {
    case string(String)
    case integer(Int)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .integer(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .integer(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var stringValue: String? {
        switch self {
        case .string(let value): return value
        case .integer(let value): return String(value)
        case .number(let value): return String(value)
        case .bool(let value): return String(value)
        default: return nil
        }
    }

    var intValue: Int? {
        switch self {
        case .integer(let value): return value
        case .number(let value): return Int(value)
        case .string(let value): return Int(value)
        default: return nil
        }
    }

    var stringArray: [String] {
        guard case .array(let values) = self else { return [] }
        return values.compactMap(\.stringValue)
    }
}

enum LeadStatus: String, CaseIterable, Identifiable, Codable {
    case toApply = "to_apply"
    case monitor
    case applied
    case archived
    case deleted

    var id: String { rawValue }

    var label: String {
        switch self {
        case .toApply: return "To Apply"
        case .monitor: return "Saved"
        case .applied: return "Applied"
        case .archived: return "Archive"
        case .deleted: return "Recently Deleted"
        }
    }

    static func normalized(_ value: String?) -> LeadStatus {
        switch value?.lowercased() {
        case "applied": return .applied
        case "monitor", "saved": return .monitor
        case "hidden", "archived", "archive", "dismissed": return .archived
        case "deleted": return .deleted
        case "manual_check", "manual check", "to_apply", "to apply": return .toApply
        default: return .toApply
        }
    }
}

struct LeadRecord: Codable, Hashable, Identifiable {
    var raw: [String: JSONValue]

    init(raw: [String: JSONValue]) {
        self.raw = raw
    }

    init(from decoder: Decoder) throws {
        raw = try [String: JSONValue](from: decoder)
    }

    func encode(to encoder: Encoder) throws {
        try raw.encode(to: encoder)
    }

    var id: String {
        string("id") ?? string("source_job_id") ?? UUID().uuidString
    }

    var title: String { string("title") ?? "Untitled opportunity" }
    var organization: String { string("organization") ?? string("company") ?? "Unknown organization" }
    var location: String { string("location") ?? "Location not specified" }
    var type: String { string("type") ?? "Opportunity" }
    var tier: String { string("tier") ?? "" }
    var deadline: String { string("deadline") ?? "" }
    var rationale: String { string("rationale") ?? "" }
    var concerns: String { string("concerns") ?? "" }
    var applicationMethod: String { string("application_method") ?? "" }
    var jobURL: String { string("job_url") ?? "" }
    var applyURL: String { string("apply_url") ?? jobURL }
    var cvPath: String { string("cv_path") ?? "" }
    var coverLetterPath: String { string("cover_letter_path") ?? "" }
    var packageFolder: String { string("package_folder") ?? "" }
    var notesPath: String { string("notes_path") ?? "" }
    var sourceJobID: String { string("source_job_id") ?? "" }
    var platformSource: String { string("platform_source") ?? "" }
    var createdAt: String { string("created_at") ?? "" }
    var updatedAt: String { string("updated_at") ?? "" }
    var appliedAt: String { string("applied_at") ?? "" }
    var deletedAt: String { string("deleted_at") ?? "" }
    var userNotes: String { string("user_notes") ?? "" }
    var score: Int? { raw["score"]?.intValue }
    var requirements: [String] { raw["key_requirements"]?.stringArray ?? [] }
    var responsibilities: [String] { raw["key_responsibilities"]?.stringArray ?? [] }
    var summary: [String] { raw["job_summary"]?.stringArray ?? [] }
    var selectedEvidenceIDs: [String] { raw["selected_evidence_ids"]?.stringArray ?? [] }
    var matchStrengths: [String] {
        let values = stringArray("match_strengths")
        return values.isEmpty && !rationale.isEmpty ? [rationale] : values
    }
    var fitGaps: [String] { stringArray("fit_gaps") }
    var eligibilityConstraints: [String] { stringArray("eligibility_constraints") }
    var applicationRequirements: [String] { stringArray("application_requirements") }
    var searchNotes: [String] {
        let values = stringArray("search_notes")
        let hasStructuredFields = [
            "match_strengths",
            "fit_gaps",
            "eligibility_constraints",
            "application_requirements",
            "search_notes"
        ].contains { raw[$0] != nil }
        return values.isEmpty && !hasStructuredFields && !concerns.isEmpty ? [concerns] : values
    }
    var hasAssessment: Bool {
        !matchStrengths.isEmpty || !fitGaps.isEmpty || !eligibilityConstraints.isEmpty ||
            !applicationRequirements.isEmpty || !searchNotes.isEmpty
    }
    var hasPackage: Bool { !cvPath.isEmpty || !coverLetterPath.isEmpty || !packageFolder.isEmpty }

    var status: LeadStatus {
        get { LeadStatus.normalized(string("status")) }
        set { raw["status"] = .string(newValue.rawValue) }
    }

    var previousStatus: LeadStatus {
        get { LeadStatus.normalized(string("previous_status")) }
        set { raw["previous_status"] = .string(newValue.rawValue) }
    }

    mutating func set(_ key: String, _ value: String) {
        raw[key] = .string(value)
    }

    mutating func set(_ key: String, _ values: [String]) {
        raw[key] = .array(values.map(JSONValue.string))
    }

    mutating func set(_ key: String, _ value: Int) {
        raw[key] = .integer(value)
    }

    mutating func remove(_ key: String) {
        raw.removeValue(forKey: key)
    }

    func string(_ key: String) -> String? {
        raw[key]?.stringValue
    }

    func stringArray(_ key: String) -> [String] {
        raw[key]?.stringArray ?? []
    }

    var dedupeKeys: Set<String> {
        Set([id, sourceJobID, jobURL, applyURL].filter { !$0.isEmpty })
    }
}

struct LeadTombstone: Codable, Hashable, Identifiable {
    var id: String
    var sourceJobID: String
    var jobURL: String
    var applyURL: String
    var title: String
    var organization: String
    var deletedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case sourceJobID = "source_job_id"
        case jobURL = "job_url"
        case applyURL = "apply_url"
        case title
        case organization
        case deletedAt = "deleted_at"
    }

    init(lead: LeadRecord, deletedAt: String) {
        id = lead.id
        sourceJobID = lead.sourceJobID
        jobURL = lead.jobURL
        applyURL = lead.applyURL
        title = lead.title
        organization = lead.organization
        self.deletedAt = deletedAt
    }

    var dedupeKeys: Set<String> {
        Set([id, sourceJobID, jobURL, applyURL].filter { !$0.isEmpty })
    }
}

struct CommandCenterState: Codable {
    var version: Int
    var createdAt: String
    var updatedAt: String
    var leads: [LeadRecord]
    var deletedLeads: [LeadRecord]
    var tombstones: [LeadTombstone]
    var notes: [JSONValue]

    enum CodingKeys: String, CodingKey {
        case version
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case leads
        case deletedLeads = "deleted_leads"
        case tombstones = "lead_tombstones"
        case notes
    }

    init(
        version: Int = 3,
        createdAt: String = ISO8601DateFormatter().string(from: Date()),
        updatedAt: String = ISO8601DateFormatter().string(from: Date()),
        leads: [LeadRecord] = [],
        deletedLeads: [LeadRecord] = [],
        tombstones: [LeadTombstone] = [],
        notes: [JSONValue] = []
    ) {
        self.version = version
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.leads = leads
        self.deletedLeads = deletedLeads
        self.tombstones = tombstones
        self.notes = notes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ISO8601DateFormatter().string(from: Date())
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? createdAt
        leads = try container.decodeIfPresent([LeadRecord].self, forKey: .leads) ?? []
        deletedLeads = try container.decodeIfPresent([LeadRecord].self, forKey: .deletedLeads) ?? []
        tombstones = try container.decodeIfPresent([LeadTombstone].self, forKey: .tombstones) ?? []
        notes = try container.decodeIfPresent([JSONValue].self, forKey: .notes) ?? []
    }
}

struct CandidateProfile: Codable, Equatable {
    var fullName = ""
    var email = ""
    var phone = ""
    var location = ""
    var workAuthorization = ""
    var linkedinURL = ""
    var githubURL = ""
    var languages = ""
}

struct SearchPreferences: Codable, Equatable {
    var countries: [String]
    var opportunityTypes: [String]
    var workArrangements: [String]
    var roleFamilies: [String]
    var inferRoleFamilies: Bool
    var targetRoleDescription: String
    var seniority: [String]
    var includeKeywords: String
    var excludeKeywords: String
    var minimumScore: Int

    init(
        countries: [String] = [],
        opportunityTypes: [String] = [],
        workArrangements: [String] = [],
        roleFamilies: [String] = [],
        inferRoleFamilies: Bool = true,
        targetRoleDescription: String = "",
        seniority: [String] = [],
        includeKeywords: String = "",
        excludeKeywords: String = "",
        minimumScore: Int = 82
    ) {
        self.countries = countries
        self.opportunityTypes = opportunityTypes
        self.workArrangements = workArrangements
        self.roleFamilies = roleFamilies
        self.inferRoleFamilies = inferRoleFamilies
        self.targetRoleDescription = targetRoleDescription
        self.seniority = seniority
        self.includeKeywords = includeKeywords
        self.excludeKeywords = excludeKeywords
        self.minimumScore = minimumScore
    }

    enum CodingKeys: String, CodingKey {
        case countries
        case opportunityTypes
        case workArrangements
        case roleFamilies
        case inferRoleFamilies
        case targetRoleDescription
        case seniority
        case includeKeywords
        case excludeKeywords
        case minimumScore
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        countries = try container.decodeIfPresent([String].self, forKey: .countries) ?? []
        opportunityTypes = try container.decodeIfPresent([String].self, forKey: .opportunityTypes) ?? []
        workArrangements = try container.decodeIfPresent([String].self, forKey: .workArrangements) ?? []
        roleFamilies = try container.decodeIfPresent([String].self, forKey: .roleFamilies) ?? []
        inferRoleFamilies = try container.decodeIfPresent(Bool.self, forKey: .inferRoleFamilies) ?? roleFamilies.isEmpty
        targetRoleDescription = try container.decodeIfPresent(String.self, forKey: .targetRoleDescription) ?? ""
        seniority = try container.decodeIfPresent([String].self, forKey: .seniority) ?? []
        includeKeywords = try container.decodeIfPresent(String.self, forKey: .includeKeywords) ?? ""
        excludeKeywords = try container.decodeIfPresent(String.self, forKey: .excludeKeywords) ?? ""
        minimumScore = try container.decodeIfPresent(Int.self, forKey: .minimumScore) ?? 82
    }
}

struct CVPreferences: Codable, Equatable {
    var strategyVersion = "2.0"
    var pageLimit = 2
    var includePhoto = false
    var targetLanguage = "Auto"
    var tone = "Precise, natural, and evidence-led"
    var selectedMasterPaths: [String] = []
}

struct AutomationPreferences: Codable, Equatable {
    var enabled: Bool
    var frequency: String
    var weekdaysOnly: Bool
    var weeklyDay: String
    var hour: Int
    var minute: Int
    var minimumNewLeads: Int
    var searchDepthMinutes: Int
    var autoCreateTierAPackages: Bool
    var automationID: String
    var needsCodexSync: Bool
    var lastSyncedAt: String

    init(
        enabled: Bool = false,
        frequency: String = "manual",
        weekdaysOnly: Bool = false,
        weeklyDay: String = "Monday",
        hour: Int = 8,
        minute: Int = 0,
        minimumNewLeads: Int = 3,
        searchDepthMinutes: Int = 90,
        autoCreateTierAPackages: Bool = false,
        automationID: String = "career-command-center-daily",
        needsCodexSync: Bool = true,
        lastSyncedAt: String = ""
    ) {
        self.enabled = enabled
        self.frequency = frequency
        self.weekdaysOnly = weekdaysOnly
        self.weeklyDay = weeklyDay
        self.hour = hour
        self.minute = minute
        self.minimumNewLeads = minimumNewLeads
        self.searchDepthMinutes = searchDepthMinutes
        self.autoCreateTierAPackages = autoCreateTierAPackages
        self.automationID = automationID
        self.needsCodexSync = needsCodexSync
        self.lastSyncedAt = lastSyncedAt
    }

    enum CodingKeys: String, CodingKey {
        case enabled
        case frequency
        case weekdaysOnly
        case weeklyDay
        case hour
        case minute
        case minimumNewLeads
        case searchDepthMinutes
        case autoCreateTierAPackages
        case automationID
        case needsCodexSync
        case lastSyncedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
        frequency = try container.decodeIfPresent(String.self, forKey: .frequency) ?? "manual"
        weekdaysOnly = try container.decodeIfPresent(Bool.self, forKey: .weekdaysOnly) ?? false
        weeklyDay = try container.decodeIfPresent(String.self, forKey: .weeklyDay) ?? "Monday"
        hour = try container.decodeIfPresent(Int.self, forKey: .hour) ?? 8
        minute = try container.decodeIfPresent(Int.self, forKey: .minute) ?? 0
        minimumNewLeads = try container.decodeIfPresent(Int.self, forKey: .minimumNewLeads) ?? 3
        searchDepthMinutes = try container.decodeIfPresent(Int.self, forKey: .searchDepthMinutes) ?? 90
        autoCreateTierAPackages = try container.decodeIfPresent(Bool.self, forKey: .autoCreateTierAPackages) ?? false
        automationID = try container.decodeIfPresent(String.self, forKey: .automationID) ?? "career-command-center-daily"
        needsCodexSync = try container.decodeIfPresent(Bool.self, forKey: .needsCodexSync) ?? true
        lastSyncedAt = try container.decodeIfPresent(String.self, forKey: .lastSyncedAt) ?? ""
    }
}

struct EvidenceAnswers: Codable, Equatable {
    var educationAndExperience: String
    var careerDirection: String
    var strongestWork: String
    var ownershipBoundaries: String
    var verifiedMetrics: String
    var projectContext: String
    var roleConcerns: String
    var claimsToAvoid: String

    init(
        educationAndExperience: String = "",
        careerDirection: String = "",
        strongestWork: String = "",
        ownershipBoundaries: String = "",
        verifiedMetrics: String = "",
        projectContext: String = "",
        roleConcerns: String = "",
        claimsToAvoid: String = ""
    ) {
        self.educationAndExperience = educationAndExperience
        self.careerDirection = careerDirection
        self.strongestWork = strongestWork
        self.ownershipBoundaries = ownershipBoundaries
        self.verifiedMetrics = verifiedMetrics
        self.projectContext = projectContext
        self.roleConcerns = roleConcerns
        self.claimsToAvoid = claimsToAvoid
    }

    enum CodingKeys: String, CodingKey {
        case educationAndExperience
        case careerDirection
        case strongestWork
        case ownershipBoundaries
        case verifiedMetrics
        case projectContext
        case roleConcerns
        case claimsToAvoid
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        educationAndExperience = try container.decodeIfPresent(String.self, forKey: .educationAndExperience) ?? ""
        careerDirection = try container.decodeIfPresent(String.self, forKey: .careerDirection) ?? ""
        strongestWork = try container.decodeIfPresent(String.self, forKey: .strongestWork) ?? ""
        ownershipBoundaries = try container.decodeIfPresent(String.self, forKey: .ownershipBoundaries) ?? ""
        verifiedMetrics = try container.decodeIfPresent(String.self, forKey: .verifiedMetrics) ?? ""
        projectContext = try container.decodeIfPresent(String.self, forKey: .projectContext) ?? ""
        roleConcerns = try container.decodeIfPresent(String.self, forKey: .roleConcerns) ?? ""
        claimsToAvoid = try container.decodeIfPresent(String.self, forKey: .claimsToAvoid) ?? ""
    }
}

enum EvidenceQuestionPriority: String, Codable, CaseIterable, Identifiable {
    case critical
    case high
    case medium

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum EvidenceQuestionCategory: String, Codable, CaseIterable, Identifiable {
    case metric
    case ownership
    case outcome
    case method
    case timeline
    case contradiction
    case eligibility
    case direction
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .metric: return "Metric"
        case .ownership: return "Ownership"
        case .outcome: return "Outcome"
        case .method: return "Method"
        case .timeline: return "Timeline"
        case .contradiction: return "Contradiction"
        case .eligibility: return "Eligibility"
        case .direction: return "Direction"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .metric: return "chart.bar.fill"
        case .ownership: return "person.badge.key.fill"
        case .outcome: return "checkmark.seal.fill"
        case .method: return "wrench.and.screwdriver.fill"
        case .timeline: return "calendar"
        case .contradiction: return "arrow.left.arrow.right"
        case .eligibility: return "checkmark.shield.fill"
        case .direction: return "scope"
        case .other: return "questionmark.circle.fill"
        }
    }
}

enum EvidenceQuestionStatus: String, Codable, CaseIterable, Identifiable {
    case open
    case answered
    case unableToVerify = "unable_to_verify"
    case notApplicable = "not_applicable"
    case resolved
    case superseded

    var id: String { rawValue }

    var label: String {
        switch self {
        case .open: return "Needs answer"
        case .answered: return "Ready for review"
        case .unableToVerify: return "Cannot verify"
        case .notApplicable: return "Not applicable"
        case .resolved: return "Resolved"
        case .superseded: return "Superseded"
        }
    }

    var needsUserAnswer: Bool { self == .open }
    var awaitsCodexReview: Bool { self == .answered || self == .unableToVerify }
    var isHistory: Bool { self == .resolved || self == .notApplicable || self == .superseded }
}

struct EvidenceQuestionSource: Codable, Hashable, Identifiable {
    var path: String
    var label: String
    var locator: String
    var context: String

    var id: String { "\(path)#\(locator)" }
}

struct EvidenceQuestion: Codable, Hashable, Identifiable {
    var id: String
    var priority: EvidenceQuestionPriority
    var category: EvidenceQuestionCategory
    var question: String
    var whyItMatters: String
    var sourceRefs: [EvidenceQuestionSource]
    var relatedEvidenceIDs: [String]
    var status: EvidenceQuestionStatus
    var answer: String
    var generatedAt: String
    var answeredAt: String
    var reviewedAt: String
    var reviewNote: String

    enum CodingKeys: String, CodingKey {
        case id
        case priority
        case category
        case question
        case whyItMatters = "why_it_matters"
        case sourceRefs = "source_refs"
        case relatedEvidenceIDs = "related_evidence_ids"
        case status
        case answer
        case generatedAt = "generated_at"
        case answeredAt = "answered_at"
        case reviewedAt = "reviewed_at"
        case reviewNote = "review_note"
    }

    init(
        id: String,
        priority: EvidenceQuestionPriority,
        category: EvidenceQuestionCategory,
        question: String,
        whyItMatters: String,
        sourceRefs: [EvidenceQuestionSource],
        relatedEvidenceIDs: [String] = [],
        status: EvidenceQuestionStatus = .open,
        answer: String = "",
        generatedAt: String = "",
        answeredAt: String = "",
        reviewedAt: String = "",
        reviewNote: String = ""
    ) {
        self.id = id
        self.priority = priority
        self.category = category
        self.question = question
        self.whyItMatters = whyItMatters
        self.sourceRefs = sourceRefs
        self.relatedEvidenceIDs = relatedEvidenceIDs
        self.status = status
        self.answer = answer
        self.generatedAt = generatedAt
        self.answeredAt = answeredAt
        self.reviewedAt = reviewedAt
        self.reviewNote = reviewNote
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        priority = try container.decode(EvidenceQuestionPriority.self, forKey: .priority)
        category = try container.decode(EvidenceQuestionCategory.self, forKey: .category)
        question = try container.decode(String.self, forKey: .question)
        whyItMatters = try container.decodeIfPresent(String.self, forKey: .whyItMatters) ?? ""
        sourceRefs = try container.decodeIfPresent([EvidenceQuestionSource].self, forKey: .sourceRefs) ?? []
        relatedEvidenceIDs = try container.decodeIfPresent([String].self, forKey: .relatedEvidenceIDs) ?? []
        status = try container.decodeIfPresent(EvidenceQuestionStatus.self, forKey: .status) ?? .open
        answer = try container.decodeIfPresent(String.self, forKey: .answer) ?? ""
        generatedAt = try container.decodeIfPresent(String.self, forKey: .generatedAt) ?? ""
        answeredAt = try container.decodeIfPresent(String.self, forKey: .answeredAt) ?? ""
        reviewedAt = try container.decodeIfPresent(String.self, forKey: .reviewedAt) ?? ""
        reviewNote = try container.decodeIfPresent(String.self, forKey: .reviewNote) ?? ""
    }
}

enum EvidenceQuestionAuditStatus: String, Codable {
    case notStarted = "not_started"
    case current
    case needsRefresh = "needs_refresh"

    var needsAudit: Bool { self != .current }
}

struct PersonalizedQuestionBank: Codable, Equatable {
    var version: Int
    var generationID: String
    var auditStatus: EvidenceQuestionAuditStatus
    var sourceChangeNote: String
    var generatedAt: String
    var updatedAt: String
    var questions: [EvidenceQuestion]

    enum CodingKeys: String, CodingKey {
        case version
        case generationID = "generation_id"
        case auditStatus = "audit_status"
        case sourceChangeNote = "source_change_note"
        case generatedAt = "generated_at"
        case updatedAt = "updated_at"
        case questions
    }

    init(
        version: Int = 1,
        generationID: String = "",
        auditStatus: EvidenceQuestionAuditStatus = .notStarted,
        sourceChangeNote: String = "",
        generatedAt: String = "",
        updatedAt: String = ISO8601DateFormatter().string(from: Date()),
        questions: [EvidenceQuestion] = []
    ) {
        self.version = version
        self.generationID = generationID
        self.auditStatus = auditStatus
        self.sourceChangeNote = sourceChangeNote
        self.generatedAt = generatedAt
        self.updatedAt = updatedAt
        self.questions = questions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        generationID = try container.decodeIfPresent(String.self, forKey: .generationID) ?? ""
        auditStatus = try container.decodeIfPresent(EvidenceQuestionAuditStatus.self, forKey: .auditStatus) ?? .notStarted
        sourceChangeNote = try container.decodeIfPresent(String.self, forKey: .sourceChangeNote) ?? ""
        generatedAt = try container.decodeIfPresent(String.self, forKey: .generatedAt) ?? ""
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
        questions = try container.decodeIfPresent([EvidenceQuestion].self, forKey: .questions) ?? []
    }
}

struct AppConfig: Codable, Equatable {
    var version = 2
    var onboardingCompleted = false
    var onboardingCompletedAt = ""
    var workspacePath = ""
    var profile = CandidateProfile()
    var search = SearchPreferences()
    var cv = CVPreferences()
    var automation = AutomationPreferences()
    var evidence = EvidenceAnswers()
    var createdAt = ISO8601DateFormatter().string(from: Date())
    var updatedAt = ISO8601DateFormatter().string(from: Date())

    enum CodingKeys: String, CodingKey {
        case version
        case onboardingCompleted = "onboarding_completed"
        case onboardingCompletedAt = "onboarding_completed_at"
        case workspacePath = "workspace_path"
        case profile
        case search
        case cv
        case automation
        case evidence
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum DocumentCategory: String, CaseIterable, Identifiable, Codable {
    case cvs = "CVs"
    case transcripts = "Transcripts"
    case certificates = "Certificates"
    case recommendations = "Recommendations"
    case portfolio = "Portfolio and Work Samples"
    case other = "Other"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .cvs: return "doc.text.fill"
        case .transcripts: return "graduationcap.fill"
        case .certificates: return "checkmark.seal.fill"
        case .recommendations: return "quote.bubble.fill"
        case .portfolio: return "shippingbox.fill"
        case .other: return "folder.fill"
        }
    }
}

enum AppSection: String, CaseIterable, Identifiable {
    case toApply
    case monitor
    case applied
    case archive
    case deleted
    case documents
    case evidence
    case questions
    case automation
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .toApply: return "To Apply"
        case .monitor: return "Saved"
        case .applied: return "Applied"
        case .archive: return "Archive"
        case .deleted: return "Recently Deleted"
        case .documents: return "Documents"
        case .evidence: return "Evidence"
        case .questions: return "Questions"
        case .automation: return "Automation"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .toApply: return "tray.full.fill"
        case .monitor: return "bookmark.fill"
        case .applied: return "checkmark.circle.fill"
        case .archive: return "archivebox.fill"
        case .deleted: return "trash.fill"
        case .documents: return "folder.fill"
        case .evidence: return "doc.text.magnifyingglass"
        case .questions: return "questionmark.bubble.fill"
        case .automation: return "clock.arrow.2.circlepath"
        case .settings: return "gearshape.fill"
        }
    }

    var leadStatus: LeadStatus? {
        switch self {
        case .toApply: return .toApply
        case .monitor: return .monitor
        case .applied: return .applied
        case .archive: return .archived
        case .deleted: return .deleted
        default: return nil
        }
    }
}

struct DocumentItem: Identifiable, Hashable {
    let url: URL
    let category: DocumentCategory
    let modifiedAt: Date
    let byteCount: Int64

    var id: String { url.path }
    var name: String { url.lastPathComponent }
}

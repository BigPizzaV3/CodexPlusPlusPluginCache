import SwiftUI

struct MainView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        HStack(spacing: 0) {
            SidebarView(store: store)
                .frame(width: 224)
            Divider()
            content
        }
        .frame(minWidth: 1200, minHeight: 720)
        .background(AppTheme.canvas)
        .overlay(alignment: .topTrailing) {
            if !store.toastMessage.isEmpty {
                Label(store.toastMessage, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 13)
                    .frame(height: 36)
                    .background(AppTheme.ink.opacity(0.92), in: RoundedRectangle(cornerRadius: 6))
                    .shadow(color: .black.opacity(0.15), radius: 10, y: 4)
                    .padding(18)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.18), value: store.toastMessage)
        .alert("Career Command Center", isPresented: Binding(
            get: { !store.errorMessage.isEmpty },
            set: { if !$0 { store.errorMessage = "" } }
        )) {
            Button("OK", role: .cancel) { store.errorMessage = "" }
        } message: {
            Text(store.errorMessage)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch store.selectedSection {
        case .toApply, .monitor, .applied, .archive, .deleted:
            HStack(spacing: 0) {
                OpportunityListView(store: store)
                    .frame(width: 390)
                Divider()
                LeadDetailView(store: store)
                    .frame(minWidth: 580)
            }
        case .documents:
            DocumentsView(store: store)
        case .evidence:
            EvidenceView(store: store)
        case .questions:
            QuestionsView(store: store)
        case .automation:
            AutomationView(store: store)
        case .settings:
            SettingsView(store: store)
        }
    }
}

struct SidebarView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                AppLogo(size: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Career Command")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Center")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 20)
            .foregroundStyle(AppTheme.ink)

            sidebarLabel("PIPELINE")
            sidebarButton(.toApply, count: store.count(for: .toApply))
            sidebarButton(.monitor, count: store.count(for: .monitor))
            sidebarButton(.applied, count: store.count(for: .applied))
            sidebarButton(.archive, count: store.count(for: .archive))
            sidebarButton(.deleted, count: store.count(for: .deleted))

            sidebarLabel("WORKSPACE")
                .padding(.top, 14)
            sidebarButton(.documents)
            sidebarButton(.evidence)
            sidebarButton(.questions, count: store.count(for: .questions))
            sidebarButton(.automation)
            sidebarButton(.settings)

            Spacer()

            if store.config.automation.needsCodexSync {
                Button {
                    store.selectedSection = .automation
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.arrow.triangle.2.circlepath")
                            .foregroundStyle(AppTheme.amber)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Sync needed")
                                .font(.system(size: 11, weight: .semibold))
                            Text("Automation settings changed")
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding(10)
                    .background(AppTheme.amber.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }

            Button {
                store.copyCodexRequest(store.runSearchRequest())
            } label: {
                Label("Run Search", systemImage: "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryButtonStyle())
            .padding(.horizontal, 12)
            .padding(.bottom, 8)

            HStack {
                Text(store.workspaceURL.lastPathComponent)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
                IconButton(icon: "arrow.clockwise", help: "Refresh workspace") { store.reload() }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .background(AppTheme.sidebar)
        .foregroundStyle(AppTheme.ink)
    }

    private func sidebarLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(AppTheme.muted)
            .padding(.horizontal, 16)
            .padding(.bottom, 6)
    }

    private func sidebarButton(_ section: AppSection, count: Int? = nil) -> some View {
        let selected = store.selectedSection == section
        return Button {
            store.selectedSection = section
            if section.leadStatus != nil {
                store.selectedLeadID = store.visibleLeads.first?.id
            }
        } label: {
            HStack(spacing: 9) {
                Image(systemName: section.icon)
                    .font(.system(size: 12, weight: .semibold))
                    .frame(width: 18)
                    .foregroundStyle(selected ? Color.white : AppTheme.muted)
                Text(section.title)
                    .font(.system(size: 12, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Color.white : AppTheme.ink)
                Spacer()
                if let count, count > 0 {
                    Text(String(count))
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(selected ? Color.white : AppTheme.muted)
                        .padding(.horizontal, 6)
                        .frame(height: 19)
                        .background(selected ? Color.white.opacity(0.17) : Color.primary.opacity(0.055), in: Capsule())
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(
                selected ? AppTheme.teal : Color.clear,
                in: RoundedRectangle(cornerRadius: 6)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
        .padding(.vertical, 1)
    }
}

struct OpportunityListView: View {
    @ObservedObject var store: AppStore
    @State private var typeFilter = "All"

    private var leads: [LeadRecord] {
        guard typeFilter != "All" else { return store.visibleLeads }
        return store.visibleLeads.filter { $0.type.localizedCaseInsensitiveContains(typeFilter) }
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 13) {
                HStack(alignment: .firstTextBaseline) {
                    SectionTitle(title: store.selectedSection.title)
                    Spacer()
                    Text("\(leads.count)")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    HStack(spacing: 7) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                        TextField("Search opportunities", text: $store.searchText)
                            .textFieldStyle(.plain)
                    }
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.line))

                    Picker("Type", selection: $typeFilter) {
                        Text("All").tag("All")
                        Text("Jobs").tag("Job")
                        Text("PhDs").tag("PhD")
                    }
                    .labelsHidden()
                    .frame(width: 86)
                }
            }
            .padding(18)
            Divider()

            if leads.isEmpty {
                Spacer()
                EmptyStateView(
                    icon: emptyIcon,
                    title: emptyTitle,
                    message: emptyMessage,
                    actionTitle: store.selectedSection == .toApply ? "Run Search" : nil,
                    action: store.selectedSection == .toApply ? { store.copyCodexRequest(store.runSearchRequest()) } : nil
                )
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(leads) { lead in
                            LeadRow(lead: lead, selected: store.selectedLeadID == lead.id)
                                .onTapGesture { store.selectedLeadID = lead.id }
                                .contextMenu {
                                    leadContextMenu(lead)
                                }
                        }
                    }
                    .padding(12)
                }
            }
        }
        .background(AppTheme.canvas)
    }

    @ViewBuilder
    private func leadContextMenu(_ lead: LeadRecord) -> some View {
        if store.selectedSection == .deleted {
            Button("Restore") { store.restoreDeleted(lead.id) }
        } else if store.selectedSection == .archive {
            Button("Restore") { store.restoreArchived(lead.id) }
            Button("Delete", role: .destructive) { store.deleteLead(lead.id) }
        } else {
            Button("Mark Applied") { store.markApplied(lead.id) }
            Button("Save for Later") { store.saveForLater(lead.id) }
            Divider()
            Button("Archive") { store.archive(lead.id) }
            Button("Delete", role: .destructive) { store.deleteLead(lead.id) }
        }
    }

    private var emptyIcon: String {
        switch store.selectedSection {
        case .archive: return "archivebox"
        case .deleted: return "trash"
        case .applied: return "checkmark.circle"
        case .monitor: return "bookmark"
        default: return "tray"
        }
    }

    private var emptyTitle: String {
        switch store.selectedSection {
        case .archive: return "Archive is empty"
        case .deleted: return "Nothing recently deleted"
        case .applied: return "No applications recorded"
        case .monitor: return "No saved opportunities"
        default: return "No opportunities waiting"
        }
    }

    private var emptyMessage: String {
        switch store.selectedSection {
        case .archive: return "Archived opportunities stay out of the active queue and remain protected from rediscovery."
        case .deleted: return "Deleted posting details appear here until they are restored or removed permanently."
        case .applied: return "Mark an opportunity applied when the application has actually been submitted."
        case .monitor: return "Save promising roles that are useful but not ready for immediate action."
        default: return "The next verified search will place matching jobs and PhDs here."
        }
    }
}

struct LeadRow: View {
    let lead: LeadRecord
    let selected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(lead.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    Text(lead.organization)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.teal)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                ScoreBadge(score: lead.score)
            }

            HStack(spacing: 11) {
                MetadataLabel(icon: "mappin.and.ellipse", text: lead.location)
                Spacer(minLength: 0)
                Text(lead.type)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
            }

            if !lead.deadline.isEmpty {
                Label(lead.deadline, systemImage: "calendar")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(AppTheme.coral)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            selected ? AppTheme.teal.opacity(0.10) : AppTheme.panel,
            in: RoundedRectangle(cornerRadius: 7)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 7)
                .stroke(selected ? AppTheme.teal.opacity(0.38) : AppTheme.line)
        )
        .contentShape(Rectangle())
    }
}

struct LeadDetailView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        if let lead = store.selectedLead {
            LeadDetailContent(store: store, lead: lead)
                .id(lead.id + lead.updatedAt)
        } else {
            EmptyStateView(
                icon: "rectangle.and.text.magnifyingglass",
                title: "Select an opportunity",
                message: "Choose a posting from the queue to review fit, application files, and lifecycle actions."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppTheme.canvas)
        }
    }
}

private struct LeadDetailContent: View {
    @ObservedObject var store: AppStore
    let lead: LeadRecord
    @State private var notes: String
    @State private var confirmDelete = false
    @State private var confirmPermanentDelete = false

    init(store: AppStore, lead: LeadRecord) {
        self.store = store
        self.lead = lead
        _notes = State(initialValue: lead.userNotes)
    }

    var body: some View {
        VStack(spacing: 0) {
            detailHeader
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if !lead.summary.isEmpty {
                        detailSection("Overview") {
                            ForEach(lead.summary, id: \.self) { item in
                                Text(item)
                                    .font(.system(size: 13))
                                    .foregroundStyle(.primary)
                            }
                        }
                    }

                    if lead.hasAssessment {
                        assessmentSection
                    }

                    if !lead.requirements.isEmpty {
                        detailSection("Requirements") {
                            bulletList(lead.requirements)
                        }
                    }

                    if !lead.responsibilities.isEmpty {
                        detailSection("Responsibilities") {
                            bulletList(lead.responsibilities)
                        }
                    }

                    if lead.hasPackage {
                        detailSection("Application Package") {
                            packageButtons
                        }
                    }

                    detailSection("Your Notes") {
                        TextEditor(text: $notes)
                            .font(.system(size: 13))
                            .scrollContentBackground(.hidden)
                            .padding(8)
                            .frame(minHeight: 90)
                            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(AppTheme.line))
                        HStack {
                            Spacer()
                            Button("Save Notes") { store.updateUserNotes(lead.id, notes: notes) }
                                .buttonStyle(SecondaryButtonStyle())
                        }
                    }

                    sourceFooter
                }
                .padding(24)
                .frame(maxWidth: 920, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .top)
            }
        }
        .background(AppTheme.canvas)
        .confirmationDialog(
            "Delete this posting?",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Move to Recently Deleted", role: .destructive) { store.deleteLead(lead.id) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The posting leaves every active list. Generated files are preserved, and a dedupe marker prevents the automation from adding it again.")
        }
        .confirmationDialog(
            "Permanently remove posting details?",
            isPresented: $confirmPermanentDelete,
            titleVisibility: .visible
        ) {
            Button("Delete Permanently", role: .destructive) { store.permanentlyDelete(lead.id) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The posting record will be removed. A minimal dedupe marker remains so the same opportunity is not rediscovered.")
        }
    }

    private var detailHeader: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        StatusPill(status: lead.status)
                        if !lead.tier.isEmpty {
                            Text("Tier \(lead.tier)")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(lead.title)
                        .font(.system(size: 21, weight: .semibold))
                        .foregroundStyle(AppTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(lead.organization)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AppTheme.teal)
                    HStack(spacing: 14) {
                        MetadataLabel(icon: "mappin.and.ellipse", text: lead.location)
                        MetadataLabel(icon: "briefcase.fill", text: lead.type)
                        if !lead.deadline.isEmpty {
                            MetadataLabel(icon: "calendar", text: lead.deadline)
                        }
                    }
                }
                Spacer(minLength: 12)
                ScoreBadge(score: lead.score)
            }

            actionBar
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 18)
        .background(AppTheme.canvas)
    }

    @ViewBuilder
    private var actionBar: some View {
        HStack(spacing: 8) {
            if lead.status == .deleted {
                Button {
                    store.restoreDeleted(lead.id)
                } label: {
                    Label("Restore", systemImage: "arrow.uturn.backward")
                }
                .buttonStyle(PrimaryButtonStyle())
                Button {
                    confirmPermanentDelete = true
                } label: {
                    Label("Delete Permanently", systemImage: "trash")
                }
                .buttonStyle(DangerButtonStyle())
            } else if lead.status == .archived {
                Button {
                    store.restoreArchived(lead.id)
                } label: {
                    Label("Restore", systemImage: "arrow.uturn.backward")
                }
                .buttonStyle(PrimaryButtonStyle())
                Button {
                    confirmDelete = true
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .buttonStyle(DangerButtonStyle())
            } else {
                if !lead.jobURL.isEmpty {
                    Button {
                        store.openWeb(lead.jobURL)
                    } label: {
                        Label("Open Posting", systemImage: "arrow.up.right.square")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                if !lead.applyURL.isEmpty {
                    Button {
                        store.openWeb(lead.applyURL)
                    } label: {
                        Label("Apply", systemImage: "paperplane.fill")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
                if lead.status != .applied {
                    IconButton(icon: "checkmark.circle", help: "Mark applied", tint: Color.green) {
                        store.markApplied(lead.id)
                    }
                }
                IconButton(icon: "archivebox", help: "Archive posting") { store.archive(lead.id) }
                IconButton(icon: "trash", help: "Delete posting", tint: AppTheme.coral) { confirmDelete = true }

                Menu {
                    Button("Move to To Apply") { store.moveToApply(lead.id) }
                    Button("Save for Later") { store.saveForLater(lead.id) }
                    if !lead.packageFolder.isEmpty {
                        Divider()
                        Button("Reveal Package") { store.reveal(path: lead.packageFolder) }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 32, height: 30)
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help("More actions")
            }
            Spacer()
        }
    }

    private var packageButtons: some View {
        FlowLayout {
            if !lead.cvPath.isEmpty {
                Button { store.open(path: lead.cvPath) } label: {
                    Label("Open CV", systemImage: "doc.text.fill")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            if !lead.coverLetterPath.isEmpty {
                Button { store.open(path: lead.coverLetterPath) } label: {
                    Label("Open Cover Letter", systemImage: "doc.richtext.fill")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            if !lead.packageFolder.isEmpty {
                Button { store.reveal(path: lead.packageFolder) } label: {
                    Label("Reveal Package", systemImage: "folder.fill")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            if !lead.notesPath.isEmpty {
                Button { store.open(path: lead.notesPath) } label: {
                    Label("Tailoring Notes", systemImage: "checklist")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
    }

    private var sourceFooter: some View {
        HStack(spacing: 14) {
            if !lead.platformSource.isEmpty {
                MetadataLabel(icon: "network", text: lead.platformSource.replacingOccurrences(of: "_", with: " "))
            }
            if !lead.updatedAt.isEmpty {
                MetadataLabel(icon: "clock", text: "Updated \(lead.updatedAt)")
            }
            Spacer()
        }
        .padding(.top, 6)
    }

    private var assessmentSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                if !lead.matchStrengths.isEmpty {
                    detailAssessmentBlock(
                        title: "Match evidence",
                        subtitle: "Verified experience that supports the fit score",
                        icon: "scope",
                        color: AppTheme.teal,
                        items: lead.matchStrengths
                    )
                }
                if !lead.fitGaps.isEmpty {
                    detailAssessmentBlock(
                        title: "Evidence gaps",
                        subtitle: "Role capabilities not yet demonstrated by the evidence bank",
                        icon: "exclamationmark.triangle.fill",
                        color: AppTheme.amber,
                        items: lead.fitGaps
                    )
                }
            }

            if !lead.eligibilityConstraints.isEmpty {
                detailAssessmentBlock(
                    title: "Eligibility and practical constraints",
                    subtitle: "Conditions to confirm before investing in the application",
                    icon: "person.badge.clock.fill",
                    color: AppTheme.amber,
                    items: lead.eligibilityConstraints
                )
            }

            if !lead.applicationRequirements.isEmpty {
                detailAssessmentBlock(
                    title: "Application checklist",
                    subtitle: "Submission tasks only. These do not count against the fit score.",
                    icon: "checklist",
                    color: AppTheme.infoBlue,
                    items: lead.applicationRequirements
                )
            }

            if !lead.searchNotes.isEmpty {
                detailAssessmentBlock(
                    title: "Search notes",
                    subtitle: "Context from discovery and verification",
                    icon: "note.text",
                    color: AppTheme.muted,
                    items: lead.searchNotes
                )
            }
        }
    }

    private func detailSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.secondary)
            content()
        }
    }

    private func detailAssessmentBlock(
        title: String,
        subtitle: String,
        icon: String,
        color: Color,
        items: [String]
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(items, id: \.self) { item in
                        HStack(alignment: .top, spacing: 7) {
                            Circle()
                                .fill(color)
                                .frame(width: 4, height: 4)
                                .padding(.top, 6)
                            Text(item)
                                .font(.system(size: 12))
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(color.opacity(0.075), in: RoundedRectangle(cornerRadius: 6))
    }

    private func bulletList(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle()
                        .fill(AppTheme.teal)
                        .frame(width: 4, height: 4)
                        .padding(.top, 7)
                    Text(item)
                        .font(.system(size: 12))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
            }
        }
    }
}

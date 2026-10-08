import Combine
import SwiftUI

private enum QuestionListFilter: String, CaseIterable, Identifiable {
    case needsAnswer
    case readyForReview
    case history

    var id: String { rawValue }

    var title: String {
        switch self {
        case .needsAnswer: return "Answer"
        case .readyForReview: return "Review"
        case .history: return "History"
        }
    }
}

struct QuestionsView: View {
    @ObservedObject var store: AppStore
    @State private var filter: QuestionListFilter = .needsAnswer
    @State private var answerDraft = ""
    private let refreshTimer = Timer.publish(every: 4, on: .main, in: .common).autoconnect()

    private var questions: [EvidenceQuestion] {
        switch filter {
        case .needsAnswer: return store.questionsNeedingAnswer
        case .readyForReview: return store.questionsAwaitingReview
        case .history: return store.questionHistory
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            HStack(spacing: 0) {
                questionList
                    .frame(width: 360)
                Divider()
                questionDetail
                    .frame(minWidth: 580)
            }
        }
        .background(AppTheme.canvas)
        .onAppear {
            store.refreshQuestions(showConfirmation: false)
            chooseUsefulFilter()
            ensureSelection()
            syncDraft()
        }
        .onChange(of: store.selectedQuestionID) { _, _ in syncDraft() }
        .onChange(of: filter) { _, _ in
            ensureSelection()
            syncDraft()
        }
        .onReceive(refreshTimer) { _ in
            store.refreshQuestions(showConfirmation: false)
            ensureSelection()
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            SectionTitle(
                title: "Evidence Questions",
                subtitle: headerSubtitle
            )
            Spacer()
            if store.questionBank.auditStatus.needsAudit {
                Button {
                    store.copyCodexRequest(store.questionGenerationRequest())
                } label: {
                    Label("Audit in Codex", systemImage: "doc.text.magnifyingglass")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            if !store.questionsAwaitingReview.isEmpty {
                Button {
                    store.copyCodexRequest(store.questionReviewRequest())
                } label: {
                    Label("Review in Codex", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            IconButton(icon: "arrow.clockwise", help: "Refresh questions") {
                store.refreshQuestions()
                chooseUsefulFilter()
                ensureSelection()
                syncDraft()
            }
        }
        .padding(22)
    }

    private var headerSubtitle: String {
        if store.questionBank.auditStatus.needsAudit {
            return store.questionBank.sourceChangeNote.isEmpty
                ? "A source-specific evidence audit is needed"
                : store.questionBank.sourceChangeNote
        }
        return "\(store.questionsNeedingAnswer.count) need answers, \(store.questionsAwaitingReview.count) ready for Codex"
    }

    private var questionList: some View {
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                ForEach(QuestionListFilter.allCases) { option in
                    Button {
                        filter = option
                    } label: {
                        Text(option.title)
                            .font(.system(size: 11, weight: filter == option ? .semibold : .medium))
                            .foregroundStyle(filter == option ? Color.white : AppTheme.muted)
                            .frame(maxWidth: .infinity)
                            .frame(height: 29)
                            .background(
                                filter == option ? AppTheme.teal : Color.clear,
                                in: RoundedRectangle(cornerRadius: 5)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
            .background(Color.primary.opacity(0.055), in: RoundedRectangle(cornerRadius: 6))
            .padding(14)

            Divider()

            if questions.isEmpty {
                listEmptyState
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(questions) { question in
                            QuestionListRow(
                                question: question,
                                selected: store.selectedQuestionID == question.id
                            ) {
                                store.selectedQuestionID = question.id
                            }
                            if question.id != questions.last?.id { Divider() }
                        }
                    }
                }
            }
        }
        .background(AppTheme.sidebar)
    }

    @ViewBuilder
    private var listEmptyState: some View {
        switch filter {
        case .needsAnswer where store.questionBank.questions.isEmpty:
            EmptyStateView(
                icon: "doc.text.magnifyingglass",
                title: "No audit questions yet",
                message: "Ask Codex to read the imported evidence and create cited follow-up questions.",
                actionTitle: "Audit in Codex",
                action: { store.copyCodexRequest(store.questionGenerationRequest()) }
            )
        case .needsAnswer where !store.questionsAwaitingReview.isEmpty:
            EmptyStateView(
                icon: "checkmark.circle",
                title: "Every question has a response",
                message: "Your saved answers are ready to be checked against the source files.",
                actionTitle: "Review in Codex",
                action: { store.copyCodexRequest(store.questionReviewRequest()) }
            )
        case .needsAnswer:
            EmptyStateView(
                icon: "checkmark.circle",
                title: "No questions need an answer",
                message: "The current evidence audit has no open questions."
            )
        case .readyForReview:
            EmptyStateView(
                icon: "tray",
                title: "No answers waiting",
                message: "Answered or unverifiable questions will appear here for Codex review."
            )
        case .history:
            EmptyStateView(
                icon: "clock.arrow.circlepath",
                title: "No question history",
                message: "Resolved and superseded questions will remain available here."
            )
        }
    }

    @ViewBuilder
    private var questionDetail: some View {
        if let question = store.selectedQuestion, questions.contains(where: { $0.id == question.id }) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 8) {
                        Label(question.category.label, systemImage: question.category.icon)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(AppTheme.teal)
                        QuestionPriorityPill(priority: question.priority)
                        QuestionStatusPill(status: question.status)
                        Spacer()
                    }

                    Text(question.question)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(AppTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 5) {
                        Text("Why this matters")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(AppTheme.muted)
                        Text(question.whyItMatters)
                            .font(.system(size: 14))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    sourceSection(question)
                    responseSection(question)
                }
                .padding(26)
                .frame(maxWidth: 860, alignment: .topLeading)
                .frame(maxWidth: .infinity, alignment: .top)
            }
        } else {
            EmptyStateView(
                icon: "questionmark.bubble",
                title: "Select a question",
                message: "Choose an item from the list to review its source and record an answer."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func sourceSection(_ question: EvidenceQuestion) -> some View {
        PanelSection(title: "Sources", subtitle: "The file detail that triggered this question.") {
            VStack(spacing: 0) {
                ForEach(question.sourceRefs) { source in
                    HStack(alignment: .top, spacing: 11) {
                        Image(systemName: "doc.text.fill")
                            .foregroundStyle(AppTheme.infoBlue)
                            .frame(width: 22, height: 22)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(source.label)
                                .font(.system(size: 13, weight: .semibold))
                            Text(source.locator)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(AppTheme.infoBlue)
                            Text(source.context)
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 12)
                        IconButton(icon: "arrow.up.right.square", help: "Open cited source") {
                            store.openQuestionSource(source)
                        }
                    }
                    .padding(.vertical, 10)
                    if source.id != question.sourceRefs.last?.id { Divider() }
                }
            }
        }
    }

    @ViewBuilder
    private func responseSection(_ question: EvidenceQuestion) -> some View {
        PanelSection(title: "Your response", subtitle: responseSubtitle(question.status)) {
            VStack(alignment: .leading, spacing: 12) {
                TextEditor(text: $answerDraft)
                    .font(.system(size: 13))
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(minHeight: 135)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(AppTheme.line))
                    .disabled(question.status == .superseded)

                if !question.reviewNote.isEmpty {
                    InlineBanner(
                        kind: question.status == .resolved ? .success : .info,
                        title: question.status == .resolved ? "Codex review" : "Question history",
                        message: question.reviewNote
                    )
                }

                HStack(spacing: 9) {
                    if question.status == .open || question.status.awaitsCodexReview {
                        Button {
                            store.saveQuestionResponse(question.id, answer: answerDraft, status: .answered)
                            advanceAfterResponse()
                        } label: {
                            Label(question.status == .answered ? "Save Changes" : "Save Answer", systemImage: "checkmark")
                        }
                        .buttonStyle(PrimaryButtonStyle())

                        Menu {
                            Button("I cannot verify this") {
                                store.saveQuestionResponse(question.id, answer: answerDraft, status: .unableToVerify)
                                advanceAfterResponse()
                            }
                            Button("This is not applicable") {
                                store.saveQuestionResponse(question.id, answer: answerDraft, status: .notApplicable)
                                advanceAfterResponse()
                            }
                        } label: {
                            Label("Other response", systemImage: "ellipsis.circle")
                        }
                        .menuStyle(.borderlessButton)
                        .fixedSize()
                    } else if question.status != .superseded {
                        Button {
                            store.reopenQuestion(question.id)
                            filter = .needsAnswer
                            store.selectedQuestionID = question.id
                        } label: {
                            Label("Reopen", systemImage: "arrow.uturn.backward")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }

                    Spacer()

                    if question.status.awaitsCodexReview {
                        Button {
                            store.copyCodexRequest(store.questionReviewRequest())
                        } label: {
                            Label("Review in Codex", systemImage: "arrow.up.right.square")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                }
            }
        }
    }

    private func responseSubtitle(_ status: EvidenceQuestionStatus) -> String {
        switch status {
        case .open: return "Answer only what you know. Unverifiable is a valid response."
        case .answered: return "Saved and waiting for Codex to update the evidence bank."
        case .unableToVerify: return "Codex will record that this detail cannot support a CV claim."
        case .notApplicable: return "Marked as outside your background or the project scope."
        case .resolved: return "Reviewed against the source files and evidence bank."
        case .superseded: return "A later audit no longer requires this question."
        }
    }

    private func chooseUsefulFilter() {
        if !store.questionsNeedingAnswer.isEmpty {
            filter = .needsAnswer
        } else if !store.questionsAwaitingReview.isEmpty {
            filter = .readyForReview
        } else if !store.questionHistory.isEmpty {
            filter = .history
        }
    }

    private func ensureSelection() {
        guard !questions.contains(where: { $0.id == store.selectedQuestionID }) else { return }
        store.selectedQuestionID = questions.first?.id
    }

    private func syncDraft() {
        answerDraft = store.selectedQuestion?.answer ?? ""
    }

    private func advanceAfterResponse() {
        if let next = store.questionsNeedingAnswer.first {
            filter = .needsAnswer
            store.selectedQuestionID = next.id
        } else if !store.questionsAwaitingReview.isEmpty {
            filter = .readyForReview
            store.selectedQuestionID = store.questionsAwaitingReview.first?.id
        } else {
            filter = .history
            store.selectedQuestionID = store.questionHistory.first?.id
        }
        syncDraft()
    }
}

private struct QuestionListRow: View {
    let question: EvidenceQuestion
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 7) {
                    QuestionPriorityPill(priority: question.priority)
                    Text(question.category.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.tertiary)
                }
                Text(question.question)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineLimit(3)
                if let source = question.sourceRefs.first {
                    Label(source.label, systemImage: "doc.text")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                QuestionStatusPill(status: question.status)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? AppTheme.teal.opacity(0.10) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct QuestionPriorityPill: View {
    let priority: EvidenceQuestionPriority

    private var tint: Color {
        switch priority {
        case .critical: return AppTheme.coral
        case .high: return AppTheme.amber
        case .medium: return AppTheme.infoBlue
        }
    }

    var body: some View {
        Text(priority.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 7)
            .frame(height: 21)
            .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 5))
    }
}

private struct QuestionStatusPill: View {
    let status: EvidenceQuestionStatus

    private var tint: Color {
        switch status {
        case .open: return AppTheme.amber
        case .answered: return AppTheme.teal
        case .unableToVerify: return AppTheme.coral
        case .notApplicable, .superseded: return Color.secondary
        case .resolved: return Color.green
        }
    }

    var body: some View {
        Text(status.label)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 7)
            .frame(height: 21)
            .background(tint.opacity(0.10), in: Capsule())
    }
}

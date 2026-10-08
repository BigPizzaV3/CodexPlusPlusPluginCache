import SwiftUI

struct OnboardingView: View {
    @ObservedObject var store: AppStore
    @State private var step = 0
    @State private var furthestStep = 0

    init(store: AppStore, initialStep: Int = 0) {
        self.store = store
        let safeStep = min(max(initialStep, 0), 6)
        _step = State(initialValue: safeStep)
        _furthestStep = State(initialValue: safeStep)
    }

    private let steps = [
        ("Start", "sparkles"),
        ("Profile", "person.crop.circle"),
        ("Documents", "folder.badge.plus"),
        ("Background", "doc.text.magnifyingglass"),
        ("Preferences", "scope"),
        ("CV standard", "doc.badge.gearshape"),
        ("Automation", "clock.arrow.2.circlepath")
    ]

    var body: some View {
        HStack(spacing: 0) {
            onboardingSidebar
                .frame(width: 245)
            Divider()
            VStack(spacing: 0) {
                ScrollView {
                    stepContent
                        .frame(maxWidth: 820, alignment: .leading)
                        .padding(.horizontal, 44)
                        .padding(.vertical, 34)
                        .frame(maxWidth: .infinity, alignment: .top)
                }
                Divider()
                onboardingFooter
                    .padding(.horizontal, 34)
                    .frame(height: 66)
                    .background(AppTheme.canvas)
            }
        }
        .background(AppTheme.canvas)
        .frame(minWidth: 1080, minHeight: 720)
    }

    private var onboardingSidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 11) {
                AppLogo(size: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Career Command Center")
                        .font(.system(size: 14, weight: .semibold))
                    Text("First-use setup")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, 30)

            VStack(alignment: .leading, spacing: 5) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, item in
                    Button {
                        if index <= furthestStep { step = index }
                    } label: {
                        HStack(spacing: 10) {
                            ZStack {
                                Circle()
                                    .fill(index == step ? Color.white.opacity(0.17) : AppTheme.ink.opacity(index < furthestStep ? 0.10 : 0.05))
                                if index < furthestStep {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(index == step ? Color.white : AppTheme.teal)
                                } else {
                                    Image(systemName: item.1)
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(index == step ? Color.white : AppTheme.muted)
                                }
                            }
                            .frame(width: 25, height: 25)
                            Text(item.0)
                                .font(.system(size: 13, weight: index == step ? .semibold : .regular))
                                .foregroundStyle(index == step ? Color.white : (index <= furthestStep ? AppTheme.ink : AppTheme.muted))
                            Spacer()
                        }
                        .padding(.horizontal, 9)
                        .frame(height: 40)
                        .background(
                            index == step ? AppTheme.teal : Color.clear,
                            in: RoundedRectangle(cornerRadius: 6)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(index > furthestStep)
                }
            }

            Spacer()
            VStack(alignment: .leading, spacing: 6) {
                Text("Local by default")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(AppTheme.ink)
                Text("Your documents and answers stay in the workspace you choose. Codex reads them only when you ask it to work on your search.")
                    .font(.system(size: 11))
                    .foregroundStyle(AppTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(22)
        .background(AppTheme.sidebar)
        .foregroundStyle(AppTheme.ink)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: welcomeStep
        case 1: profileStep
        case 2: documentsStep
        case 3: evidenceStep
        case 4: targetsStep
        case 5: cvStep
        default: automationStep
        }
    }

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            SectionTitle(
                title: "Start with a blank search profile",
                subtitle: "Add your documents and broad answers first. Codex will audit them and return with source-specific follow-up questions."
            )

            InlineBanner(
                kind: .info,
                title: "Nothing has been assumed about you",
                message: "No country, role family, seniority, opportunity type, CV language, photograph policy, or recurring schedule is selected on a new setup. You can change every choice later."
            )

            PanelSection(title: "Workspace", subtitle: "One folder holds your source documents, generated applications, lead state, and automation logs.") {
                HStack(spacing: 12) {
                    Image(systemName: "externaldrive.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(AppTheme.teal)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(store.workspaceURL.path)
                            .font(.system(size: 12, design: .monospaced))
                            .lineLimit(2)
                        Text(FileManager.default.fileExists(atPath: store.stateURL.path) ? "Existing application state found" : "A new workspace will be prepared")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Choose Folder") { store.chooseWorkspaceFolder() }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }

            PanelSection(title: "What setup will ask") {
                VStack(spacing: 13) {
                    onboardingPromise(icon: "person.text.rectangle", title: "Your factual profile", text: "Contact details, work authorisation, languages, and public links.")
                    onboardingPromise(icon: "folder.badge.plus", title: "The complete evidence base", text: "Every CV, transcript, certificate, recommendation, report, portfolio item, and project file you can provide.")
                    onboardingPromise(icon: "doc.text.magnifyingglass", title: "Your actual background", text: "Education, experience, strongest work, ownership, verified results, and career direction.")
                    onboardingPromise(icon: "scope", title: "What to search", text: "Only after that: geography, opportunity format, working model, seniority, and any direction you want to impose.")
                    onboardingPromise(icon: "clock.arrow.2.circlepath", title: "How Codex should work", text: "Search depth, minimum lead count, package generation, and schedule.")
                }
            }
        }
    }

    private var profileStep: some View {
        VStack(alignment: .leading, spacing: 22) {
            SectionTitle(title: "Start with the facts that must stay stable", subtitle: "These details become locked identity facts across future CVs.")

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], alignment: .leading, spacing: 16) {
                LabeledField(label: "Full name") {
                    TextField("As it should appear on applications", text: $store.config.profile.fullName)
                        .textFieldStyle(AppTextFieldStyle())
                }
                LabeledField(label: "Current location") {
                    TextField("City, country", text: $store.config.profile.location)
                        .textFieldStyle(AppTextFieldStyle())
                }
                LabeledField(label: "Email") {
                    TextField("name@example.com", text: $store.config.profile.email)
                        .textFieldStyle(AppTextFieldStyle())
                }
                LabeledField(label: "Phone") {
                    TextField("Include country code", text: $store.config.profile.phone)
                        .textFieldStyle(AppTextFieldStyle())
                }
                LabeledField(label: "LinkedIn") {
                    TextField("https://linkedin.com/in/...", text: $store.config.profile.linkedinURL)
                        .textFieldStyle(AppTextFieldStyle())
                }
                LabeledField(label: "GitHub or portfolio") {
                    TextField("Public evidence only", text: $store.config.profile.githubURL)
                        .textFieldStyle(AppTextFieldStyle())
                }
            }

            PanelSection(title: "Work authorisation", subtitle: "Write the exact permit or sponsorship situation. Avoid optimistic shorthand.") {
                TextField("Example: Permit type, expiry, and whether employer action is required", text: $store.config.profile.workAuthorization)
                    .textFieldStyle(AppTextFieldStyle())
            }

            PanelSection(title: "Languages", subtitle: "Use verified levels and test scores where available.") {
                TextField("Example: English fluent (IELTS 7.5); French C1 (DALF)", text: $store.config.profile.languages)
                    .textFieldStyle(AppTextFieldStyle())
            }
        }
    }

    private var targetsStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionTitle(title: "Now define the search boundary", subtitle: "Nothing below is preselected. Choose the practical limits; let Codex infer suitable role families from your evidence unless you prefer to direct it.")

            PanelSection(title: "Countries or regions", subtitle: "Required. Use the places where you genuinely want the automation to search.") {
                TextField("Enter one or more locations, separated by commas", text: commaSeparated($store.config.search.countries))
                    .textFieldStyle(AppTextFieldStyle())
            }

            PanelSection(title: "Opportunity format", subtitle: "Required. These describe the format of the opportunity, not your profession.") {
                FlowLayout {
                    ForEach(["Job", "PhD", "Research assistantship", "Graduate programme"], id: \.self) { option in
                        ChoiceChip(title: option, selected: store.config.search.opportunityTypes.contains(option)) {
                            toggle(option, in: &store.config.search.opportunityTypes)
                        }
                    }
                }
            }

            PanelSection(title: "Working model", subtitle: "Optional. Leave all unselected if any arrangement is acceptable.") {
                FlowLayout {
                    ForEach(["On-site", "Hybrid", "Remote"], id: \.self) { option in
                        ChoiceChip(title: option, selected: store.config.search.workArrangements.contains(option)) {
                            toggle(option, in: &store.config.search.workArrangements)
                        }
                    }
                }
            }

            PanelSection(title: "Professional direction", subtitle: "The default is evidence-led discovery. The app does not assign you a profession from a preset list.") {
                VStack(alignment: .leading, spacing: 14) {
                    Toggle("Infer suitable role families from my documents and background answers", isOn: $store.config.search.inferRoleFamilies)
                        .toggleStyle(.switch)
                    LabeledField(label: "Direction in your own words", hint: "optional") {
                        TextField("Describe work you want, problems you enjoy, or a direction you want to explore", text: $store.config.search.targetRoleDescription)
                            .textFieldStyle(AppTextFieldStyle())
                    }
                    if !store.config.search.inferRoleFamilies {
                        LabeledField(label: "Role families to search", hint: "comma-separated") {
                            TextField("Use your own titles or professional categories", text: commaSeparated($store.config.search.roleFamilies))
                                .textFieldStyle(AppTextFieldStyle())
                        }
                    }
                }
            }

            PanelSection(title: "Seniority", subtitle: "Optional. Leave all unselected to let verified experience and each posting determine the fit.") {
                FlowLayout {
                    ForEach(["Internship", "Graduate", "Junior", "Mid-level", "Senior", "Lead"], id: \.self) { option in
                        ChoiceChip(title: option, selected: store.config.search.seniority.contains(option)) {
                            toggle(option, in: &store.config.search.seniority)
                        }
                    }
                }
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], alignment: .leading, spacing: 16) {
                LabeledField(label: "Include", hint: "skills, domains, employers") {
                    TextField("systems engineering, data analysis, validation", text: $store.config.search.includeKeywords)
                        .textFieldStyle(AppTextFieldStyle())
                }
                LabeledField(label: "Exclude", hint: "roles or constraints") {
                    TextField("commission-only, extensive travel", text: $store.config.search.excludeKeywords)
                        .textFieldStyle(AppTextFieldStyle())
                }
            }
        }
    }

    private var documentsStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionTitle(title: "Give Codex the complete source material", subtitle: "This is the most useful setup step. Sparse evidence produces generic CVs.")

            InlineBanner(
                kind: .warning,
                title: "Include old and imperfect documents",
                message: "Add every CV version, transcript, diploma, certificate, recommendation, project report, thesis, presentation, portfolio item, and useful work sample. Old CVs are audit material, not factual proof."
            )

            VStack(spacing: 0) {
                ForEach(DocumentCategory.allCases) { category in
                    HStack(spacing: 12) {
                        Image(systemName: category.icon)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AppTheme.teal)
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(category.rawValue)
                                .font(.system(size: 13, weight: .medium))
                            Text("\(store.documentCount(for: category)) file\(store.documentCount(for: category) == 1 ? "" : "s") imported")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            store.importDocuments(category: category)
                        } label: {
                            Label("Add", systemImage: "plus")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 58)
                    if category != DocumentCategory.allCases.last { Divider() }
                }
            }
            .background(AppTheme.panel, in: RoundedRectangle(cornerRadius: 7))
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(AppTheme.line))

            PanelSection(title: "Projects", subtitle: "Add complete project folders when possible, including reports, code, figures, notes, and final presentations.") {
                HStack {
                    Button {
                        store.importProjectFolder()
                    } label: {
                        Label("Import Project Material", systemImage: "folder.badge.plus")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    Button("Open Projects Folder") { store.revealProjects() }
                        .buttonStyle(SecondaryButtonStyle())
                    Spacer()
                }
            }
        }
    }

    private var evidenceStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionTitle(title: "Explain the person behind the files", subtitle: "This comes before job preferences so the search can be based on evidence rather than guesses. Short, concrete answers are best.")

            InlineBanner(
                kind: .info,
                title: "This is the first pass",
                message: "After setup, Codex reads the imported files and places project-specific follow-ups in the Questions workspace. Those follow-ups cite the report, CV, transcript, or intake detail that triggered them."
            )

            evidenceEditor(
                title: "What is your education and work history?",
                prompt: "Summarise degrees, disciplines, employers, role scope, dates, and any important transitions. Plain facts are enough.",
                text: $store.config.evidence.educationAndExperience
            )
            evidenceEditor(
                title: "Where do you want to go next?",
                prompt: "Describe work you want more of, work you want to avoid, and whether you are exploring several directions. It is fine to be undecided.",
                text: $store.config.evidence.careerDirection
            )

            evidenceEditor(
                title: "Which work best represents you?",
                prompt: "Name the projects or roles you would want to discuss in an interview. Explain what made each one technically difficult.",
                text: $store.config.evidence.strongestWork
            )
            evidenceEditor(
                title: "What did you personally own?",
                prompt: "Separate your work from team work. Include decisions, implementation, testing, analysis, and documentation you handled yourself.",
                text: $store.config.evidence.ownershipBoundaries
            )
            evidenceEditor(
                title: "Which numbers are verified?",
                prompt: "List scales, accuracies, time savings, test counts, dataset sizes, performance results, grades, and whether each is measured or estimated.",
                text: $store.config.evidence.verifiedMetrics
            )
            evidenceEditor(
                title: "What is missing from your project reports?",
                prompt: "Add tools, constraints, failed approaches, engineering conclusions, team context, and downstream use that the reports do not make clear.",
                text: $store.config.evidence.projectContext
            )
            evidenceEditor(
                title: "Which constraints should shape the search?",
                prompt: "Add permit, relocation, travel, salary, contract, language, schedule, accessibility, or role-level constraints. Leave blank if none are known.",
                text: $store.config.evidence.roleConcerns
            )
            evidenceEditor(
                title: "What must never be claimed?",
                prompt: "Record uncertain dates, shared ownership, proposed KPIs, technologies you only observed, and any wording you do not want used.",
                text: $store.config.evidence.claimsToAvoid
            )
        }
    }

    private var cvStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionTitle(title: "Set the CV operating standard", subtitle: "The plugin uses an evidence-first master-CV strategy rather than rewriting from old applications.")

            PanelSection(title: "Strategy v2.0", subtitle: "Applied to every future job-specific CV.") {
                VStack(spacing: 12) {
                    onboardingPromise(icon: "square.stack.3d.up.fill", title: "Role-family masters", text: "Codex builds stable masters from verified evidence, then starts every application from the closest one.")
                    onboardingPromise(icon: "text.alignleft", title: "Natural targeting", text: "Fit comes from evidence selection, order, and truthful terminology, without visible recruiter commentary.")
                    onboardingPromise(icon: "checkmark.shield.fill", title: "Claim control", text: "Measured, estimated, proposed, shared, and individually owned work stay clearly separated.")
                    onboardingPromise(icon: "doc.viewfinder", title: "Render and inspect", text: "PDF and editable-source output must pass content, ATS, duplicate, and visual checks.")
                }
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], alignment: .leading, spacing: 16) {
                PanelSection(title: "Length") {
                    Stepper("\(store.config.cv.pageLimit) page\(store.config.cv.pageLimit == 1 ? "" : "s")", value: $store.config.cv.pageLimit, in: 1...3)
                }
                PanelSection(title: "Application language") {
                    Picker("Language", selection: $store.config.cv.targetLanguage) {
                        Text("Decide per application").tag("Auto")
                        Text("English").tag("English")
                        Text("French").tag("French")
                        Text("German").tag("German")
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                }
            }

            PanelSection(title: "Photograph", subtitle: "Country norms differ. The CV strategy still keeps the document ATS-readable.") {
                Toggle("Include a professional photo when appropriate for the target country", isOn: $store.config.cv.includePhoto)
                    .toggleStyle(.switch)
            }
        }
    }

    private var automationStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionTitle(title: "Choose how Codex should run", subtitle: "Manual search is the default. A recurring schedule is registered only when you explicitly choose daily or weekly.")

            PanelSection(title: "Schedule") {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Run mode", selection: automationFrequency) {
                        Text("Manual only").tag("manual")
                        Text("Daily").tag("daily")
                        Text("Weekly").tag("weekly")
                    }
                    .pickerStyle(.segmented)
                    if store.config.automation.frequency != "manual" {
                        if store.config.automation.frequency == "daily" {
                            Toggle("Weekdays only", isOn: $store.config.automation.weekdaysOnly)
                                .toggleStyle(.switch)
                        } else {
                            Picker("Day", selection: $store.config.automation.weeklyDay) {
                                ForEach(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], id: \.self) {
                                    Text($0).tag($0)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                        HStack(spacing: 18) {
                            Stepper("Hour: \(String(format: "%02d", store.config.automation.hour))", value: $store.config.automation.hour, in: 0...23)
                            Divider().frame(height: 22)
                            Stepper("Minute: \(String(format: "%02d", store.config.automation.minute))", value: $store.config.automation.minute, in: 0...55, step: 5)
                        }
                    }
                    Stepper("Minimum new leads per run: \(store.config.automation.minimumNewLeads)", value: $store.config.automation.minimumNewLeads, in: 1...20)
                }
            }

            PanelSection(title: "Search depth", subtitle: "Long searches broaden source coverage. Codex still verifies each promoted lead before it reaches the queue.") {
                VStack(alignment: .leading, spacing: 8) {
                    Slider(value: Binding(
                        get: { Double(store.config.automation.searchDepthMinutes) },
                        set: { store.config.automation.searchDepthMinutes = Int($0) }
                    ), in: 30...480, step: 30)
                    Text(durationLabel(store.config.automation.searchDepthMinutes))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.teal)
                }
            }

            PanelSection(title: "Application packages") {
                Toggle("Create CV and cover-letter packages automatically for exceptional matches", isOn: $store.config.automation.autoCreateTierAPackages)
                    .toggleStyle(.switch)
            }

            InlineBanner(
                kind: .info,
                title: "Complete the evidence audit in Codex",
                message: store.config.automation.frequency == "manual"
                    ? "After this window closes, return to Codex and say: Finish Career Command Center setup. Codex will audit the files and place any source-specific follow-ups in Questions. No recurring search will be registered."
                    : "After this window closes, return to Codex and say: Finish Career Command Center setup. Codex will audit the files and place any source-specific follow-ups in Questions before it validates and registers the schedule."
            )
        }
    }

    private var onboardingFooter: some View {
        HStack {
            Text("Step \(step + 1) of \(steps.count)")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            Spacer()
            if step > 0 {
                Button("Back") { step -= 1 }
                    .buttonStyle(SecondaryButtonStyle())
            }
            if step < steps.count - 1 {
                Button("Continue") {
                    store.saveConfig()
                    furthestStep = max(furthestStep, step + 1)
                    step += 1
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canContinue)
            } else {
                Button {
                    store.finishOnboarding()
                } label: {
                    Label("Finish Setup", systemImage: "checkmark")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canContinue)
            }
        }
    }

    private var canContinue: Bool {
        switch step {
        case 1:
            return !store.config.profile.fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case 4:
            let rolesDefined = store.config.search.inferRoleFamilies || !store.config.search.roleFamilies.isEmpty
            return !store.config.search.countries.isEmpty && !store.config.search.opportunityTypes.isEmpty && rolesDefined
        default:
            return true
        }
    }

    private func onboardingPromise(icon: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 11) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AppTheme.teal)
                .frame(width: 22, height: 22)
                .background(AppTheme.teal.opacity(0.09), in: RoundedRectangle(cornerRadius: 5))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Text(text)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private func evidenceEditor(title: String, prompt: String, text: Binding<String>) -> some View {
        PanelSection(title: title, subtitle: prompt) {
            TextEditor(text: text)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(minHeight: 92)
                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(AppTheme.line))
        }
    }

    private func commaSeparated(_ values: Binding<[String]>) -> Binding<String> {
        Binding(
            get: { values.wrappedValue.joined(separator: ", ") },
            set: { newValue in
                values.wrappedValue = newValue
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
        )
    }

    private func toggle(_ value: String, in array: inout [String]) {
        if array.contains(value) {
            array.removeAll { $0 == value }
        } else {
            array.append(value)
        }
    }

    private func durationLabel(_ minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) minutes per run" }
        let hours = Double(minutes) / 60
        return hours == floor(hours)
            ? "\(Int(hours)) hour\(hours == 1 ? "" : "s") per run"
            : String(format: "%.1f hours per run", hours)
    }

    private var automationFrequency: Binding<String> {
        Binding(
            get: { store.config.automation.frequency },
            set: { value in
                store.config.automation.frequency = value
                store.config.automation.enabled = value != "manual"
            }
        )
    }
}

# Sources and provenance

Original sources reviewed 2026-09-06; iOS and Appllama public-contract additions reviewed 2026-09-15. Links document specific requirements; they do not imply endorsement or a licence to reuse a service's content.

| Source | What it supports |
|---|---|
| [OpenAI plugin submission](https://developers.openai.com/plugins/deploy/submission) | Skills-only submission route, verified publisher identity, review before publication. |
| [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines) | Privacy notice categories, recipients, purposes, retention and controls. |
| [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) | GitHub's handling of account and submitted support content; separate from plugin behavior. |
| [AppLlama terms](https://appllama.io/terms) | Website response section 6 describes restrictions on automated access; sections 5 and 7 address library content and rights. No automated access is included in this release. |
| [AppLlama privacy](https://appllama.io/privacy) | Applies to AppLlama itself, not this project; included for users who visit that service independently. |
| [Apple WidgetKit](https://developer.apple.com/documentation/widgetkit) | iPhone widget families, WidgetKit and SwiftUI presentation, App Intents interaction, deep links, and accessibility. |
| [Apple ActivityKit](https://developer.apple.com/documentation/activitykit) | iPhone Live Activity lifecycle, Lock Screen and Dynamic Island presentation, and ActivityKit/WidgetKit integration. |
| [Apple accessible descriptions for widgets and Live Activities](https://developer.apple.com/documentation/activitykit/adding-accessible-descriptions-to-widgets-and-live-activities) | Accessibility labels for every widget and Live Activity presentation, including changing status imagery. |
| [Appllama public skills snapshot](https://github.com/Appllama/appllama-skills/tree/dd5caaec3d5d50ad7fc0324da238119c6b7c3707) | Supplied snapshot of the public tool map, lifecycle semantics, licensing boundary, and runtime unknowns. |

The portable review skill and package documentation are original project material. The disabled Hermes code derives from this project's earlier local implementation, not AppLlama service source code. No AppLlama skills, screenshots, logos, datasets, private reports, or recorded browser output are redistributed. Mentions identify dependencies or references, not affiliation.

Code-level evidence is in the public adapter entry point and the behavior tests. Previous live-prototype results are not acceptance evidence for this release's disabled backend. No claim is made about legal enforceability or exhaustive legal clearance.

The iOS additions are original guidance for the project's supported iPhone
targets. They do not redistribute Apple or AppLlama screens, logos, watermarks,
datasets, or private browser output. The released skill remains no-fetch and
does not make paid or live Appllama MCP calls.

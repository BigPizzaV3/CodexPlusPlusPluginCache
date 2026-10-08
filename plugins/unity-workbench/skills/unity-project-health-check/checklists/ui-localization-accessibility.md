# UI, Localization, and Accessibility Checklist

Inspect:

- uGUI or UI Toolkit architecture
- listener lifecycle
- localization coverage
- hardcoded user-facing strings
- locale switching
- navigation and focus
- keyboard and controller support
- scaling and safe areas
- repeated layout rebuilds
- hidden views remaining subscribed
- color-only communication
- text readability
- input modality assumptions

Only report accessibility requirements the project actually targets or clearly
benefits from.

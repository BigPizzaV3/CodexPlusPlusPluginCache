import { 
// brandCyan,
brandGreen, brandWhite, normalLog, normalWhite } from "./colors.js";
export function configureSemanticHelp(command, enabled) {
    if (!enabled)
        return;
    command.configureHelp({
        styleTitle: brandGreen,
        styleUsage: brandWhite,
        // styleCommandText: brandWhite,
        styleCommandText: brandGreen,
        // styleSubcommandTerm: brandMagenta,
        styleSubcommandTerm: brandWhite,
        styleOptionTerm: normalWhite,
        styleArgumentTerm: normalLog,
    });
}
//# sourceMappingURL=help-style.js.map
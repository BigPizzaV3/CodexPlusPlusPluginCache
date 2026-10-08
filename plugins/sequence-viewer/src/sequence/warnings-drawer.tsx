import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import type { SequenceParseWarning } from "./types";

export function WarningsDrawer({
  warnings,
}: {
  warnings: Array<SequenceParseWarning>;
}): React.ReactElement | null {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <WorkbenchDisclosure
      className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2"
      id="sequence.warnings"
      label={`${warnings.length} parser note${warnings.length === 1 ? "" : "s"}`}
      summaryClassName="cursor-pointer text-sm font-semibold text-token-text-primary"
    >
      <ul className="mt-3 space-y-2 text-sm text-token-text-secondary">
        {warnings.map((warning) => (
          <li key={`${warning.code}-${warning.message}`}>
            <span className="font-semibold">{warning.code}</span>:{" "}
            {warning.message}
          </li>
        ))}
      </ul>
    </WorkbenchDisclosure>
  );
}

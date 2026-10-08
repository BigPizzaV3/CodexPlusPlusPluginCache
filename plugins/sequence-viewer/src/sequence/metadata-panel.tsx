import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import type { SequenceRecord } from "./types";

export function MetadataPanel({
  record,
}: {
  record: SequenceRecord;
}): React.ReactElement | null {
  const entries = Object.entries(record.metadata).filter(
    ([, value]) => String(value).length > 0,
  );
  if (entries.length === 0) {
    return null;
  }

  return (
    <WorkbenchDisclosure
      className="border-t border-token-border pt-3"
      id="sequence.record-metadata"
      label="Record metadata"
      summaryClassName="cursor-pointer text-sm font-medium text-token-text-primary"
    >
      <dl className="mt-3 grid gap-2 text-sm">
        {entries.map(([key, value]) => (
          <div className="grid grid-cols-[7rem_1fr] gap-3" key={key}>
            <dt className="text-token-text-tertiary">{key}</dt>
            <dd className="break-words text-token-text-primary">
              {Array.isArray(value) ? value.join("; ") : value}
            </dd>
          </div>
        ))}
      </dl>
    </WorkbenchDisclosure>
  );
}

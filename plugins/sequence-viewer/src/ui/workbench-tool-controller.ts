import type { SequenceViewerCommandResult } from "../viewer-commands";
import type { ViewerQueryResult } from "../viewer-query";
import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "../runtime-contract";

export type WorkbenchToolGroup =
  "alignment-tools" | "sequence-display" | "sequence-tools";

export type WorkbenchToolGroupSnapshot = {
  activePanel: string | null;
  blocked: boolean;
  group: WorkbenchToolGroup;
  label: string;
  panels: Array<{ id: string; label: string }>;
};

export type WorkbenchToolGroupControl = {
  getSnapshot: () => WorkbenchToolGroupSnapshot;
  setPanel: (panel: string | null) => SequenceViewerCommandResult;
};

export type WorkbenchPanelLocation = {
  group: WorkbenchToolGroup;
  panel: string;
};

export type WorkbenchDisclosureSnapshot = {
  ancestors: Array<string>;
  blocked: boolean;
  expanded: boolean;
  id: string;
  label: string;
  location: WorkbenchPanelLocation | null;
};

export type WorkbenchDisclosureControl = {
  getSnapshot: () => WorkbenchDisclosureSnapshot;
  setExpanded: (expanded: boolean) => SequenceViewerCommandResult;
};

export type WorkbenchFeedbackSnapshot = {
  id: string;
  kind: "copy" | "session-error";
  label: string;
  message: string | null;
  visible: boolean;
};

export type WorkbenchFeedbackControl = {
  dismiss: () => SequenceViewerCommandResult;
  getSnapshot: () => WorkbenchFeedbackSnapshot;
};

/** Direct UI operations shared by buttons and the revisioned agent protocol. */
export class WorkbenchToolController {
  private controls = new Map<WorkbenchToolGroup, WorkbenchToolGroupControl>();
  private disclosures = new Map<string, WorkbenchDisclosureControl>();
  private disclosureCatalogRevision = 0;
  private feedback = new Map<string, WorkbenchFeedbackControl>();
  private feedbackCatalogRevision = 0;
  private identity = crypto.randomUUID();
  private listeners = new Set<() => void>();
  private version = 0;

  getVersion = (): number => this.version;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  notifyChanged = (): void => {
    this.version += 1;
    for (const listener of this.listeners) listener();
  };

  register(
    group: WorkbenchToolGroup,
    control: WorkbenchToolGroupControl,
  ): () => void {
    if (this.controls.has(group)) {
      throw new Error(`Workbench tool group ${group} is already mounted.`);
    }
    this.controls.set(group, control);
    this.notifyChanged();
    return () => {
      if (this.controls.get(group) !== control) return;
      this.controls.delete(group);
      this.notifyChanged();
    };
  }

  getSnapshots(group?: WorkbenchToolGroup): Array<WorkbenchToolGroupSnapshot> {
    return Array.from(this.controls.entries())
      .filter(([id]) => group == null || group === id)
      .map(([, control]) => control.getSnapshot());
  }

  setPanel(
    group: WorkbenchToolGroup,
    panel: string | null,
  ): SequenceViewerCommandResult {
    const control = this.controls.get(group);
    return control == null
      ? {
          applied: false,
          message: `Workbench tool group ${group} is not mounted for this artifact.`,
          state: { mountedGroups: Array.from(this.controls.keys()) },
        }
      : control.setPanel(panel);
  }

  registerDisclosure(
    id: string,
    control: WorkbenchDisclosureControl,
  ): () => void {
    if (this.disclosures.has(id)) {
      throw new Error(`Workbench disclosure ${id} is already mounted.`);
    }
    this.disclosures.set(id, control);
    this.disclosureCatalogRevision += 1;
    this.notifyChanged();
    return () => {
      if (this.disclosures.get(id) !== control) return;
      this.disclosures.delete(id);
      this.disclosureCatalogRevision += 1;
      this.notifyChanged();
    };
  }

  getDisclosureSnapshots(
    mode?: "alignment" | "sequence",
  ): Array<WorkbenchDisclosureSnapshot> {
    return Array.from(this.disclosures.values())
      .map((control) => control.getSnapshot())
      .filter(({ id }) => mode == null || id.startsWith(`${mode}.`))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  setDisclosure(id: string, expanded: boolean): SequenceViewerCommandResult {
    const control = this.disclosures.get(id);
    if (control == null) {
      return {
        applied: false,
        message: `Disclosure ${id} is not mounted. Query workbench-disclosures for the available IDs.`,
      };
    }
    const target = control.getSnapshot();
    if (expanded) {
      const parents = target.ancestors.map((ancestor) =>
        this.disclosures.get(ancestor),
      );
      if (parents.some((parent) => parent == null)) {
        return {
          applied: false,
          message:
            "A parent disclosure is no longer mounted. Query the current viewer state and retry.",
        };
      }
      if (target.location != null) {
        const opened = this.setPanel(
          target.location.group,
          target.location.panel,
        );
        if (!opened.applied) return opened;
      }
      for (const parent of parents) {
        if (parent == null) continue;
        const opened = parent.setExpanded(true);
        if (!opened.applied) return opened;
      }
    }
    return control.setExpanded(expanded);
  }

  queryDisclosures({
    cursor,
    limit,
    mode,
  }: {
    cursor?: string;
    limit: number;
    mode?: "alignment" | "sequence";
  }): ViewerQueryResult {
    return this.queryCatalog(
      "workbench-disclosures",
      this.getDisclosureSnapshots(mode),
      this.disclosureCatalogRevision,
      { cursor, limit, mode },
    );
  }

  registerFeedback(id: string, control: WorkbenchFeedbackControl): () => void {
    if (this.feedback.has(id)) {
      throw new Error(`Workbench feedback ${id} is already mounted.`);
    }
    this.feedback.set(id, control);
    this.feedbackCatalogRevision += 1;
    this.notifyChanged();
    return () => {
      if (this.feedback.get(id) !== control) return;
      this.feedback.delete(id);
      this.feedbackCatalogRevision += 1;
      this.notifyChanged();
    };
  }

  getFeedbackSnapshots(
    mode?: "alignment" | "sequence",
  ): Array<WorkbenchFeedbackSnapshot> {
    return Array.from(this.feedback.values())
      .map((control) => control.getSnapshot())
      .filter(({ id }) => mode == null || id.startsWith(`${mode}.`))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  dismissFeedback(id: string): SequenceViewerCommandResult {
    const feedback = this.feedback.get(id);
    return feedback == null
      ? {
          applied: false,
          message: `Feedback ${id} is not registered. Query workbench-feedback for the available dismissible feedback; user approvals cannot be dismissed through this action.`,
        }
      : feedback.dismiss();
  }

  queryFeedback({
    cursor,
    limit,
    mode,
  }: {
    cursor?: string;
    limit: number;
    mode?: "alignment" | "sequence";
  }): ViewerQueryResult {
    return this.queryCatalog(
      "workbench-feedback",
      this.getFeedbackSnapshots(mode),
      this.feedbackCatalogRevision,
      { cursor, limit, mode },
    );
  }

  private queryCatalog<
    T extends WorkbenchDisclosureSnapshot | WorkbenchFeedbackSnapshot,
  >(
    target: "workbench-disclosures" | "workbench-feedback",
    snapshots: Array<T>,
    revision: number,
    {
      cursor,
      limit,
      mode,
    }: { cursor?: string; limit: number; mode?: "alignment" | "sequence" },
  ): ViewerQueryResult {
    const prefix = `${target}:${this.identity}:${revision}:${mode ?? "current"}:`;
    if (
      cursor != null &&
      (!cursor.startsWith(prefix) ||
        !/^\d+$/u.test(cursor.slice(prefix.length)))
    ) {
      throw new Error(
        `Invalid ${target} cursor. Query the current catalog without a cursor.`,
      );
    }
    const offset = cursor == null ? 0 : Number(cursor.slice(prefix.length));
    if (
      !Number.isSafeInteger(offset) ||
      offset > snapshots.length ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error(
        "Workbench UI queries require a valid cursor and a page limit from 1 to 100.",
      );
    }
    const items = snapshots.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const query: ViewerQueryResult = {
      items,
      nextCursor:
        nextOffset < snapshots.length ? `${prefix}${nextOffset}` : null,
      page: { count: items.length, offset, totalCount: snapshots.length },
      target,
      truncated: nextOffset < snapshots.length,
    };
    if (
      utf8ByteLength(JSON.stringify({ query })) >
      Math.min(
        SEQUENCE_VIEWER_LIMITS.analysis.maxResultBytes,
        SEQUENCE_VIEWER_LIMITS.command.maxCompletionStateBytes,
      )
    ) {
      throw new Error(
        "The UI state page exceeds the completion budget. Request a smaller page limit.",
      );
    }
    return query;
  }
}

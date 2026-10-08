import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { SequenceViewerCommandResult } from "../viewer-commands";
import type { WorkbenchDisclosureSnapshot } from "./workbench-tool-controller";
import {
  hasPendingWorkbenchAction,
  hasPendingWorkbenchDialog,
  WorkbenchPanelLocationContext,
  WorkbenchToolControllerContext,
} from "./workbench-tools";

const WorkbenchDisclosureAncestorsContext = createContext<Array<string>>([]);

/** A native disclosure with one guarded operation for people and agent tools. */
export function WorkbenchDisclosure({
  children,
  className,
  defaultExpanded = false,
  id,
  label,
  summaryClassName,
}: {
  children: ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  id: `${"alignment" | "sequence"}.${string}`;
  label: string;
  summaryClassName?: string;
}): React.ReactElement {
  const controller = useContext(WorkbenchToolControllerContext);
  const location = useContext(WorkbenchPanelLocationContext);
  const ancestors = useContext(WorkbenchDisclosureAncestorsContext);
  const bodyId = useId();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [notice, setNotice] = useState<string | null>(null);
  const sourceControllerRef = useRef(controller);
  const stateRef = useRef({ ancestors, expanded, id, label, location });
  stateRef.current = { ancestors, expanded, id, label, location };
  const ancestryKey = ancestors.join("|");

  const getSnapshot = useCallback(
    (): WorkbenchDisclosureSnapshot => ({
      ...stateRef.current,
      blocked:
        stateRef.current.expanded &&
        (hasPendingWorkbenchDialog() ||
          (detailsRef.current != null &&
            hasPendingWorkbenchAction(detailsRef.current))),
    }),
    [],
  );

  const applyExpanded = useCallback(
    (nextExpanded: boolean): SequenceViewerCommandResult => {
      const snapshot = getSnapshot();
      if (!nextExpanded && snapshot.expanded && snapshot.blocked) {
        setNotice(
          "Finish or dismiss the pending action before closing this section.",
        );
        return {
          applied: false,
          message:
            "The section cannot close while an approval, copy feedback, or alert needs attention.",
          state: { disclosure: snapshot },
        };
      }
      setNotice(null);
      stateRef.current = { ...stateRef.current, expanded: nextExpanded };
      setExpanded(nextExpanded);
      return {
        applied: true,
        message: `${nextExpanded ? "Expanded" : "Collapsed"} ${snapshot.label}.`,
        state: { disclosure: { ...snapshot, expanded: nextExpanded } },
      };
    },
    [getSnapshot],
  );

  useLayoutEffect(
    () =>
      controller?.registerDisclosure(id, {
        getSnapshot,
        setExpanded: applyExpanded,
      }),
    [applyExpanded, controller, getSnapshot, id],
  );
  useLayoutEffect(() => {
    if (sourceControllerRef.current !== controller) {
      sourceControllerRef.current = controller;
      stateRef.current = { ...stateRef.current, expanded: defaultExpanded };
      setExpanded(defaultExpanded);
      setNotice(null);
    }
  }, [controller, defaultExpanded]);
  useLayoutEffect(() => {
    controller?.notifyChanged();
  }, [
    ancestryKey,
    controller,
    expanded,
    label,
    location?.group,
    location?.panel,
  ]);

  return (
    <details
      className={className}
      data-workbench-disclosure={id}
      onToggle={(event) => {
        if (event.currentTarget.open === stateRef.current.expanded) return;
        const result = applyExpanded(event.currentTarget.open);
        if (!result.applied)
          event.currentTarget.open = stateRef.current.expanded;
      }}
      open={expanded}
      ref={detailsRef}
    >
      <summary
        aria-controls={bodyId}
        aria-expanded={expanded}
        className={summaryClassName}
        onClick={(event) => {
          event.preventDefault();
          applyExpanded(!stateRef.current.expanded);
        }}
      >
        {label}
      </summary>
      <div hidden={!expanded} id={bodyId} inert={!expanded ? true : undefined}>
        <WorkbenchDisclosureAncestorsContext.Provider
          value={[...ancestors, id]}
        >
          {children}
        </WorkbenchDisclosureAncestorsContext.Provider>
        {notice == null ? null : <p role="status">{notice}</p>}
      </div>
    </details>
  );
}

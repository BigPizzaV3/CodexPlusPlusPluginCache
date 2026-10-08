import clsx from "clsx";
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
import type {
  WorkbenchToolController,
  WorkbenchToolGroup,
  WorkbenchToolGroupSnapshot,
  WorkbenchPanelLocation,
} from "./workbench-tool-controller";

export const WorkbenchToolControllerContext =
  createContext<WorkbenchToolController | null>(null);
export const WorkbenchPanelLocationContext =
  createContext<WorkbenchPanelLocation | null>(null);

export type WorkbenchToolPanel = {
  content: ReactNode;
  id: string;
  label: string;
};

/** Keep tool state mounted while showing only the task the reader chose. */
export function WorkbenchTools({
  className,
  defaultPanel,
  group,
  label,
  panels,
}: {
  className?: string;
  defaultPanel?: string;
  group: WorkbenchToolGroup;
  label: string;
  panels: Array<WorkbenchToolPanel>;
}): React.ReactElement {
  const controller = useContext(WorkbenchToolControllerContext);
  const instanceId = useId();
  const [activePanel, setActivePanel] = useState<string | null>(
    defaultPanel ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const selectedPanel = panels.find(({ id }) => id === activePanel);
  const stateRef = useRef({ activePanel, group, label, panels });
  stateRef.current = { activePanel, group, label, panels };
  const panelIdentity = JSON.stringify(
    panels.map(({ id, label: name }) => [id, name]),
  );

  const getSnapshot = useCallback((): WorkbenchToolGroupSnapshot => {
    const current = containerRef.current?.querySelector<HTMLElement>(
      ":scope > .bio-workbench-tool-panel:not([hidden])",
    );
    const state = stateRef.current;
    return {
      activePanel: state.panels.some(({ id }) => id === state.activePanel)
        ? state.activePanel
        : null,
      blocked:
        (current != null && hasPendingWorkbenchAction(current)) ||
        hasPendingWorkbenchDialog(),
      group: state.group,
      label: state.label,
      panels: state.panels.map(({ id, label: panelLabel }) => ({
        id,
        label: panelLabel,
      })),
    };
  }, []);

  const setPanel = useCallback(
    (nextPanel: string | null): SequenceViewerCommandResult => {
      const snapshot = getSnapshot();
      if (
        nextPanel != null &&
        !snapshot.panels.some(({ id }) => id === nextPanel)
      ) {
        return {
          applied: false,
          message: `Panel ${nextPanel} is not available in ${snapshot.label}. Query workbench-panels for the mounted choices.`,
          state: { ...snapshot },
        };
      }
      if (nextPanel === snapshot.activePanel) {
        return {
          applied: true,
          message:
            nextPanel == null
              ? `${snapshot.label} is already closed.`
              : `Panel ${nextPanel} is already open.`,
          state: { ...snapshot },
        };
      }
      if (snapshot.blocked) {
        setNotice(
          "Finish or dismiss the action in the open tool before switching tools.",
        );
        return {
          applied: false,
          message:
            "Finish or dismiss the pending approval, copy feedback, or alert in the open tool before switching or closing it.",
          state: { ...snapshot },
        };
      }
      setNotice(null);
      stateRef.current = { ...stateRef.current, activePanel: nextPanel };
      setActivePanel(nextPanel);
      return {
        applied: true,
        message:
          nextPanel == null
            ? `Closed ${snapshot.label}.`
            : `Opened panel ${nextPanel}.`,
        state: { ...snapshot, activePanel: nextPanel },
      };
    },
    [getSnapshot],
  );

  useLayoutEffect(
    () => controller?.register(group, { getSnapshot, setPanel }),
    [controller, getSnapshot, group, setPanel],
  );

  useLayoutEffect(() => {
    controller?.notifyChanged();
  }, [activePanel, controller, label, panelIdentity]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (controller == null || container == null) return;
    let previous = JSON.stringify(getSnapshot());
    const observer = new MutationObserver(() => {
      const next = JSON.stringify(getSnapshot());
      if (previous === next) return;
      previous = next;
      controller.notifyChanged();
    });
    observer.observe(container, {
      attributeFilter: [
        "hidden",
        "inert",
        "role",
        "readonly",
        "open",
        "data-workbench-action-pending",
        "data-workbench-nonblocking",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [controller, getSnapshot]);

  return (
    <section
      aria-label={label}
      className={clsx("bio-workbench-tools", className)}
      data-panel-open={selectedPanel != null}
      data-active-panel={selectedPanel?.id}
      data-workbench-tool-group={group}
      ref={containerRef}
    >
      <div
        aria-label={`${label} navigation`}
        className="bio-workbench-tool-nav"
      >
        {panels.map(({ id, label: panelLabel }) => (
          <button
            aria-controls={`${instanceId}-${id}-panel`}
            aria-expanded={selectedPanel?.id === id}
            className="bio-workbench-tool-trigger"
            id={`${instanceId}-${id}-trigger`}
            key={id}
            onClick={() =>
              setPanel(stateRef.current.activePanel === id ? null : id)
            }
            type="button"
          >
            {panelLabel}
            <span aria-hidden="true" className="bio-workbench-tool-chevron">
              {selectedPanel?.id === id ? "−" : "+"}
            </span>
          </button>
        ))}
      </div>
      {notice == null ? null : (
        <p className="bio-workbench-tool-notice" role="status">
          {notice}
        </p>
      )}
      {panels.map(({ content, id }) => (
        <section
          aria-labelledby={`${instanceId}-${id}-trigger`}
          className="bio-workbench-tool-panel"
          hidden={selectedPanel?.id !== id}
          id={`${instanceId}-${id}-panel`}
          inert={selectedPanel?.id !== id ? true : undefined}
          key={id}
        >
          <WorkbenchPanelLocationContext.Provider value={{ group, panel: id }}>
            {content}
          </WorkbenchPanelLocationContext.Provider>
        </section>
      ))}
    </section>
  );
}

/** Hidden nested tools must not prevent closing an otherwise idle inspector. */
export function hasPendingWorkbenchAction(container: HTMLElement): boolean {
  const candidates = container.querySelectorAll<HTMLElement>(
    '[role="alert"], [role="alertdialog"], [role="dialog"][aria-modal="true"], dialog[open], textarea[readonly], [data-workbench-action-pending="true"]',
  );
  return Array.from(candidates).some((candidate) => {
    if (candidate.closest('[data-workbench-nonblocking="true"]') != null) {
      return false;
    }
    let current: HTMLElement | null = candidate;
    while (current != null) {
      if (current.hidden || current.hasAttribute("inert")) return false;
      if (
        current instanceof HTMLDetailsElement &&
        !current.open &&
        !current.querySelector(":scope > summary")?.contains(candidate)
      ) {
        return false;
      }
      if (current === container) return true;
      current = current.parentElement;
    }
    return false;
  });
}

/** Portal-mounted confirmations remain visible outside their originating panel. */
export function hasPendingWorkbenchDialog(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="alertdialog"], [role="dialog"][aria-modal="true"], dialog[open]',
    ),
  ).some(
    (dialog) =>
      dialog.closest(
        '[hidden], [inert], [data-workbench-nonblocking="true"]',
      ) == null,
  );
}

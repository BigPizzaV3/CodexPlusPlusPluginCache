import { useCallback, useContext, useLayoutEffect, useRef } from "react";

import type { SequenceViewerCommandResult } from "../viewer-commands";
import type { WorkbenchFeedbackSnapshot } from "./workbench-tool-controller";
import { WorkbenchToolControllerContext } from "./workbench-tools";

/** Register only harmless feedback dismissal, never approval or overwrite actions. */
export function useWorkbenchFeedback({
  id,
  kind,
  label,
  message,
  onDismiss,
  visible,
}: {
  id: `${"alignment" | "sequence"}.${string}`;
  kind: WorkbenchFeedbackSnapshot["kind"];
  label: string;
  message?: string;
  onDismiss: () => void;
  visible: boolean;
}): () => SequenceViewerCommandResult {
  const controller = useContext(WorkbenchToolControllerContext);
  const stateRef = useRef({ id, kind, label, message, onDismiss, visible });
  stateRef.current = { id, kind, label, message, onDismiss, visible };

  const getSnapshot = useCallback((): WorkbenchFeedbackSnapshot => {
    const current = stateRef.current;
    return {
      id: current.id,
      kind: current.kind,
      label: current.label,
      message: current.message?.slice(0, 1_000) ?? null,
      visible: current.visible,
    };
  }, []);
  const dismiss = useCallback((): SequenceViewerCommandResult => {
    const snapshot = getSnapshot();
    if (snapshot.visible) {
      stateRef.current.onDismiss();
      stateRef.current = {
        ...stateRef.current,
        message: undefined,
        visible: false,
      };
    }
    return {
      applied: true,
      message: snapshot.visible
        ? `Dismissed ${snapshot.label}.`
        : `${snapshot.label} is already dismissed.`,
      state: { feedback: { ...snapshot, message: null, visible: false } },
    };
  }, [getSnapshot]);

  useLayoutEffect(
    () => controller?.registerFeedback(id, { dismiss, getSnapshot }),
    [controller, dismiss, getSnapshot, id],
  );
  useLayoutEffect(() => {
    controller?.notifyChanged();
  }, [controller, kind, label, message, visible]);
  return dismiss;
}

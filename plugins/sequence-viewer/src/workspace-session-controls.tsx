import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  SequenceListWorkspaceSessionsResult,
  SequenceRestoreWorkspaceSessionResult,
} from "./workspace-session-protocol";
import { WorkspaceSaveAsButton } from "./workspace-publish-button";
import type { SequenceWorkspaceSessionClient } from "./views/workspace-sessions";

type WorkspaceSessionCandidate =
  SequenceListWorkspaceSessionsResult["candidates"][number];

export function WorkspaceSessionSaveButton({
  className,
  client,
  defaultName,
  prepare,
}: {
  className: string;
  client: SequenceWorkspaceSessionClient;
  defaultName: string;
  prepare: () => string;
}): React.ReactElement {
  return (
    <WorkspaceSaveAsButton
      browser={client}
      className={className}
      item={{ format: "json", name: defaultName }}
      label="Save project"
      onSave={async (relativePath, collisionPolicy, signal) => {
        const result = await client(
          { content: prepare(), name: defaultName },
          relativePath,
          collisionPolicy,
          signal,
        );
        if (
          result.kind !== "session" ||
          !("destination" in result) ||
          result.destination.kind !== "workspace"
        ) {
          throw new Error("The server did not confirm a workspace project.");
        }
        window.dispatchEvent(new Event("sequence-workspace-session-saved"));
        return result.outputWorkspacePath;
      }}
    />
  );
}

export function WorkspaceSessionDiscovery({
  client,
}: {
  client?: SequenceWorkspaceSessionClient;
}): React.ReactElement | null {
  const [result, setResult] =
    useState<SequenceListWorkspaceSessionsResult>();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [refreshRevision, setRefreshRevision] = useState(0);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setResult(undefined);
    setOpen(false);
    if (client == null) return;
    const controller = new AbortController();
    void client
      .discover(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch(() => {
        // Discovery is an optional installed-host capability. Keep the viewer
        // fully usable when an older host does not expose it.
      });
    return () => controller.abort();
  }, [client, refreshRevision]);

  useEffect(() => setNotice(undefined), [client]);

  useEffect(() => {
    const refresh = () => setRefreshRevision((revision) => revision + 1);
    window.addEventListener("sequence-workspace-session-saved", refresh);
    return () =>
      window.removeEventListener("sequence-workspace-session-saved", refresh);
  }, []);

  if (client == null || result == null || result.candidates.length === 0) {
    return null;
  }

  function close(): void {
    setOpen(false);
    window.setTimeout(() => reviewButtonRef.current?.focus(), 0);
  }

  return (
    <>
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-token-border bg-blue-500/5 px-3 py-2 text-xs"
        role="status"
      >
        <span>
          {notice ?? (
            <>
              {result.candidates.length} saved workspace project
              {result.candidates.length === 1 ? "" : "s"} found for this source.
            </>
          )}
        </span>
        <button
          className="rounded border border-token-border px-2 py-1 font-medium"
          onClick={() => setOpen(true)}
          ref={reviewButtonRef}
          type="button"
        >
          Review saved projects
        </button>
      </div>
      {open
        ? createPortal(
            <WorkspaceSessionRestoreDialog
              candidates={result.candidates}
              client={client}
              omittedCandidates={result.omittedCandidates}
              onClose={close}
              onRestored={(restored) => {
                const unavailable = restored.dependencies.filter(
                  ({ required, status }) => !required && status !== "matched",
                );
                setNotice(
                  unavailable.length === 0
                    ? `Restored ${restored.name}.`
                    : `Restored ${restored.name}; ${unavailable.length} optional dependency${unavailable.length === 1 ? " is" : "ies are"} unavailable.`,
                );
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function WorkspaceSessionRestoreDialog({
  candidates,
  client,
  omittedCandidates,
  onClose,
  onRestored,
}: {
  candidates: Array<WorkspaceSessionCandidate>;
  client: SequenceWorkspaceSessionClient;
  omittedCandidates: number;
  onClose: () => void;
  onRestored: (result: SequenceRestoreWorkspaceSessionResult) => void;
}): React.ReactElement {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreController = useRef<AbortController | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [restoring, setRestoring] = useState<string>();

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
      ?.focus();
    return () => restoreController.current?.abort();
  }, []);

  function cancelAndClose(): void {
    restoreController.current?.abort(
      new DOMException("Workspace restore was cancelled.", "AbortError"),
    );
    onClose();
  }

  async function restore(candidate: WorkspaceSessionCandidate): Promise<void> {
    if (!confirmed || restoring != null) return;
    const controller = new AbortController();
    restoreController.current = controller;
    setError(undefined);
    setRestoring(candidate.candidateId);
    try {
      const result = await client.restore(
        candidate.candidateId,
        controller.signal,
      );
      onRestored(result);
      onClose();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The workspace project could not be restored.",
        );
      }
    } finally {
      if (restoreController.current === controller) {
        restoreController.current = undefined;
      }
      setRestoring(undefined);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") cancelAndClose();
        if (event.key !== "Tab") return;
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable == null || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-2xl rounded-xl border border-token-border bg-token-main-surface-primary shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-token-border px-4 py-3">
          <h2 className="text-sm font-semibold" id={titleId}>
            Restore workspace project
          </h2>
          <button
            aria-label="Close workspace project dialog"
            className="rounded px-2 py-1 text-token-text-secondary"
            onClick={cancelAndClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-token-text-secondary">
            Saved projects are never applied automatically. The source and
            required dependencies are verified again when you restore.
          </p>
          <ul className="space-y-2" aria-label="Compatible saved projects">
            {candidates.map((candidate) => (
              <li
                className="rounded-lg border border-token-border p-3 text-xs"
                key={candidate.candidateId}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{candidate.name}</div>
                    <div className="mt-1 text-token-text-secondary">
                      {candidate.mode} · {candidate.workspacePath} ·{" "}
                      {new Date(candidate.createdAt).toLocaleString()}
                    </div>
                    {candidate.dependencies.length === 0 ? null : (
                      <ul className="mt-2 space-y-0.5" aria-label={`${candidate.name} dependencies`}>
                        {candidate.dependencies.map((dependency) => (
                          <li key={`${dependency.kind}:${dependency.workspacePath}`}>
                            {dependency.name}: {dependency.status}
                            {dependency.required ? " (required)" : " (optional)"}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1 text-token-text-secondary">
                      Source: {candidate.sourceStatus}
                      {candidate.dependencies.length === 0
                        ? " · No external dependencies"
                        : ` · ${candidate.dependencies.length} dependencies`}
                    </div>
                  </div>
                  <button
                    className="rounded bg-token-text-primary px-3 py-1.5 font-medium text-token-main-surface-primary disabled:opacity-50"
                    disabled={!confirmed || restoring != null}
                    onClick={() => void restore(candidate)}
                    type="button"
                  >
                    {restoring === candidate.candidateId ? "Restoring…" : "Restore"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {omittedCandidates === 0 ? null : (
            <p className="text-xs text-token-text-secondary">
              {omittedCandidates} incompatible or invalid project
              {omittedCandidates === 1 ? " was" : "s were"} omitted.
            </p>
          )}
          <label className="flex items-start gap-2 text-xs font-medium">
            <input
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            I want to replace the current workbench state with the selected
            saved project.
          </label>
          {error == null ? null : (
            <p aria-live="polite" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function workspaceSessionDefaultName(
  sourceName: string | undefined,
  fallback: string,
): string {
  const basename = (sourceName ?? fallback).split(/[\\/]/u).at(-1) ?? fallback;
  const withoutCompression = basename.replace(/\.gz$/iu, "");
  const dot = withoutCompression.lastIndexOf(".");
  const stem = dot > 0 ? withoutCompression.slice(0, dot) : withoutCompression;
  return `${stem || fallback}.sequence-viewer.session.json`;
}

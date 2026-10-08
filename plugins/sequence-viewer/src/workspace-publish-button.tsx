import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { isWorkspaceExportNameForFormat } from "./viewer-operations";
import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "./views/workbench-persistence";
import {
  isSafeWorkspaceBrowserChildName,
  type SequenceListWorkspaceDirectoryResult,
} from "./workspace-browser-protocol";

export function WorkspacePublishButton({
  artifact,
  className,
  label = "Publish to workspace",
  publisher,
}: {
  artifact: PreparedSequenceWorkspaceArtifact;
  className: string;
  label?: string;
  publisher: SequenceWorkspaceArtifactPublisher;
}): React.ReactElement {
  return (
    <WorkspaceSaveAsButton
      browser={publisher}
      className={className}
      item={artifact}
      label={label}
      successVerb="Published"
      onSave={async (relativePath, collisionPolicy, signal) => {
        const result = await publisher(
          artifact,
          relativePath,
          collisionPolicy,
          signal,
        );
        if (
          result.kind !== "artifact" ||
          !("destination" in result) ||
          result.destination.kind !== "workspace"
        ) {
          throw new Error("The server did not confirm a workspace publication.");
        }
        return result.outputWorkspacePath;
      }}
    />
  );
}

export type WorkspaceSaveAsItem = Pick<
  PreparedSequenceWorkspaceArtifact,
  "format" | "name"
>;

export type WorkspaceSaveAsBrowser = Pick<
  SequenceWorkspaceArtifactPublisher,
  "createDirectory" | "listDirectory"
>;

export function WorkspaceSaveAsButton({
  browser,
  className,
  item,
  label,
  onSave,
  successVerb = "Saved",
}: {
  browser: WorkspaceSaveAsBrowser;
  className: string;
  item: WorkspaceSaveAsItem;
  label: string;
  onSave: (
    relativePath: string,
    collisionPolicy: "exact" | "next-version",
    signal: AbortSignal,
  ) => Promise<string>;
  successVerb?: string;
}): React.ReactElement {
  const [message, setMessage] = useState<string>();
  const [open, setOpen] = useState(false);
  const publishButtonRef = useRef<HTMLButtonElement>(null);

  function closeDialog(): void {
    setOpen(false);
    window.setTimeout(() => publishButtonRef.current?.focus(), 0);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        className={className}
        onClick={() => {
          setMessage(undefined);
          setOpen(true);
        }}
        ref={publishButtonRef}
        type="button"
      >
        {label}
      </button>
      {message == null ? null : (
        <span
          aria-live="polite"
          className="max-w-64 text-[10px] text-token-text-secondary"
        >
          {message}
        </span>
      )}
      {open
        ? createPortal(
            <WorkspaceSaveAsDialog
              browser={browser}
              item={item}
              onClose={closeDialog}
              onPublished={(workspacePath) => {
                setMessage(`${successVerb} ${workspacePath}`);
                closeDialog();
              }}
              onSave={onSave}
            />,
            document.body,
          )
        : null}
    </span>
  );
}

function WorkspaceSaveAsDialog({
  browser,
  item,
  onClose,
  onPublished,
  onSave,
}: {
  browser: WorkspaceSaveAsBrowser;
  item: WorkspaceSaveAsItem;
  onClose: () => void;
  onPublished: (workspacePath: string) => void;
  onSave: (
    relativePath: string,
    collisionPolicy: "exact" | "next-version",
    signal: AbortSignal,
  ) => Promise<string>;
}): React.ReactElement {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const saveAbortController = useRef<AbortController | undefined>(undefined);
  const [collisionPolicy, setCollisionPolicy] = useState<
    "exact" | "next-version"
  >("exact");
  const [cursor, setCursor] = useState<string>();
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([]);
  const [directory, setDirectory] = useState(".");
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState(item.name);
  const [listing, setListing] =
    useState<SequenceListWorkspaceDirectoryResult>();
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileNameError = validateWorkspaceFileName(item, fileName);
  const newFolderNameError =
    newFolderName === "" || isSafeWorkspaceBrowserChildName(newFolderName)
      ? undefined
      : "Enter one safe folder name without path separators.";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timeout = window.setTimeout(() => {
      void browser
        .listDirectory({
          candidate:
            fileNameError == null
              ? { format: item.format, name: fileName }
              : undefined,
          cursor,
          directory,
          limit: 50,
          signal: controller.signal,
        })
        .then((result) => {
          if (controller.signal.aborted) return;
          setListing(result);
        })
        .catch((cause) => {
          if (isAbortError(cause)) return;
          setListing(undefined);
          setError(errorMessage(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 100);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    browser,
    cursor,
    directory,
    fileName,
    fileNameError,
    item.format,
    refreshRevision,
  ]);

  const candidate = listing?.candidate;
  const selectedWorkspacePath =
    collisionPolicy === "exact"
      ? candidate?.exactWorkspacePath
      : candidate?.nextVersionWorkspacePath;
  const canSave =
    fileNameError == null &&
    !loading &&
    !saving &&
    candidate != null &&
    (collisionPolicy === "exact"
      ? candidate.exactAvailable
      : candidate.nextVersionName != null);

  function navigate(relativePath: string): void {
    setDirectory(relativePath);
    setLoading(true);
    setCursor(undefined);
    setCursorStack([]);
    setError(undefined);
  }

  async function createFolder(): Promise<void> {
    if (newFolderName === "" || newFolderNameError != null) return;
    setSaving(true);
    setError(undefined);
    try {
      const created = await browser.createDirectory({
        name: newFolderName,
        parentDirectory: directory,
      });
      setNewFolderName("");
      navigate(created.relativePath);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function save(): Promise<void> {
    if (!canSave || listing == null) return;
    const relativePath = joinWorkspacePath(
      listing.directory.relativePath,
      fileName,
    );
    setSaving(true);
    setError(undefined);
    const controller = new AbortController();
    saveAbortController.current = controller;
    try {
      const workspacePath = await onSave(
        relativePath,
        collisionPolicy,
        controller.signal,
      );
      onPublished(workspacePath);
    } catch (cause) {
      setError(errorMessage(cause));
      setRefreshRevision((revision) => revision + 1);
    } finally {
      if (saveAbortController.current === controller) {
        saveAbortController.current = undefined;
      }
      setSaving(false);
    }
  }

  function cancelAndClose(): void {
    saveAbortController.current?.abort(
      new DOMException("Workspace publication was cancelled.", "AbortError"),
    );
    onClose();
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
        className="flex max-h-[640px] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-token-border bg-token-main-surface-primary shadow-xl"
        ref={dialogRef}
        role="dialog"
        style={{ maxHeight: "min(calc(100vh - 2rem), 640px)" }}
      >
        <div className="flex items-center justify-between border-b border-token-border px-4 py-3">
          <h2 className="text-sm font-semibold" id={titleId}>
            Save to workspace
          </h2>
          <button
            aria-label="Close Save As dialog"
            className="rounded px-2 py-1 text-token-text-secondary hover:bg-token-bg-tertiary"
            onClick={cancelAndClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          {listing == null ? null : (
            <nav aria-label="Workspace location" className="flex flex-wrap gap-1">
              {listing.directory.breadcrumbs.map((breadcrumb, index) => (
                <span className="inline-flex items-center gap-1" key={breadcrumb.workspacePath}>
                  {index === 0 ? null : <span aria-hidden="true">/</span>}
                  <button
                    className="rounded px-1.5 py-1 text-xs text-token-text-secondary hover:bg-token-bg-tertiary"
                    onClick={() => navigate(breadcrumb.relativePath)}
                    type="button"
                  >
                    {breadcrumb.label}
                  </button>
                </span>
              ))}
            </nav>
          )}

          <div className="min-h-40 rounded-lg border border-token-border">
            {loading ? (
              <p className="p-4 text-sm text-token-text-secondary">Loading workspace…</p>
            ) : listing == null ? (
              <p className="p-4 text-sm text-token-text-secondary">
                Workspace browsing is unavailable.
              </p>
            ) : listing.entries.length === 0 ? (
              <p className="p-4 text-sm text-token-text-secondary">
                This folder is empty.
              </p>
            ) : (
              <ul className="divide-y divide-token-border" aria-label="Workspace folder contents">
                {listing.entries.map((entry) => (
                  <li className="flex items-center justify-between gap-3 px-3 py-2" key={`${entry.kind}:${entry.name}`}>
                    {entry.kind === "directory" ? (
                      <button
                        className="min-w-0 truncate text-left text-sm font-medium hover:underline"
                        onClick={() => navigate(entry.relativePath)}
                        type="button"
                      >
                        {entry.name}/
                      </button>
                    ) : (
                      <span className="min-w-0 truncate text-sm">{entry.name}</span>
                    )}
                    {entry.size == null ? null : (
                      <span className="shrink-0 text-xs text-token-text-secondary">
                        {formatFileSize(entry.size)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              className="rounded border border-token-border px-2 py-1 text-xs disabled:opacity-50"
              disabled={cursorStack.length === 0 || loading}
              onClick={() => {
                setError(undefined);
                setLoading(true);
                const previous = cursorStack.at(-1);
                setCursor(previous);
                setCursorStack((stack) => stack.slice(0, -1));
              }}
              type="button"
            >
              Previous page
            </button>
            <button
              className="rounded border border-token-border px-2 py-1 text-xs disabled:opacity-50"
              disabled={listing?.nextCursor == null || loading}
              onClick={() => {
                setError(undefined);
                setLoading(true);
                setCursorStack((stack) => [...stack, cursor]);
                setCursor(listing?.nextCursor);
              }}
              type="button"
            >
              Next page
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-token-border p-3">
            <label className="min-w-48 flex-1 text-xs font-medium">
              New folder
              <input
                className="mt-1 w-full rounded border border-token-border bg-transparent px-2 py-1.5 text-sm"
                onChange={(event) => {
                  setError(undefined);
                  setNewFolderName(event.target.value);
                }}
                placeholder="One folder name"
                value={newFolderName}
              />
            </label>
            <button
              className="rounded border border-token-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              disabled={saving || newFolderName === "" || newFolderNameError != null}
              onClick={() => void createFolder()}
              type="button"
            >
              Create folder
            </button>
            {newFolderNameError == null ? null : (
              <p className="w-full text-xs text-red-600" role="alert">
                {newFolderNameError}
              </p>
            )}
          </div>

          <label className="text-xs font-medium">
            File name
            <input
              autoFocus
              className="mt-1 w-full rounded border border-token-border bg-transparent px-2 py-1.5 text-sm"
              onChange={(event) => {
                setError(undefined);
                setLoading(true);
                setFileName(event.target.value);
              }}
              value={fileName}
            />
          </label>
          {fileNameError == null ? null : (
            <p className="text-xs text-red-600" role="alert">
              {fileNameError}
            </p>
          )}

          <fieldset className="flex flex-wrap gap-4 text-xs">
            <legend className="mb-1 font-medium">If the name exists</legend>
            <label className="inline-flex items-center gap-1.5">
              <input
                checked={collisionPolicy === "exact"}
                name={`${titleId}-collision-policy`}
                onChange={() => {
                  setError(undefined);
                  setCollisionPolicy("exact");
                }}
                type="radio"
              />
              Report collision
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                checked={collisionPolicy === "next-version"}
                name={`${titleId}-collision-policy`}
                onChange={() => {
                  setError(undefined);
                  setCollisionPolicy("next-version");
                }}
                type="radio"
              />
              Save next version
            </label>
          </fieldset>

          {candidate == null ? null : (
            <div className="rounded-lg bg-token-bg-secondary p-3 text-xs">
              <div>
                Destination: <strong>{selectedWorkspacePath ?? "Unavailable"}</strong>
              </div>
              {collisionPolicy === "exact" && !candidate.exactAvailable ? (
                <div className="mt-1 text-amber-700" role="status">
                  The artifact or provenance sidecar already exists.
                </div>
              ) : null}
            </div>
          )}

          {listing?.omittedEntries ? (
            <p className="text-xs text-token-text-secondary">
              {listing.omittedEntries} unsupported or linked entries were omitted.
            </p>
          ) : null}
          {error == null ? null : (
            <p aria-live="polite" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-token-border px-4 py-3">
          <button
            className="rounded border border-token-border px-3 py-1.5 text-sm"
            onClick={cancelAndClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded bg-token-text-primary px-3 py-1.5 text-sm font-medium text-token-main-surface-primary disabled:opacity-50"
            disabled={!canSave}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function validateWorkspaceFileName(
  item: WorkspaceSaveAsItem,
  name: string,
): string | undefined {
  if (
    !isSafeWorkspaceBrowserChildName(name)
  ) {
    return "Enter one safe file name without path separators.";
  }
  if (!isWorkspaceExportNameForFormat(item.format, name)) {
    return `The file extension does not match ${item.format}.`;
  }
  if (new TextEncoder().encode(`${name}.provenance.json`).byteLength > 255) {
    return "The file name is too long for its provenance sidecar.";
  }
  return undefined;
}

function joinWorkspacePath(directory: string, name: string): string {
  return directory === "." ? name : `${directory.replace(/\/$/u, "")}/${name}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MiB`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The workspace export operation failed.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  SequenceListWorkspaceTrackDirectoryResult,
  SequenceResolveWorkspaceTrackBundleResult,
  SequenceWorkspaceTrackCandidate,
} from "../workspace-track-protocol";
import type { SequenceWorkspaceTrackBrowserClient } from "../views/workspace-tracks";

export function WorkspaceTrackBrowserButton({
  browser,
}: {
  browser?: SequenceWorkspaceTrackBrowserClient;
}): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  if (browser == null) return null;
  return (
    <>
      <button
        className={buttonClass}
        onClick={() => setOpen(true)}
        type="button"
      >
        Add from workspace
      </button>
      {open ? (
        <WorkspaceTrackBrowserDialog
          browser={browser}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function WorkspaceTrackBrowserDialog({
  browser,
  onClose,
}: {
  browser: SequenceWorkspaceTrackBrowserClient;
  onClose: () => void;
}): React.ReactElement {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const [listing, setListing] =
    useState<SequenceListWorkspaceTrackDirectoryResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [primary, setPrimary] = useState<SequenceWorkspaceTrackCandidate>();
  const [index, setIndex] = useState<SequenceWorkspaceTrackCandidate>();
  const [referenceFile, setReferenceFile] =
    useState<SequenceWorkspaceTrackCandidate>();
  const [resolution, setResolution] =
    useState<SequenceResolveWorkspaceTrackBundleResult>();
  const [reference, setReference] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loadedMessage, setLoadedMessage] = useState<string>();

  const run = useCallback(
    async <T,>(operation: (signal: AbortSignal) => Promise<T>) => {
      abortRef.current?.abort(
        new DOMException(
          "A newer workspace browser action started.",
          "AbortError",
        ),
      );
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(undefined);
      try {
        return await operation(controller.signal);
      } catch (caught) {
        if (controller.signal.aborted) return undefined;
        setError(
          caught instanceof Error
            ? caught.message
            : "The workspace track operation could not be completed.",
        );
        return undefined;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = undefined;
          setLoading(false);
        }
      }
    },
    [],
  );

  const listDirectory = useCallback(
    async (directoryCandidateId?: string, cursor?: string) => {
      const next = await run((signal) =>
        browser.listDirectory({
          cursor,
          directoryCandidateId,
          limit: 50,
          signal,
        }),
      );
      if (next == null) return;
      setListing((current) =>
        cursor == null || current == null
          ? next
          : {
              ...next,
              entries: [...current.entries, ...next.entries],
            },
      );
    },
    [browser, run],
  );

  const resolve = useCallback(
    async (
      selectedPrimary: SequenceWorkspaceTrackCandidate,
      selectedIndex?: SequenceWorkspaceTrackCandidate,
      selectedReference?: SequenceWorkspaceTrackCandidate,
    ) => {
      setConfirmed(false);
      setLoadedMessage(undefined);
      setResolution(undefined);
      const next = await run((signal) =>
        browser.resolveBundle({
          indexCandidateId: selectedIndex?.candidateId,
          primaryCandidateId: selectedPrimary.candidateId,
          referenceCandidateId: selectedReference?.candidateId,
          signal,
        }),
      );
      if (next == null) return;
      setResolution(next);
      for (const requirement of next.requirements) {
        if (requirement.role === "index") {
          setIndex(requirement.selectedCandidate);
        } else {
          setReferenceFile(requirement.selectedCandidate);
        }
      }
    },
    [browser, run],
  );

  useEffect(() => {
    setListing(undefined);
    setPrimary(undefined);
    setIndex(undefined);
    setReferenceFile(undefined);
    setResolution(undefined);
    setConfirmed(false);
    void listDirectory();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      abortRef.current?.abort(
        new DOMException("Workspace browser closed.", "AbortError"),
      );
      previouslyFocused?.focus();
    };
  }, [listDirectory]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog == null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [href], select:not([disabled])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const indexed = primary?.format === "bam" || primary?.format === "cram";
  const startNumber = Number(start);
  const endNumber = Number(end);
  const validWindow =
    !indexed ||
    (reference.trim().length > 0 &&
      Number.isInteger(startNumber) &&
      startNumber > 0 &&
      Number.isInteger(endNumber) &&
      endNumber >= startNumber &&
      endNumber - startNumber + 1 <= 100_000);
  const canLoad =
    confirmed &&
    resolution?.ready === true &&
    resolution.bundleId != null &&
    validWindow &&
    !loading;

  async function choose(
    candidate: SequenceWorkspaceTrackCandidate,
  ): Promise<void> {
    if (candidate.role === "index") {
      setIndex(candidate);
      if (primary != null) await resolve(primary, candidate, referenceFile);
      return;
    }
    if (candidate.role === "reference") {
      setReferenceFile(candidate);
      if (primary != null) await resolve(primary, index, candidate);
      return;
    }
    setPrimary(candidate);
    setIndex(undefined);
    setReferenceFile(undefined);
    await resolve(candidate);
  }

  async function load(): Promise<void> {
    if (!canLoad || resolution?.bundleId == null || primary == null) return;
    const result = await run((signal) =>
      browser.loadBundle({
        bundleId: resolution.bundleId!,
        end: indexed ? endNumber : undefined,
        reference: indexed ? reference.trim() : undefined,
        signal,
        start: indexed ? startNumber : undefined,
      }),
    );
    if (result == null) return;
    setLoadedMessage(
      `Loaded ${
        result.name
      } with ${result.itemCount.toLocaleString()} items; mapping ${
        result.mappingStatus
      }.`,
    );
    setConfirmed(false);
  }

  return createPortal(
    <div
      aria-label="Workspace track browser backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        aria-labelledby="workspace-track-browser-title"
        aria-modal="true"
        className="flex max-h-[min(760px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-token-border bg-token-main-surface-primary shadow-2xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-token-border px-4 py-3">
          <div>
            <h2
              className="text-sm font-semibold"
              id="workspace-track-browser-title"
            >
              Add related workspace evidence
            </h2>
            <p className="mt-1 text-xs text-token-text-secondary">
              Choose a track, review any index or reference companions, then
              confirm the bounded load.
            </p>
          </div>
          <button
            className={buttonClass}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-[1.2fr_1fr]">
          <section aria-label="Workspace files" className="min-w-0 space-y-3">
            <nav
              aria-label="Workspace breadcrumb"
              className="flex flex-wrap gap-1"
            >
              {listing?.breadcrumbs.map((breadcrumb) => (
                <button
                  className={buttonClass}
                  disabled={loading}
                  key={breadcrumb.candidateId}
                  onClick={() => void listDirectory(breadcrumb.candidateId)}
                  type="button"
                >
                  {breadcrumb.label}
                </button>
              ))}
            </nav>
            <div className="max-h-96 overflow-auto rounded-lg border border-token-border">
              {listing?.entries.map((entry) =>
                entry.kind === "directory" ? (
                  <button
                    className="flex w-full items-center gap-2 border-b border-token-border px-3 py-2 text-left text-xs hover:bg-token-main-surface-secondary"
                    disabled={loading}
                    key={entry.candidateId}
                    onClick={() => void listDirectory(entry.candidateId)}
                    type="button"
                  >
                    <span aria-hidden="true">▸</span>
                    <span className="truncate">{entry.label}</span>
                  </button>
                ) : (
                  <button
                    aria-pressed={
                      entry.candidateId === primary?.candidateId ||
                      entry.candidateId === index?.candidateId ||
                      entry.candidateId === referenceFile?.candidateId
                    }
                    className="flex w-full items-start justify-between gap-3 border-b border-token-border px-3 py-2 text-left text-xs hover:bg-token-main-surface-secondary aria-pressed:bg-emerald-500/10"
                    disabled={loading}
                    key={entry.candidateId}
                    onClick={() => void choose(entry)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {entry.label}
                      </span>
                      <span className="text-[10px] text-token-text-secondary">
                        {entry.workspacePath} · {entry.role}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-token-text-secondary">
                      {entry.format.toUpperCase()} · {formatBytes(entry.size)}
                    </span>
                  </button>
                ),
              )}
              {listing != null && listing.entries.length === 0 ? (
                <p className="p-3 text-xs text-token-text-secondary">
                  No supported track files or child directories are visible
                  here.
                </p>
              ) : null}
            </div>
            {listing?.nextCursor == null ? null : (
              <button
                className={buttonClass}
                disabled={loading}
                onClick={() =>
                  void listDirectory(
                    listing.directory.candidateId,
                    listing.nextCursor,
                  )
                }
                type="button"
              >
                Load more
              </button>
            )}
            {listing?.omittedEntries ? (
              <p className="text-[10px] text-token-text-secondary">
                {listing.omittedEntries.toLocaleString()} unsupported or unsafe
                entries omitted.
              </p>
            ) : null}
          </section>
          <section aria-label="Track bundle review" className="space-y-3">
            <h3 className="text-xs font-semibold">Bundle review</h3>
            {primary == null ? (
              <p className="text-xs text-token-text-secondary">
                Select a GFF/GTF/BED, VCF, SAM, BAM, or CRAM file.
              </p>
            ) : (
              <div className="space-y-2 rounded-lg border border-token-border p-3 text-xs">
                <div>
                  <strong>Track:</strong> {primary.workspacePath}
                </div>
                {resolution?.requirements.map((requirement) => (
                  <div
                    className="space-y-1 border-t border-token-border pt-2"
                    key={requirement.role}
                  >
                    <div className="font-medium capitalize">
                      {requirement.role}: {requirement.status}
                    </div>
                    <p className="text-[10px] text-token-text-secondary">
                      {requirement.message}
                    </p>
                    {requirement.candidates.map((candidate) => (
                      <button
                        className={buttonClass}
                        key={candidate.candidateId}
                        onClick={() => void choose(candidate)}
                        type="button"
                      >
                        Use {candidate.workspacePath}
                      </button>
                    ))}
                  </div>
                ))}
                {indexed ? (
                  <fieldset className="grid gap-2 border-t border-token-border pt-2">
                    <legend className="text-xs font-medium">
                      Bounded read window
                    </legend>
                    <label className="text-[10px] text-token-text-secondary">
                      Contig
                      <input
                        className={inputClass}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder="chr1"
                        value={reference}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-token-text-secondary">
                        Start
                        <input
                          className={inputClass}
                          min="1"
                          onChange={(event) => setStart(event.target.value)}
                          type="number"
                          value={start}
                        />
                      </label>
                      <label className="text-[10px] text-token-text-secondary">
                        End
                        <input
                          className={inputClass}
                          min="1"
                          onChange={(event) => setEnd(event.target.value)}
                          type="number"
                          value={end}
                        />
                      </label>
                    </div>
                    {!validWindow ? (
                      <p className="text-[10px] text-amber-600">
                        Enter one contig and a 1–100,000 bp inclusive window.
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}
                <label className="flex items-start gap-2 border-t border-token-border pt-2">
                  <input
                    checked={confirmed}
                    disabled={resolution?.ready !== true}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    I confirm this track and its selected companions should be
                    added to the current viewer session.
                  </span>
                </label>
                <button
                  className={buttonClass}
                  disabled={!canLoad}
                  onClick={() => void load()}
                  type="button"
                >
                  {loading ? "Working…" : "Load confirmed track"}
                </button>
              </div>
            )}
            {error == null ? null : (
              <p className="text-xs text-red-500" role="alert">
                {error}
              </p>
            )}
            {loadedMessage == null ? null : (
              <p className="text-xs text-emerald-600" role="status">
                {loadedMessage}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MiB`;
}

const buttonClass =
  "inline-flex items-center rounded-md border border-token-border bg-token-main-surface-primary px-2.5 py-1.5 text-xs font-medium text-token-text-primary hover:bg-token-main-surface-secondary disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "mt-1 block w-full rounded-md border border-token-border bg-token-main-surface-primary px-2 py-1.5 text-xs text-token-text-primary";

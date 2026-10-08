import { randomUUID } from "node:crypto";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SequenceWorkspaceSessionClient } from "./views/workspace-sessions";
import {
  WorkspaceSessionDiscovery,
  WorkspaceSessionSaveButton,
  workspaceSessionDefaultName,
} from "./workspace-session-controls";

describe("workspace session controls", () => {
  it("uses the collision-safe Save As browser and prepares state only on save", async () => {
    const client = createClient();
    const prepare = vi.fn(() => '{"schemaVersion":1}');
    render(
      <WorkspaceSessionSaveButton
        className="action"
        client={client}
        defaultName="source.sequence-viewer.session.json"
        prepare={prepare}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(
      await screen.findByRole("dialog", { name: "Save to workspace" }),
    ).toBeVisible();
    expect(prepare).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "Save next version" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(client).toHaveBeenCalledOnce());
    expect(prepare).toHaveBeenCalledOnce();
    expect(client).toHaveBeenCalledWith(
      {
        content: '{"schemaVersion":1}',
        name: "source.sequence-viewer.session.json",
      },
      "source.sequence-viewer.session.json",
      "next-version",
      expect.any(AbortSignal),
    );
    expect(
      await screen.findByText(
        "Saved data/source.sequence-viewer.session-2.json",
      ),
    ).toBeVisible();
  });

  it("discovers quietly and requires explicit confirmation before restore", async () => {
    const client = createClient({ withCandidate: true });
    render(<WorkspaceSessionDiscovery client={client} />);

    expect(
      await screen.findByText("1 saved workspace project found for this source."),
    ).toBeVisible();
    expect(client.restore).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Review saved projects" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Restore workspace project" }),
    ).toBeVisible();
    const restore = screen.getByRole("button", { name: "Restore" });
    expect(restore).toBeDisabled();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /replace the current workbench state/u,
      }),
    );
    await userEvent.click(restore);

    await waitFor(() => expect(client.restore).toHaveBeenCalledOnce());
    expect(client.restore).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(AbortSignal),
    );
  });

  it("keeps older installed hosts usable when discovery is unavailable", async () => {
    const client = createClient();
    client.discover.mockRejectedValue(new Error("Method not found"));
    render(<WorkspaceSessionDiscovery client={client} />);

    await waitFor(() => expect(client.discover).toHaveBeenCalledOnce());
    expect(screen.queryByText(/saved workspace project/u)).not.toBeInTheDocument();
  });

  it("derives safe stable defaults from plain, compressed, and path-like names", () => {
    expect(workspaceSessionDefaultName("reads.fastq.gz", "sequence")).toBe(
      "reads.sequence-viewer.session.json",
    );
    expect(workspaceSessionDefaultName("data/family.aln-fasta", "alignment")).toBe(
      "family.sequence-viewer.session.json",
    );
    expect(workspaceSessionDefaultName(undefined, "sequence")).toBe(
      "sequence.sequence-viewer.session.json",
    );
  });
});

function createClient({ withCandidate = false } = {}) {
  const candidateId = randomUUID();
  const save = vi.fn(async () => ({
    destination: { base: "opened-source" as const, kind: "workspace" as const },
    kind: "session" as const,
    name: "source.sequence-viewer.session-2.json",
    outputWorkspacePath: "data/source.sequence-viewer.session-2.json",
    payloadSha256: "a".repeat(64),
    payloadSize: 19,
    provenanceWorkspacePath:
      "data/source.sequence-viewer.session-2.json.provenance.json",
    sha256: "b".repeat(64),
    size: 1_024,
    version: 1 as const,
  }));
  return Object.assign(save, {
    createDirectory: vi.fn(),
    discover: vi.fn(async () => ({
      candidates: withCandidate
        ? [
            {
              candidateId,
              createdAt: "2026-06-29T12:00:00.000Z",
              dependencies: [],
              mode: "sequence" as const,
              name: "source.sequence-viewer.session.json",
              sourceStatus: "verification-required" as const,
              workspacePath: "data/source.sequence-viewer.session.json",
            },
          ]
        : [],
      omittedCandidates: 0,
    })),
    listDirectory: vi.fn(async () => ({
      candidate: {
        exactAvailable: true,
        exactWorkspacePath: "data/source.sequence-viewer.session.json",
        name: "source.sequence-viewer.session.json",
        nextVersionName: "source.sequence-viewer.session-2.json",
        nextVersionWorkspacePath:
          "data/source.sequence-viewer.session-2.json",
      },
      directory: {
        breadcrumbs: [
          { label: "Workspace", relativePath: "..", workspacePath: "." },
          { label: "data", relativePath: ".", workspacePath: "data" },
        ],
        parentRelativePath: "..",
        relativePath: ".",
        sourceDirectoryWorkspacePath: "data",
        workspacePath: "data",
      },
      entries: [],
      omittedEntries: 0,
    })),
    restore: vi.fn(async () => ({
      dependencies: [],
      mode: "sequence" as const,
      name: "source.sequence-viewer.session.json",
      restored: true as const,
      workspacePath: "data/source.sequence-viewer.session.json",
    })),
  }) as unknown as SequenceWorkspaceSessionClient & {
    discover: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
}

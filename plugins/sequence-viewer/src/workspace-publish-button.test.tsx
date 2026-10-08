import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "./views/workbench-persistence";
import { WorkspacePublishButton } from "./workspace-publish-button";

const artifact: PreparedSequenceWorkspaceArtifact = {
  content: ">x\nAC\n",
  format: "fasta",
  mediaType: "text/x-fasta",
  name: "suggested.fasta",
  provenance: {
    engine: "sequence-viewer-browser-export-v1",
    parameters: { kind: "record" },
    sourceRevision: 0,
  },
};

afterEach(() => vi.restoreAllMocks());

describe("WorkspacePublishButton", () => {
  it("browses from the opened source directory and publishes an exact path", async () => {
    const publisher = createPublisher();
    renderButton(publisher);

    await userEvent.click(
      screen.getByRole("button", { name: "Publish to workspace" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Save to workspace" }),
    ).toBeVisible();
    expect(await screen.findByRole("button", { name: "results/" })).toBeVisible();
    expect(screen.queryByText(/\/tmp|\/home/u)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "results/" }));
    await waitFor(() =>
      expect(publisher.listDirectory).toHaveBeenLastCalledWith(
        expect.objectContaining({ directory: "../results" }),
      ),
    );
    const name = screen.getByRole("textbox", { name: "File name" });
    await userEvent.clear(name);
    await userEvent.type(name, "derived.fasta");
    expect(await screen.findByText("Destination:")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText("results/derived.fasta")).toBeVisible(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher).toHaveBeenCalledWith(
      expect.objectContaining({ content: ">x\nAC\n", format: "fasta" }),
      "../results/derived.fasta",
      "exact",
      expect.any(AbortSignal),
    );
    expect(await screen.findByText("Published results/derived.fasta")).toBeVisible();
  });

  it("disables exact collisions and requests the server-selected next version", async () => {
    const publisher = createPublisher({ exactAvailable: false });
    renderButton(publisher);

    await userEvent.click(
      screen.getByRole("button", { name: "Publish to workspace" }),
    );
    expect(
      await screen.findByText(
        "The artifact or provenance sidecar already exists.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.click(
      screen.getByRole("radio", { name: "Save next version" }),
    );
    expect(screen.getByText("data/suggested-2.fasta")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher).toHaveBeenCalledWith(
      artifact,
      "suggested.fasta",
      "next-version",
      expect.any(AbortSignal),
    );
  });

  it("creates one child folder and navigates into it", async () => {
    const publisher = createPublisher();
    renderButton(publisher);
    await userEvent.click(
      screen.getByRole("button", { name: "Publish to workspace" }),
    );
    await screen.findByRole("dialog", { name: "Save to workspace" });

    await userEvent.type(
      screen.getByRole("textbox", { name: "New folder" }),
      "analysis",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create folder" }));

    await waitFor(() =>
      expect(publisher.createDirectory).toHaveBeenCalledWith({
        name: "analysis",
        parentDirectory: ".",
      }),
    );
    await waitFor(() =>
      expect(publisher.listDirectory).toHaveBeenLastCalledWith(
        expect.objectContaining({ directory: "analysis" }),
      ),
    );
  });

  it("surfaces capability-unavailable failures without attempting publication", async () => {
    const publisher = createPublisher();
    publisher.listDirectory.mockRejectedValue(
      new Error("Workspace publication is unavailable for this viewer."),
    );
    renderButton(publisher);

    await userEvent.click(
      screen.getByRole("button", { name: "Publish to workspace" }),
    );
    expect(
      await screen.findByText(
        "Workspace publication is unavailable for this viewer.",
      ),
    ).toBeVisible();
    expect(publisher).not.toHaveBeenCalled();
  });

  it("closes with Escape and restores focus to the publish action", async () => {
    const publisher = createPublisher();
    renderButton(publisher);
    const publish = screen.getByRole("button", {
      name: "Publish to workspace",
    });
    await userEvent.click(publish);
    await screen.findByRole("dialog", { name: "Save to workspace" });

    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Save to workspace" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(publish).toHaveFocus());
  });

  it("cancels an in-flight publication when the dialog closes", async () => {
    const publisher = createPublisher();
    let observedSignal: AbortSignal | undefined;
    publisher.mockImplementation(
      async (_artifact, _relativePath, _collisionPolicy, signal) => {
        observedSignal = signal;
        await new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
        throw new Error("unreachable");
      },
    );
    renderButton(publisher);
    await userEvent.click(
      screen.getByRole("button", { name: "Publish to workspace" }),
    );
    const save = await screen.findByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(observedSignal).toBeDefined());

    await userEvent.click(
      screen.getByRole("button", { name: "Close Save As dialog" }),
    );

    expect(observedSignal?.aborted).toBe(true);
    expect(
      screen.queryByRole("dialog", { name: "Save to workspace" }),
    ).not.toBeInTheDocument();
  });
});

function renderButton(publisher: SequenceWorkspaceArtifactPublisher): void {
  render(
    <WorkspacePublishButton
      artifact={artifact}
      className="action"
      publisher={publisher}
    />,
  );
}

function createPublisher({ exactAvailable = true } = {}) {
  const publish = vi.fn(async (
    _artifact: PreparedSequenceWorkspaceArtifact,
    _relativePath: string,
    _collisionPolicy?: "exact" | "next-version",
    _signal?: AbortSignal,
  ) => ({
    destination: { base: "opened-source" as const, kind: "workspace" as const },
    format: "fasta" as const,
    kind: "artifact" as const,
    mediaType: "text/x-fasta",
    name: exactAvailable ? "derived.fasta" : "suggested-2.fasta",
    outputWorkspacePath: exactAvailable
      ? "results/derived.fasta"
      : "data/suggested-2.fasta",
    provenanceWorkspacePath: exactAvailable
      ? "results/derived.fasta.provenance.json"
      : "data/suggested-2.fasta.provenance.json",
    sha256: "a".repeat(64),
    size: 8,
    version: 1 as const,
  }));
  const listDirectory = vi.fn(
    async ({ candidate, directory = "." }: Parameters<SequenceWorkspaceArtifactPublisher["listDirectory"]>[0]) => {
      const inResults = directory === "../results";
      const name = candidate?.name ?? artifact.name;
      return {
        candidate: {
          exactAvailable,
          exactWorkspacePath: inResults ? `results/${name}` : `data/${name}`,
          name,
          nextVersionName: exactAvailable ? name : "suggested-2.fasta",
          nextVersionWorkspacePath: exactAvailable
            ? inResults
              ? `results/${name}`
              : `data/${name}`
            : "data/suggested-2.fasta",
        },
        directory: {
          breadcrumbs: inResults
            ? [
                { label: "Workspace", relativePath: "..", workspacePath: "." },
                {
                  label: "results",
                  relativePath: "../results",
                  workspacePath: "results",
                },
              ]
            : [
                { label: "Workspace", relativePath: "..", workspacePath: "." },
                { label: "data", relativePath: ".", workspacePath: "data" },
              ],
          parentRelativePath: "..",
          relativePath: directory,
          sourceDirectoryWorkspacePath: "data",
          workspacePath: inResults ? "results" : "data",
        },
        entries: inResults
          ? []
          : [
              {
                kind: "directory" as const,
                name: "results",
                relativePath: "../results",
              },
            ],
        omittedEntries: 0,
      };
    },
  );
  const createDirectory = vi.fn(async ({ name }: { name: string }) => ({
    name,
    relativePath: name,
    workspacePath: `data/${name}`,
  }));
  return Object.assign(publish, {
    createDirectory,
    listDirectory,
  }) as typeof publish & SequenceWorkspaceArtifactPublisher & {
    createDirectory: typeof createDirectory;
    listDirectory: typeof listDirectory;
  };
}

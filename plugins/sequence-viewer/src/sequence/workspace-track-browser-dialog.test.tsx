import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SequenceWorkspaceTrackBrowserClient } from "../views/workspace-tracks";
import { WorkspaceTrackBrowserButton } from "./workspace-track-browser-dialog";

afterEach(() => vi.restoreAllMocks());

describe("WorkspaceTrackBrowserButton", () => {
  it("requires bundle review and confirmation before loading a workspace track", async () => {
    const browser = createBrowser();
    render(<WorkspaceTrackBrowserButton browser={browser} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add from workspace" }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: "Add related workspace evidence",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/\/tmp|\/home/u)).not.toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", { name: /genes\.gff3/u }),
    );
    await waitFor(() => expect(browser.resolveBundle).toHaveBeenCalledOnce());
    const loadButton = screen.getByRole("button", {
      name: "Load confirmed track",
    });
    expect(loadButton).toBeDisabled();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /I confirm this track and its selected companions/u,
      }),
    );
    expect(loadButton).toBeEnabled();
    await userEvent.click(loadButton);

    await waitFor(() => expect(browser.loadBundle).toHaveBeenCalledOnce());
    expect(browser.loadBundle).toHaveBeenCalledWith({
      bundleId: expect.any(String),
      end: undefined,
      reference: undefined,
      signal: expect.any(AbortSignal),
      start: undefined,
    });
    expect(
      await screen.findByText(/Loaded genes\.gff3 with 1 items/u),
    ).toBeVisible();
  });

  it("aborts an in-flight listing when the dialog closes", async () => {
    let observedSignal: AbortSignal | undefined;
    const browser = createBrowser();
    browser.listDirectory = vi.fn(async ({ signal }) => {
      observedSignal = signal;
      await new Promise<void>(() => undefined);
      throw new Error("unreachable");
    });
    render(<WorkspaceTrackBrowserButton browser={browser} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add from workspace" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(observedSignal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("surfaces missing trusted workspace capability without host paths", async () => {
    const browser = createBrowser();
    browser.listDirectory = vi.fn(async () => {
      throw new Error(
        "Workspace access is unavailable without trusted file metadata.",
      );
    });
    render(<WorkspaceTrackBrowserButton browser={browser} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Add from workspace" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "trusted file metadata",
    );
    expect(screen.queryByText(/\/tmp|\/home/u)).not.toBeInTheDocument();
  });
});

function createBrowser(): SequenceWorkspaceTrackBrowserClient {
  const candidate = {
    candidateId: crypto.randomUUID(),
    format: "gff3" as const,
    kind: "file" as const,
    label: "genes.gff3",
    role: "annotation" as const,
    size: 73,
    workspacePath: "data/genes.gff3",
  };
  return {
    listDirectory: vi.fn(async () => ({
      breadcrumbs: [
        {
          candidateId: crypto.randomUUID(),
          label: "Workspace" as const,
          workspacePath: ".",
        },
        {
          candidateId: crypto.randomUUID(),
          label: "data",
          workspacePath: "data",
        },
      ],
      directory: {
        candidateId: crypto.randomUUID(),
        label: "data",
        workspacePath: "data",
      },
      entries: [candidate],
      omittedEntries: 0,
    })),
    loadBundle: vi.fn(async () => ({
      format: "gff3" as const,
      itemCount: 1,
      kind: "annotations" as const,
      loaded: true as const,
      mappingStatus: "matched" as const,
      name: "genes.gff3",
      sha256: "a".repeat(64),
      sourceTruncated: false,
      sourceWorkspacePath: "data/genes.gff3",
    })),
    resolveBundle: vi.fn(async () => ({
      bundleId: crypto.randomUUID(),
      primary: candidate,
      ready: true,
      requirements: [],
    })),
  };
}

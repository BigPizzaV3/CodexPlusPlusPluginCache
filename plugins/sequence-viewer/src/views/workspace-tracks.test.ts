import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
  SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
} from "../workspace-track-protocol";
import { createSequenceWorkspaceTrackBrowserClient } from "./workspace-tracks";

describe("workspace track browser client", () => {
  it("retries read-only listings with opaque bounded requests", async () => {
    const sessionId = randomUUID();
    const directoryCandidateId = randomUUID();
    const callServerTool = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport disconnected"))
      .mockResolvedValue({
        structuredContent: {
          breadcrumbs: [
            {
              candidateId: directoryCandidateId,
              label: "Workspace",
              workspacePath: ".",
            },
          ],
          directory: {
            candidateId: directoryCandidateId,
            label: "Workspace",
            workspacePath: ".",
          },
          entries: [],
          omittedEntries: 0,
        },
      });
    const browser = createSequenceWorkspaceTrackBrowserClient(
      { callServerTool } as never,
      sessionId,
    );
    await expect(
      browser.listDirectory({ directoryCandidateId, limit: 10 }),
    ).resolves.toMatchObject({ entries: [] });
    expect(callServerTool).toHaveBeenCalledTimes(2);
    expect(callServerTool).toHaveBeenLastCalledWith({
      arguments: { directoryCandidateId, limit: 10, sessionId },
      name: SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
    });
  });

  it("never replays a mutating load after an uncertain failure", async () => {
    const callServerTool = vi.fn(async () => {
      throw new Error("network timeout");
    });
    const browser = createSequenceWorkspaceTrackBrowserClient(
      { callServerTool } as never,
      randomUUID(),
    );
    await expect(
      browser.loadBundle({ bundleId: randomUUID() }),
    ).rejects.toThrow("network timeout");
    expect(callServerTool).toHaveBeenCalledOnce();
    expect(callServerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
      }),
    );
  });
});

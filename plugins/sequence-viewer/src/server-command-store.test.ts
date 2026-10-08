import { afterEach, describe, expect, it, vi } from "vitest";

import { SequenceViewerCommandStore } from "./server-command-store";

afterEach(() => {
  vi.useRealTimers();
});

describe("SequenceViewerCommandStore", () => {
  it("restores the authenticated original session without minting a replacement", () => {
    const original = new SequenceViewerCommandStore();
    const { sessionId } = original.registerSession();
    const restarted = new SequenceViewerCommandStore({ maxSessions: 1 });

    expect(restarted.restoreSession(sessionId)).toEqual({
      created: true,
      revision: 0,
      schemaVersion: 1,
      sessionId,
    });
    expect(restarted.restoreSession(sessionId)).toEqual({
      created: false,
      revision: 0,
      schemaVersion: 1,
      sessionId,
    });
    expect(() => restarted.registerSession()).toThrow("[viewer_busy]");
  });

  it("rejects malformed and over-capacity restored session identities", () => {
    const store = new SequenceViewerCommandStore({ maxSessions: 1 });
    store.registerSession();

    expect(() => store.restoreSession("not-a-uuid")).toThrow(
      "session identity is invalid",
    );
    expect(() =>
      store.restoreSession("11111111-1111-4111-8111-111111111111"),
    ).toThrow("[viewer_busy]");
  });

  it("resumes command delivery above its authenticated checkpoint revision", async () => {
    const original = new SequenceViewerCommandStore();
    const { sessionId } = original.registerSession();
    const restarted = new SequenceViewerCommandStore();

    expect(restarted.restoreSession(sessionId, 7)).toMatchObject({
      created: true,
      revision: 7,
      sessionId,
    });
    expect(restarted.restoreSession(sessionId, 3)).toMatchObject({
      created: false,
      revision: 7,
    });

    const completion = restarted.enqueue(sessionId, {
      action: "clear_sequence_selection",
    });
    const command = await restarted.waitForCommand(sessionId, 7, 1_000);
    expect(command).toMatchObject({ revision: 8 });
    restarted.complete(sessionId, command?.commandId ?? "", {
      applied: true,
      message: "cleared",
    });
    await expect(completion).resolves.toMatchObject({ applied: true });
    expect(() => restarted.restoreSession(sessionId, Number.MAX_VALUE)).toThrow(
      "session revision is invalid",
    );
  });

  it("replays duplicate acknowledgements without rejecting the model call", async () => {
    const store = new SequenceViewerCommandStore();
    const { sessionId } = store.registerSession();
    const resultPromise = store.enqueue(sessionId, {
      action: "clear_sequence_selection",
    });
    const command = await store.waitForCommand(sessionId, 0, 1_000);
    const result = { applied: true, message: "cleared" };

    expect(store.complete(sessionId, command?.commandId ?? "", result)).toBe(
      "completed",
    );
    expect(store.complete(sessionId, command?.commandId ?? "", result)).toBe(
      "duplicate",
    );
    await expect(resultPromise).resolves.toEqual(result);
  });

  it("classifies an acknowledgement after the command deadline as late", async () => {
    vi.useFakeTimers();
    const store = new SequenceViewerCommandStore();
    const { sessionId } = store.registerSession();
    const resultPromise = store.enqueue(
      sessionId,
      { action: "clear_sequence_selection" },
      1_000,
    );
    const command = await store.waitForCommand(sessionId, 0, 1_000);
    const rejection = expect(resultPromise).rejects.toThrow(
      "did not acknowledge",
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await rejection;

    expect(
      store.complete(sessionId, command?.commandId ?? "", {
        applied: true,
        message: "late",
      }),
    ).toBe("late");
  });

  it("does not redeliver completed commands to later revisions", async () => {
    vi.useFakeTimers();
    const store = new SequenceViewerCommandStore();
    const { sessionId } = store.registerSession();
    const resultPromise = store.enqueue(sessionId, {
      action: "clear_sequence_selection",
    });
    const command = await store.waitForCommand(sessionId, 0, 1_000);
    store.complete(sessionId, command?.commandId ?? "", {
      applied: true,
      message: "done",
    });
    await resultPromise;

    const wait = store.waitForCommand(sessionId, command?.revision ?? 0, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(wait).resolves.toBeNull();
  });

  it("bounds pending commands, waiters, and active sessions", async () => {
    vi.useFakeTimers();
    const store = new SequenceViewerCommandStore({
      maxPendingGlobal: 1,
      maxPendingPerSession: 1,
      maxSessions: 1,
      maxWaitersGlobal: 1,
      maxWaitersPerSession: 1,
    });
    const { sessionId } = store.registerSession();
    expect(() => store.registerSession()).toThrow("[viewer_busy]");
    const first = store.enqueue(
      sessionId,
      { action: "clear_sequence_selection" },
      10_000,
    );
    await expect(
      store.enqueue(sessionId, { action: "clear_alignment_selection" }),
    ).rejects.toThrow("[viewer_queue_full]");
    const waiter = store.waitForCommand(sessionId, 1, 10_000);
    await expect(store.waitForCommand(sessionId, 1, 10_000)).rejects.toThrow(
      "[viewer_queue_full]",
    );
    const command = await store.waitForCommand(sessionId, 0, 1_000);
    store.complete(sessionId, command?.commandId ?? "", {
      applied: true,
      message: "done",
    });
    await first;
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(waiter).resolves.toBeNull();
  });

  it("closes failed mount sessions, settles waiters, and releases quota", async () => {
    vi.useFakeTimers();
    const store = new SequenceViewerCommandStore({ maxSessions: 1 });
    const { sessionId } = store.registerSession();
    const pending = store.enqueue(
      sessionId,
      { action: "clear_sequence_selection" },
      10_000,
    );
    const pendingRejection = expect(pending).rejects.toThrow(
      "failed before mounting",
    );
    const waiter = store.waitForCommand(sessionId, 1, 10_000);

    store.closeSession(sessionId, "The viewer failed before mounting.");

    await pendingRejection;
    await expect(waiter).resolves.toBeNull();
    expect(() => store.assertSessionActive(sessionId)).toThrow(
      "no longer active",
    );
    expect(() => store.registerSession()).not.toThrow();
  });

  it("rejects artifact bodies in generic command completion", async () => {
    const store = new SequenceViewerCommandStore();
    const { sessionId } = store.registerSession();
    const resultPromise = store.enqueue(sessionId, {
      action: "export_artifact",
      destination: { kind: "private" },
      format: "fasta",
      scope: "all",
    });
    const command = await store.waitForCommand(sessionId, 0, 1_000);
    expect(() =>
      store.complete(sessionId, command?.commandId ?? "", {
        applied: true,
        message: "prepared",
        state: {
          artifact: {
            content: ">demo\nACGT\n",
            format: "fasta",
            mediaType: "text/x-fasta",
            name: "demo.fasta",
          },
          provenance: {
            engine: "test",
            parameters: {},
            sourceRevision: 0,
          },
        },
      }),
    ).toThrow();
    const metadata = {
      createdAt: 1,
      format: "fasta",
      id: "11111111-1111-4111-8111-111111111111",
      mediaType: "text/x-fasta",
      name: "demo.fasta",
      resourceUri:
        "viewer-artifact://sequence-viewer/generated/11111111-1111-4111-8111-111111111111",
      sha256: "0".repeat(64),
      size: 11,
      version: 1,
    };
    store.complete(sessionId, command?.commandId ?? "", {
      applied: true,
      message: "persisted",
      state: {
        artifact: metadata,
        provenance: {
          engine: "test",
          parameters: {},
          sourceRevision: 0,
        },
      },
    });
    await expect(resultPromise).resolves.toMatchObject({
      state: { artifact: metadata },
    });
  });

  it("rejects serialized sessions in generic command completion", async () => {
    const store = new SequenceViewerCommandStore();
    const { sessionId } = store.registerSession();
    const resultPromise = store.enqueue(sessionId, {
      action: "save_session",
      name: "demo.session.json",
    });
    const command = await store.waitForCommand(sessionId, 0, 1_000);
    expect(() =>
      store.complete(sessionId, command?.commandId ?? "", {
        applied: true,
        message: "serialized",
        state: { session: '{"schemaVersion":1}' },
      }),
    ).toThrow();
    store.complete(sessionId, command?.commandId ?? "", {
      applied: true,
      message: "saved",
      state: {
        session: {
          name: "demo.session.json",
          savedSessionId: "11111111-1111-4111-8111-111111111111",
          sha256: "0".repeat(64),
          size: 123,
        },
      },
    });
    await expect(resultPromise).resolves.toMatchObject({
      state: { session: { savedSessionId: expect.any(String) } },
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  sequenceViewerChatToolInputSchema,
  sequenceViewerSessionSchema,
  sequenceViewerToolResultSessionSchema,
  sequenceViewerWaitResultSchema,
} from "./protocol";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("sequence viewer protocol", () => {
  it("accepts legacy unversioned session envelopes with the current version", () => {
    expect(
      sequenceViewerSessionSchema.parse({ revision: 2, sessionId: SESSION_ID }),
    ).toEqual({ revision: 2, schemaVersion: 1, sessionId: SESSION_ID });
    expect(
      sequenceViewerToolResultSessionSchema.parse({
        viewerCommandRevision: 3,
        viewerSessionId: SESSION_ID,
      }),
    ).toMatchObject({ schemaVersion: 1, viewerCommandRevision: 3 });
  });

  it("rejects unsupported versions and unknown app-only fields", () => {
    expect(
      sequenceViewerSessionSchema.safeParse({
        revision: 0,
        schemaVersion: 2,
        sessionId: SESSION_ID,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerSessionSchema.safeParse({
        extra: true,
        revision: 0,
        sessionId: SESSION_ID,
      }).success,
    ).toBe(false);
  });

  it("accepts backwards-compatible full or inline chat presentation only", () => {
    expect(sequenceViewerChatToolInputSchema.parse({ path: "demo.fasta" })).toEqual({
      path: "demo.fasta",
    });
    expect(
      sequenceViewerChatToolInputSchema.parse({
        path: "demo.fasta",
        presentation: "inline",
      }),
    ).toMatchObject({ presentation: "inline" });
    expect(
      sequenceViewerChatToolInputSchema.safeParse({
        path: "demo.fasta",
        presentation: "fullscreen",
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerChatToolInputSchema.safeParse({
        path: "demo.fasta",
        unknown: true,
      }).success,
    ).toBe(false);
  });

  it("validates the shared queued-command envelope", () => {
    expect(
      sequenceViewerWaitResultSchema.parse({
        command: {
          action: "focus_sequence_coordinate",
          commandId: "22222222-2222-4222-8222-222222222222",
          coordinate: 12,
          revision: 1,
        },
      }),
    ).toMatchObject({ command: { coordinate: 12, revision: 1 } });
    expect(
      sequenceViewerWaitResultSchema.parse({
        command: {
          action: "query_viewer",
          commandId: "33333333-3333-4333-8333-333333333333",
          request: {
            limit: 25,
            query: "NP_040628.1",
            target: "features",
          },
          revision: 2,
        },
      }),
    ).toMatchObject({
      command: {
        request: { query: "NP_040628.1", target: "features" },
        revision: 2,
      },
    });
    expect(
      sequenceViewerWaitResultSchema.safeParse({
        command: { action: "focus_sequence_coordinate", coordinate: 12 },
      }).success,
    ).toBe(false);
  });
});

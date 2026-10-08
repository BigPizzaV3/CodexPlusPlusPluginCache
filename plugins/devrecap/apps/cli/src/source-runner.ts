import type { CollectionRange, GitCollection, SessionCollection } from "@devrecap/collectors";
import {
  collectClaudeSessions,
  collectCodexSessions,
  collectGitHistory,
  discoverProjectDirectories,
} from "@devrecap/collectors";
import type { CliSourcePermissions } from "./config.ts";

export interface SourceCollectionResult {
  codex: SessionCollection;
  claude: SessionCollection;
  git: GitCollection;
  directories: string[];
}

export interface SourceCollectorDeps {
  collectCodexSessions: typeof collectCodexSessions;
  collectClaudeSessions: typeof collectClaudeSessions;
  collectGitHistory: typeof collectGitHistory;
  discoverProjectDirectories: typeof discoverProjectDirectories;
}

const defaultDeps: SourceCollectorDeps = {
  collectCodexSessions,
  collectClaudeSessions,
  collectGitHistory,
  discoverProjectDirectories,
};

export function collectAuthorizedSources(
  range: CollectionRange,
  enabled: CliSourcePermissions,
  deps: SourceCollectorDeps = defaultDeps,
): SourceCollectionResult {
  const codex = enabled.codex ? deps.collectCodexSessions(range) : emptySession("codex");
  const claude = enabled.claude ? deps.collectClaudeSessions(range) : emptySession("claude");
  const sessionEvents = [...codex.events, ...claude.events];
  const directories = enabled.git ? deps.discoverProjectDirectories(sessionEvents, true) : [];
  const git = enabled.git ? deps.collectGitHistory(directories, range) : { repositories: [], warnings: [] };
  return { codex, claude, git, directories };
}

function emptySession(source: "codex" | "claude"): SessionCollection {
  return { source, events: [], filesRead: 0, malformed: 0, warnings: [] };
}

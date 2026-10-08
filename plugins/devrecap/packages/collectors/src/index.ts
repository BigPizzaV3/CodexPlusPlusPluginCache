import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import type { Commit, RawEvent } from "@devrecap/shared";
import { stableId } from "@devrecap/shared";
import { parseCodexJsonl } from "@devrecap/codex-parser";
import { parseGitLogText } from "@devrecap/git-parser";

export interface CollectionRange { start: string; end: string }
export interface SessionCollection { source: "codex" | "claude"; events: RawEvent[]; filesRead: number; malformed: number; warnings: string[]; }
export interface GitRepositoryCollection { root: string; repositoryId: string; commits: Commit[]; events: RawEvent[]; gitRemote?: string; branch?: string; }
export interface GitCollection { repositories: GitRepositoryCollection[]; warnings: string[] }

export function collectCodexSessions(range: CollectionRange, root = process.env.CODEX_HOME ? join(process.env.CODEX_HOME, "sessions") : join(homedir(), ".codex", "sessions")): SessionCollection {
  const out: SessionCollection = { source: "codex", events: [], filesRead: 0, malformed: 0, warnings: [] };
  for (const file of discoverJsonl(root, range, true)) {
    try {
      const parsed = parseCodexJsonl(readFileSync(file, "utf8"));
      out.filesRead++; out.malformed += parsed.malformed;
      const cwd = parsed.events.find((e) => e.cwd)?.cwd;
      for (const event of parsed.events) { if (!inRange(event.ts, range)) continue; if (!event.cwd && cwd) event.cwd = cwd; out.events.push(event); }
    } catch (error) { out.warnings.push(`Could not read Codex session ${basename(file)}: ${errorMessage(error)}`); }
  }
  return out;
}

export function collectClaudeSessions(range: CollectionRange, root = join(homedir(), ".claude", "projects")): SessionCollection {
  const out: SessionCollection = { source: "claude", events: [], filesRead: 0, malformed: 0, warnings: [] };
  if (!existsSync(root)) return out;
  for (const projectDir of safeReadDir(root).filter((name) => safeIsDirectory(join(root, name)))) {
    const dir = join(root, projectDir);
    for (const name of safeReadDir(dir)) {
      const file = join(dir, name);
      if (!name.endsWith(".jsonl") || !safeIsFile(file) || !mtimeCouldOverlap(file, range)) continue;
      try {
        const lines = readFileSync(file, "utf8").split(/\r?\n/); out.filesRead++; let seq = 0;
        for (const line of lines) {
          if (!line.trim()) continue;
          let record: unknown; try { record = JSON.parse(line); } catch { out.malformed++; continue; }
          if (!record || typeof record !== "object") { out.malformed++; continue; }
          const converted = claudeRecordToRawEvents(record as Record<string, unknown>, seq, line); seq += Math.max(converted.length, 1);
          for (const event of converted) if (inRange(event.ts, range)) out.events.push(event);
        }
      } catch (error) { out.warnings.push(`Could not read Claude session ${name}: ${errorMessage(error)}`); }
    }
  }
  return out;
}

export function collectGitHistory(projectDirs: string[], range: CollectionRange): GitCollection {
  const warnings: string[] = []; const roots = new Set<string>();
  for (const dir of projectDirs) { try { const root = git(dir, ["rev-parse", "--show-toplevel"]).trim(); if (root) roots.add(resolve(root)); } catch {} }
  const repositories: GitRepositoryCollection[] = [];
  for (const root of roots) {
    try {
      const repositoryId = stableId("repo", root); const email = safeGit(root, ["config", "user.email"]).trim(); const name = safeGit(root, ["config", "user.name"]).trim();
      const args = ["log", `--since=${range.start}`, `--until=${range.end}`, "--date=iso-strict", "--name-only", "--pretty=medium", "--no-renames"];
      if (email) args.push(`--author=${email}`); else if (name) args.push(`--author=${name}`); else warnings.push(`No Git user identity found for ${root}; commit history may include other authors.`);
      const commits = parseGitLogText(safeGit(root, args), { repositoryId });
      const events: RawEvent[] = commits.map((commit, index) => ({ sessionId: stableId("git", root), seq: index, ts: commit.committedAt, rootType: "git", payloadType: "git_commit", toolName: "git", cwd: root, data: commit, raw: `commit ${commit.hash} ${commit.message.split("\n")[0]}` }));
      repositories.push({ root, repositoryId, commits, events, gitRemote: safeGit(root, ["remote", "get-url", "origin"]).trim() || undefined, branch: safeGit(root, ["branch", "--show-current"]).trim() || undefined });
    } catch (error) { warnings.push(`Could not collect Git history for ${root}: ${errorMessage(error)}`); }
  }
  return { repositories, warnings };
}

export function discoverProjectDirectories(events: RawEvent[], includeCwd = true): string[] { const dirs = new Set<string>(); for (const event of events) if (event.cwd) dirs.add(resolve(event.cwd)); if (includeCwd) dirs.add(resolve(process.cwd())); return [...dirs]; }
export function projectRootForCwd(cwd: string | undefined, gitRoots: string[]): string | undefined { if (!cwd) return undefined; const resolved = resolve(cwd); return [...gitRoots].sort((a,b)=>b.length-a.length).find((root)=>resolved===root || resolved.startsWith(root + sep)) ?? resolved; }

/**
 * Hard safety boundary for terminal Git access. The collector is deliberately
 * read-only: only the exact Git query shapes DevRecap needs are allowed. Any
 * future mutating command (add/commit/push/switch/reset/etc.) fails before Git
 * is invoked.
 */
export function assertReadOnlyGitArgs(args: string[]): void {
  const [command, ...rest] = args;
  let allowed = false;
  if (command === "rev-parse") allowed = rest.length === 1 && rest[0] === "--show-toplevel";
  else if (command === "config") allowed = rest.length === 1 && (rest[0] === "user.email" || rest[0] === "user.name");
  else if (command === "log") allowed = rest.length >= 1 && rest.every((arg) => arg.startsWith("--"));
  else if (command === "remote") allowed = rest.length === 2 && rest[0] === "get-url" && rest[1] === "origin";
  else if (command === "branch") allowed = rest.length === 1 && rest[0] === "--show-current";
  if (!allowed) throw new Error(`DevRecap refused non-read-only Git command: git ${args.join(" ")}`);
}

function claudeRecordToRawEvents(record: Record<string, unknown>, seq: number, raw: string): RawEvent[] {
  const type = typeof record.type === "string" ? record.type : ""; if (type !== "user" && type !== "assistant") return [];
  const message = record.message && typeof record.message === "object" ? record.message as Record<string, unknown> : {};
  const ts = typeof record.timestamp === "string" ? record.timestamp : undefined; const cwd = typeof record.cwd === "string" ? record.cwd : undefined; const sessionId = typeof record.sessionId === "string" ? record.sessionId : undefined;
  const content = message.content; const blocks = Array.isArray(content) ? content : [{ type: "text", text: typeof content === "string" ? content : "" }]; const out: RawEvent[] = []; let offset = 0;
  const text = blocks.filter((b)=>b&&typeof b==="object"&&(b as Record<string,unknown>).type==="text").map((b)=>String((b as Record<string,unknown>).text??"")).filter(Boolean).join("\n");
  if (text) out.push({ sessionId, seq: seq + offset++, ts, rootType: "response_item", payloadType: "message", role: type === "user" ? "user" : "assistant", cwd, data: { type: "message", role: type === "user" ? "user" : "assistant", content: [{ type: type === "user" ? "input_text" : "output_text", text }] }, raw });
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue; const b = block as Record<string, unknown>;
    if (type === "assistant" && b.type === "tool_use") {
      const originalName = typeof b.name === "string" ? b.name : "tool"; const mapped = mapClaudeTool(originalName); const input = b.input && typeof b.input === "object" ? b.input as Record<string, unknown> : {};
      out.push({ sessionId, seq: seq + offset++, ts, rootType: "response_item", payloadType: "function_call", role: "assistant", toolName: mapped, cwd, data: { type: "function_call", name: mapped, arguments: JSON.stringify(normalizeClaudeToolInput(originalName, input)), call_id: b.id }, raw });
    } else if (type === "assistant" && b.type === "thinking" && typeof b.thinking === "string") {
      out.push({ sessionId, seq: seq + offset++, ts, rootType: "response_item", payloadType: "reasoning", role: "assistant", cwd, data: { type: "reasoning", content: [{ type: "output_text", text: b.thinking }] }, raw });
    } else if (type === "user" && b.type === "tool_result") {
      out.push({ sessionId, seq: seq + offset++, ts, rootType: "response_item", payloadType: "function_call_output", role: "tool", cwd, data: { type: "function_call_output", call_id: b.tool_use_id, output: claudeToolResultText(b.content) }, raw });
    }
  }
  return out;
}
function mapClaudeTool(name: string): string { const n=name.toLowerCase(); if(n==="bash"||n==="shell")return "exec_command"; if(n==="read")return "read_file"; if(n==="edit")return "edit_file"; if(n==="write")return "write_file"; if(n==="glob")return "glob"; if(n==="grep")return "grep_search"; if(n==="multiedit"||n==="multi_edit")return "multi_edit"; if(n.includes("notebook")&&n.includes("edit"))return "edit_file"; return n.replace(/[^a-z0-9_]+/g,"_"); }
function normalizeClaudeToolInput(name:string,input:Record<string,unknown>):Record<string,unknown>{ if(name.toLowerCase()==="bash"&&typeof input.command==="string")return {cmd:input.command}; return input; }
function claudeToolResultText(content:unknown):string{ if(typeof content==="string")return content; if(!Array.isArray(content))return JSON.stringify(content??""); return content.map((part)=>{if(typeof part==="string")return part;if(part&&typeof part==="object"){const obj=part as Record<string,unknown>;return typeof obj.text==="string"?obj.text:""}return ""}).filter(Boolean).join("\n"); }
function discoverJsonl(root:string,range:CollectionRange,recursive:boolean):string[]{ if(!existsSync(root))return []; const files:string[]=[]; const walk=(dir:string)=>{for(const name of safeReadDir(dir)){const path=join(dir,name);if(safeIsDirectory(path)){if(recursive)walk(path);continue}if(name.endsWith(".jsonl")&&safeIsFile(path)&&mtimeCouldOverlap(path,range))files.push(path)}};walk(root);return files.slice(-5000); }
function mtimeCouldOverlap(file:string,range:CollectionRange):boolean{try{return statSync(file).mtimeMs>=Date.parse(range.start)-48*60*60_000}catch{return false}}
function inRange(ts:string|undefined,range:CollectionRange):boolean{if(!ts)return false;const value=Date.parse(ts),start=Date.parse(range.start),end=Date.parse(range.end);return Number.isFinite(value)&&value>=start&&value<=end}
function safeReadDir(path:string):string[]{try{return readdirSync(path)}catch{return []}}
function safeIsDirectory(path:string):boolean{try{return statSync(path).isDirectory()}catch{return false}}
function safeIsFile(path:string):boolean{try{return statSync(path).isFile()}catch{return false}}
function safeGit(root:string,args:string[]):string{try{return git(root,args)}catch{return ""}}
function git(root:string,args:string[]):string{assertReadOnlyGitArgs(args);return execFileSync("git",["-C",root,...args],{encoding:"utf8",stdio:["ignore","pipe","ignore"],maxBuffer:20*1024*1024})}
function errorMessage(error:unknown):string{return error instanceof Error?error.message:String(error)}
import {
  runInspector
} from "./chunk-6A4INWEF.mjs";
import "./chunk-VNKX2X2V.mjs";
import "./chunk-5CKDGZHL.mjs";

// src/terminal/takeover.ts
import { execFileSync } from "node:child_process";
import { accessSync, closeSync, constants, openSync, writeSync } from "node:fs";
import { PassThrough } from "node:stream";
var ENTER = "\x1B[?1049h\x1B[?25l\x1B[2J";
var LEAVE = "\x1B[0m\x1B[?25h\x1B[?1049l";
function findHostTerminal() {
  try {
    accessSync("/dev/tty", constants.W_OK);
    return "/dev/tty";
  } catch (error) {
    const code = error.code;
    if (code === "EPERM" || code === "EACCES") {
      const denied = new Error("terminal write denied");
      denied.code = code;
      throw denied;
    }
  }
  return findControllingTerminal();
}
function findControllingTerminal(startPid = process.pid) {
  let pid = startPid;
  for (let depth = 0; pid > 1 && depth < 12; depth++) {
    let line;
    try {
      line = execFileSync("ps", ["-o", "ppid=,tty=", "-p", String(pid)], { encoding: "utf8" }).trim();
    } catch {
      return void 0;
    }
    const [parent, tty] = line.split(/\s+/);
    if (tty && tty !== "??" && tty !== "-") return tty.startsWith("/dev/") ? tty : `/dev/${tty}`;
    const next = Number(parent);
    if (!Number.isInteger(next) || next <= 1 || next === pid) return void 0;
    pid = next;
  }
  return void 0;
}
function terminalSize(device) {
  try {
    const output = execFileSync("stty", ["-f", device, "size"], { encoding: "utf8" }).trim();
    const [rows, columns] = output.split(/\s+/).map(Number);
    if (Number.isInteger(rows) && Number.isInteger(columns) && rows > 0 && columns > 0) return { rows, columns };
  } catch {
  }
  return { rows: 24, columns: 80 };
}
function deviceIO() {
  const handles = /* @__PURE__ */ new WeakMap();
  return {
    find: findHostTerminal,
    size: terminalSize,
    open(device) {
      const handle = openSync(device, "w");
      const screen = Object.assign(new PassThrough(), {
        isTTY: true,
        write(chunk) {
          const bytes = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk);
          try {
            writeSync(handle, bytes);
            return true;
          } catch {
            return false;
          }
        }
      });
      handles.set(screen, handle);
      return screen;
    },
    close(screen) {
      const handle = handles.get(screen);
      if (handle === void 0) return;
      try {
        closeSync(handle);
      } catch {
      }
    }
  };
}
var HANDOFF = "Do not replace this with a static ASCII report. Re-run the same command with permission to write the user's terminal, or use the Ctrl+Z handoff: suspend the agent, run the dashboard at the shell prompt, press q, then run fg.";
async function runTakeover(analytics, options = {}, io = deviceIO()) {
  let device = options.device;
  if (!device) {
    try {
      device = io.find?.();
    } catch (error) {
      const code = error.code;
      if (code === "EPERM" || code === "EACCES") {
        throw new Error(`This process is sandboxed and cannot write to /dev/tty, so the dashboard cannot paint on your terminal. ${HANDOFF} Codex users can also restart with "codex -s danger-full-access", which lifts the sandbox for every command, not just this one.`);
      }
      throw error;
    }
  }
  if (!device) throw new Error(`No terminal was found for this process; a sandbox may be blocking process inspection. ${HANDOFF}`);
  let screen;
  try {
    screen = io.open(device);
  } catch (error) {
    const code = error.code;
    if (code === "EPERM" || code === "EACCES") {
      throw new Error(`This process is sandboxed and cannot write to ${device}, so the dashboard cannot paint on your terminal. ${HANDOFF} Codex users can also restart with "codex -s danger-full-access", which lifts the sandbox for every command, not just this one.`);
    }
    throw new Error(`Unable to write to ${device} (${code ?? "unknown error"}). ${HANDOFF}`);
  }
  const { rows, columns } = io.size(device);
  Object.assign(screen, { columns, rows });
  const seconds = Math.min(120, Math.max(1, options.seconds ?? 10));
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    try {
      screen.write(LEAVE);
    } catch {
    }
    try {
      io.close(screen);
    } catch {
    }
  };
  const onSignal = () => {
    restore();
    process.exit(130);
  };
  process.once("exit", restore);
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode() {
      return input;
    }
  });
  try {
    screen.write(ENTER);
    const finished = runInspector(analytics, options, { input, output: screen, signals: new PassThrough(), manageScreen: false });
    const pageMs = Math.max(2500, Math.floor(seconds * 1e3 / 6));
    const tour = setInterval(() => input.write("l"), pageMs);
    const timer = setTimeout(() => input.write("q"), seconds * 1e3);
    try {
      await finished;
    } finally {
      clearInterval(tour);
      clearTimeout(timer);
    }
  } finally {
    restore();
    process.off("exit", restore);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
  return device;
}
export {
  findControllingTerminal,
  findHostTerminal,
  runTakeover
};

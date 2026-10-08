// src/cli-options.ts
import { resolve } from "node:path";
var HELP = `Codex Cost \u2014 local usage, clearly counted.

Usage: codex-cost [options]

  --terminal         Print charts and data in the terminal; no browser or server
  --inspect          Interactive dashboard; Left/Right switches full-page charts
  --ascii            Use plain ASCII charts (also selects terminal mode)
  --no-color         Disable terminal colors (also selects terminal mode)
  --color            Enable terminal colors, overriding NO_COLOR
  --no-motion        Start the interactive dashboard paused (requires --inspect)
  --takeover         Play the dashboard on this process's own terminal and exit
  --seconds <count>  How long --takeover animates, 1-120 (default: 10)
  --width <columns>  Terminal report width, 40\u2013160 (auto-detected by default)
  --range <period>   all, 7d, 30d, or 90d; for terminal modes or --json (UTC)
  --bucket <period>  day, week, or month (default: day)
  --metric <metric>  tokens or cost for the activity chart (default: tokens)
  --details          Include exact period and model values
  --json             Print aggregate analytics; do not start a server
  --no-open          Start the web dashboard without opening a browser
  --rescan           Rebuild the local usage index
  --data-dir <path>  Read a different Codex data directory
  --port <number>    Web dashboard port (default: 3456)
  --help, -h         Show this help

Chart options select terminal mode. Terminal reports can be saved or piped.
Interactive Activity: press m to switch its model-stacked area between tokens
and API dollars. --metric sets the initial units.
Space pauses/resumes chart motion; r replays the page entrance while moving.
Keys 1-6 select charts; 6 opens Cost by repo, ranked by API-equivalent dollars.
The interactive dashboard starts in ASCII; press a for Unicode/Braille.
Examples:
  codex-cost --terminal --range 30d
  codex-cost --inspect --range 30d
  codex-cost --inspect --no-motion
  codex-cost --takeover --seconds 12
  codex-cost --ascii --bucket month --metric cost
  codex-cost --terminal --details > usage.txt

Node.js 22.13+ required. No API key. All processing stays local.`;
function parseCliOptions(args) {
  const options = { help: false, noOpen: false, rescan: false, json: false, terminal: false, inspect: false, ascii: false, noColor: false, color: false, noMotion: false, takeover: false, port: 3456, bucket: "day", metric: "tokens", details: false };
  if (args.includes("--help") || args.includes("-h")) return { ...options, help: true };
  let rangeProvided = false, portProvided = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const value = () => {
      const next = args[++i];
      if (!next || next.startsWith("--")) throw new Error(`${flag} needs a value. Use --help for supported options.`);
      return next;
    };
    if (flag === "--no-open") options.noOpen = true;
    else if (flag === "--rescan") options.rescan = true;
    else if (flag === "--json") options.json = true;
    else if (flag === "--terminal") options.terminal = true;
    else if (flag === "--inspect") {
      options.inspect = true;
      options.terminal = true;
    } else if (flag === "--ascii") {
      options.ascii = true;
      options.terminal = true;
    } else if (flag === "--no-color") {
      options.noColor = true;
      options.terminal = true;
    } else if (flag === "--color") {
      options.color = true;
      options.terminal = true;
    } else if (flag === "--no-motion") options.noMotion = true;
    else if (flag === "--takeover") {
      options.takeover = true;
      options.inspect = true;
      options.terminal = true;
    } else if (flag === "--seconds") {
      options.seconds = Number(value());
      if (!Number.isInteger(options.seconds) || options.seconds < 1 || options.seconds > 120) throw new Error("--seconds must be a whole number between 1 and 120.");
    } else if (flag === "--details") {
      options.details = true;
      options.terminal = true;
    } else if (flag === "--data-dir") options.dataDir = resolve(value());
    else if (flag === "--port") {
      options.port = Number(value());
      portProvided = true;
      if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw new Error("--port must be a number between 1024 and 65535.");
    } else if (flag === "--width") {
      options.width = Number(value());
      options.terminal = true;
      if (!Number.isInteger(options.width) || options.width < 40 || options.width > 160) throw new Error("--width must be a whole number between 40 and 160.");
    } else if (flag === "--range") {
      const period = value();
      rangeProvided = true;
      if (!["all", "7d", "30d", "90d"].includes(period)) throw new Error("--range must be all, 7d, 30d, or 90d.");
      options.days = period === "all" ? void 0 : Number(period.slice(0, -1));
    } else if (flag === "--bucket") {
      const bucket = value();
      options.terminal = true;
      if (bucket !== "day" && bucket !== "week" && bucket !== "month") throw new Error("--bucket must be day, week, or month.");
      options.bucket = bucket;
    } else if (flag === "--metric") {
      const metric = value();
      options.terminal = true;
      if (metric !== "tokens" && metric !== "cost") throw new Error("--metric must be tokens or cost.");
      options.metric = metric;
    } else throw new Error(`Unknown option: ${flag}. Use --help for supported options.`);
  }
  if (options.json && options.terminal) throw new Error("Choose --json or terminal chart options, not both.");
  if (options.color && options.noColor) throw new Error("Choose --color or --no-color, not both.");
  if (options.seconds !== void 0 && !options.takeover) throw new Error("--seconds requires --takeover.");
  if (options.takeover && options.noMotion) throw new Error("--takeover exists to show motion. Use --terminal for a still report.");
  if (options.noMotion && !options.inspect) throw new Error("--no-motion requires --inspect. Static reports and JSON do not animate.");
  if (options.inspect && options.bucket !== "day") throw new Error("--inspect groups activity to fit the terminal. Use --terminal for weekly or monthly buckets.");
  if (rangeProvided && !options.json && !options.terminal) throw new Error("--range needs --terminal or --json. Use the date filter in the web dashboard.");
  if (portProvided && (options.terminal || options.json)) throw new Error("--port is only used by the web dashboard.");
  if (options.inspect) options.ascii = true;
  return options;
}
export {
  HELP,
  parseCliOptions
};

// src/skill.ts
var SKILL_HELP = `Codex Cost \u2014 portable local usage skill.

Usage: node scripts/codex-cost.mjs [options]

  --inspect          Open the interactive chart dashboard (default mode)
  --terminal         Print the complete report once and exit
  --ascii            Use plain ASCII; selects a static report unless --inspect is set
  --color            Enable terminal colors even when NO_COLOR is set
  --no-color         Disable terminal colors
  --no-motion        Start the interactive dashboard paused; use --inspect with other chart flags
  --takeover         Play the animated dashboard on this process's own terminal, then restore it
  --seconds <count>  How long --takeover animates, 1-120 (default: 10)
  --width <columns>  Width in columns, 40\u2013160
  --range <period>   all, 7d, 30d, or 90d (UTC; default: all)
  --bucket <period>  Static report grouping: day, week, or month
  --metric <metric>  Activity chart: tokens or cost (default: tokens)
  --details          Include exact static report values
  --json             Print structured analytics and exit
  --rescan           Rebuild the local metadata index
  --data-dir <path>  Read another local Codex data directory
  --help, -h         Show this help

Dashboard pages: Activity, Cumulative cost, Models, Token mix, GPT-3 era, Cost by repo.
Left/Right or h/l change pages; 1-6 jump directly; Home/End jump to first/last.
Up/Down or k/j and PageUp/PageDown scroll; a toggles ASCII/Braille;
c toggles color; m switches Activity between tokens and API dollars.
The dashboard starts with fine ASCII marks, matching its animation previews.
Space pauses/resumes motion; r replays the page entrance while moving.
q or Ctrl+C quits. Every page covers the full selected range.
Run the dashboard in a terminal you can type in. Try --inspect --color.
From a CLI agent, open a Terminal window with scripts/open.sh. The agent
has no terminal of its own, so --takeover cannot paint there.
Use --inspect --no-motion to start with the final chart visible and no animation.

Node.js 22.13+ required. No API key. All processing stays local.`;
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  console.error(`Codex Cost: unable to write output (${error.code ?? error.message}).`);
  process.exit(1);
});
async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || major === 22 && minor < 13) {
    throw new Error("Node.js 22.13 or newer is required. Please upgrade Node.js and try again.");
  }
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(SKILL_HELP);
    return;
  }
  if (args.includes("--port") || args.includes("--no-open")) {
    throw new Error("This portable skill provides terminal charts only. Use --inspect, --terminal, or --json.");
  }
  const modes = ["--inspect", "--terminal", "--ascii", "--color", "--no-color", "--width", "--bucket", "--metric", "--details", "--json"];
  if (!args.some((arg) => modes.includes(arg))) args.unshift("--inspect");
  const { parseCliOptions } = await import("./chunks/cli-options-5KYJ2N6P.mjs");
  const options = parseCliOptions(args);
  if (options.dataDir) process.env.CODEX_COST_DATA_DIR = options.dataDir;
  const { getAnalytics } = await import("./chunks/service-SIMU6ROX.mjs");
  if (process.stderr.isTTY) console.error("Reading your local Codex usage...");
  const analytics = await getAnalytics({ rescan: options.rescan, days: options.days });
  if (options.takeover) {
    const { runTakeover } = await import("./chunks/takeover-XD4XRDAQ.mjs");
    const device = await runTakeover(analytics, options);
    console.log(`Played the animated dashboard on ${device} for ${options.seconds ?? 10}s and restored the screen.`);
    return;
  }
  if (options.inspect) {
    const { runInspector } = await import("./chunks/inspector-QZMCFQLT.mjs");
    await runInspector(analytics, options);
    return;
  }
  if (options.json) {
    console.log(JSON.stringify({ sessions: analytics.sessions, ...analytics.totals, cacheHitRate: analytics.cacheHitRate, historicalComparison: analytics.historicalComparison, models: analytics.models, daily: analytics.daily, pricingCheckedAt: analytics.pricingCheckedAt, assumptions: analytics.assumptions, diagnostics: { ...analytics.source, directory: void 0 } }, null, 2));
    return;
  }
  const { renderTerminal } = await import("./chunks/render-7KEDKSTK.mjs");
  const plain = options.ascii || !process.stdout.isTTY || process.env.TERM === "dumb";
  console.log(renderTerminal(analytics, {
    width: options.width ?? process.stdout.columns ?? 100,
    ascii: plain,
    color: !!process.stdout.isTTY && !options.noColor && (options.color || process.env.NO_COLOR === void 0) && !plain,
    bucket: options.bucket,
    metric: options.metric,
    details: options.details
  }));
}
try {
  await main();
} catch (error) {
  console.error(`Codex Cost: ${error instanceof Error ? error.message : "Unable to start."}`);
  process.exitCode = 1;
}

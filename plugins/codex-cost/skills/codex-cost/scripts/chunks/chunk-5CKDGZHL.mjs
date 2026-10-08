// src/lib/chart-data.ts
var zeroTotals = () => ({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedApiCost: 0, unpricedTokens: 0, pricedTokens: 0 });
var fields = Object.keys(zeroTotals());
function calendarBucket(date, bucket) {
  if (bucket === "month") return `${date.slice(0, 7)}-01`;
  if (bucket === "week") {
    const day = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    return day.toISOString().slice(0, 10);
  }
  return date;
}
function groupDays(days, bucket) {
  const groups = /* @__PURE__ */ new Map();
  for (const day of days) {
    const date = calendarBucket(day.date, bucket);
    let group = groups.get(date);
    if (!group) {
      group = { point: { date, ...zeroTotals(), cumulativeCost: 0, models: [] }, models: /* @__PURE__ */ new Map() };
      groups.set(date, group);
    }
    for (const field of fields) group.point[field] += day[field];
    for (const model of day.models) {
      let total = group.models.get(model.model);
      if (!total) {
        total = { ...zeroTotals(), model: model.model, pricingKnown: model.pricingKnown };
        group.models.set(model.model, total);
      }
      for (const field of fields) total[field] += model[field];
      total.pricingKnown = total.pricingKnown && model.pricingKnown;
    }
  }
  let cumulativeCost = 0;
  return [...groups.values()].sort((a, b) => a.point.date.localeCompare(b.point.date)).map(({ point, models }) => ({
    ...point,
    models: [...models.values()].sort((a, b) => a.model.localeCompare(b.model)),
    cumulativeCost: cumulativeCost += point.estimatedApiCost
  }));
}
function cumulativeDays(days) {
  const totals = zeroTotals();
  const models = /* @__PURE__ */ new Map();
  return groupDays(days, "day").map((day) => {
    for (const field of fields) totals[field] += day[field];
    for (const model of day.models) {
      let total = models.get(model.model);
      if (!total) {
        total = { ...zeroTotals(), model: model.model, pricingKnown: model.pricingKnown };
        models.set(model.model, total);
      }
      for (const field of fields) total[field] += model[field];
      total.pricingKnown = total.pricingKnown && model.pricingKnown;
    }
    return {
      date: day.date,
      ...totals,
      cumulativeCost: totals.estimatedApiCost,
      models: [...models.values()].sort((a, b) => a.model.localeCompare(b.model)).map((model) => ({ ...model }))
    };
  });
}
var modelColors = {
  "gpt-6-astra": "#fb8264",
  "gpt-5.6-sol": "#3454ed",
  "gpt-5.6-terra": "#278c86",
  "gpt-5.6-luna": "#bb852f",
  "gpt-5.5": "#b79be5",
  "gpt-5.4": "#da5a85",
  "gpt-5.4-mini": "#609ad2",
  "gpt-5.3-codex": "#754da7",
  "codex-auto-review": "#a3a3a3",
  "unknown": "#575757"
};
function modelColor(model) {
  if (Object.hasOwn(modelColors, model)) return modelColors[model];
  let hash = 0;
  for (const character of model) hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
  return `hsl(${(hash >>> 0) % 360} 58% 48%)`;
}

// src/lib/format.ts
var exactNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
var fullMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
function duration(minutes) {
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hrs`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

// src/terminal/render.ts
function buildTerminalChartSamples(days, bucket, metric, columns, cumulative = false) {
  const grouped = groupDays(days, bucket);
  if (!grouped.length) return [];
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0].date;
  const last = ordered[ordered.length - 1].date;
  const running = /* @__PURE__ */ new Map();
  let runningTotal = 0;
  let runningUnpriced = 0;
  const periods = grouped.map((point, index) => {
    const next = grouped[index + 1]?.date;
    const end = next ? new Date(Date.parse(`${next}T00:00:00Z`) - 864e5).toISOString().slice(0, 10) : last;
    const value = metric === "tokens" ? point.totalTokens : point.estimatedApiCost;
    runningTotal += value;
    runningUnpriced += point.unpricedTokens;
    for (const model of point.models) {
      const prior = running.get(model.model) ?? { value: 0, unpricedTokens: 0 };
      running.set(model.model, { value: prior.value + (metric === "tokens" ? model.totalTokens : model.estimatedApiCost), unpricedTokens: prior.unpricedTokens + model.unpricedTokens });
    }
    return {
      from: point.date < first ? first : point.date,
      to: end > last ? last : end,
      groups: 1,
      total: cumulative ? runningTotal : value,
      unpricedTokens: cumulative ? runningUnpriced : point.unpricedTokens,
      models: cumulative ? [...running].map(([model, totals]) => ({ model, ...totals })) : point.models.map((model) => ({ model: model.model, value: metric === "tokens" ? model.totalTokens : model.estimatedApiCost, unpricedTokens: model.unpricedTokens }))
    };
  });
  const count = Math.min(periods.length, Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : periods.length);
  return Array.from({ length: count }, (_, index) => {
    const portion = periods.slice(Math.floor(index * periods.length / count), Math.floor((index + 1) * periods.length / count));
    const final = portion[portion.length - 1];
    if (cumulative) return { ...final, from: portion[0].from, groups: portion.length };
    const models = /* @__PURE__ */ new Map();
    for (const point of portion) for (const model of point.models) {
      const prior = models.get(model.model) ?? { value: 0, unpricedTokens: 0 };
      models.set(model.model, { value: prior.value + model.value, unpricedTokens: prior.unpricedTokens + model.unpricedTokens });
    }
    return {
      from: portion[0].from,
      to: final.to,
      groups: portion.length,
      total: portion.reduce((sum, point) => sum + point.total, 0),
      unpricedTokens: portion.reduce((sum, point) => sum + point.unpricedTokens, 0),
      models: [...models].map(([model, totals]) => ({ model, ...totals }))
    };
  });
}
function safe(value) {
  return String(value).replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\|$)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\x1b[@-_]/g, "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u00b7/g, "/").normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").replace(/[\x00-\x1f\x7f-\x9f]/g, " ").replace(/[^\x20-\x7e]/g, "?").replace(/\s+/g, " ").trim();
}
function wrap(value, width) {
  const lines = [];
  let remaining = safe(value);
  while (remaining.length > width) {
    const space = remaining.lastIndexOf(" ", width);
    const cut = space > width / 3 ? space : width;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining || !lines.length) lines.push(remaining);
  return lines;
}
var exact = (value) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
var amount = (value) => value > 0 && value < 0.01 ? "<$0.01" : value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
var exactCost = (value) => value > 0 && value < 1e-9 ? "<$0.000000001" : `$${value.toLocaleString("en-US", { maximumFractionDigits: 9 })}`;
function compact(value) {
  const units = [[1e15, "Q"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  const unit = units.find(([size]) => value >= size);
  return unit ? `${Number((value / unit[0]).toFixed(value / unit[0] >= 100 ? 0 : 1))}${unit[1]}` : Number(value.toFixed(2)).toString();
}
function costLabel(totals, precise = false) {
  if (totals.unpricedTokens > 0 && totals.pricedTokens === 0) return "Unpriced";
  return `${(precise ? exactCost : amount)(totals.estimatedApiCost)}${totals.unpricedTokens ? " (partial)" : ""}`;
}
function rgbFor(model) {
  const value = modelColor(model);
  if (value.startsWith("#")) return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const hue = Number(value.match(/hsl\((\d+)/)?.[1] ?? 220) / 60;
  const chroma = (1 - Math.abs(2 * 0.48 - 1)) * 0.58;
  const x = chroma * (1 - Math.abs(hue % 2 - 1));
  const base = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return base.map((channel) => Math.round((channel + 0.48 - chroma / 2) * 255));
}
function renderTerminal(analytics, options = {}) {
  const width = Math.min(160, Math.max(40, Number.isFinite(options.width) ? Math.floor(options.width) : 100));
  const ascii = options.ascii ?? false;
  const color = !!options.color && !ascii;
  const bucket = options.bucket ?? "day";
  const metric = options.metric ?? "tokens";
  const horizontal = ascii ? "-" : "\u2500";
  const vertical = ascii ? "|" : "\u2502";
  const block = ascii ? "#" : "\u2588";
  const output = [];
  const text = (value = "") => output.push(...wrap(value, width));
  const rule = () => output.push(horizontal.repeat(width));
  const section = (title) => {
    text();
    text(title.toUpperCase());
    rule();
  };
  const pair = (label, value) => {
    const left = safe(label), right = safe(value);
    if (left.length + right.length + 2 <= width) output.push(left + " ".repeat(width - left.length - right.length) + right);
    else {
      text(`${left}:`);
      text(right);
    }
  };
  const fields2 = (values) => {
    const cellWidth = Math.floor((width - 3) / 2);
    if (width >= 72 && values.every(([label, value]) => safe(`${label}: ${value}`).length <= cellWidth)) {
      for (let index = 0; index < values.length; index += 2) {
        const first = safe(`${values[index][0]}: ${values[index][1]}`);
        const second = values[index + 1];
        output.push(second ? first.padEnd(cellWidth) + "   " + safe(`${second[0]}: ${second[1]}`) : first);
      }
    } else for (const [label, value] of values) pair(label, value);
  };
  const sortedModels = [...analytics.models].sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
  const chartModels = sortedModels.slice(0, 8);
  const chartModelIds = new Set(chartModels.map((model) => model.model));
  const allModelNames = /* @__PURE__ */ new Set([...analytics.models.map((model) => model.model), ...analytics.daily.flatMap((day) => day.models.map((model) => model.model))]);
  const otherCount = [...allModelNames].filter((model) => !chartModelIds.has(model)).length;
  const keys = chartModels.map((model, index) => ({ model: model.model, character: String.fromCharCode(65 + index) }));
  if (otherCount) keys.push({ model: "\0other", character: "*" });
  const colored = (character, model) => color ? `\x1B[38;2;${(model === "\0other" ? [145, 145, 145] : rgbFor(model)).join(";")}m${character}\x1B[0m` : character;
  const modelSymbol = (model) => keys.find((key) => key.model === model)?.character ?? "*";
  rule();
  text("CODEX COST / LOCAL USAGE");
  text("Every token, in your terminal.");
  rule();
  const orderedDates = analytics.daily.map((day) => day.date).sort();
  text(orderedDates.length ? `${orderedDates[0]} to ${orderedDates[orderedDates.length - 1]} / UTC` : "No recorded dates / UTC");
  pair("API-equivalent estimate", costLabel(analytics.totals));
  fields2([
    ["Total tokens", exact(analytics.totals.totalTokens)],
    ["Sessions", exact(analytics.sessions)],
    ["Cache hit rate", `${(analytics.cacheHitRate * 100).toFixed(1)}%`],
    ["Models", exact(analytics.models.length)]
  ]);
  text("USD estimate at published API rates; not your subscription bill.");
  if (analytics.totals.unpricedTokens) text(`${exact(analytics.totals.unpricedTokens)} tokens have no verified price and are excluded from dollar estimates. They remain in token totals.`);
  if (!analytics.totals.totalTokens) text("No token usage was found for this period.");
  if (!analytics.source.found) text("Local Codex history directory was not found. Use --data-dir to select your Codex history.");
  const chart = (title, chartMetric, cumulative) => {
    section(title);
    const columnCount = width - 13;
    const samples = buildTerminalChartSamples(analytics.daily, bucket, chartMetric, columnCount, cumulative);
    const max = Math.max(0, ...samples.map((sample) => sample.total));
    const groupCount = samples.reduce((sum, sample) => sum + sample.groups, 0);
    const bucketName = bucket === "day" ? "daily" : bucket === "week" ? "weekly" : "monthly";
    text(`${bucketName[0].toUpperCase() + bucketName.slice(1)} / ${chartMetric === "tokens" ? "tokens" : "API-equivalent USD"} / by model`);
    if (groupCount > samples.length) {
      const sizes = [...new Set(samples.map((sample) => sample.groups))].sort((a, b) => a - b);
      text(`${samples.length} columns cover ${groupCount} ${bucketName} periods. Each column ${cumulative ? "ends after" : "sums"} ${sizes.join("-")} adjacent periods.`);
    } else text(cumulative ? "Each column is the running total at period end." : "Each column is one period; quiet periods remain visible.");
    if (bucket === "week") text("Weeks start Monday in UTC; edge weeks can be partial.");
    if (bucket === "month") text("Calendar months in UTC; edge months can be partial.");
    if (chartMetric === "cost" && analytics.totals.unpricedTokens) text("Dollar chart excludes unpriced usage.");
    if (cumulative) text(`Period end: ${costLabel(analytics.totals)}`);
    if (!max) {
      text(chartMetric === "cost" && analytics.totals.unpricedTokens ? "No priced usage to chart. Unpriced tokens are not $0." : "No usage to chart.");
      return;
    }
    const height = width < 70 ? 8 : 10;
    const stacks = samples.map((sample) => {
      const values = new Map(sample.models.map((model) => [model.model, model.value]));
      return keys.map((key) => ({ ...key, value: key.model === "\0other" ? sample.models.filter((model) => !chartModelIds.has(model.model)).reduce((sum, model) => sum + model.value, 0) : values.get(key.model) ?? 0 }));
    });
    const cellScale = Math.max(1, Math.floor(columnCount / Math.max(1, samples.length)));
    const plottedWidth = samples.length * cellScale;
    for (let row = height; row >= 1; row--) {
      const axisValue = max * row / height;
      const axisLabel = row === height || row === Math.ceil(height / 2) ? chartMetric === "cost" && axisValue > 0 && axisValue < 0.01 ? "<$0.01" : `${chartMetric === "cost" ? "$" : ""}${compact(axisValue)}` : "";
      let cells = "";
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        const occupied = sample.total > 0 && row <= Math.max(1, Math.round(sample.total / max * height));
        if (!occupied) {
          cells += " ".repeat(cellScale);
          continue;
        }
        const target = Math.min(sample.total, (row - 0.5) / height * max);
        let sum = 0;
        const entry = stacks[index].find((item) => {
          sum += item.value;
          return item.value > 0 && sum >= target;
        }) ?? [...stacks[index]].reverse().find((item) => item.value > 0);
        cells += (entry ? colored(entry.character, entry.model) : "?").repeat(cellScale);
      }
      output.push(axisLabel.padStart(10) + ` ${vertical}` + cells);
    }
    output.push("0".padStart(10) + ` ${ascii ? "+" : "\u2514"}` + horizontal.repeat(plottedWidth));
    const first = samples[0].from;
    const last = samples[samples.length - 1].to;
    if (plottedWidth >= first.length + last.length + 1) output.push(" ".repeat(12) + first + " ".repeat(plottedWidth - first.length - last.length) + last);
    else text(`${first} to ${last}`);
    text("Chart height is rounded; tiny contributions may be invisible.");
  };
  chart("Usage over time", metric, false);
  chart("Cumulative cost", "cost", true);
  if (keys.length) {
    text();
    text("MODEL LEGEND / same symbols in both charts");
    for (const key of keys) {
      if (key.model === "\0other") text(`* Other (${otherCount} models combined in charts; all are listed below)`);
      else {
        const label = `${key.character} ${safe(key.model)}`;
        const lines = wrap(label, width);
        output.push(color ? lines[0].replace(key.character, colored(key.character, key.model)) : lines[0], ...lines.slice(1));
      }
    }
  }
  section("Token mix");
  const tokenRows = [["Input (uncached)", analytics.totals.inputTokens], ["Cached input", analytics.totals.cachedInputTokens], ["Output", analytics.totals.outputTokens]];
  for (const [label, value] of tokenRows) {
    const fraction = analytics.totals.totalTokens ? value / analytics.totals.totalTokens : 0;
    pair(label, `${exact(value)} / ${(fraction * 100).toFixed(1)}%`);
    output.push(block.repeat(value ? Math.max(1, Math.round(fraction * (width - 2))) : 0));
  }
  text("Cache hit rate uses input + cached input. Token mix uses all tokens. Reasoning is already included in output.");
  section(`Models / ${analytics.models.length}`);
  text("Exact token counts. API-equivalent USD; partial prices are marked.");
  if (!sortedModels.length) text("No models recorded.");
  for (const [index, model] of sortedModels.entries()) {
    if (index) text();
    text(`${modelSymbol(model.model)} ${model.model}`);
    fields2([
      ["Input (uncached)", exact(model.inputTokens)],
      ["Cached input", exact(model.cachedInputTokens)],
      ["Output", exact(model.outputTokens)],
      ["Total tokens", exact(model.totalTokens)],
      ["Sessions", exact(model.sessions)],
      ["API equivalent", costLabel(model, !!options.details)]
    ]);
    if (model.unpricedTokens) pair("Unpriced tokens", exact(model.unpricedTokens));
  }
  text("A session can use multiple models; model session counts overlap.");
  section("Projects");
  const projects = [...analytics.projects].sort((a, b) => b.totalTokens - a.totalTokens);
  const shownProjects = options.details ? projects : projects.slice(0, 8);
  if (!projects.length) text("No projects recorded.");
  for (const project of shownProjects) {
    text(project.project);
    text(`  ${exact(project.totalTokens)} tokens / ${exact(project.sessions)} sessions / ${costLabel(project)}`);
  }
  if (shownProjects.length < projects.length) text(`${projects.length - shownProjects.length} more projects; use --details to list every project.`);
  section("Highlights");
  const activeDays = analytics.daily.filter((day) => day.totalTokens > 0);
  pair("Active days", exact(activeDays.length));
  const busiest = [...activeDays].sort((a, b) => b.totalTokens - a.totalTokens)[0];
  if (busiest) text(`Busiest day: ${busiest.date} / ${exact(busiest.totalTokens)} tokens`);
  const mostExpensiveDay = analytics.daily.filter((day) => day.pricedTokens > 0).sort((a, b) => b.estimatedApiCost - a.estimatedApiCost)[0];
  const mostExpensiveSession = analytics.sessionDetails.filter((session) => session.pricedTokens > 0).sort((a, b) => b.estimatedApiCost - a.estimatedApiCost)[0];
  const longestSession = [...analytics.sessionDetails].sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  pair("Most expensive day", mostExpensiveDay ? costLabel(mostExpensiveDay) : analytics.totals.unpricedTokens ? "Unpriced" : "No recorded usage");
  if (mostExpensiveDay) text(`  ${mostExpensiveDay.date} / UTC`);
  pair("Most expensive session", mostExpensiveSession ? costLabel(mostExpensiveSession) : analytics.totals.unpricedTokens ? "Unpriced" : "No recorded usage");
  if (mostExpensiveSession) text(`  ${mostExpensiveSession.project} / started ${mostExpensiveSession.startedAt.slice(0, 10)} UTC`);
  if (analytics.totals.unpricedTokens) text("Cost highlights compare priced usage only; unknown costs can change the ranking.");
  if (longestSession) {
    pair("Longest session", duration(longestSession.durationMinutes));
    text(`  ${longestSession.project} / started ${longestSession.startedAt.slice(0, 10)} UTC`);
    text("Full recorded span includes idle time and can begin before the selected period.");
  }
  if (sortedModels[0]) text(`Most-used model: ${sortedModels[0].model} / ${exact(sortedModels[0].totalTokens)} tokens`);
  if (activeDays.length) pair("Tokens per active day", exact(analytics.totals.totalTokens / activeDays.length));
  section(`${analytics.historicalComparison.label} / ${analytics.historicalComparison.year}`);
  const historical = analytics.historicalComparison;
  pair("Same-token thought experiment", amount(historical.estimatedCost));
  text(`${exact(historical.totalTokens)} tokens x $${historical.usdPerMillion} / million tokens`);
  text(historical.basis);
  text("Includes all models and cached tokens at full historical price. Modern token counts held fixed, including reasoning already in output. This does not imply equivalent capabilities.");
  text("Uses the 2020 Build-plan marginal overage rate; excludes plan fees, included tokens and inflation.");
  if (options.details) {
    section(`Exact ${bucket === "day" ? "daily" : bucket === "week" ? "weekly" : "monthly"} chart data`);
    text("Full periods before chart compression. Both token and USD values are shown.");
    const periods = buildTerminalChartSamples(analytics.daily, bucket, "tokens", Number.MAX_SAFE_INTEGER);
    const costs = buildTerminalChartSamples(analytics.daily, bucket, "cost", Number.MAX_SAFE_INTEGER);
    const cumulative = buildTerminalChartSamples(analytics.daily, bucket, "cost", Number.MAX_SAFE_INTEGER, true);
    for (let index = 0; index < periods.length; index++) {
      const period = periods[index], cost = costs[index], running = cumulative[index];
      text();
      text(`${period.from}${period.from !== period.to ? ` to ${period.to}` : ""}`);
      pair("Tokens", exact(period.total));
      pair("Priced cost", exactCost(cost.total));
      pair("Cumulative priced cost", exactCost(running.total));
      pair("Unpriced tokens", exact(period.unpricedTokens));
      const models = new Map(cost.models.map((model) => [model.model, model]));
      const accumulated = new Map(running.models.map((model) => [model.model, model]));
      for (const name of [.../* @__PURE__ */ new Set([...period.models.map((model) => model.model), ...running.models.map((model) => model.model)])].sort()) {
        const current = period.models.find((model) => model.model === name);
        text(`${modelSymbol(name)} ${name}`);
        pair("  Tokens", exact(current?.value ?? 0));
        pair("  Priced cost", exactCost(models.get(name)?.value ?? 0));
        pair("  Cumulative priced cost", exactCost(accumulated.get(name)?.value ?? 0));
        pair("  Unpriced tokens", exact(current?.unpricedTokens ?? 0));
      }
    }
  }
  section("Coverage & accounting");
  const coverage = analytics.totals.totalTokens ? analytics.totals.pricedTokens / analytics.totals.totalTokens * 100 : 0;
  pair("Tokens with verified prices", `${coverage.toFixed(2)}%`);
  pair("Pricing checked", analytics.pricingCheckedAt);
  text(`Local history: ${exact(analytics.source.files)} files found; ${exact(analytics.source.parsedFiles)} readable; ${exact(analytics.source.failedFiles)} failed.`);
  text("Only available local Codex history is counted. Deleted sessions, other devices and server-only usage may be missing. No conversation text is printed.");
  if (analytics.source.warnings.length) {
    text();
    text("IMPORT WARNINGS");
    for (const warning of analytics.source.warnings) text(`! ${warning}`);
  }
  if (options.details) {
    text();
    text("ACCOUNTING ASSUMPTIONS");
    for (const assumption of analytics.assumptions) text(`- ${assumption}`);
    text();
    text("GPT-3 ERA SOURCES");
    for (const source of historical.sources) {
      text(source.label);
      text(source.url);
    }
  } else text("Use --details for exact chart data, all projects, assumptions and historical sources.");
  rule();
  return output.join("\n") + "\n";
}

export {
  groupDays,
  cumulativeDays,
  buildTerminalChartSamples,
  renderTerminal
};

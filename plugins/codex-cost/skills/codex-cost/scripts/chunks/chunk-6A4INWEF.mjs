import {
  GPT3_ERA_PRICING,
  calculateGpt3EraCost
} from "./chunk-VNKX2X2V.mjs";
import {
  cumulativeDays,
  groupDays,
  renderTerminal
} from "./chunk-5CKDGZHL.mjs";

// src/terminal/inspector.ts
import { emitKeypressEvents } from "node:readline";

// src/terminal/stacked-area.ts
function createActivityStack(days, metric, columns) {
  const field = metric === "cost" ? "estimatedApiCost" : "totalTokens";
  const totals = /* @__PURE__ */ new Map();
  for (const day of days) for (const model of day.models) totals.set(model.model, (totals.get(model.model) ?? 0) + model[field]);
  const ranked = [...totals].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const series = ranked.slice(0, 5).map(([model, total], index) => ({ model, label: model, symbol: String.fromCharCode(65 + index), count: 1, total }));
  const other = ranked.slice(5);
  if (other.length) series.push({ model: "", label: `Other (${other.length} models)`, symbol: "O", count: other.length, total: other.reduce((sum, [, total]) => sum + total, 0) });
  const owners = new Map(ranked.map(([model], index) => [model, Math.min(index, 5)]));
  const daysPerBucket = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(columns) || 1)));
  const buckets = [];
  for (let start = 0; start < days.length; start += daysPerBucket) {
    const chunk = days.slice(start, start + daysPerBucket), values = series.map(() => 0);
    for (const day of chunk) for (const model of day.models) {
      const owner = owners.get(model.model);
      if (owner !== void 0) values[owner] += model[field];
    }
    buckets.push({ firstDate: chunk[0].date, lastDate: chunk.at(-1).date, days: chunk.length, values, total: values.reduce((sum, value) => sum + value, 0) });
  }
  return { series, buckets, daysPerBucket, maximum: buckets.reduce((maximum, bucket) => Math.max(maximum, bucket.total), 0) };
}
function rasterActivityStack(stack, columns, rows, subrows = 8) {
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ({ owner: -1, filled: 0 })));
  if (!stack.maximum || !stack.buckets.length) return grid;
  const totalDays = stack.buckets.reduce((sum, bucket) => sum + bucket.days, 0);
  for (let column = 0; column < columns; column++) {
    const day = column === columns - 1 ? totalDays - 1 : Math.floor(column * totalDays / columns);
    const bucket = stack.buckets[Math.min(stack.buckets.length - 1, Math.floor(day / stack.daysPerBucket))];
    for (let row = 0; row < rows; row++) {
      const owners = stack.series.map(() => 0);
      let filled = 0;
      for (let subrow = 0; subrow < subrows; subrow++) {
        const value = stack.maximum * (rows * subrows - row * subrows - subrow - 0.5) / (rows * subrows);
        let lower = 0;
        for (let owner = 0; owner < bucket.values.length; owner++) {
          const upper = lower + bucket.values[owner];
          if (value > lower && value <= upper) {
            owners[owner]++;
            filled++;
            break;
          }
          lower = upper;
        }
      }
      if (filled) grid[row][column] = { owner: owners.indexOf(Math.max(...owners)), filled };
    }
  }
  return grid;
}

// src/terminal/inspector-render.ts
var INSPECTOR_PAGES = ["Activity", "Cumulative cost", "Models", "Token mix", "GPT-3 era", "Cost by repo"];
function createInspectorData(analytics) {
  const days = groupDays(analytics.daily, "day");
  const cumulative = cumulativeDays(analytics.daily);
  const dailyModels = days.map((day) => new Map(day.models.map((model) => [model.model, model])));
  const cumulativeModels = cumulative.map((day) => new Map(day.models.map((model) => [model.model, model])));
  const finalModels = new Map(analytics.models.map((model) => [model.model, model]));
  for (const model of cumulative.at(-1)?.models ?? []) if (!finalModels.has(model.model)) finalModels.set(model.model, model);
  const models = [...finalModels.values()].sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
  const repos = [...analytics.projects].sort((a, b) => Number(!!a.unpricedTokens && !a.pricedTokens) - Number(!!b.unpricedTokens && !b.pricedTokens) || b.estimatedApiCost - a.estimatedApiCost || a.project.localeCompare(b.project));
  const priced = models.filter((model) => model.estimatedApiCost > 0).sort((a, b) => b.estimatedApiCost - a.estimatedApiCost || a.model.localeCompare(b.model));
  const curves = priced.slice(0, 5).map((model, index) => ({
    symbol: String.fromCharCode(65 + index),
    label: model.model,
    model: model.model,
    count: 1,
    values: cumulativeModels.map((point) => point.get(model.model)?.estimatedApiCost ?? 0)
  }));
  const other = priced.slice(5);
  if (other.length) curves.push({
    symbol: "O",
    label: `Other (${other.length} models combined)`,
    model: "",
    count: other.length,
    values: cumulativeModels.map((point) => other.reduce((sum, model) => sum + (point.get(model.model)?.estimatedApiCost ?? 0), 0))
  });
  const modelColors = /* @__PURE__ */ new Map(), used = /* @__PURE__ */ new Set();
  for (const model of models) {
    const preferred = modelColor(model.model);
    const color = !used.has(preferred) ? preferred : palette.find((color2) => !used.has(color2)) ?? preferred;
    modelColors.set(model.model, color);
    used.add(color);
  }
  return { analytics, days, cumulative, models, repos, dailyModels, cumulativeModels, curves, modelColors };
}
function safe(value) {
  return String(value).replace(/(?:\x1b\]|\u009d)[\s\S]*?(?:\x07|\x1b\\|\u009c|$)/g, "").replace(/(?:\x1b\[|\u009b)[0-?]*[ -/]*[@-~]/g, "").replace(/\x1b[@-_]/g, "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u00b7/g, "/").normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").replace(/[\x00-\x1f\x7f-\x9f]/g, " ").replace(/[^\x20-\x7e]/g, "?").replace(/\s+/g, " ").trim();
}
function wrap(value, width) {
  let remaining = safe(value);
  const lines = [];
  while (remaining.length > width) {
    const space = remaining.lastIndexOf(" ", width);
    const cut = space > width / 3 ? space : width;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  lines.push(remaining);
  return lines;
}
var roles = { heading: 25, input: 33, cached: 30, output: 166, cost: 28, warning: 130, historical: 97 };
var palette = [33, 166, 30, 97, 130, 28, 63, 162, 60, 136];
var knownColors = {
  "gpt-5.6-sol": 33,
  "gpt-6-astra": 166,
  "gpt-5.6-terra": 30,
  "gpt-5.6-luna": 130,
  "gpt-5.5": 63,
  "gpt-5.4": 97,
  "gpt-5.4-mini": 28,
  "gpt-5.3-codex": 30,
  "unknown": 130,
  "codex-auto-review": 136
};
function modelColor(model) {
  if (Object.hasOwn(knownColors, model)) return knownColors[model];
  let hash = 0;
  for (const char of model) hash = Math.imul(hash, 31) + char.charCodeAt(0) | 0;
  return palette[(hash >>> 0) % palette.length];
}
function colorize(text, role, enabled) {
  if (!enabled || role === void 0) return text;
  const code = typeof role === "number" ? Math.max(0, Math.min(255, Number.isFinite(role) ? Math.floor(role) : 25)) : roles[role];
  return `\x1B[38;5;${code}m${text}\x1B[39m`;
}
function inspectorPaint(text, role = "heading") {
  return colorize(safe(text), role, true);
}
var exact = (value) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
var dollars = (value) => value > 0 && value < 1e-9 ? "<$0.000000001" : `$${value.toLocaleString("en-US", { maximumFractionDigits: 9 })}`;
var roundedDollars = (value) => value > 0 && value < 0.01 ? "<$0.01" : value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
var cost = (totals, rounded = false) => totals.unpricedTokens && !totals.pricedTokens ? "Unpriced" : `${(rounded ? roundedDollars : dollars)(totals.estimatedApiCost)}${totals.unpricedTokens ? " (partial)" : ""}`;
var percent = (value, total) => `${(total ? value / total * 100 : 0).toFixed(1)}%`;
function abbreviated(value) {
  const unit = [[1e15, "Q"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]].find(([scale]) => value >= scale);
  return unit ? `${Number((value / unit[0]).toFixed(1))}${unit[1]}` : `${Number(value.toFixed(2))}`;
}
var shorten = (value, width) => {
  const clean = safe(value);
  return clean.length > width ? clean.slice(0, width - 3) + "..." : clean;
};
function fieldRows(fields, width, colored) {
  const result = [];
  let row = "", length = 0;
  for (const field of fields) {
    const clean = (field.swatch && AREA_GLYPHS.includes(field.swatch) ? `${field.swatch} ` : "") + safe(field.text);
    if (row && length + clean.length + 3 > width) {
      result.push(row);
      row = "";
      length = 0;
    }
    if (clean.length > width) {
      result.push(...wrap(clean, width).map((line) => colorize(line, field.role, colored)));
      continue;
    }
    if (row) {
      row += " | ";
      length += 3;
    }
    row += colorize(clean, field.role, colored);
    length += clean.length;
  }
  if (row) result.push(row);
  return result;
}
var BRAILLE_BITS = [1, 8, 2, 16, 4, 32, 64, 128];
var AREA_GLYPHS = ["\u2588", "\u2593", "\u2592", "\u2591", "\u259A", "\u259E"];
var PARTIAL_BLOCKS = ["", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587"];
var otherColor = 244;
var seriesColor = (data, model) => model ? data.modelColors.get(model) ?? modelColor(model) : otherColor;
var motionGeometry = /* @__PURE__ */ new WeakMap();
function geometryCache(data) {
  let cache = motionGeometry.get(data);
  if (!cache) {
    cache = {};
    motionGeometry.set(data, cache);
  }
  return cache;
}
var motionTime = (motion) => Number.isFinite(motion.elapsedMs) ? Math.max(0, motion.elapsedMs) : 0;
var revealProgress = (motion) => Number.isFinite(motion.reveal) ? Math.max(0, Math.min(1, motion.reveal)) : 1;
var modulo = (value, size) => (value % size + size) % size;
function emphasis(glyph, role, colored, strength) {
  let tone = role;
  if (strength > 0.65) {
    const code = typeof role === "number" ? role : roles[role];
    if (code >= 16 && code <= 231) {
      const value = code - 16;
      const red = Math.min(5, Math.floor(value / 36) + 1);
      const green = Math.min(5, Math.floor(value % 36 / 6) + 1);
      const blue = Math.min(5, value % 6 + 1);
      tone = 16 + red * 36 + green * 6 + blue;
    } else if (code >= 232) tone = Math.min(253, code + 3);
  }
  const painted = colorize(glyph, tone, colored);
  return !colored || strength <= 0 ? painted : `\x1B[${strength > 0.65 ? 1 : 2}m${painted}\x1B[22m`;
}
function rippleGlyph(owner, column, row, motion, ascii, colored) {
  const phase = column * 0.45 + row * 0.8 - motionTime(motion) * 27e-4 + owner * 0.9;
  const wave = Math.sin(phase);
  if (!colored && (column + row * 3) % 11 === 0) return ascii ? "ABCDEO"[owner] : AREA_GLYPHS[owner];
  if (ascii) return wave > 0.75 ? "#" : wave > 0.05 ? "=" : ".";
  return wave > 0.5 ? "\u2593" : wave > -0.15 ? "\u2592" : "\u2591";
}
function activityStack(data, options, columns) {
  if (!options.motion) return createActivityStack(data.days, options.metric === "cost" ? "cost" : "tokens", columns);
  const cache = geometryCache(data), key = `${columns}:${options.metric === "cost" ? "cost" : "tokens"}`;
  if (cache.activity?.key !== key) cache.activity = { key, stack: createActivityStack(data.days, options.metric === "cost" ? "cost" : "tokens", columns) };
  return cache.activity.stack;
}
function paintCells(cells, colored, combine) {
  if (!combine) return cells.map((cell) => colorize(cell.glyph, cell.role, colored)).join("");
  const runs = [];
  for (const cell of cells) {
    const previous = runs.at(-1);
    if (previous && previous.role === cell.role) previous.glyph += cell.glyph;
    else runs.push({ ...cell });
  }
  return runs.map((run) => colorize(run.glyph, run.role, colored)).join("");
}
function activityPlot(data, stack, options, width, rows) {
  if (!data.days.length) return ["No recorded dates to plot."];
  const axisWidth = 10, columns = width - axisWidth, isCost = options.metric === "cost";
  const cache = options.motion ? geometryCache(data).activity : void 0;
  const gridKey = `${columns}:${rows}:${options.ascii}`;
  const grid = cache?.gridKey === gridKey ? cache.grid : rasterActivityStack(stack, columns, rows, options.ascii ? 1 : 8);
  if (cache && cache.gridKey !== gridKey) {
    cache.gridKey = gridKey;
    cache.grid = grid;
  }
  const ticks = /* @__PURE__ */ new Set([0, Math.floor((rows - 1) / 2), rows - 1]);
  const output = grid.map((cells, row) => {
    const value = stack.maximum * (rows - 1 - row) / (rows - 1);
    const tick = !ticks.has(row) ? "" : isCost ? !stack.maximum ? "--" : value > 0 && value < 0.01 ? "<$0.01" : `$${abbreviated(value)}` : abbreviated(value);
    const marks = cells.map((cell, column) => {
      if (cell.owner < 0) return { glyph: ticks.has(row) && column % 3 === 0 ? options.ascii ? "." : "\xB7" : " " };
      const series = stack.series[cell.owner];
      const glyph = options.motion && (options.ascii || cell.filled === 8) ? rippleGlyph(cell.owner, column, row, options.motion, options.ascii, options.color) : options.ascii ? series.symbol : cell.filled < 8 ? PARTIAL_BLOCKS[cell.filled] : AREA_GLYPHS[cell.owner];
      return { glyph, role: seriesColor(data, series.model) };
    });
    return tick.padStart(axisWidth - 2) + (options.ascii ? " |" : " \u2502") + paintCells(marks, options.color, !!options.motion);
  });
  output.push(" ".repeat(axisWidth - 1) + (options.ascii ? "+" : "\u2514") + (options.ascii ? "-" : "\u2500").repeat(columns));
  const first = safe(data.days[0].date), last = safe(data.days.at(-1).date);
  if (data.days.length === 1) output.push(...wrap(`Date: ${first} UTC`, width));
  else if (first.length + last.length < columns) output.push(" ".repeat(axisWidth) + first + " ".repeat(columns - first.length - last.length) + last);
  else output.push(...wrap(`${first} to ${last} UTC`, width));
  return output;
}
function plot(data, options, width, rows) {
  const ascii = options.ascii, axisWidth = 10;
  rows = Math.max(rows, data.curves.length);
  const labels = data.curves.map((curve, owner) => {
    const value = curve.values.at(-1) ?? 0;
    const amount = roundedDollars(value);
    const text = `${curve.symbol} ${amount.length + 2 <= width - axisWidth - 12 ? amount : `$${abbreviated(value)}`}`;
    return { owner, value, text, row: 0 };
  }).sort((a, b) => b.value - a.value || a.owner - b.owner);
  const labelWidth = labels.length ? Math.max(...labels.map((label) => label.text.length)) + 2 : 0;
  const columns = width - axisWidth - labelWidth;
  const sx = ascii ? 1 : 2, sy = ascii ? 1 : 4;
  const pixelWidth = columns * sx, pixelHeight = rows * sy, count = data.days.length;
  if (!count) return ["No recorded dates to plot."];
  const series = data.curves.map((curve) => curve.values);
  let maximum = 0;
  for (const values of series) for (const value of values) maximum = Math.max(maximum, value);
  const cache = options.motion ? geometryCache(data) : void 0;
  const geometryKey = `${width}:${rows}:${ascii}`;
  const cached = cache?.cost?.key === geometryKey ? cache.cost.geometry : void 0;
  const grid = cached?.grid ?? Array.from({ length: rows }, () => Array.from({ length: columns }, () => ({ bits: 0, char: " ", owner: -1 })));
  const paths = cached?.paths ?? series.map(() => []);
  const xFor = (day) => count === 1 ? 0 : day / (count - 1) * (pixelWidth - 1);
  const yFor = (value) => maximum ? (1 - value / maximum) * (pixelHeight - 1) : pixelHeight - 1;
  for (const [index, label] of labels.entries()) {
    const desired = Math.floor(Math.round(yFor(label.value)) / sy);
    label.row = Math.max(index ? labels[index - 1].row + 1 : 0, Math.min(rows - labels.length + index, desired));
  }
  const put = (x, y, owner, char) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= pixelWidth || y < 0 || y >= pixelHeight) return;
    const position = Math.floor(y / sy) * columns + Math.floor(x / sx);
    if (paths[owner].at(-1) !== position) paths[owner].push(position);
    const cell = grid[Math.floor(y / sy)][Math.floor(x / sx)];
    const occupied = cell.bits !== 0 || cell.char !== " ";
    if (occupied && cell.owner !== owner) cell.owner = -2;
    else if (!occupied) cell.owner = owner;
    if (ascii) cell.char = cell.owner === -2 ? "+" : char;
    else cell.bits |= BRAILLE_BITS[y % 4 * 2 + x % 2];
  };
  const line = (x0, y0, x1, y1, owner) => {
    const length = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const char = Math.abs(y1 - y0) < 0.5 ? "_" : Math.abs(x1 - x0) < 0.5 ? "|" : y1 < y0 ? "/" : "\\";
    for (let step = 0; step <= length; step++) put(x0 + (x1 - x0) * step / length, y0 + (y1 - y0) * step / length, owner, char);
  };
  if (maximum && !cached) {
    series.forEach((values, owner) => {
      if (count === 1) put(0, yFor(values[0]), owner, "o");
      for (let day = 1; day < count; day++) line(xFor(day - 1), yFor(values[day - 1]), xFor(day), yFor(values[day]), owner);
      const row = Math.min(rows - 1, Math.max(0, Math.floor(Math.round(yFor(values[count - 1])) / sy)));
      const cell = grid[row][count === 1 ? 0 : columns - 1];
      cell.marker = cell.marker ? "@" : data.curves[owner].symbol;
      cell.owner = cell.marker === "@" ? -2 : owner;
    });
  }
  if (cache && !cached) cache.cost = { key: geometryKey, geometry: { grid, paths } };
  const tracers = /* @__PURE__ */ new Map();
  if (options.motion) for (const [owner, path] of paths.entries()) {
    if (path.length < 2) continue;
    const spacing = Math.max(8, Math.min(22, Math.ceil(path.length / 3)));
    const travel = motionTime(options.motion) / 95 + owner * spacing / Math.max(1, paths.length);
    for (const [index, position] of path.entries()) {
      const behind = modulo(travel - index, spacing);
      if (behind >= 4) continue;
      const strength = 1 - behind / 4;
      if (!tracers.has(position) || tracers.get(position).strength < strength) tracers.set(position, { owner, strength });
    }
  }
  const paint = (text, owner) => colorize(text, owner < 0 ? void 0 : seriesColor(data, data.curves[owner].model), options.color);
  const ticks = /* @__PURE__ */ new Set([0, Math.floor((rows - 1) / 2), rows - 1]);
  const output = grid.map((cells, row) => {
    const value = maximum * (rows - 1 - row) / (rows - 1);
    const tick = !ticks.has(row) ? "" : !maximum ? "--" : value > 0 && value < 0.01 ? "<$0.01" : `$${abbreviated(value)}`;
    const marks = cells.map((cell, column) => {
      if (cell.marker && !labels.some((label2) => label2.owner === cell.owner && label2.row === row)) return paint(cell.marker, cell.owner);
      if (cell.bits || cell.char !== " ") {
        const tracer = tracers.get(row * columns + column);
        let glyph = cell.bits ? String.fromCharCode(10240 + cell.bits) : cell.char === "+" ? "+" : ".";
        if (tracer) {
          if (ascii) glyph = tracer.strength > 0.65 ? "o" : "=";
          else if (!options.color && tracer.strength > 0.65) glyph = String.fromCharCode(10240 + (cell.bits & -cell.bits));
          return emphasis(glyph, seriesColor(data, data.curves[tracer.owner].model), options.color, tracer.strength);
        }
        return ascii && options.color && cell.owner >= 0 ? emphasis(glyph, seriesColor(data, data.curves[cell.owner].model), true, 0.1) : paint(glyph, cell.owner);
      }
      return ticks.has(row) && column % 3 === 0 ? ascii ? "." : "\xB7" : " ";
    }).join("");
    const label = labels.find((label2) => label2.row === row);
    return tick.padStart(axisWidth - 2) + (ascii ? " |" : " \u2502") + marks + (label ? "  " + paint(label.text, label.owner) : "");
  });
  output.push(" ".repeat(axisWidth - 1) + (ascii ? "+" : "\u2514") + (ascii ? "-" : "\u2500").repeat(columns));
  const first = safe(data.days[0].date), last = safe(data.days[count - 1].date);
  if (count === 1) output.push(...wrap(`Date: ${first} UTC`, width));
  else if (first.length + last.length < columns) output.push(" ".repeat(axisWidth) + first + " ".repeat(columns - first.length - last.length) + last);
  else output.push(...wrap(`${first} to ${last} UTC`, width));
  return output;
}
function renderInspector(data, options) {
  const width = Math.max(40, Math.min(240, Number.isFinite(options.width) ? Math.floor(options.width) : 100));
  const page = Math.max(0, Math.min(INSPECTOR_PAGES.length - 1, Number.isFinite(options.page) ? Math.floor(options.page) : 0));
  const totals = data.analytics.totals, header = [], body = [];
  const paint = (value, role) => colorize(value, role, options.color);
  const text = (value = "", role) => body.push(...wrap(value, width).map((line) => paint(line, role)));
  const fields = (items) => body.push(...fieldRows(items, width, options.color));
  const pair = (label, value, valueRole, labelRole) => {
    const left = safe(label), right = safe(value);
    if (left.length + right.length + 2 <= width) body.push(paint(left, labelRole) + " ".repeat(width - left.length - right.length) + paint(right, valueRole));
    else {
      text(left, labelRole);
      text(right, valueRole);
    }
  };
  const heading = (title, subtitle) => {
    text(title, "heading");
    text(subtitle);
    text();
  };
  const bar = (value, maximum, role, label, amount, variant, index = 0) => {
    pair(label, amount, role, role);
    const columns = width - 2, length = maximum ? Math.round(value / maximum * columns) : 0;
    const size = Math.min(columns, Math.max(value > 0 ? 1 : 0, length));
    const tiny = value > 0 && !length;
    for (let row = 0; row < 2; row++) {
      const cells = Array.from({ length: size }, (_, column) => {
        const glyph = tiny ? "." : options.ascii ? variant === "rails" ? ":" : "#" : variant === "flip" ? "\u2588" : "\u2501";
        if (!options.motion || tiny) return { glyph };
        if (variant === "rails") {
          const perimeter = size * 2;
          const position = row === 0 ? column : perimeter - 1 - column;
          const head = motionTime(options.motion) / 80 + index * 9;
          const lag = modulo(head - position, perimeter);
          const tail = Math.min(4, Math.max(1, size / 2));
          if (lag >= tail) return { glyph };
          const strength = 1 - lag / tail;
          const spark = options.ascii ? strength > 0.65 ? "*" : "o" : strength > 0.65 ? "\u25CF" : "\u2022";
          return { glyph: spark, strength };
        }
        const progress = revealProgress(options.motion);
        if (progress >= 1) return { glyph };
        const start = (columns > 1 ? column / (columns - 1) : 0) * 0.58 + row * 0.11 + index * 0.08;
        const phase = (progress - start) / 0.22;
        const flipping = phase < 0 ? "." : phase < 0.3 ? "/" : phase < 0.65 ? options.ascii ? "o" : "\u25CB" : phase < 1 ? options.ascii ? "=" : "\u25B0" : glyph;
        return { glyph: flipping, strength: phase >= 0 && phase < 1 ? 0.85 : void 0 };
      });
      let marks = "", ordinary = "";
      for (const cell of cells) {
        if (cell.strength === void 0) ordinary += cell.glyph;
        else {
          if (ordinary) {
            marks += paint(ordinary, role);
            ordinary = "";
          }
          marks += emphasis(cell.glyph, role, options.color, cell.strength);
        }
      }
      if (ordinary) marks += paint(ordinary, role);
      body.push("  " + marks);
    }
  };
  header.push(paint("CODEX COST / LOCAL ANALYTICS", "heading"));
  header.push(...wrap(data.days.length ? `${data.days[0].date} to ${data.days.at(-1).date} / UTC` : "No recorded dates / UTC", width));
  header.push(...fieldRows([{ text: `TOKENS ${exact(totals.totalTokens)}` }, { text: `API EQUIVALENT ${cost(totals, true)}`, role: totals.unpricedTokens && !totals.pricedTokens ? "warning" : "cost" }], width, options.color));
  header.push(...fieldRows([{ text: `INPUT ${exact(totals.inputTokens)}`, role: "input" }, { text: `CACHED ${exact(totals.cachedInputTokens)}`, role: "cached" }, { text: `OUTPUT ${exact(totals.outputTokens)}`, role: "output" }], width, options.color));
  header.push(...fieldRows([{ text: `UNPRICED ${exact(totals.unpricedTokens)}`, role: totals.unpricedTokens ? "warning" : void 0 }, { text: `${exact(data.analytics.sessions)} SESSIONS` }, { text: `${data.models.length} MODELS` }], width, options.color));
  header.push((options.ascii ? "-" : "\u2500").repeat(width));
  const bodyHeight = Math.max(8, (Number.isFinite(options.height) ? Math.floor(options.height) : 32) - header.length);
  const chartRows = (overhead) => Math.max(4, Math.min(16, bodyHeight - overhead));
  if (page === 0) {
    const isCost = options.metric === "cost", stack = activityStack(data, options, width - 10);
    const unit = isCost ? "API-equivalent USD" : "tokens";
    heading("ACTIVITY / CONTOUR CURRENTS", `${stack.daysPerBucket > 1 ? "Bucket" : "Daily"} ${unit} / stacked by model${isCost && totals.unpricedTokens ? " / partial estimate" : ""}`);
    fields([{ text: isCost ? "Y AXIS: API $" : "Y AXIS: TOKENS", role: isCost ? "cost" : "input" }, { text: "m switches tokens / API $" }]);
    const legend = stack.series.map((series, index) => ({ text: `${series.symbol} ${series.model ? shorten(series.label, 24) : `Other (${series.count})`}`, role: seriesColor(data, series.model), swatch: options.ascii ? void 0 : AREA_GLYPHS[index] }));
    const legendRows = fieldRows(legend, width, options.color);
    body.push(...legendRows);
    if (isCost && !stack.maximum) text(totals.unpricedTokens ? "No priced usage to plot. Unpriced does not mean free." : "No priced cost recorded.", totals.unpricedTokens ? "warning" : void 0);
    body.push(...activityPlot(data, stack, options, width, chartRows(10 + legendRows.length)));
    if (stack.daysPerBucket > 1) text(`Consecutive ${stack.daysPerBucket}-day bucket sums; the final bucket has ${stack.buckets.at(-1)?.days ?? 0} day(s). Y values are per bucket.`);
    else text("Each band is one model; the top edge is the daily total.");
    text("Very thin bands may be smaller than a terminal cell.");
    if (isCost && totals.unpricedTokens) text(`${exact(totals.unpricedTokens)} unpriced tokens are excluded from dollar estimates.`, "warning");
    text();
    const activeDays = data.days.filter((day) => day.totalTokens > 0).length;
    fields([{ text: `${activeDays} active days` }, { text: isCost ? `${cost(totals, true)} / range estimate` : `${exact(activeDays ? totals.totalTokens / activeDays : 0)} tokens / active day`, role: isCost ? "cost" : void 0 }]);
    text();
    text("MODEL BANDS / RANGE TOTALS", "heading");
    if (!stack.series.length && !isCost) text("No models recorded.");
    for (const series of stack.series) pair(`${series.symbol} ${series.label}`, `${isCost ? dollars(series.total) : abbreviated(series.total) + " tokens"} / ${percent(series.total, isCost ? totals.estimatedApiCost : totals.totalTokens)}`, seriesColor(data, series.model), seriesColor(data, series.model));
    if (stack.series.some((series) => !series.model)) text("Other combines the remaining models; all exact totals are on the Models page.");
    if (isCost) text("Published API rates, not your Codex subscription bill.");
  } else if (page === 1) {
    heading("CUMULATIVE COST / SIGNAL DASHES", "Each curve is one model / API-equivalent USD");
    const legend = data.curves.map((curve) => ({ text: `${curve.symbol} ${curve.model ? shorten(curve.label, Math.min(24, width - 3)) : `Other (${curve.count})`}`, role: seriesColor(data, curve.model) }));
    const legendRows = fieldRows(legend, width, options.color);
    body.push(...legendRows);
    if (!data.curves.length) text(totals.unpricedTokens ? "No priced usage to plot. Unpriced does not mean free." : "No priced cost recorded.", totals.unpricedTokens ? "warning" : void 0);
    body.push(...plot(data, options, width, chartRows(6 + legendRows.length)));
    text();
    pair("Range API-equivalent estimate", cost(totals), "cost");
    const other = data.curves.find((curve) => curve.symbol === "O");
    if (other) text(`O combines ${other.count} models; all appear on the Models page.`);
    if (data.curves.length) text("Right labels show final API amounts, spaced for readability. Letters match the curves; @ marks overlapping endpoints.");
    if (totals.unpricedTokens) text(`${exact(totals.unpricedTokens)} unpriced tokens are excluded from dollar estimates.`, "warning");
    text("Published API rates, not your Codex subscription bill.");
    pair("Pricing checked", data.analytics.pricingCheckedAt);
  } else if (page === 2) {
    heading("YOUR MODELS / SPARK RAILS", "Ranked by total tokens / the entire selected range");
    const maximum = data.models[0]?.totalTokens ?? 0;
    if (!data.models.length) text("No models recorded.");
    for (const [index, model] of data.models.entries()) {
      bar(model.totalTokens, maximum, seriesColor(data, model.model), `${index + 1}. ${model.model}`, `${abbreviated(model.totalTokens)} tokens / ${percent(model.totalTokens, totals.totalTokens)} | API ${cost(model, true)}`, "rails", index);
      text();
    }
    if (data.models.length) text("Bars share one scale, relative to the leading model.");
    text();
    text("EXACT RANGE TOTALS", "heading");
    for (const model of data.models) {
      text();
      text(model.model, seriesColor(data, model.model));
      fields([{ text: `Input ${exact(model.inputTokens)}`, role: "input" }, { text: `Cached ${exact(model.cachedInputTokens)}`, role: "cached" }, { text: `Output ${exact(model.outputTokens)}`, role: "output" }]);
      fields([{ text: `Tokens ${exact(model.totalTokens)}` }, { text: `API ${cost(model)}`, role: model.unpricedTokens && !model.pricedTokens ? "warning" : "cost" }]);
      if (model.unpricedTokens) text(`${exact(model.unpricedTokens)} unpriced tokens excluded from this estimate.`, "warning");
    }
  } else if (page === 3) {
    heading("TOKEN MIX / SORTING MACHINE", "How every token in this range was used");
    const mix = [
      { symbol: "I", glyph: "\u2593", label: "Input (uncached)", value: totals.inputTokens, role: "input" },
      { symbol: "C", glyph: "\u2592", label: "Cached input", value: totals.cachedInputTokens, role: "cached" },
      { symbol: "O", glyph: "\u2591", label: "Output", value: totals.outputTokens, role: "output" }
    ];
    const columns = width - 2;
    const raw = mix.map((item) => totals.totalTokens ? item.value / totals.totalTokens * columns : 0);
    const lengths = raw.map(Math.floor);
    const order = raw.map((value, index) => ({ index, fraction: value - lengths[index] })).sort((a, b) => b.fraction - a.fraction);
    const left = totals.totalTokens ? columns - lengths.reduce((sum, value) => sum + value, 0) : 0;
    for (let index = 0; index < left; index++) lengths[order[index % order.length].index]++;
    const chuteRows = 7, middle = Math.floor(columns / 2);
    const sorter = Array.from({ length: chuteRows }, () => Array.from({ length: width }, () => ({ glyph: " " })));
    const put = (column, row, glyph, role) => {
      if (row >= 0 && row < chuteRows && column >= 0 && column < width) sorter[row][column] = { glyph, role };
    };
    for (const [offset, glyph] of [..."TOKENS"].entries()) put(middle - 2 + offset, 0, glyph);
    for (const [offset, glyph] of [..."\\___/"].entries()) put(middle - 1 + offset, 2, glyph);
    put(middle + 1, 3, "|");
    let segmentStart = 0;
    for (const [index, item] of mix.entries()) {
      const size = lengths[index];
      const destination = 1 + segmentStart + Math.max(0, Math.floor((size - 1) / 2));
      if (size && options.motion) for (let token = 0; token < 3; token++) {
        const fall = modulo(motionTime(options.motion) / 3400 + token / 3 + index * 0.17, 1);
        if (fall < 0.22) put(middle + 1, 1, options.ascii ? options.color ? "." : item.symbol : "\u2022", item.role);
        else {
          const progress = (fall - 0.22) / 0.78;
          const row = Math.min(chuteRows - 1, 3 + Math.floor(progress * (chuteRows - 3)));
          const column = row === chuteRows - 1 ? destination : Math.round(middle + 1 + (destination - middle - 1) * progress);
          put(column, row, options.ascii ? options.color ? "o" : item.symbol : "\u25CF", item.role);
        }
      }
      segmentStart += size;
    }
    for (const row of sorter) body.push(paintCells(row, options.color, true));
    const ribbon = mix.map((item, index) => paint((options.ascii ? options.color ? "#" : item.symbol : item.glyph).repeat(lengths[index]), item.role)).join("");
    for (let row = 0; row < (bodyHeight >= 18 ? 3 : 2); row++) body.push("[" + (totals.totalTokens ? ribbon : " ".repeat(columns)) + "]");
    text();
    for (const item of mix) {
      pair(`${item.symbol} ${item.label}`, `${exact(item.value)} / ${percent(item.value, totals.totalTokens)}`, item.role, item.role);
      text();
    }
    pair("Cache hit rate", `${percent(totals.cachedInputTokens, totals.inputTokens + totals.cachedInputTokens)} of input`, "cached");
    text("Cache hit rate uses input + cached input. Mix percentages use all tokens.");
    text();
    text("Input is uncached; cached input is counted once. Reasoning is already included in output.");
    text("Motion illustrates sorting; ribbon widths show the actual token shares.");
    text("Very small shares can disappear at character-cell resolution.");
  } else if (page === 4) {
    heading("GPT-3 ERA / FLIP-DOT WALL", "Your whole range, priced as a 2020 thought experiment");
    const historical = calculateGpt3EraCost(totals.totalTokens);
    const maximum = Math.max(historical, totals.estimatedApiCost);
    const axisWidth = 10, columns = width - axisWidth, gap = 4;
    const barWidth = Math.floor((columns - gap) / 2);
    const rows = Math.max(4, Math.min(12, bodyHeight - 10));
    const unpriced = !!totals.unpricedTokens && !totals.pricedTokens;
    const walls = [
      { label: "CURRENT API", value: unpriced ? 0 : totals.estimatedApiCost, amount: unpriced ? "Unpriced" : roundedDollars(totals.estimatedApiCost), role: unpriced ? "warning" : "cost" },
      { label: "GPT-3 / 2020", value: historical, amount: roundedDollars(historical), role: "historical" }
    ];
    const labels = (values) => " ".repeat(axisWidth) + values.map((value, index) => paint(shorten(value, barWidth).padEnd(barWidth), walls[index].role)).join(" ".repeat(gap));
    body.push(labels(walls.map((wall) => wall.label)));
    body.push(labels(walls.map((wall) => wall.amount.length <= barWidth ? wall.amount : `$${abbreviated(wall.value)}`)));
    for (let row = 0; row < rows; row++) {
      const fromBottom = rows - row - 1;
      const value = maximum * (rows - row) / rows;
      const tick = row === 0 || row === Math.floor(rows / 2) ? value > 0 && value < 0.01 ? "<$0.01" : `$${abbreviated(value)}` : "";
      const marks = walls.map((wall, index) => {
        const height = maximum ? Math.round(wall.value / maximum * rows) : 0;
        const tiny = wall.value > 0 && height === 0;
        const cells = Array.from({ length: barWidth }, (_, column) => {
          if (tiny) return { glyph: fromBottom === 0 && column === Math.floor(barWidth / 2) ? "." : " ", role: wall.role };
          if (fromBottom >= height) return { glyph: " " };
          const finalGlyph = options.ascii ? "#" : "\u2588";
          const progress = options.motion ? revealProgress(options.motion) : 1;
          if (progress >= 1) return { glyph: finalGlyph, role: wall.role };
          const start = fromBottom / Math.max(1, rows - 1) * 0.32 + column / Math.max(1, barWidth - 1) * 0.26 + index * 0.06;
          const phase = (progress - start) / 0.22;
          const glyph = phase < 0 ? "." : phase < 0.3 ? "/" : phase < 0.65 ? options.ascii ? "o" : "\u25CB" : phase < 1 ? options.ascii ? "=" : "\u25B0" : finalGlyph;
          return { glyph, role: wall.role };
        });
        return paintCells(cells, options.color, true);
      }).join(" ".repeat(gap));
      body.push(tick.padStart(axisWidth - 2) + (options.ascii ? " |" : " \u2502") + marks);
    }
    body.push("$0".padStart(axisWidth - 2) + (options.ascii ? " +" : " \u2514") + (options.ascii ? "-" : "\u2500").repeat(columns));
    text("Both bars use the same dollar scale. A dot means a nonzero amount smaller than one vertical cell.");
    text();
    pair("Historical scenario / exact", dollars(historical), "historical");
    pair("Current API estimate / exact", cost(totals), totals.unpricedTokens && !totals.pricedTokens ? "warning" : "cost");
    text(`${exact(totals.totalTokens)} tokens x $${GPT3_ERA_PRICING.usdPerMillion} per million.`, "historical");
    text(GPT3_ERA_PRICING.basis);
    text();
    text("All models count, including unpriced usage; cached tokens use the full historical rate.");
    text("Modern token counts stay fixed. Reasoning is already included in output.");
    text("A token-volume comparison, not equivalent capabilities. Excludes plan fees, included tokens and inflation.");
    if (totals.unpricedTokens) text(`Current estimate excludes ${exact(totals.unpricedTokens)} unpriced tokens.`, "warning");
  } else if (page === 5) {
    heading("COST BY REPO / CHEVRON CONVEYOR", "Total API-equivalent USD / the entire selected range");
    pair("Range API-equivalent estimate", cost(totals, true), totals.unpricedTokens && !totals.pricedTokens ? "warning" : "cost");
    text();
    const maximum = data.repos.reduce((largest, repo) => repo.unpricedTokens && !repo.pricedTokens ? largest : Math.max(largest, repo.estimatedApiCost), 0);
    const columns = width - 2, elapsed = options.motion ? motionTime(options.motion) : 0;
    if (!data.repos.length) text("No repos or directories recorded.");
    for (const [index, repo] of data.repos.entries()) {
      const unpriced = !!repo.unpricedTokens && !repo.pricedTokens;
      const role = modelColor(repo.project);
      pair(`${index + 1}. ${repo.project}`, `API ${cost(repo, true)}`, unpriced ? "warning" : role, role);
      const value = unpriced ? 0 : repo.estimatedApiCost;
      const length = maximum ? Math.round(value / maximum * columns) : 0;
      const size = Math.min(columns, Math.max(0, length));
      const tiny = value > 0 && !size;
      for (let row = 0; row < 3; row++) {
        const marks = tiny ? row === 1 ? "." : "" : Array.from({ length: size }, (_, column) => modulo(column - elapsed * 6e-3 + index * 2 - row, 9) < 2 ? ">" : ".").join("");
        const runs = marks.match(/>+|\.+/g) ?? [];
        body.push(" " + runs.map((run) => options.color && !tiny && run[0] === "." ? `\x1B[2m${paint(run, role)}\x1B[22m` : paint(run, role)).join(""));
      }
    }
    if (maximum > 0) {
      const labels = ["$0", roundedDollars(maximum / 2), roundedDollars(maximum)];
      if (labels.reduce((sum, label) => sum + label.length, 0) + 4 > columns) {
        labels[1] = `$${abbreviated(maximum / 2)}`;
        labels[2] = `$${abbreviated(maximum)}`;
      }
      const axis = Array(columns).fill(" ");
      const positions = [0, Math.max(labels[0].length + 1, Math.min(Math.round(columns / 2) - Math.floor(labels[1].length / 2), columns - labels[2].length - labels[1].length - 1)), columns - labels[2].length];
      labels.forEach((label, index) => [...label].forEach((glyph, offset) => {
        axis[positions[index] + offset] = glyph;
      }));
      body.push(" " + paint(axis.join(""), "cost"));
      text();
      text("Bars share one dollar scale. A dot marks a nonzero cost smaller than one cell.");
    } else if (data.repos.length) text(totals.unpricedTokens ? "No priced usage to plot. Unpriced does not mean free." : "No priced cost recorded.", totals.unpricedTokens ? "warning" : void 0);
    text();
    if (totals.unpricedTokens) text(`${exact(totals.unpricedTokens)} unpriced tokens are excluded from dollar estimates.`, "warning");
    text("Grouped by available repo or directory names; same-name roots may be combined.");
    text("Published API rates, not your Codex subscription bill.");
  }
  if (!data.analytics.source.found) {
    text();
    text("Local history directory was not found. Use --data-dir to select your history.", "warning");
  }
  if (data.analytics.source.warnings.length) {
    text();
    for (const warning of data.analytics.source.warnings) text(`! ${warning}`, "warning");
  }
  return { header, body };
}

// src/terminal/inspector.ts
function sameWindowHint() {
  const script = process.argv[1] ?? "scripts/codex-cost.mjs";
  const launcher = script.replace(/codex-cost\.mjs$/, "inspect.sh");
  const command = launcher === script ? `node ${JSON.stringify(script)} --inspect --color` : `/bin/sh ${JSON.stringify(launcher)}`;
  return [
    "For the animated dashboard, run it in this same terminal window:",
    "  1. Press Ctrl+Z to suspend your CLI agent and wait for the shell prompt.",
    `  2. Run: ${command}`,
    "  3. Press q to quit the dashboard, then run fg to resume.",
    "Do not open a new terminal window for this."
  ].join("\n");
}
async function runInspector(analytics, options = {}, io = { input: process.stdin, output: process.stdout, signals: process }) {
  const { input, output, signals } = io;
  const manageScreen = io.manageScreen !== false;
  if (!input.isTTY || !output.isTTY || process.env.TERM === "dumb") {
    output.write(renderTerminal(analytics, { width: options.width ?? output.columns ?? 100, ascii: true, color: false, details: options.details, metric: options.metric }));
    output.write(`
${sameWindowHint()}
`);
    return;
  }
  const data = createInspectorData(analytics);
  const clock = io.clock ?? {
    now: () => performance.now(),
    every: (callback, milliseconds) => {
      const timer = setInterval(callback, milliseconds);
      return () => clearInterval(timer);
    }
  };
  let page = 0, scroll = 0, ascii = !!options.ascii, closed = false;
  let metric = options.metric ?? "tokens";
  let playing = !options.noMotion, elapsedMs = 0, lastTick = clock.now();
  const entranceDuration = () => page === 4 ? 1600 : 650;
  let motionStarted = playing;
  let cancelFrames;
  let canAnimate = false;
  let previous = [], maxScroll = 0, visibleBodyRows = 1;
  const wasRaw = input.isRaw, wasFlowing = input.readableFlowing === true;
  let color = !options.noColor && (!!options.color || process.env.NO_COLOR === void 0);
  return new Promise((resolve, reject) => {
    const restore = () => {
      if (closed) return;
      closed = true;
      cancelFrames?.();
      cancelFrames = void 0;
      input.off("keypress", onKey);
      input.off("end", onEnd);
      input.off("error", onError);
      output.off("resize", onResize);
      output.off("error", onError);
      signals.off("SIGINT", onEnd);
      signals.off("SIGTERM", onEnd);
      signals.off("exit", restore);
      try {
        input.setRawMode(wasRaw ?? false);
      } finally {
        if (!wasFlowing) input.pause();
        if (manageScreen) output.write("\x1B[0m\x1B[?25h\x1B[?1049l");
      }
    };
    const finish = (error) => {
      try {
        restore();
      } catch (cleanupError) {
        error ??= cleanupError;
      }
      if (error) reject(error);
      else resolve();
    };
    const onEnd = () => finish();
    const onError = (error) => finish(error);
    const draw = () => {
      if (closed) return;
      canAnimate = false;
      const terminalWidth = output.columns || 80, height = Math.max(1, output.rows || 24);
      const width = Math.max(1, Math.min(160, terminalWidth - 1, options.width ?? 160));
      let lines;
      if (width < 40 || height < 16) {
        lines = ["CODEX COST / DASHBOARD", "Enlarge to at least 41 columns x 16 rows.", "q quit"].map((line) => line.slice(0, width));
      } else {
        const hints = ["Left/Right charts", `1-${INSPECTOR_PAGES.length} jump`, "Up/Down scroll", ...page === 0 ? ["m Tokens/API $"] : [], "Space pause", "r replay", "a glyphs", "c color", "q quit"];
        const controls = [];
        for (const hint of hints) {
          const last = controls.length - 1;
          if (last >= 0 && controls[last].length + hint.length + 3 <= width) controls[last] += ` | ${hint}`;
          else controls.push(hint);
        }
        const paint = (text, tone = 25) => color ? inspectorPaint(text, tone) : text;
        const tabNames = ["Activity", "Cost", "Models", "Mix", "GPT-3", "Repos"];
        const tabs = tabNames.map((name, i) => i === page ? `[${i + 1} ${name}]` : ` ${i + 1} ${name} `);
        const navigation = tabs.join(" ").length <= width ? tabs.map((tab, i) => i === page ? paint(tab) : tab).join(" ") : paint(`< ${page + 1}/${INSPECTOR_PAGES.length} ${INSPECTOR_PAGES[page]} >`);
        const render = () => renderInspector(data, {
          page,
          width,
          ascii,
          color,
          metric,
          height: height - controls.length - 2,
          motion: motionStarted ? { elapsedMs, reveal: Math.min(1, elapsedMs / entranceDuration()) } : void 0
        });
        let frame = render();
        if (height - frame.header.length - controls.length - 2 < 8) {
          controls.splice(0, controls.length, "L/R charts | Space pause | q quit");
          frame = render();
        }
        visibleBodyRows = height - frame.header.length - controls.length - 2;
        if (visibleBodyRows < 8) {
          lines = ["CODEX COST / DASHBOARD", `Enlarge to at least ${frame.header.length + 11} rows.`, "q quit"].map((line) => line.slice(0, width));
        } else {
          canAnimate = true;
          maxScroll = Math.max(0, frame.body.length - visibleBodyRows);
          scroll = Math.max(0, Math.min(scroll, maxScroll));
          const body = frame.body.slice(scroll, scroll + visibleBodyRows);
          while (body.length < visibleBodyRows) body.push("");
          const status = `PAGE ${page + 1}/${INSPECTOR_PAGES.length} | ${ascii ? "ASCII" : page === 0 ? "FILLED" : "BRAILLE"} | ${color ? "COLOR" : "MONO"} | ${playing ? "MOTION" : "PAUSED"}${page === 0 ? ` | ${metric === "cost" ? "API $" : "TOKENS"}` : ""}${maxScroll ? ` | scroll ${scroll + 1}/${maxScroll + 1}` : ""}`;
          lines = [...frame.header, navigation, ...body, paint(status.slice(0, width), 97), ...controls.map((line) => paint(line.slice(0, width)))];
        }
      }
      lines = lines.slice(0, height);
      let update = "";
      for (let row = 0; row < Math.min(height, Math.max(lines.length, previous.length)); row++) {
        if (lines[row] !== previous[row]) update += `\x1B[${row + 1};1H${lines[row] ?? ""}\x1B[K`;
      }
      if (update) output.write(update);
      previous = lines;
    };
    const safelyDraw = () => {
      try {
        draw();
      } catch (error) {
        finish(error);
      }
    };
    const syncFrames = () => {
      cancelFrames?.();
      cancelFrames = void 0;
      lastTick = clock.now();
      const width = Math.min(160, (output.columns || 80) - 1, options.width ?? 160);
      if (closed || !canAnimate || !playing || scroll > 0 || width < 40 || (output.rows || 24) < 16) return;
      if (page === 1 ? !data.curves.length : page === 0 && metric === "cost" ? !analytics.totals.estimatedApiCost : !analytics.totals.totalTokens) return;
      if (page === 5 && !data.repos.some((repo) => repo.estimatedApiCost > 0)) return;
      if (page === 4 && elapsedMs >= entranceDuration()) return;
      cancelFrames = clock.every(() => {
        const now = clock.now(), delta = Math.max(0, Math.min(100, now - lastTick));
        lastTick = now;
        if (closed || output.writableNeedDrain) return;
        elapsedMs += delta;
        safelyDraw();
        if (!closed && page === 4 && elapsedMs >= entranceDuration()) {
          cancelFrames?.();
          cancelFrames = void 0;
        }
      }, 50);
    };
    const onResize = () => {
      try {
        output.write("\x1B[2J");
        previous = [];
        draw();
        syncFrames();
      } catch (error) {
        finish(error);
      }
    };
    const onKey = (text, key = {}) => {
      if (closed) return;
      if (key.name === "q" || key.name === "escape" || key.ctrl && ["c", "d"].includes(key.name ?? "")) {
        finish();
        return;
      }
      const select = (next) => {
        page = (next + INSPECTOR_PAGES.length) % INSPECTOR_PAGES.length;
        scroll = 0;
        elapsedMs = playing ? 0 : entranceDuration();
      };
      const move = (amount) => select(page + amount);
      if (key.name === "left" || key.name === "h") move(-1);
      else if (key.name === "right" || key.name === "l") move(1);
      else if (key.name === "home") select(0);
      else if (key.name === "end") select(INSPECTOR_PAGES.length - 1);
      else if (/^[1-9]$/.test(key.name ?? text ?? "") && Number(key.name ?? text) <= INSPECTOR_PAGES.length) select(Number(key.name ?? text) - 1);
      else if (key.name === "up" || key.name === "k") scroll--;
      else if (key.name === "down" || key.name === "j") scroll++;
      else if (key.name === "pageup") scroll -= visibleBodyRows;
      else if (key.name === "pagedown") scroll += visibleBodyRows;
      else if (key.name === "m" && page === 0) {
        metric = metric === "tokens" ? "cost" : "tokens";
        scroll = 0;
        elapsedMs = playing ? 0 : entranceDuration();
      } else if (key.name === "space" || text === " ") {
        playing = !playing;
        motionStarted ||= playing;
      } else if (key.name === "r") {
        scroll = 0;
        elapsedMs = playing ? 0 : entranceDuration();
      } else if (key.name === "a") ascii = !ascii;
      else if (key.name === "c") color = !color;
      else return;
      safelyDraw();
      syncFrames();
    };
    try {
      emitKeypressEvents(input);
      input.setRawMode(true);
      input.on("keypress", onKey);
      input.once("end", onEnd);
      input.once("error", onError);
      output.on("resize", onResize);
      output.once("error", onError);
      signals.once("SIGINT", onEnd);
      signals.once("SIGTERM", onEnd);
      signals.once("exit", restore);
      if (manageScreen) output.write("\x1B[?1049h\x1B[?25l\x1B[2J");
      input.resume();
      safelyDraw();
      syncFrames();
    } catch (error) {
      finish(error);
    }
  });
}

export {
  runInspector
};

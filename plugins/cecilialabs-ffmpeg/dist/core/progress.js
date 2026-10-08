function optionalNumber(value) {
    if (value === undefined || value === "N/A")
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function toSnapshot(values) {
    const frame = optionalNumber(values["frame"]);
    const fps = optionalNumber(values["fps"]);
    const stream0_0Q = optionalNumber(values["stream_0_0_q"]);
    const totalSize = optionalNumber(values["total_size"]);
    const outTimeUs = optionalNumber(values["out_time_us"]);
    const outTimeMs = optionalNumber(values["out_time_ms"]);
    const dupFrames = optionalNumber(values["dup_frames"]);
    const dropFrames = optionalNumber(values["drop_frames"]);
    const bitrate = values["bitrate"];
    const outTime = values["out_time"];
    const speed = values["speed"];
    return {
        ...(frame !== undefined ? { frame } : {}),
        ...(fps !== undefined ? { fps } : {}),
        ...(stream0_0Q !== undefined ? { stream0_0Q } : {}),
        ...(bitrate !== undefined ? { bitrate } : {}),
        ...(totalSize !== undefined ? { totalSize } : {}),
        ...(outTimeUs !== undefined ? { outTimeUs } : {}),
        ...(outTimeMs !== undefined ? { outTimeMs } : {}),
        ...(outTime !== undefined ? { outTime } : {}),
        ...(dupFrames !== undefined ? { dupFrames } : {}),
        ...(dropFrames !== undefined ? { dropFrames } : {}),
        ...(speed !== undefined ? { speed } : {}),
        progress: values["progress"] ?? "continue",
        raw: { ...values },
    };
}
export function parseClockSeconds(value) {
    if (!value)
        return undefined;
    if (/^\d+(?:\.\d+)?$/.test(value)) {
        const direct = Number(value);
        return Number.isFinite(direct) ? direct : undefined;
    }
    const match = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value);
    if (!match)
        return undefined;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (![hours, minutes, seconds].every(Number.isFinite))
        return undefined;
    return hours * 3600 + minutes * 60 + seconds;
}
export function parseSpeedMultiplier(value) {
    if (!value)
        return undefined;
    const normalized = value.endsWith("x") ? value.slice(0, -1) : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function processedSeconds(snapshot) {
    if (snapshot.outTimeUs !== undefined)
        return snapshot.outTimeUs / 1_000_000;
    if (snapshot.outTimeMs !== undefined)
        return snapshot.outTimeMs / 1_000_000;
    return parseClockSeconds(snapshot.outTime);
}
export function deriveProgressEvent(runId, snapshot, options = {}) {
    const processed = processedSeconds(snapshot);
    const speedMultiplier = parseSpeedMultiplier(snapshot.speed);
    const totalSeconds = options.duration?.seconds;
    const ended = snapshot.progress === "end";
    const percentage = totalSeconds !== undefined && processed !== undefined
        ? (ended ? 100 : Math.max(0, Math.min(100, (processed / totalSeconds) * 100)))
        : undefined;
    const etaSeconds = ended
        ? (totalSeconds !== undefined ? 0 : undefined)
        : totalSeconds !== undefined && processed !== undefined && speedMultiplier !== undefined
            ? Math.max(0, (totalSeconds - processed) / speedMultiplier)
            : undefined;
    return {
        runId,
        state: ended ? "end" : "continue",
        estimated: options.duration?.estimated ?? false,
        ...(options.source !== undefined ? { source: options.source } : {}),
        ...(snapshot.frame !== undefined ? { frame: snapshot.frame } : {}),
        ...(snapshot.fps !== undefined ? { fps: snapshot.fps } : {}),
        ...(speedMultiplier !== undefined ? { speedMultiplier } : {}),
        ...(processed !== undefined ? { processedSeconds: processed } : {}),
        ...(totalSeconds !== undefined ? { totalSeconds } : {}),
        ...(percentage !== undefined ? { percentage } : {}),
        ...(etaSeconds !== undefined ? { etaSeconds } : {}),
    };
}
export function inputSources(args) {
    const sources = [];
    for (let index = 0; index < args.length - 1; index += 1) {
        if (args[index] === "-i")
            sources.push(args[index + 1]);
    }
    return sources;
}
function outputScopedTime(args, option) {
    let lastInputIndex = -1;
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === "-i")
            lastInputIndex = index;
    }
    for (let index = args.length - 2; index > lastInputIndex; index -= 1) {
        if (args[index] === option)
            return parseClockSeconds(args[index + 1]);
    }
    return undefined;
}
function firstSeekSeconds(args) {
    const index = args.indexOf("-ss");
    return index >= 0 ? parseClockSeconds(args[index + 1]) : undefined;
}
function speedFactor(args) {
    for (const value of args) {
        const match = /setpts=PTS\/([0-9]+(?:\.[0-9]+)?)/.exec(value);
        if (match?.[1]) {
            const parsed = Number(match[1]);
            if (Number.isFinite(parsed) && parsed > 0)
                return parsed;
        }
    }
    return undefined;
}
function transitionDuration(args) {
    let total = 0;
    for (const value of args) {
        const matches = value.matchAll(/xfade=[^;[]*?duration=([0-9]+(?:\.[0-9]+)?)/g);
        for (const match of matches)
            total += Number(match[1] ?? 0);
    }
    return total;
}
function isComposition(args) {
    return args.some((value) => value.includes("xfade=") || /concat=n=\d+/.test(value));
}
export function estimateProgressDuration(args, durationForSource) {
    const explicitDuration = outputScopedTime(args, "-t");
    if (explicitDuration !== undefined && explicitDuration > 0) {
        return { seconds: explicitDuration, source: "explicit", estimated: false };
    }
    const explicitEnd = outputScopedTime(args, "-to");
    if (explicitEnd !== undefined && explicitEnd > 0) {
        const seek = firstSeekSeconds(args) ?? 0;
        const seconds = explicitEnd - seek;
        if (seconds > 0)
            return { seconds, source: "explicit", estimated: false };
    }
    const sources = inputSources(args);
    const known = sources
        .map((source) => durationForSource(source))
        .filter((value) => value !== undefined && Number.isFinite(value) && value > 0);
    if (known.length === 0)
        return undefined;
    let seconds;
    let source;
    if (isComposition(args) && known.length > 1) {
        seconds = known.reduce((sum, value) => sum + value, 0) - transitionDuration(args);
        source = "composition";
    }
    else {
        seconds = known[0];
        source = "probe";
    }
    const seek = firstSeekSeconds(args);
    if (seek !== undefined && seek > 0)
        seconds = Math.max(0, seconds - seek);
    const factor = speedFactor(args);
    if (factor !== undefined)
        seconds /= factor;
    if (!(seconds > 0))
        return undefined;
    return { seconds, source, estimated: true };
}
/** Incremental parser for FFmpeg `-progress pipe:N` key/value output. */
export class FFmpegProgressParser {
    buffer = "";
    values = {};
    push(chunk) {
        this.buffer += chunk;
        const snapshots = [];
        while (true) {
            const newline = this.buffer.indexOf("\n");
            if (newline < 0)
                break;
            const line = this.buffer.slice(0, newline).replace(/\r$/, "");
            this.buffer = this.buffer.slice(newline + 1);
            const snapshot = this.consumeLine(line);
            if (snapshot)
                snapshots.push(snapshot);
        }
        return snapshots;
    }
    flush() {
        const snapshots = [];
        if (this.buffer.length > 0) {
            const snapshot = this.consumeLine(this.buffer.replace(/\r$/, ""));
            if (snapshot)
                snapshots.push(snapshot);
            this.buffer = "";
        }
        return snapshots;
    }
    consumeLine(line) {
        if (!line)
            return undefined;
        const separator = line.indexOf("=");
        if (separator <= 0)
            return undefined;
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1);
        this.values[key] = value;
        if (key !== "progress")
            return undefined;
        const snapshot = toSnapshot(this.values);
        this.values = {};
        return snapshot;
    }
}
//# sourceMappingURL=progress.js.map
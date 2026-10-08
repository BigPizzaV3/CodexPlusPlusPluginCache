import { readdir } from "node:fs/promises";
import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
import { buildFitFilters } from "../media/fit.js";
import { preflightOutputPath } from "../media/io.js";
import { matchesAnyPattern } from "../conversion/patterns.js";
import { resolveEncodingProfile } from "../video/encoding.js";
import { FilterGraphBuilder } from "./filter-graph.js";
import { executeComposition } from "./helpers.js";
import { xfadeFilter } from "./transitions.js";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
async function discoverImages(directory, recursive, includes, excludes) {
    const root = path.resolve(directory);
    const found = [];
    async function visit(current) {
        const entries = await readdir(current, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory() && recursive) {
                await visit(absolute);
                continue;
            }
            if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
                continue;
            const relative = path.relative(root, absolute);
            if (includes.length > 0 && !matchesAnyPattern(relative, includes))
                continue;
            if (excludes.length > 0 && matchesAnyPattern(relative, excludes))
                continue;
            found.push(absolute);
        }
    }
    try {
        await visit(root);
    }
    catch (error) {
        throw new ToolkitRuntimeError("E_INPUT_UNREADABLE", `Unable to read slideshow directory: ${root}`, { cause: error });
    }
    return found;
}
function positiveInteger(value, fallback, name) {
    const resolved = value ?? fallback;
    if (!Number.isInteger(resolved) || resolved <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a positive integer.`);
    }
    return resolved;
}
function positiveNumber(value, fallback, name) {
    const resolved = value ?? fallback;
    if (!Number.isFinite(resolved) || resolved <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be positive.`);
    }
    return resolved;
}
function safeColor(value) {
    if (!/^(?:[A-Za-z]+|#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?)$/.test(value)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "background must be a named color or #RRGGBB/#RRGGBBAA value.");
    }
    return value;
}
function outputPath(directory, request, to) {
    if (request.output !== undefined)
        return path.resolve(request.cwd ?? process.cwd(), request.output);
    return path.join(path.resolve(directory), `slideshow.${request.style ?? "vertical-stack"}.${to}`);
}
function outputEncodingArgs(format) {
    if (format === "mp4" || format === "webm") {
        const profile = resolveEncodingProfile(`output.${format}`);
        return [
            "-c:v", profile.videoCodec,
            ...profile.videoQualityArgs,
            ...profile.muxerArgs,
            "-pix_fmt", "yuv420p",
        ];
    }
    if (format === "webp") {
        return ["-c:v", "libwebp", "-quality", "82", "-compression_level", "4", "-loop", "0", "-f", "webp"];
    }
    return ["-c:v", "gif", "-loop", "0"];
}
function normalizeImageFilters(width, height, fps, request) {
    return [
        ...buildFitFilters({
            width,
            height,
            ...(request.fit !== undefined ? { fit: request.fit } : {}),
            ...(request.background !== undefined ? { background: request.background } : {}),
        }),
        "setsar=1",
        "setpts=PTS-STARTPTS",
        `fps=${fps}`,
        "format=yuv420p",
        "settb=AVTB",
    ];
}
function buildSequenceGraph(graph, images, width, height, fps, duration, request) {
    const transition = request.transition ?? "fade";
    const transitionDuration = transition === "none"
        ? 0
        : positiveNumber(request.transitionDuration, 0.75, "transitionDuration");
    const perSlide = transition === "none"
        ? duration / images.length
        : (duration + transitionDuration * (images.length - 1)) / images.length;
    if (transition !== "none" && perSlide <= transitionDuration) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Slideshow duration is too short for the selected transition duration.", { details: { duration, imageCount: images.length, transitionDuration, perSlide } });
    }
    images.forEach((_image, index) => {
        graph.add([`${index}:v`], normalizeImageFilters(width, height, fps, request), `slide${index}`);
    });
    if (transition === "none") {
        graph.addRaw(`${images.map((_image, index) => `[slide${index}]`).join("")}concat=n=${images.length}:v=1:a=0[vout]`);
        return { videoOut: "vout", perSlide, transitionDuration: 0 };
    }
    let videoOut = "slide0";
    let outputDuration = perSlide;
    for (let index = 1; index < images.length; index += 1) {
        const next = `slide${index}`;
        const current = `sx${index}`;
        const offset = outputDuration - transitionDuration;
        graph.addRaw(`[${videoOut}][${next}]${xfadeFilter(transition, transitionDuration, offset)}[${current}]`);
        videoOut = current;
        outputDuration += perSlide - transitionDuration;
    }
    return { videoOut, perSlide, transitionDuration };
}
export async function createSlideshow(directory, request = {}) {
    const style = request.style ?? "vertical-stack";
    const to = request.to ?? "mp4";
    const output = outputPath(directory, { ...request, style }, to);
    await preflightOutputPath({ output, overwrite: request.overwrite ?? false });
    const recursive = request.recursive ?? false;
    const includes = request.includes ?? [];
    const excludes = request.excludes ?? [];
    const images = await discoverImages(directory, recursive, includes, excludes);
    if (images.length < 2) {
        throw new ToolkitRuntimeError("E_BATCH_EMPTY_SELECTION", "Slideshow requires at least two selected images.", {
            details: { directory, discovered: images.length, includes, excludes },
        });
    }
    const width = positiveInteger(request.width, 1280, "width");
    const height = positiveInteger(request.height, 720, "height");
    const fps = positiveInteger(request.fps, 30, "fps");
    const duration = positiveNumber(request.duration, 10, "duration");
    const background = safeColor(request.background ?? "black");
    const graph = new FilterGraphBuilder();
    const args = [];
    let videoOut = "vout";
    let sequenceDetails = {};
    if (style === "sequence") {
        const built = buildSequenceGraph(graph, images, width, height, fps, duration, { ...request, background });
        videoOut = built.videoOut;
        sequenceDetails = {
            transition: request.transition ?? "fade",
            transitionDuration: built.transitionDuration,
            perSlide: built.perSlide,
        };
        for (const image of images) {
            args.push("-loop", "1", "-framerate", String(fps), "-t", String(built.perSlide), "-i", image);
        }
    }
    else {
        if (request.transition !== undefined && request.transition !== "none") {
            throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Slideshow transitions require --style sequence; vertical-stack uses continuous scrolling.");
        }
        const direction = request.direction ?? "up";
        const includeIntro = request.includeIntro ?? true;
        const includeOutro = request.includeOutro ?? false;
        images.forEach((_image, index) => {
            graph.add([`${index}:v`], [
                ...buildFitFilters({
                    width,
                    height,
                    ...(request.fit !== undefined ? { fit: request.fit } : {}),
                    background,
                }),
                "setsar=1",
                `fps=${fps}`,
                "setpts=PTS-STARTPTS",
            ], `slide${index}`);
        });
        graph.addRaw(`color=c=${background}:s=${width}x${height}:r=${fps}:d=${duration}[bg]`);
        if (includeIntro)
            graph.addRaw(`color=c=${background}:s=${width}x${height}:r=${fps}:d=${duration}[intro]`);
        if (includeOutro)
            graph.addRaw(`color=c=${background}:s=${width}x${height}:r=${fps}:d=${duration}[outro]`);
        const stacked = [
            ...(includeIntro ? ["[intro]"] : []),
            ...images.map((_image, index) => `[slide${index}]`),
            ...(includeOutro ? ["[outro]"] : []),
        ];
        graph.addRaw(`${stacked.join("")}vstack=inputs=${stacked.length}[stack]`);
        const y = direction === "down"
            ? `-(overlay_h-${height})+(overlay_h-${height})*t/${duration}`
            : `-(overlay_h-${height})*t/${duration}`;
        graph.addRaw(`[bg][stack]overlay=x=0:y='${y}':shortest=1,trim=duration=${duration},format=yuv420p[vout]`);
        for (const image of images)
            args.push("-loop", "1", "-framerate", String(fps), "-i", image);
        sequenceDetails = { direction, includeIntro, includeOutro };
    }
    args.push("-filter_complex", graph.build(), "-map", `[${videoOut}]`, ...outputEncodingArgs(to), "-r", String(fps), "-an", "-t", String(duration));
    return await executeComposition({
        operation: "slideshow",
        sources: images,
        output,
        argsBeforeOutput: args,
        runtime: request,
        warnings: [],
        details: {
            style,
            imageCount: images.length,
            width,
            height,
            fps,
            duration,
            background,
            fit: request.fit ?? "contain",
            recursive,
            includes,
            excludes,
            to,
            ...sequenceDetails,
        },
    });
}
/** Compatibility alias for the Milestone 7 vertical-stack implementation. */
export async function createVerticalStackSlideshow(directory, request = {}) {
    return await createSlideshow(directory, { ...request, style: "vertical-stack" });
}
//# sourceMappingURL=slideshow.js.map
import { ToolkitRuntimeError } from "../core/errors.js";
import { encodingArgs, resolveEncodingProfile } from "../video/encoding.js";
import { FilterGraphBuilder } from "./filter-graph.js";
import { deriveCompositionOutput, durationSeconds, executeComposition, inspectCompositionInput, preflightCompositionOutput, requireVideoStreams, resolveCompositionFiles } from "./helpers.js";
import { AUDIO_NORMALIZATION_FILTERS, resolveVideoNormalization, videoNormalizationFilters } from "./normalization.js";
import { COMPOSITION_TRANSITIONS, xfadeFilter } from "./transitions.js";
function resolveAudioMode(requested, allHaveAudio) {
    const mode = requested ?? "auto";
    if (mode === "preserve" && !allHaveAudio) {
        throw new ToolkitRuntimeError("E_MEDIA_INCOMPATIBLE", "--audio preserve requires every input to contain audio.");
    }
    if (mode === "auto")
        return allHaveAudio ? "preserve" : "drop";
    return mode;
}
export async function concatMedia(inputs, request = {}) {
    const sources = await resolveCompositionFiles(inputs, request);
    const output = deriveCompositionOutput(sources[0], "concat", request.output, request.cwd, request.to ?? "mp4");
    await preflightCompositionOutput(sources, output, request.overwrite ?? false);
    const media = await Promise.all(sources.map(async (source) => await inspectCompositionInput(source, request)));
    requireVideoStreams(media, sources);
    const transition = request.transition ?? "none";
    if (transition !== "none" && !COMPOSITION_TRANSITIONS.has(transition)) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `Unsupported transition: ${transition}`);
    }
    const transitionDuration = request.transitionDuration ?? 1;
    if (!Number.isFinite(transitionDuration) || transitionDuration <= 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "transition duration must be positive.");
    }
    const durations = media.map((item, index) => durationSeconds(item, sources[index] ?? "unknown"));
    if (transition !== "none" && durations.some((duration) => duration <= transitionDuration)) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Every input must be longer than the transition duration.", {
            details: { durations, transitionDuration },
        });
    }
    const normalization = resolveVideoNormalization(media, request);
    const allHaveAudio = media.every((item) => item.audio.length > 0);
    const audioMode = resolveAudioMode(request.audio, allHaveAudio);
    const warnings = request.audio === undefined && !allHaveAudio
        ? [{ code: "W_COMPOSITION_AUDIO_DROPPED", message: "At least one input has no audio; auto mode produced video-only output." }]
        : [];
    const graph = new FilterGraphBuilder();
    sources.forEach((_source, index) => {
        graph.add([`${index}:v`], videoNormalizationFilters(normalization), `v${index}`);
        if (audioMode === "preserve")
            graph.add([`${index}:a`], AUDIO_NORMALIZATION_FILTERS, `a${index}`);
    });
    let videoOut = "v0";
    let audioOut = audioMode === "preserve" ? "a0" : undefined;
    let outputDuration = durations[0] ?? 0;
    for (let index = 1; index < sources.length; index += 1) {
        const nextDuration = durations[index] ?? 0;
        const nextVideo = `v${index}`;
        const nextAudio = `a${index}`;
        const currentVideoOut = `vx${index}`;
        const currentAudioOut = `ax${index}`;
        if (transition === "none") {
            // Defer concatenation until all normalized pads are available.
            continue;
        }
        const offset = outputDuration - transitionDuration;
        graph.addRaw(`[${videoOut}][${nextVideo}]${xfadeFilter(transition, transitionDuration, offset)}[${currentVideoOut}]`);
        videoOut = currentVideoOut;
        if (audioOut !== undefined) {
            graph.addRaw(`[${audioOut}][${nextAudio}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${currentAudioOut}]`);
            audioOut = currentAudioOut;
        }
        outputDuration += nextDuration - transitionDuration;
    }
    if (transition === "none") {
        graph.addRaw(`${sources.map((_source, index) => `[v${index}]`).join("")}concat=n=${sources.length}:v=1:a=0[vout]`);
        videoOut = "vout";
        if (audioMode === "preserve") {
            graph.addRaw(`${sources.map((_source, index) => `[a${index}]`).join("")}concat=n=${sources.length}:v=0:a=1[aout]`);
            audioOut = "aout";
        }
        outputDuration = durations.reduce((sum, value) => sum + value, 0);
    }
    const encoding = resolveEncodingProfile(output);
    const args = [];
    for (const source of sources)
        args.push("-i", source);
    args.push("-filter_complex", graph.build(), "-map", `[${videoOut}]`);
    if (audioOut !== undefined)
        args.push("-map", `[${audioOut}]`);
    args.push(...encodingArgs(encoding, audioOut !== undefined), "-r", String(normalization.fps));
    return await executeComposition({
        operation: "concat",
        sources,
        output,
        argsBeforeOutput: args,
        runtime: request,
        inputMedia: media,
        warnings,
        details: {
            transition,
            transitionDuration: transition === "none" ? 0 : transitionDuration,
            audioMode,
            normalization,
            estimatedDuration: Number(outputDuration.toFixed(6)),
            inputCount: sources.length,
        },
    });
}
//# sourceMappingURL=concat.js.map
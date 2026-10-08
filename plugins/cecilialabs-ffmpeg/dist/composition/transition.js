import { ToolkitRuntimeError } from "../core/errors.js";
import { encodingArgs, resolveEncodingProfile } from "../video/encoding.js";
import { FilterGraphBuilder } from "./filter-graph.js";
import { deriveCompositionOutput, durationSeconds, executeComposition, inspectCompositionInput, preflightCompositionOutput, requireVideoStreams, resolveCompositionFiles } from "./helpers.js";
import { AUDIO_NORMALIZATION_FILTERS, resolveVideoNormalization, videoNormalizationFilters } from "./normalization.js";
import { COMPOSITION_TRANSITIONS, xfadeFilter } from "./transitions.js";
function resolvedAudioMode(requested, allHaveAudio) {
    const mode = requested ?? "auto";
    if (mode === "preserve" && !allHaveAudio) {
        throw new ToolkitRuntimeError("E_MEDIA_INCOMPATIBLE", "--audio preserve requires both inputs to contain audio.");
    }
    return mode === "auto" ? (allHaveAudio ? "preserve" : "drop") : mode;
}
export async function transitionMedia(leftInput, rightInput, request = {}) {
    const sources = await resolveCompositionFiles([leftInput, rightInput], request);
    const output = deriveCompositionOutput(sources[0], "transition", request.output, request.cwd, request.to ?? "mp4");
    await preflightCompositionOutput(sources, output, request.overwrite ?? false);
    const media = await Promise.all(sources.map(async (source) => await inspectCompositionInput(source, request)));
    requireVideoStreams(media, sources);
    const transition = request.transition ?? "fade";
    if (!COMPOSITION_TRANSITIONS.has(transition))
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `Unsupported transition: ${transition}`);
    const duration = request.duration ?? 1;
    if (!Number.isFinite(duration) || duration <= 0)
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "transition duration must be positive.");
    const leftDuration = durationSeconds(media[0], sources[0]);
    const rightDuration = durationSeconds(media[1], sources[1]);
    const offset = request.offset ?? leftDuration - duration;
    if (!Number.isFinite(offset) || offset < 0 || offset + duration > leftDuration + 0.001 || duration >= rightDuration) {
        throw new ToolkitRuntimeError("E_OPERATION_INVALID_RANGE", "Transition offset/duration does not fit inside the source durations.", {
            details: { leftDuration, rightDuration, offset, duration },
        });
    }
    const normalization = resolveVideoNormalization(media, request);
    const allHaveAudio = media.every((item) => item.audio.length > 0);
    const audioMode = resolvedAudioMode(request.audio, allHaveAudio);
    const warnings = request.audio === undefined && !allHaveAudio
        ? [{ code: "W_COMPOSITION_AUDIO_DROPPED", message: "At least one input has no audio; auto mode produced video-only output." }]
        : [];
    const graph = new FilterGraphBuilder();
    graph.add(["0:v"], videoNormalizationFilters(normalization), "v0");
    graph.add(["1:v"], videoNormalizationFilters(normalization), "v1");
    graph.addRaw(`[v0][v1]${xfadeFilter(transition, duration, offset)}[vout]`);
    if (audioMode === "preserve") {
        graph.add(["0:a"], AUDIO_NORMALIZATION_FILTERS, "a0");
        graph.add(["1:a"], AUDIO_NORMALIZATION_FILTERS, "a1");
        graph.addRaw(`[a0][a1]acrossfade=d=${duration}:c1=tri:c2=tri[aout]`);
    }
    const encoding = resolveEncodingProfile(output);
    const args = [
        "-i", sources[0], "-i", sources[1],
        "-filter_complex", graph.build(),
        "-map", "[vout]",
        ...(audioMode === "preserve" ? ["-map", "[aout]"] : []),
        ...encodingArgs(encoding, audioMode === "preserve"),
        "-r", String(normalization.fps),
    ];
    return await executeComposition({
        operation: "transition",
        sources,
        output,
        argsBeforeOutput: args,
        runtime: request,
        inputMedia: media,
        warnings,
        details: {
            transition,
            duration,
            offset,
            audioMode,
            normalization,
            estimatedDuration: Number((leftDuration + rightDuration - duration).toFixed(6)),
        },
    });
}
//# sourceMappingURL=transition.js.map
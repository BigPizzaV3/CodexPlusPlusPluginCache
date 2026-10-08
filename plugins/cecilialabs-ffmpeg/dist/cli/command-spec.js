/**
 * Milestone 0 command grammar represented as data. The recursive registration
 * layer means adding a future leaf does not require changes to CLI plumbing.
 */
export const COMMAND_TREE = [
    {
        syntax: "pipeline [tokens...]",
        description: "Validate, print, or run a declarative file or inline media pipeline. Use pipeline <file> <validate|print|run>.",
        implementationMilestone: 21,
    },
    {
        syntax: "doctor",
        description: "Inspect the FFmpeg/FFprobe runtime and media capabilities.",
        implementationMilestone: 3,
    },
    {
        syntax: "probe <input>",
        description: "Inspect media metadata and streams using FFprobe.",
        implementationMilestone: 3,
    },
    {
        syntax: "environment",
        description: "Inspect or configure the FFmpeg runtime environment.",
        implementationMilestone: 3,
        children: [
            {
                syntax: "capabilities",
                description: "List available encoders, decoders, filters, and acceleration backends.",
                implementationMilestone: 3,
            },
            {
                syntax: "version",
                description: "Show resolved FFmpeg and FFprobe versions.",
                implementationMilestone: 3,
            },
            {
                syntax: "check",
                description: "Check execution context, toolkit installation, FFmpeg, FFprobe, and capabilities.",
                implementationMilestone: 20,
            },
            {
                syntax: "install [scope]",
                description: "Plan or explicitly install the toolkit through npm.",
                implementationMilestone: 20,
            },
        ],
    },
    {
        syntax: "video",
        description: "Perform typed video editing operations.",
        implementationMilestone: 4,
        children: [
            { syntax: "trim-start <input>", description: "Remove media from the start.", implementationMilestone: 4 },
            { syntax: "trim-end <input>", description: "Remove media from the end.", implementationMilestone: 4 },
            { syntax: "trim <input>", description: "Extract a temporal range.", implementationMilestone: 4 },
            { syntax: "speed <input>", description: "Change video playback speed.", implementationMilestone: 4 },
            { syntax: "from-image <input>", description: "Create a video clip from a still image.", implementationMilestone: 4 },
            { syntax: "upscale <input>", description: "Resize/upscale video with configurable fit and restoration profile.", implementationMilestone: 13 },
            { syntax: "restore <input>", description: "Compatibility alias for video upscale.", implementationMilestone: 4 },
            { syntax: "attach-audio <video> <audio>", description: "Attach or replace audio on video.", implementationMilestone: 13 },
            { syntax: "add-silence <video>", description: "Add a silent audio track to video.", implementationMilestone: 13 },
        ],
    },
    {
        syntax: "image",
        description: "Convert still/animated images or extract frames from video.",
        implementationMilestone: 13,
        children: [
            { syntax: "convert <input>", description: "Convert one image to another image format.", implementationMilestone: 13 },
            { syntax: "extract <input>", description: "Extract a still image from a video timestamp.", implementationMilestone: 13 },
        ],
    },
    {
        syntax: "audio",
        description: "Perform typed audio and telephony operations.",
        implementationMilestone: 5,
        children: [
            { syntax: "attach <video> <audio>", description: "Attach or replace audio on video.", implementationMilestone: 5 },
            { syntax: "silence", description: "Generate silence audio.", implementationMilestone: 5 },
            { syntax: "add-silence <video>", description: "Add a silence track to video.", implementationMilestone: 5 },
            { syntax: "detect-silence <input>", description: "Detect silence intervals.", implementationMilestone: 5 },
            { syntax: "remove-silence <input>", description: "Remove configured silence intervals.", implementationMilestone: 5 },
            { syntax: "telephony <input>", description: "Transcode audio for telephony codecs and profiles.", implementationMilestone: 5 },
        ],
    },
    {
        syntax: "convert",
        description: "Convert individual media files or batches.",
        implementationMilestone: 6,
        children: [
            { syntax: "file <input>", description: "Convert one media file.", implementationMilestone: 6 },
            { syntax: "batch <directory>", description: "Convert a selected batch of media files.", implementationMilestone: 6 },
        ],
    },
    {
        syntax: "compose",
        description: "Compose multiple media sources and transitions.",
        implementationMilestone: 7,
        children: [
            { syntax: "concat <inputs...>", description: "Concatenate multiple media inputs.", implementationMilestone: 7 },
            { syntax: "transition <left> <right>", description: "Compose two inputs with a transition.", implementationMilestone: 7 },
            { syntax: "slideshow <directory>", description: "Compose a slideshow from image assets.", implementationMilestone: 7 },
        ],
    },
    {
        syntax: "diagnose <input>",
        description: "Diagnose media compatibility, timestamps, streams, and filter failures.",
        implementationMilestone: 8,
    },
    {
        syntax: "repair",
        description: "Repair or normalize media structures.",
        implementationMilestone: 8,
        children: [
            { syntax: "timestamps <input>", description: "Repair timestamp and frame-timing problems.", implementationMilestone: 8 },
            { syntax: "normalize <input>", description: "Normalize media properties for downstream processing.", implementationMilestone: 8 },
        ],
    },
    {
        syntax: "stream",
        description: "Capture or stream media to a configured transport.",
        implementationMilestone: 9,
        children: [
            { syntax: "camera", description: "Capture and stream a camera device.", implementationMilestone: 9 },
            { syntax: "file <input>", description: "Stream a media file.", implementationMilestone: 9 },
        ],
    },
];
//# sourceMappingURL=command-spec.js.map
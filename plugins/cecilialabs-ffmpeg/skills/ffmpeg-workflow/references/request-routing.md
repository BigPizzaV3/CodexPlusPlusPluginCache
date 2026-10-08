# Request routing

Start with the user's desired result, then choose the narrowest domain Skill.
Use ffmpeg-onboarding first whenever the execution context or runtime
capability is not established.

| Request signal                                              | Primary Skill        | Typical result                            |
| ----------------------------------------------------------- | -------------------- | ----------------------------------------- |
| Check FFmpeg, FFprobe, codecs, filters, or hardware         | ffmpeg-environment   | Readiness or capability report            |
| Trim, speed, resize, restore, or create video from an image | ffmpeg-video-editing | Verified video artifact                   |
| Attach, generate, detect, remove, or process audio          | ffmpeg-audio         | Verified audio/video artifact             |
| Convert one file or a directory                             | ffmpeg-conversion    | Verified converted artifact(s)            |
| Concatenate, transition, or create a slideshow              | ffmpeg-composition   | Verified composed artifact                |
| Capture or deliver a live stream                            | ffmpeg-streaming     | Validated transport plan or stream result |
| Explain or repair a damaged media file                      | ffmpeg-diagnostics   | Diagnosis or verified repair              |
| Chain two or more supported operations                      | ffmpeg-pipelines     | Validated pipeline and artifacts          |
| Unknown host, install request, or missing runtime facts     | ffmpeg-onboarding    | Context/readiness report                  |

## Mixed requests

For a request such as “check this machine, then trim and convert the clip”:

1. run ffmpeg-onboarding;
2. route the media operation to ffmpeg-video-editing and/or
   ffmpeg-conversion;
3. use ffmpeg-pipelines only when the user wants a reusable ordered
   workflow or the operation is naturally multi-step;
4. verify the final artifact after all steps.

Do not select a Skill merely because a keyword appears in the filename.
FFprobe stream metadata and the requested output contract are the source of
truth.

## Workflow examples

“Can this host encode H.264 with NVENC?” starts with onboarding and the
environment Skill; it is not proof of a successful encode until the requested
runtime capability is probed.

“Trim the first ten seconds and make a WebM” uses video editing followed by
conversion, or a validated pipeline if the user requests one document.

“Tell me why this MP4 has no audio” uses diagnostics plus environment/media
inspection; it does not silently attach a generated track.

“Create a reusable process for these three conversions” uses conversion plus
pipelines and requires explicit input discovery, output naming, and overwrite
policy.

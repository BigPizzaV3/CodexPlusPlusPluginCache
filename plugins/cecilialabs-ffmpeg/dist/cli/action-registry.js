import { runDoctorAction, runEnvironmentCapabilitiesAction, runEnvironmentCheckAction, runEnvironmentInstallAction, runEnvironmentVersionAction, runProbeAction } from "./actions/environment.js";
import { runTrimEndAction, runTrimRangeAction, runTrimStartAction, runVideoFromImageAction, runVideoRestoreAction, runVideoSpeedAction, runVideoUpscaleAction } from "./actions/video.js";
import { runAudioAddSilenceAction, runAudioAttachAction, runAudioDetectSilenceAction, runAudioRemoveSilenceAction, runAudioSilenceAction, runAudioTelephonyAction } from "./actions/audio.js";
import { runConvertBatchAction, runConvertFileAction } from "./actions/conversion.js";
import { runComposeConcatAction, runComposeSlideshowAction, runComposeTransitionAction } from "./actions/composition.js";
import { runDiagnoseAction, runRepairNormalizeAction, runRepairTimestampsAction } from "./actions/diagnostics.js";
import { runStreamCameraAction, runStreamFileAction } from "./actions/streaming.js";
import { runImageConvertAction, runImageExtractAction } from "./actions/image.js";
import { runPipelineAction } from "./actions/pipeline.js";
const ACTIONS = {
    "cecilia-ffmpeg pipeline": runPipelineAction,
    "cecilia-ffmpeg doctor": runDoctorAction,
    "cecilia-ffmpeg probe": runProbeAction,
    "cecilia-ffmpeg environment capabilities": runEnvironmentCapabilitiesAction,
    "cecilia-ffmpeg environment version": runEnvironmentVersionAction,
    "cecilia-ffmpeg environment check": runEnvironmentCheckAction,
    "cecilia-ffmpeg environment install": runEnvironmentInstallAction,
    "cecilia-ffmpeg video trim-start": runTrimStartAction,
    "cecilia-ffmpeg video trim-end": runTrimEndAction,
    "cecilia-ffmpeg video trim": runTrimRangeAction,
    "cecilia-ffmpeg video speed": runVideoSpeedAction,
    "cecilia-ffmpeg video from-image": runVideoFromImageAction,
    "cecilia-ffmpeg video upscale": runVideoUpscaleAction,
    "cecilia-ffmpeg video restore": runVideoRestoreAction,
    "cecilia-ffmpeg video attach-audio": runAudioAttachAction,
    "cecilia-ffmpeg video add-silence": runAudioAddSilenceAction,
    "cecilia-ffmpeg image convert": runImageConvertAction,
    "cecilia-ffmpeg image extract": runImageExtractAction,
    "cecilia-ffmpeg audio attach": runAudioAttachAction,
    "cecilia-ffmpeg audio silence": runAudioSilenceAction,
    "cecilia-ffmpeg audio add-silence": runAudioAddSilenceAction,
    "cecilia-ffmpeg audio detect-silence": runAudioDetectSilenceAction,
    "cecilia-ffmpeg audio remove-silence": runAudioRemoveSilenceAction,
    "cecilia-ffmpeg audio telephony": runAudioTelephonyAction,
    "cecilia-ffmpeg convert file": runConvertFileAction,
    "cecilia-ffmpeg convert batch": runConvertBatchAction,
    "cecilia-ffmpeg compose concat": runComposeConcatAction,
    "cecilia-ffmpeg compose transition": runComposeTransitionAction,
    "cecilia-ffmpeg compose slideshow": runComposeSlideshowAction,
    "cecilia-ffmpeg diagnose": runDiagnoseAction,
    "cecilia-ffmpeg repair timestamps": runRepairTimestampsAction,
    "cecilia-ffmpeg repair normalize": runRepairNormalizeAction,
    "cecilia-ffmpeg stream camera": runStreamCameraAction,
    "cecilia-ffmpeg stream file": runStreamFileAction,
};
export function resolveCommandAction(path) {
    return ACTIONS[path];
}
//# sourceMappingURL=action-registry.js.map
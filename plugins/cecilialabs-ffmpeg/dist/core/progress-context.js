import { AsyncLocalStorage } from "node:async_hooks";
const storage = new AsyncLocalStorage();
function durationOf(media) {
    return media.format.durationSeconds
        ?? media.video[0]?.durationSeconds
        ?? media.audio[0]?.durationSeconds;
}
export async function withProgressObserver(observer, operation) {
    return await storage.run({
        observer,
        mediaDurations: new Map(),
        nextRunNumber: 1,
    }, operation);
}
export function currentProgressObserver() {
    return storage.getStore()?.observer;
}
export function registerProgressMedia(media) {
    const state = storage.getStore();
    if (!state)
        return;
    const duration = durationOf(media);
    if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
        state.mediaDurations.set(media.source, duration);
    }
}
export function progressMediaDuration(source) {
    return storage.getStore()?.mediaDurations.get(source);
}
export function nextProgressRunId() {
    const state = storage.getStore();
    if (!state)
        return "ffmpeg";
    const value = state.nextRunNumber;
    state.nextRunNumber += 1;
    return `ffmpeg-${value}`;
}
//# sourceMappingURL=progress-context.js.map
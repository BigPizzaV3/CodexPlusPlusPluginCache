const NATIVE = new Set([
    "fade", "fadeblack", "fadewhite", "wipeleft", "wiperight", "slideup", "slidedown",
    "circleopen", "circleclose", "dissolve", "pixelize", "distance", "zoomin",
]);
export const COMPOSITION_TRANSITIONS = new Set([
    ...NATIVE,
    "zoomout",
]);
function zoomoutExpression() {
    // Shrink the outgoing frame around the center while revealing the incoming frame.
    return "if(between(X,W*P*0.15,W*(1-P*0.15))*between(Y,H*P*0.15,H*(1-P*0.15)),a0((X-W*P*0.15)/(1-0.3*P),(Y-H*P*0.15)/(1-0.3*P)),b0(X,Y))";
}
export function xfadeFilter(transition, duration, offset) {
    if (transition === "zoomout") {
        return `xfade=transition=custom:duration=${duration}:offset=${Number(offset.toFixed(6))}:expr='${zoomoutExpression()}'`;
    }
    return `xfade=transition=${transition}:duration=${duration}:offset=${Number(offset.toFixed(6))}`;
}
//# sourceMappingURL=transitions.js.map
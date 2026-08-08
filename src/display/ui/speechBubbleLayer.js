import { SPEECH_BUBBLE_LAYER_Z_INDEX } from "./overlayUtils.js";

/**
 * Keep lightweight world-space speech above every ordinary DOM overlay without
 * lifting the game canvas (and the rest of its world rendering) over the HUD.
 */
export function createSpeechBubbleLayer({ sourceCanvas, documentRef = document } = {}) {
  if (!sourceCanvas) throw new Error("createSpeechBubbleLayer requires a source canvas");

  const canvas = documentRef.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  canvas.id = "speech-bubble-layer";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "0",
    height: "0",
    zIndex: String(SPEECH_BUBBLE_LAYER_Z_INDEX),
    pointerEvents: "none",
  });
  documentRef.body.appendChild(canvas);

  function syncSize() {
    const width = Math.max(1, Number(sourceCanvas.width) || 1) | 0;
    const height = Math.max(1, Number(sourceCanvas.height) || 1) | 0;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const rect = typeof sourceCanvas.getBoundingClientRect === "function"
      ? sourceCanvas.getBoundingClientRect()
      : null;
    const cssWidth = Math.max(1, Number(rect?.width || sourceCanvas.offsetWidth || width));
    const cssHeight = Math.max(1, Number(rect?.height || sourceCanvas.offsetHeight || height));
    canvas.style.left = `${Math.round(Number(rect?.left || 0))}px`;
    canvas.style.top = `${Math.round(Number(rect?.top || 0))}px`;
    canvas.style.width = `${Math.round(cssWidth)}px`;
    canvas.style.height = `${Math.round(cssHeight)}px`;
  }

  function render(draw) {
    syncSize();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (typeof draw === "function") draw(ctx);
  }

  return { canvas, ctx, render, syncSize };
}

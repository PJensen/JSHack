import { worldToScreen } from "../../display/camera/controller.js";

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function getLogicalCanvasSize(canvasLike, fallbackWidth, fallbackHeight) {
  const width = Math.max(
    1,
    finiteOr(canvasLike?.offsetWidth, finiteOr(canvasLike?.width, finiteOr(fallbackWidth, 1)))
  );
  const height = Math.max(
    1,
    finiteOr(canvasLike?.offsetHeight, finiteOr(canvasLike?.height, finiteOr(fallbackHeight, 1)))
  );
  return { width, height };
}

export function projectBubbleAnchor(cam, anchor, logicalCanvas, viewportRect) {
  const [localX, localY] = worldToScreen(
    cam,
    finiteOr(anchor?.x, 0),
    finiteOr(anchor?.y, 0),
    logicalCanvas
  );
  const left = finiteOr(viewportRect?.left, 0);
  const top = finiteOr(viewportRect?.top, 0);
  return {
    localX,
    localY,
    viewportX: left + localX,
    viewportY: top + localY,
  };
}

export function placeBubbleBox({
  anchorX,
  anchorY,
  boxWidth,
  boxHeight,
  liftPx,
  tailHeight = 12,
  viewportWidth,
  viewportHeight,
  margin = 10,
  bottomMargin = 30,
}) {
  const width = Math.max(1, finiteOr(boxWidth, 1));
  const height = Math.max(1, finiteOr(boxHeight, 1));
  const x = finiteOr(anchorX, 0);
  const y = finiteOr(anchorY, 0);
  const lift = Math.max(0, finiteOr(liftPx, 0));
  const tail = Math.max(0, finiteOr(tailHeight, 0));
  const viewW = Math.max(width + (margin * 2), finiteOr(viewportWidth, width + (margin * 2)));
  const viewH = Math.max(height + (margin * 2), finiteOr(viewportHeight, height + (margin * 2)));
  const safeMargin = Math.max(0, finiteOr(margin, 0));
  const safeBottom = Math.max(safeMargin, finiteOr(bottomMargin, safeMargin));

  const left = Math.max(
    safeMargin,
    Math.min(viewW - width - safeMargin, Math.round(x - (width / 2)))
  );
  const top = Math.max(
    safeMargin,
    Math.min(viewH - height - safeBottom, Math.round(y - height - tail - lift))
  );

  return { left, top };
}

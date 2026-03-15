import { assertEquals } from "jsr:@std/assert";
import {
  getLogicalCanvasSize,
  placeBubbleBox,
  projectBubbleAnchor,
} from "../src/main/ui/bubblePlacement.js";

Deno.test("bubble placement projects the same logical anchor into viewport space", () => {
  const cam = { x: 12, y: 8, scale: 28, shakeX: 0, shakeY: 0 };
  const logicalCanvas = getLogicalCanvasSize({ offsetWidth: 560, offsetHeight: 420 }, 560, 420);
  const projected = projectBubbleAnchor(
    cam,
    { x: 13, y: 7.32 },
    logicalCanvas,
    { left: 100, top: 40 }
  );

  assertEquals(projected.localX, 308);
  assertEquals(projected.localY, 190.96);
  assertEquals(projected.viewportX, 408);
  assertEquals(projected.viewportY, 230.96);
});

Deno.test("bubble placement clamps consistently within the viewport", () => {
  const placed = placeBubbleBox({
    anchorX: 408,
    anchorY: 231,
    boxWidth: 280,
    boxHeight: 120,
    liftPx: 36,
    tailHeight: 12,
    viewportWidth: 430,
    viewportHeight: 300,
    margin: 10,
    bottomMargin: 30,
  });

  assertEquals(placed.left, 140);
  assertEquals(placed.top, 63);
});

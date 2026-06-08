import { assert, assertEquals } from "jsr:@std/assert";
import {
  resolveDarknessAlpha,
} from "../src/display/lighting/engine.js";
import { computeAmbient } from "../src/display/lighting/sources/index.js";

function sum(rgb) {
  return rgb[0] + rgb[1] + rgb[2];
}

Deno.test("daylight ambient keeps a fog veil outside current vision", () => {
  const noonAmbient = computeAmbient({
    isOverworld: true,
    turnInDay: 365,
    moonBrightness: 0.15,
  });
  const ambientSum = sum(noonAmbient);

  const unseenAlpha = resolveDarknessAlpha({
    lightSum: ambientSum,
    ambientLightSum: ambientSum,
    sight: 0,
    dark: 210,
  });
  const visibleAlpha = resolveDarknessAlpha({
    lightSum: ambientSum,
    ambientLightSum: ambientSum,
    sight: 1,
    dark: 210,
  });

  assert(unseenAlpha >= 72, "daylight memory cells should retain a visible veil");
  assertEquals(visibleAlpha, 0, "visible daylight cells should stay bright");
});

Deno.test("local light can still punch through the daylight memory veil", () => {
  const noonAmbient = computeAmbient({
    isOverworld: true,
    turnInDay: 365,
    moonBrightness: 0.15,
  });
  const ambientSum = sum(noonAmbient);

  const alpha = resolveDarknessAlpha({
    lightSum: ambientSum + 2.5,
    ambientLightSum: ambientSum,
    sight: 0,
    dark: 210,
  });

  assertEquals(alpha, 0);
});

Deno.test("night ambient remains darker than day ambient", () => {
  const noonAmbient = computeAmbient({
    isOverworld: true,
    turnInDay: 365,
    moonBrightness: 0.15,
  });
  const nightAmbient = computeAmbient({
    isOverworld: true,
    turnInDay: 0,
    moonBrightness: 0.15,
  });

  assert(sum(nightAmbient) < sum(noonAmbient));
});

Deno.test("underground floors do not receive sky ambient", () => {
  assertEquals(computeAmbient({ isOverworld: false }), null);
});

Deno.test("cells without sky ambient remain fully dark when unseen", () => {
  const alpha = resolveDarknessAlpha({
    lightSum: 0,
    ambientLightSum: 0,
    sight: 0,
    dark: 210,
  });

  assertEquals(alpha, 210);
});

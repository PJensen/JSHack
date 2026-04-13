import { assertAlmostEquals } from "jsr:@std/assert";
import { computePlaybackRate } from "../src/display/audio/audioEngine.js";

function centsToRate(cents) {
  return Math.pow(2, cents / 1200);
}

Deno.test("audioEngine: computePlaybackRate applies fixed detune and base rate", () => {
  const rate = computePlaybackRate({ rate: 1.25, detune: 100, randomPitch: 0 }, () => 0.5);
  const expected = 1.25 * centsToRate(100);
  assertAlmostEquals(rate, expected, 1e-10);
});

Deno.test("audioEngine: computePlaybackRate applies negative random jitter", () => {
  // rng=0 maps to -randomPitch cents
  const rate = computePlaybackRate({ randomPitch: 60 }, () => 0);
  const expected = centsToRate(-60);
  assertAlmostEquals(rate, expected, 1e-10);
});

Deno.test("audioEngine: computePlaybackRate applies positive random jitter", () => {
  // rng=1 maps to +randomPitch cents
  const rate = computePlaybackRate({ randomPitch: 60 }, () => 1);
  const expected = centsToRate(60);
  assertAlmostEquals(rate, expected, 1e-10);
});

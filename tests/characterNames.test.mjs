import { assert, assertEquals } from "jsr:@std/assert";
import {
  STARTER_CHARACTER_NAMES,
  pickRandomCharacterName,
} from "../src/shared/utils/characterNames.js";

Deno.test("starter character names list is populated", () => {
  assert(STARTER_CHARACTER_NAMES.length > 0, "starter name list should not be empty");
});

Deno.test("pickRandomCharacterName maps rolls to valid list slots", () => {
  const names = STARTER_CHARACTER_NAMES;
  assertEquals(pickRandomCharacterName(() => 0), names[0]);
  assertEquals(pickRandomCharacterName(() => 0.999999), names[names.length - 1]);
  assertEquals(pickRandomCharacterName(() => 1), names[names.length - 1]);
});

Deno.test("pickRandomCharacterName handles invalid RNG output", () => {
  assertEquals(pickRandomCharacterName(() => Number.NaN), STARTER_CHARACTER_NAMES[0]);
});

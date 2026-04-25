import { resolve } from "../src/display/audio/sounds.js";
import {
  ALERT_SOUND_BY_IDENTITY,
  CREATURE_ATTACK_SOUNDS,
  SPELL_CAST_SOUND_EVENTS,
} from "../src/display/audio/audioWiring.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test("new audio assets are registered", async () => {
  const ids = [
    "gelatinous_cube:alert",
    "spell:heal",
    "spell:flash_heal",
    "insect:alert",
    "insect:attack",
    "player:near_death",
    "spell:lifetap",
    "teleported",
    "water:magic",
  ];

  for (const id of ids) {
    const sound = resolve(id);
    assert(sound, `missing sound registry entry for ${id}`);
    const stat = await Deno.stat(new URL(`../${sound.url}`, import.meta.url));
    assert(stat.isFile, `missing audio file for ${id}: ${sound.file}`);
  }
});

Deno.test("new audio hooks map gameplay identities and spell events", () => {
  assert(ALERT_SOUND_BY_IDENTITY.gelatinous_cube === "gelatinous_cube:alert", "cube alert should use cube sound");
  assert(ALERT_SOUND_BY_IDENTITY.grid_bug === "insect:alert", "grid bug should use insect alert");
  assert(ALERT_SOUND_BY_IDENTITY.centipede === "insect:alert", "centipede should use insect alert");
  assert(!ALERT_SOUND_BY_IDENTITY.killer_bee, "killer bee should not use insect alert");
  assert(CREATURE_ATTACK_SOUNDS.grid_bug === "insect:attack", "grid bug attacks should use insect attack");
  assert(CREATURE_ATTACK_SOUNDS.centipede === "insect:attack", "centipede attacks should use insect attack");
  assert(!CREATURE_ATTACK_SOUNDS.killer_bee, "killer bee attacks should not use insect attack");
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:heal"), "heal spell should have a cast sound hook");
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:lifetap"), "lifetap spell should keep its cast sound hook");
});

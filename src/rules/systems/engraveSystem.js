import { EngraveIntent } from "../components/Intents/EngraveIntent.js";
import { Engraving } from "../components/Engraving.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Physiology } from "../components/Physiology.js";
import { mulberry32, combatSeed } from "../utils/rng.js";

/**
 * engraveSystem — consumes EngraveIntent, creates an Engraving entity
 * on the ground at the actor's current tile.
 *
 * If an engraving already exists at the same position it is overwritten
 * (the old entity is destroyed and a fresh one created).
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function engraveSystem(world) {
  for (const [actor, intent, pos] of world.query(EngraveIntent, Position)) {
    const text = String(intent.text || "").trim();
    if (!text) {
      world.remove(actor, EngraveIntent);
      continue;
    }

    // Cap length to keep things sane
    const capped = text.slice(0, 64);

    // Remove any existing engraving at this tile
    for (const [eid, , epos] of world.query(Engraving, Position)) {
      if (epos.x === pos.x && epos.y === pos.y) {
        try { world.destroy(eid); } catch { /* already gone */ }
      }
    }

    // Spawn a new engraving entity
    const id = world.create();
    world.add(id, Position, { x: pos.x, y: pos.y });
    world.add(id, Engraving, { text: capped, author: actor, turn: world.step | 0 });
    world.add(id, NamedIdentity, { name: capped, identity: "engraving" });

    try {
      world.emit && world.emit("engrave", {
        actor,
        engravingId: id,
        text: capped,
        x: pos.x,
        y: pos.y,
      });
    } catch { /* listener threw */ }

    world.remove(actor, EngraveIntent);
  }
}

// --- Scramble-on-step event listener ----------------------------------------

const INSTALLED = Symbol.for("jshack.engraveScramble");

// Characters used to replace scuffed glyphs — scratched stone / smeared dust
const SCUFF = ".,;:'`~-_/|\\*#%";

/**
 * Scramble n random characters in str, replacing with random scuff glyphs.
 * Returns the new string (or the original if nothing changed).
 */
function scrambleChars(str, n, rng) {
  if (n <= 0 || !str.length) return str;
  const chars = str.split("");
  // Pick n distinct indices
  const indices = [];
  for (let i = 0; i < chars.length; i++) {
    // Skip already-scuffed characters to avoid double-mangling
    if (!SCUFF.includes(chars[i])) indices.push(i);
  }
  if (!indices.length) return str; // fully degraded already
  // Fisher-Yates partial shuffle to pick up to n unique positions
  const count = Math.min(n, indices.length);
  for (let i = 0; i < count; i++) {
    const j = i + ((rng() * (indices.length - i)) | 0);
    const tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
  }
  for (let i = 0; i < count; i++) {
    chars[indices[i]] = SCUFF[(rng() * SCUFF.length) | 0];
  }
  return chars.join("");
}

/**
 * Install a world.on('moved') listener that degrades engravings when
 * entities walk over them. Heavier creatures scuff more characters.
 *
 * Mass thresholds (Physiology.massKg):
 *   <=5 kg  (rat/bat)      — 10% chance, 1 char
 *   <=50 kg (goblin/spider) — 30% chance, 1 char
 *   <=120 kg (human/orc)    — 50% chance, 1-2 chars
 *   <=300 kg (troll/ogre)   — 75% chance, 2-3 chars
 *   >300 kg (dragon)        — 95% chance, 3-5 chars
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installEngraveListeners(world) {
  if (!world || world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("moved", ({ id, to }) => {
    if (!to) return;
    const tx = to.x | 0, ty = to.y | 0;

    for (const [eid, eng, epos] of world.query(Engraving, Position)) {
      if (epos.x !== tx || epos.y !== ty) continue;

      // Don't scramble if the text is already fully degraded
      const clean = eng.text.split("").filter((c) => !SCUFF.includes(c));
      if (!clean.length) continue;

      // Deterministic per (step, walker, engraving)
      const rng = mulberry32(combatSeed(world.seed, world.step, id, eid, 0xE69A0000));

      // Determine mass of the walker
      const phys = world.get(id, Physiology);
      const mass = phys?.massKg ?? 80; // default to human-ish

      // Scale chance and severity by mass
      let chance, minChars, maxChars;
      if (mass <= 5) {
        chance = 0.10; minChars = 1; maxChars = 1;
      } else if (mass <= 50) {
        chance = 0.30; minChars = 1; maxChars = 1;
      } else if (mass <= 120) {
        chance = 0.50; minChars = 1; maxChars = 2;
      } else if (mass <= 300) {
        chance = 0.75; minChars = 2; maxChars = 3;
      } else {
        chance = 0.95; minChars = 3; maxChars = 5;
      }

      if (rng() > chance) continue;

      const n = minChars + ((rng() * (maxChars - minChars + 1)) | 0);
      const newText = scrambleChars(eng.text, n, rng);
      if (newText === eng.text) continue;

      // Mutate in place
      eng.text = newText;
      // Keep NamedIdentity in sync for display identity
      const ni = world.get(eid, NamedIdentity);
      if (ni) ni.name = newText;

      try {
        world.emit && world.emit("engrave:scrambled", {
          actor: id,
          engravingId: eid,
          text: newText,
          x: tx,
          y: ty,
        });
      } catch { /* listener threw */ }
    }
  });
}

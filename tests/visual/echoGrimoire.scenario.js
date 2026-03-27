import { World } from "../../src/lib/ecs-js/index.js";
import { Brain } from "../../src/rules/components/Brain.js";
import { Equipment } from "../../src/rules/components/Equipment.js";
import { Faction } from "../../src/rules/components/Faction.js";
import { CastSpellIntent } from "../../src/rules/components/Intents/CastSpellIntent.js";
import { Mana } from "../../src/rules/components/Mana.js";
import { NamedIdentity } from "../../src/rules/components/NamedIdentity.js";
import { Position } from "../../src/rules/components/Position.js";
import { Vitality } from "../../src/rules/components/Vitality.js";
import { buildCatalogItem } from "../../src/rules/data/itemCatalogLoader.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../../src/rules/environment/dungeon/tileMap.js";
import { castSpellSystem } from "../../src/rules/systems/castSpellSystem.js";

function mana(world, id) {
  return Number(world.get(id, Mana)?.mana || 0);
}

export default {
  name: "Echo Grimoire",
  description: "Casting the same spell again within 3 turns costs no mana and echoes at reduced power.",
  bounds: { x0: 1, y0: 1, x1: 8, y1: 6 },

  setup() {
    clearAll();
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
    loadChunk(0, 0, tiles);

    const world = new World({ seed: 0x5173 });
    const events = [];
    world.on("castSpell", (ev) => events.push(ev));

    const caster = world.create();
    world.add(caster, Position, { x: 2, y: 3 });
    world.add(caster, NamedIdentity, { name: "Caster", identity: "player" });
    world.add(caster, Faction, { key: "stone_taunter" });
    world.add(caster, Equipment, {});
    world.add(caster, Brain, { learnedSpellIds: ["frost"] });
    world.add(caster, Mana, { mana: 20, maxMana: 20, manaRegen: 0, regenCooldown: 0 });
    world.add(caster, Vitality, { maxHp: 24, hp: 24 });

    const target = world.create();
    world.add(target, Position, { x: 6, y: 3 });
    world.add(target, NamedIdentity, { name: "Goblin", identity: "goblin" });
    world.add(target, Faction, { key: "enemy" });
    world.add(target, Equipment, { spellAvoidDerived: 0 });
    world.add(target, Vitality, { maxHp: 20, hp: 20 });

    const grimoireId = buildCatalogItem(world, "echo_grimoire");
    world.get(caster, Equipment).offhand = grimoireId;

    world._caster = caster;
    world._events = events;

    const entities = new Map();
    entities.set(caster, { label: "Caster", track: true });
    entities.set(target, { label: "Target", track: true });
    return { world, entities };
  },

  steps: [
    {
      description: "First Frost cast spends mana normally.",
      run(world) {
        world.step += 1;
        world.add(world._caster, CastSpellIntent, { spellId: "frost" });
        castSpellSystem(world);
      },
      check(world) {
        const current = mana(world, world._caster);
        const pass = current === 15;
        return { pass, message: pass ? "Mana spent: 20 -> 15." : `Expected mana=15, got ${current}` };
      },
    },
    {
      description: "Second Frost cast inside memory window is free and flagged as echoRepeat.",
      run(world) {
        world.step += 1;
        world.add(world._caster, CastSpellIntent, { spellId: "frost" });
        castSpellSystem(world);
      },
      check(world) {
        const current = mana(world, world._caster);
        const echo = world._events.find((ev) => ev?.spellId === "frost" && ev?.echoRepeat === true);
        const pass = current === 15 && !!echo;
        return { pass, message: pass ? "Echo cast was free and flagged reduced-power." : `Expected free echo cast; mana=${current}, echo=${!!echo}` };
      },
    },
  ],
};

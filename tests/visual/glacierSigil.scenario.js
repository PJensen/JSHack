import { World } from "../../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../../src/rules/components/ActiveEffects.js";
import { Equipment } from "../../src/rules/components/Equipment.js";
import { Faction } from "../../src/rules/components/Faction.js";
import { NamedIdentity } from "../../src/rules/components/NamedIdentity.js";
import { Position } from "../../src/rules/components/Position.js";
import { Vitality } from "../../src/rules/components/Vitality.js";
import { buildCatalogItem } from "../../src/rules/data/itemCatalogLoader.js";
import { getSpell } from "../../src/rules/data/spells.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../../src/rules/environment/dungeon/tileMap.js";
import { runSpellScript } from "../../src/rules/scripts/spells.js";

export default {
  name: "Glacier Sigil",
  description: "Frost with Glacier Sigil freezes the target for one turn (stun status) on hit.",
  bounds: { x0: 1, y0: 1, x1: 8, y1: 6 },

  setup() {
    clearAll();
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
    loadChunk(0, 0, tiles);

    const world = new World({ seed: 0x5171 });
    const caster = world.create();
    world.add(caster, Position, { x: 2, y: 3 });
    world.add(caster, NamedIdentity, { name: "Caster", identity: "player" });
    world.add(caster, Faction, { key: "stone_taunter" });
    world.add(caster, Equipment, {});
    world.add(caster, Vitality, { maxHp: 24, hp: 24 });

    const target = world.create();
    world.add(target, Position, { x: 6, y: 3 });
    world.add(target, NamedIdentity, { name: "Goblin", identity: "goblin" });
    world.add(target, Faction, { key: "enemy" });
    world.add(target, Equipment, { spellAvoidDerived: 0 });
    world.add(target, ActiveEffects, { effects: [] });
    world.add(target, Vitality, { maxHp: 20, hp: 20 });

    const sigilId = buildCatalogItem(world, "glacier_sigil");
    world.get(caster, Equipment).offhand = sigilId;

    world._caster = caster;
    world._target = target;

    const entities = new Map();
    entities.set(caster, { label: "Caster", track: true });
    entities.set(target, { label: "Target", track: true });
    return { world, entities };
  },

  steps: [
    {
      description: "Cast Frost: target should gain both frost and stun.",
      run(world) {
        world.step += 1;
        runSpellScript(world, world._caster, getSpell("frost"), {});
      },
      check(world) {
        const effects = world.get(world._target, ActiveEffects)?.effects || [];
        const hasFrost = effects.some((entry) => entry?.key === "frost");
        const hasStun = effects.some((entry) => entry?.key === "stun");
        const pass = hasFrost && hasStun;
        return { pass, message: pass ? "Frost and freeze landed." : `Missing expected effects: ${effects.map((e) => e?.key).join(", ")}` };
      },
    },
  ],
};

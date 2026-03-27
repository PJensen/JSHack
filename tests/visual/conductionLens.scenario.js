import { World } from "../../src/lib/ecs-js/index.js";
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

function hp(world, id) {
  return Number(world.get(id, Vitality)?.hp || 0);
}

export default {
  name: "Conduction Lens",
  description: "Lightning gains one extra chain target when the Conduction Lens is equipped.",
  bounds: { x0: 1, y0: 1, x1: 12, y1: 6 },

  setup() {
    clearAll();
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
    loadChunk(0, 0, tiles);

    const world = new World({ seed: 0x5172 });
    const caster = world.create();
    world.add(caster, Position, { x: 2, y: 3 });
    world.add(caster, NamedIdentity, { name: "Caster", identity: "player" });
    world.add(caster, Faction, { key: "stone_taunter" });
    world.add(caster, Equipment, {});
    world.add(caster, Vitality, { maxHp: 24, hp: 24 });

    const targets = [];
    const xs = [4, 6, 8, 10];
    for (let i = 0; i < xs.length; i++) {
      const id = world.create();
      world.add(id, Position, { x: xs[i], y: 3 });
      world.add(id, NamedIdentity, { name: `Enemy ${i + 1}`, identity: "goblin" });
      world.add(id, Faction, { key: "enemy" });
      world.add(id, Equipment, { spellAvoidDerived: 0 });
      world.add(id, Vitality, { maxHp: 20, hp: 20 });
      targets.push(id);
    }

    const lensId = buildCatalogItem(world, "conduction_lens");
    world.get(caster, Equipment).offhand = lensId;

    world._caster = caster;
    world._targets = targets;

    const entities = new Map();
    entities.set(caster, { label: "Caster", track: true });
    for (let i = 0; i < targets.length; i++) entities.set(targets[i], { label: `Target ${i + 1}`, track: true });
    return { world, entities };
  },

  steps: [
    {
      description: "Cast Lightning: all four lined-up enemies should take chain damage.",
      run(world) {
        world.step += 1;
        runSpellScript(world, world._caster, getSpell("lightning"), {});
      },
      check(world) {
        const hits = world._targets.map((id) => hp(world, id));
        const pass = hits.every((n) => n < 20);
        return { pass, message: pass ? `All chained: HP ${hits.join(", ")}` : `Expected all four hit, got HP ${hits.join(", ")}` };
      },
    },
  ],
};

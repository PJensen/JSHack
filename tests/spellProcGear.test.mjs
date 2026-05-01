import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Faction } from "../src/rules/components/Faction.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";
import { Mana } from "../src/rules/components/Mana.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { castSpellSystem } from "../src/rules/systems/castSpellSystem.js";

function loadFlatFloor() {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeCaster(world, x = 2, y = 2, faction = "stone_taunter") {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: faction });
  world.add(id, Vitality, { maxHp: 30, hp: 30 });
  world.add(id, Equipment, {});
  world.add(id, Brain, { learnedSpellIds: [] });
  world.add(id, Mana, { mana: 20, maxMana: 20, manaRegen: 0, regenCooldown: 0 });
  return id;
}

function makeEnemy(world, x, y, hp = 40) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: "enemy" });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, { spellAvoidDerived: 0 });
  return id;
}

Deno.test("glacier sigil: frost hit applies stun (freeze) for one turn", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x5151 });
  const caster = makeCaster(world);
  const target = makeEnemy(world, 6, 2);
  const sigil = buildCatalogItem(world, "glacier_sigil");
  world.get(caster, Equipment).offhand = sigil;

  runSpellScript(world, caster, { id: "frost", script: "frost", manaCost: 5 }, {});

  const effects = world.get(target, ActiveEffects)?.effects || [];
  assert(effects.some((entry) => entry?.key === "stun" && Number(entry?.turnsLeft || 0) >= 1));
});

Deno.test("conduction lens: lightning chains to one additional target", () => {
  loadFlatFloor();

  const baseline = new World({ seed: 0x5152 });
  const casterA = makeCaster(baseline);
  const a = makeEnemy(baseline, 4, 2);
  const b = makeEnemy(baseline, 6, 2);
  const c = makeEnemy(baseline, 8, 2);
  const d = makeEnemy(baseline, 10, 2);
  runSpellScript(baseline, casterA, { id: "lightning", script: "lightning", manaCost: 7 }, {});
  const baselineHp4 = worldHp(baseline, d);

  const boosted = new World({ seed: 0x5152 });
  const casterB = makeCaster(boosted);
  const lens = buildCatalogItem(boosted, "conduction_lens");
  worldEquip(boosted, casterB).offhand = lens;
  const a2 = makeEnemy(boosted, 4, 2);
  const b2 = makeEnemy(boosted, 6, 2);
  const c2 = makeEnemy(boosted, 8, 2);
  const d2 = makeEnemy(boosted, 10, 2);
  runSpellScript(boosted, casterB, { id: "lightning", script: "lightning", manaCost: 7 }, {});
  const boostedHp4 = worldHp(boosted, d2);

  assertEquals(worldHp(baseline, a), worldHp(boosted, a2));
  assertEquals(worldHp(baseline, b), worldHp(boosted, b2));
  assertEquals(worldHp(baseline, c), worldHp(boosted, c2));
  assert(boostedHp4 < baselineHp4, "expected lens to hit the 4th chain target");
});

Deno.test("echo grimoire: repeating the same spell in 3 turns is free and marked reduced-power", () => {
  loadFlatFloor();
  const world = new World({ seed: 0x5153 });
  const caster = makeCaster(world);
  makeEnemy(world, 6, 2);
  const grimoire = buildCatalogItem(world, "echo_grimoire");
  worldEquip(world, caster).offhand = grimoire;
  world.get(caster, Brain).learnedSpellIds = ["frost"];

  const castEvents = [];
  const echoEvents = [];
  world.on("castSpell", (ev) => castEvents.push(ev));
  world.on("proc:echoGrimoire:echo", (ev) => echoEvents.push(ev));

  world.add(caster, CastSpellIntent, { spellId: "frost" });
  castSpellSystem(world);
  const manaAfterFirst = world.get(caster, Mana).mana;
  assertEquals(manaAfterFirst, 15);

  world.add(caster, CastSpellIntent, { spellId: "frost" });
  castSpellSystem(world);
  const manaAfterSecond = world.get(caster, Mana).mana;
  assertEquals(manaAfterSecond, manaAfterFirst);
  assert(castEvents.some((ev) => ev?.spellId === "frost" && ev?.echoRepeat === true && Number(ev?.powerScale || 1) < 1));
  assert(echoEvents.length >= 1);
});

function worldHp(world, id) {
  return Number(world.get(id, Vitality)?.hp || 0);
}

function worldEquip(world, id) {
  const eq = world.get(id, Equipment);
  if (eq) return eq;
  world.add(id, Equipment, {});
  return world.get(id, Equipment);
}

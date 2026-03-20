import { assert } from "jsr:@std/assert";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { resolveLootTable } from "../src/rules/data/lootResolver.js";

const SEEDS = 1000;

Deno.test("sarcophagus:contents rolls 2-4 drops", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sarcophagus:contents", rng, 3);
    assert(drops.length >= 2 && drops.length <= 4,
      `seed ${seed}: expected 2-4 drops, got ${drops.length}`);
  }
});

Deno.test("sarcophagus:contents can drop bones", () => {
  let boneCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sarcophagus:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "archetype" && d.params.archetype === "Bone") boneCount++;
    }
  }
  assert(boneCount > 0, "expected bones in sarcophagus loot");
});

Deno.test("sarcophagus:contents can drop burial weapons", () => {
  let weaponCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sarcophagus:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "equip") weaponCount++;
    }
  }
  assert(weaponCount > 0, "expected weapons or jewelry in sarcophagus loot");
});

Deno.test("sarcophagus:contents can drop gems (real gemstones only)", () => {
  let gemCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sarcophagus:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "gem") gemCount++;
    }
  }
  assert(gemCount > 0, "expected gems in sarcophagus loot");
});

Deno.test("sarcophagus:contents can drop gold", () => {
  let goldCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sarcophagus:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "gold") goldCount++;
    }
  }
  assert(goldCount > 0, "expected gold in sarcophagus loot");
});

Deno.test("sub:sarc_weapon only produces weapons", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:sarc_weapon", rng, 3);
    for (const d of drops) {
      assert(d.kind === "equip", `unexpected kind: ${d.kind}`);
    }
  }
});

Deno.test("sarcophagus loot is richer than urn loot", () => {
  let sarcTotal = 0;
  let urnTotal = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    sarcTotal += resolveLootTable("sarcophagus:contents", createRng(seed), 3).length;
    urnTotal += resolveLootTable("urn:contents", createRng(seed), 3).length;
  }
  assert(sarcTotal > urnTotal * 3,
    `sarcophagus (${sarcTotal} items) should be much richer than urns (${urnTotal} items)`);
});

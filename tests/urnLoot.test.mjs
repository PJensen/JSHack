import { assert } from "jsr:@std/assert";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { resolveLootTable } from "../src/rules/data/lootResolver.js";

const SEEDS = 2000;

Deno.test("urn:contents produces at most 1 drop per roll", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("urn:contents", rng, 3);
    assert(drops.length <= 1,
      `seed ${seed}: expected 0-1 drops, got ${drops.length}`);
  }
});

Deno.test("urn:contents sometimes drops nothing", () => {
  let nothingCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("urn:contents", rng, 3);
    if (drops.length === 0) nothingCount++;
  }
  // 10/35 weight is nothing — expect roughly 29% empty
  const ratio = nothingCount / SEEDS;
  assert(ratio > 0.15, `expected >15% empty urns, got ${(ratio * 100).toFixed(1)}%`);
  assert(ratio < 0.45, `expected <45% empty urns, got ${(ratio * 100).toFixed(1)}%`);
});

Deno.test("urn:contents can drop jewelry (equip kind)", () => {
  let jewelryCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("urn:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "equip") jewelryCount++;
    }
  }
  assert(jewelryCount > 0, "expected at least one jewelry drop across seeds");
});

Deno.test("urn:contents can drop gems", () => {
  let gemCount = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("urn:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "gem") gemCount++;
    }
  }
  assert(gemCount > 0, "expected at least one gem drop across seeds");
});

Deno.test("urn:contents gems are rarer than jewelry", () => {
  let gems = 0;
  let jewelry = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("urn:contents", rng, 3);
    for (const d of drops) {
      if (d.kind === "gem") gems++;
      if (d.kind === "equip") jewelry++;
    }
  }
  assert(gems < jewelry,
    `gems (${gems}) should be rarer than jewelry (${jewelry})`);
});

Deno.test("sub:jewelry only produces rings/amulets/pendants", () => {
  const ALLOWED = /^(ring_|amulet_|pendant_|serpent_ring)/;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:jewelry", rng, 3);
    for (const d of drops) {
      assert(d.kind === "equip", `unexpected kind: ${d.kind}`);
      assert(ALLOWED.test(d.params.equipId),
        `seed ${seed}: unexpected equip ${d.params.equipId} — only jewelry expected`);
    }
  }
});

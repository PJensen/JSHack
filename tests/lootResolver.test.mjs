import { assert, assertEquals } from "jsr:@std/assert";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { resolveLootTable } from "../src/rules/data/lootResolver.js";

Deno.test("known spells are suppressed from spellbook drops", () => {
  // Run many seeds — sub:spellbooks should never produce a known spell
  const knownSpells = new Set(["lightning", "meteor"]);
  const opts = { knownSpells };

  let totalBooks = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:spellbooks", rng, 5, 0, opts);
    for (const drop of drops) {
      assert(drop.kind === "item", "sub:spellbooks should only produce items");
      const spellId = drop.params.itemId.replace(/^book_/, "");
      assert(!knownSpells.has(spellId),
        `seed ${seed}: got book_${spellId} but spell "${spellId}" is known`);
      totalBooks++;
    }
  }
  // We should still get books (the unknown ones: blastwave, frost, blink)
  assert(totalBooks > 0, "should still drop unknown spellbooks");
});

Deno.test("all spells known suppresses entire spellbook sub-table", () => {
  const knownSpells = new Set(["lightning", "meteor", "blastwave", "frost", "blink"]);
  const opts = { knownSpells };

  for (let seed = 1; seed <= 50; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:spellbooks", rng, 5, 0, opts);
    assertEquals(drops.length, 0,
      `seed ${seed}: should get no drops when all spells known`);
  }
});

Deno.test("without opts, spellbooks drop normally", () => {
  let totalBooks = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:spellbooks", rng, 5);
    totalBooks += drops.length;
  }
  assert(totalBooks > 0, "should drop spellbooks without filtering");
});

Deno.test("known-spell filter does not affect non-book item entries", () => {
  // Potions are "item" type entries but not books — should be unaffected
  const knownSpells = new Set(["lightning", "meteor"]);
  const opts = { knownSpells };

  let totalPotions = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:potions", rng, 5, 0, opts);
    totalPotions += drops.filter(d => d.kind === "item").length;
  }
  assert(totalPotions > 0, "non-book item entries should still drop");
});

Deno.test("sub:equip_common can naturally drop helm_iron", () => {
  let seen = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:equip_common", rng, 2);
    for (const drop of drops) {
      if (drop.kind === "equip" && drop.params?.equipId === "helm_iron") {
        seen++;
      }
    }
  }
  assert(seen > 0, "expected to see helm_iron in common equipment drops");
});

Deno.test("sub:potions can naturally drop potion_water", () => {
  let seen = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const rng = createRng(seed);
    const drops = resolveLootTable("sub:potions", rng, 5);
    for (const drop of drops) {
      if (drop.kind === "item" && drop.params?.itemId === "potion_water") seen++;
    }
  }
  assert(seen > 0, "expected to see potion_water in potion drops");
});

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
  // We should still get books from the remaining unknown pool.
  assert(totalBooks > 0, "should still drop unknown spellbooks");
});

Deno.test("all spells known suppresses entire spellbook sub-table", () => {
  const knownSpells = new Set([
    "lightning", "meteor", "blastwave", "frost", "blizzard", "firestorm",
    "fireball", "scorch", "arcane_bolt",
    "iron_flesh", "bloodthirst", "cleave", "war_cry", "earthshatter",
    "rampage", "primal_roar",
    "heal", "barkskin", "thorn_burst", "entangle", "verdant_ward",
    "harmony_ward", "poison_blade", "plague_swarm",
    "quicken", "blind", "shadow_veil", "smoke_bomb", "phase_strike",
    "blink", "ignite_weapons",
    "shadow_bolt", "agony", "mark_of_death", "drain_life", "summon_skeleton",
    "flash_heal", "smite", "divine_shield", "purify", "consecrate",
    "evocation", "homecoming", "hearthstone",
  ]);
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

Deno.test("spell-proc offhands are suppressed when required spells are unknown", () => {
  const blocked = new Set(["glacier_sigil", "conduction_lens", "echo_grimoire"]);
  const opts = { knownSpells: new Set() };
  let seenBlocked = 0;
  for (let seed = 1; seed <= 700; seed++) {
    const rareDrops = resolveLootTable("sub:equip_rare", createRng(seed), 4, 0, opts);
    const epicDrops = resolveLootTable("sub:equip_epic", createRng(seed + 1000), 5, 0, opts);
    for (const drop of [...rareDrops, ...epicDrops]) {
      if (drop.kind !== "equip") continue;
      if (blocked.has(String(drop.params?.equipId || ""))) seenBlocked++;
    }
  }
  assertEquals(seenBlocked, 0, "spell-proc offhands should not drop with no known spells");
});

Deno.test("spell-proc offhands become eligible when matching spells are known", () => {
  const seen = new Set();
  const opts = { knownSpells: new Set(["frost", "lightning"]) };
  for (let seed = 1; seed <= 1400; seed++) {
    const rareDrops = resolveLootTable("sub:equip_rare", createRng(seed), 4, 0, opts);
    const epicDrops = resolveLootTable("sub:equip_epic", createRng(seed + 5000), 5, 0, opts);
    for (const drop of [...rareDrops, ...epicDrops]) {
      if (drop.kind !== "equip") continue;
      const id = String(drop.params?.equipId || "");
      if (id === "glacier_sigil" || id === "conduction_lens" || id === "echo_grimoire") seen.add(id);
    }
    if (seen.size === 3) break;
  }
  assert(seen.has("glacier_sigil"), "glacier_sigil should become eligible when frost is known");
  assert(seen.has("conduction_lens"), "conduction_lens should become eligible when lightning is known");
  assert(seen.has("echo_grimoire"), "echo_grimoire should become eligible once any spell is known");
});

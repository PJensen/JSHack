import { assertEquals } from "jsr:@std/assert";
import { reconcilePinnedQuickItemsWithInventory, upsertPinnedQuickItemLifo } from "../src/display/ui/hud.js";

Deno.test("quick pin slots keep latest entries and evict oldest when full (LIFO replacement)", () => {
  let pinned = [];
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 1, name: "a" }, 3);
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 2, name: "b" }, 3);
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 3, name: "c" }, 3);
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 4, name: "d" }, 3);

  assertEquals(pinned.map((it) => it.id), [2, 3, 4]);
});

Deno.test("quick pin slots move existing pin to latest position when re-pinned", () => {
  let pinned = [];
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 11, name: "a" }, 3);
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 12, name: "b" }, 3);
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 11, name: "a" }, 3);

  assertEquals(pinned.map((it) => it.id), [12, 11]);
});

Deno.test("quick pin slots pin by identity so all instances share one pin", () => {
  let pinned = [];
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 100, identity: "potion_heal_minor", name: "Potion A" }, 5);
  pinned = upsertPinnedQuickItemLifo(pinned, { id: 101, identity: "potion_heal_minor", name: "Potion B" }, 5);
  assertEquals(pinned.length, 1);
  assertEquals(pinned.map((it) => it.id), [101]);
  assertEquals(pinned.map((it) => it.pinKey), ["potion_heal_minor"]);
});

Deno.test("quick pin slots reconcile counts and remove consumed items from inventory snapshot", () => {
  const pinned = [
    { id: 21, name: "Potion", count: 1 },
    { id: 22, name: "Scroll", count: 1 },
  ];
  const bagItems = [
    { id: 21, count: 3 },
    { id: 30, count: 1 },
  ];

  const next = reconcilePinnedQuickItemsWithInventory(pinned, bagItems);
  assertEquals(next.map((it) => [it.id, it.count]), [[21, 3]]);
});

Deno.test("quick pin slots reconcile grouped inventory entries via entityIds", () => {
  const pinned = [{ id: 41, name: "Arrows", count: 1 }];
  const bagItems = [{ id: 99, entityIds: [41, 42, 43], count: 7 }];
  const next = reconcilePinnedQuickItemsWithInventory(pinned, bagItems);
  assertEquals(next.map((it) => [it.id, it.count]), [[41, 7]]);
});

Deno.test("quick pin slots reconcile grouped inventory entries by identity", () => {
  const pinned = [{ id: 50, identity: "potion_heal_minor", pinKey: "potion_heal_minor", count: 1, name: "Potion" }];
  const bagItems = [
    { id: 60, identity: "potion_heal_minor", count: 2, name: "Potion" },
    { id: 61, identity: "potion_heal_minor", count: 1, name: "Potion" },
  ];
  const next = reconcilePinnedQuickItemsWithInventory(pinned, bagItems);
  assertEquals(next.map((it) => [it.pinKey, it.id, it.count]), [["potion_heal_minor", 61, 3]]);
});

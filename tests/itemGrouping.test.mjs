import { assertEquals } from "jsr:@std/assert";

import { getGroupedEntityIds, groupDisplayItems } from "../src/main/ui/itemGrouping.js";

Deno.test("groupDisplayItems coalesces visually identical items and sums counts", () => {
  const grouped = groupDisplayItems([
    { id: 10, type: "junk", name: "Ash", count: 1, rarityName: "common" },
    { id: 11, type: "junk", name: "Ash", count: 1, rarityName: "common" },
  ]);

  assertEquals(grouped.length, 1);
  assertEquals(grouped[0].id, 10);
  assertEquals(grouped[0].count, 2);
  assertEquals(grouped[0].entityIds, [10, 11]);
});

Deno.test("groupDisplayItems keeps items separate when visible data differs", () => {
  const grouped = groupDisplayItems([
    { id: 20, type: "junk", name: "Ash", count: 1, rarityName: "common" },
    { id: 21, type: "junk", name: "Ash", count: 1, rarityName: "common", cooldownTurnsRemaining: 2 },
  ]);

  assertEquals(grouped.length, 2);
});

Deno.test("groupDisplayItems sums economic fields across grouped shop rows", () => {
  const grouped = groupDisplayItems([
    { id: 30, type: "ammo", name: "Arrow", count: 4, rarityName: "common", buyPrice: 12, sellPrice: 4 },
    { id: 31, type: "ammo", name: "Arrow", count: 6, rarityName: "common", buyPrice: 18, sellPrice: 6 },
  ]);

  assertEquals(grouped.length, 1);
  assertEquals(grouped[0].count, 10);
  assertEquals(grouped[0].buyPrice, 30);
  assertEquals(grouped[0].sellPrice, 10);
});

Deno.test("getGroupedEntityIds returns backing ids for grouped and ungrouped rows", () => {
  assertEquals(getGroupedEntityIds({ id: 40, count: 1 }), [40]);
  assertEquals(getGroupedEntityIds({ id: 41, entityIds: [41, 42, 41] }), [41, 42]);
});

import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Player } from "../src/rules/components/Player.js";
import { Brain } from "../src/rules/components/Brain.js";
import { basePalette } from "../src/display/palette/base.js";
import { listCatalogItems } from "../src/rules/data/itemCatalog.js";

Deno.test("worldView tags potion items for glow FX", () => {
  const world = new World({ seed: 1 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 4, y: 7 });
  world.add(playerId, Brain, { learnedSpellIds: [], itemKnowledgeIdentities: [], seenTiles: new Uint8Array(), intelligence: 10, visionRange: 8 });

  const id = world.create();
  world.add(id, Position, { x: 4, y: 7 });
  world.add(id, NamedIdentity, { name: "Potion of Mana", identity: "potion_mana" });
  world.add(id, ItemInfo, {
    type: "potion",
    slot: "",
    weight: 1,
    value: 1,
    description: "",
    count: 1,
    bonuses: {},
    twoHanded: false,
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === id);
  assert(rec, "potion item should appear in world view");
  assert(rec.tags.includes("potion_glow"), "potion items should get potion_glow tag");
});

Deno.test("every catalog potion has a potion glyph palette entry", () => {
  const missing = listCatalogItems()
    .filter((item) => String(item?.type || "").toLowerCase() === "potion")
    .map((item) => String(item.id || ""))
    .filter((id) => {
      const look = basePalette[id] || basePalette.potion;
      return !look || look.glyph !== "!";
    });

  assert(missing.length === 0, `missing potion palette entries: ${missing.join(", ")}`);
});

import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createThrowFxController } from "../src/display/fx/throwFxController.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";

function makeCtx() {
  const draws = [];
  return {
    draws,
    save() {},
    restore() {},
    beginPath() {},
    fill() {},
    arc() {},
    ellipse() {},
    fillText() {},
    set fillStyle(_v) {},
    set textAlign(_v) {},
    set textBaseline(_v) {},
    set font(_v) {},
    set shadowColor(_v) {},
    set shadowBlur(_v) {},
    set globalCompositeOperation(_v) {},
    drawImage(img) { draws.push(img); },
  };
}

Deno.test("throwFx uses potion glyph fallback for thrown potion items not present in worldView", () => {
  const world = new World({ seed: 1 });
  const potionId = world.create();
  world.add(potionId, NamedIdentity, { name: "Potion of Mana", identity: "potion_mana" });
  world.add(potionId, ItemInfo, {
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

  const controller = createThrowFxController({ world });
  controller.installListeners();
  world.emit("item:thrown", {
    itemId: potionId,
    from: { x: 1, y: 1 },
    to: { x: 3, y: 1 },
  });

  const potionCanvas = { tag: "potion" };
  const defaultCanvas = { tag: "default" };
  const glyphAtlas = new Map([
    ["potion_mana", { canvas: potionCanvas }],
    ["potion", { canvas: potionCanvas }],
    ["default", { canvas: defaultCanvas }],
  ]);
  const ctx = makeCtx();

  controller.draw(ctx, { entities: [] }, glyphAtlas);

  assertEquals(ctx.draws[0], potionCanvas);
});

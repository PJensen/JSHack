import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createHudFeeds } from "../src/main/ui/hudFeeds.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { ItemCooldown } from "../src/rules/components/ItemCooldown.js";
import { Stamina } from "../src/rules/components/Stamina.js";
import "../src/content/items/sunsword.js";
import { installContent } from "../src/content/install.js";
installContent();

function installTestWindow() {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const prevWindow = globalThis.window;
  const target = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    value: target,
    configurable: true,
    writable: true,
  });
  return () => {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        value: prevWindow,
        configurable: true,
        writable: true,
      });
    } else {
      delete globalThis.window;
    }
  };
}

Deno.test("hudFeeds prepends equipped Sunsword action into the mobile dock and carries cooldown", () => {
  const restoreWindow = installTestWindow();

  try {
    const world = new World({ seed: 12 });
    const player = world.create();
    world.add(player, Player, {});
    world.add(player, Position, { x: 0, y: 0 });
    world.add(player, Equipment, {});
    world.add(player, Stamina, { stamina: 9, maxStamina: 10, staminaRegen: 1, regenCooldown: 0 });

    const sunsword = world.create();
    world.add(sunsword, NamedIdentity, { name: "Sunsword", identity: "sunsword" });
    world.add(sunsword, ItemInfo, {
      type: "equip",
      slot: "weapon",
      count: 1,
      bonuses: {},
      rarity: 4,
      rarityName: "epic",
      affixes: [],
    });
    world.add(sunsword, ItemCooldown, { turnsRemaining: 7, turnsMax: 12, dueTurn: 7 });
    world.get(player, Equipment).weapon = sunsword;

    const pinnedSpellSlots = ["heal", "fireball", "arcane_bolt", "shadow_bolt"];
    const hudFeeds = createHudFeeds(world, {
      getPlayerMana: () => ({ mana: 10, maxMana: 10 }),
      ensureActiveSpell: () => "heal",
      updateActiveSpellLabel: () => {},
      knownSpellIds: () => pinnedSpellSlots.slice(),
      getActionBarSlots: () => [],
      getPinnedSpellSlots: () => pinnedSpellSlots.slice(),
      autoAssignSlot: () => -1,
      autoAssignPinnedSlot: () => -1,
    });

    /** @type {any[]} */
    const payloads = [];
    const onUpdate = (ev) => payloads.push(ev?.detail || null);
    window.addEventListener("ui:updatePinnedSpellBar", onUpdate);
    hudFeeds.updateActiveSpellHUD();
    window.removeEventListener("ui:updatePinnedSpellBar", onUpdate);

    assert(payloads.length > 0, "expected pinned dock payload");
    const detail = payloads[payloads.length - 1];
    const slots = Array.isArray(detail?.pinnedSlots) ? detail.pinnedSlots : [];
    assertEquals(slots.length, 4);
    assertEquals(slots[0]?.kind, "item-use");
    assertEquals(slots[0]?.identity, "sunsword");
    assertEquals(Number(slots[0]?.itemId || 0), sunsword);
    assertEquals(Number(slots[0]?.cdRemaining || 0), 7);
    assertEquals(String(slots[1]?.id || ""), "heal");
    assertEquals(String(slots[3]?.id || ""), "arcane_bolt");
    assert(!slots.some((entry) => String(entry?.id || "") === "shadow_bolt"), "expected last spell to be spliced out when Sunsword occupies the dock");
  } finally {
    restoreWindow();
  }
});

Deno.test("hudFeeds prepends equipped Sunsword action into the desktop spell dock", () => {
  const restoreWindow = installTestWindow();

  try {
    const world = new World({ seed: 13 });
    const player = world.create();
    world.add(player, Player, {});
    world.add(player, Position, { x: 0, y: 0 });
    world.add(player, Equipment, {});
    world.add(player, Stamina, { stamina: 9, maxStamina: 10, staminaRegen: 1, regenCooldown: 0 });

    const sunsword = world.create();
    world.add(sunsword, NamedIdentity, { name: "Sunsword", identity: "sunsword" });
    world.add(sunsword, ItemInfo, {
      type: "equip",
      slot: "weapon",
      count: 1,
      bonuses: {},
      rarity: 4,
      rarityName: "epic",
      affixes: [],
    });
    world.add(sunsword, ItemCooldown, { turnsRemaining: 5, turnsMax: 12, dueTurn: 5 });
    world.get(player, Equipment).weapon = sunsword;

    const actionBarSlots = ["heal", "fireball", "arcane_bolt", "shadow_bolt", "lightning", "smite"];
    const hudFeeds = createHudFeeds(world, {
      getPlayerMana: () => ({ mana: 10, maxMana: 10 }),
      ensureActiveSpell: () => "heal",
      updateActiveSpellLabel: () => {},
      knownSpellIds: () => actionBarSlots.slice(),
      getActionBarSlots: () => actionBarSlots.slice(),
      getPinnedSpellSlots: () => [],
      autoAssignSlot: () => -1,
      autoAssignPinnedSlot: () => -1,
    });

    /** @type {any[]} */
    const payloads = [];
    const onUpdate = (ev) => payloads.push(ev?.detail || null);
    window.addEventListener("ui:updateSpellBar", onUpdate);
    hudFeeds.updateActiveSpellHUD();
    window.removeEventListener("ui:updateSpellBar", onUpdate);

    assert(payloads.length > 0, "expected desktop spell dock payload");
    const detail = payloads[payloads.length - 1];
    const slots = Array.isArray(detail?.slots) ? detail.slots : [];
    assertEquals(slots.length, 6);
    assertEquals(slots[0]?.kind, "item-use");
    assertEquals(slots[0]?.identity, "sunsword");
    assertEquals(Number(slots[0]?.itemId || 0), sunsword);
    assertEquals(Number(slots[0]?.cdRemaining || 0), 5);
    assertEquals(String(slots[1]?.id || ""), "heal");
    assertEquals(String(slots[5]?.id || ""), "lightning");
    assert(!slots.some((entry) => String(entry?.id || "") === "smite"), "expected last action bar spell to be spliced out when Sunsword occupies the dock");
  } finally {
    restoreWindow();
  }
});

// src/rules/systems/aiWeaponPickupSystem.js
// Sapient humanoid monsters (intelligence ≥ 10, tag 'humanoid') pick up weapons
// from the floor when they are unarmed and actively hunting the player.
//
// This gives the Lich — the only sapient humanoid in the current roster — the
// ability to arm itself from fallen gear.  Future humanoids can join by adding
// intelligence: 10 and the 'humanoid' tag to their def.

import { Position }     from "../components/Position.js";
import { Faction }      from "../components/Faction.js";
import { Equipment }    from "../components/Equipment.js";
import { ItemInfo }     from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { Vitality }     from "../components/Vitality.js";
import { Unpaid }       from "../components/Unpaid.js";
import { Player }       from "../components/Player.js";
import { getMonster }   from "../data/monsters.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import {
  resolveEquipmentView,
  setEquippedSlotTopology,
} from "../utils/equipmentTopology.js";

// Only check near the player so we don't burn time on distant monsters.
const WEAPON_PICKUP_ACTIVE_RADIUS = 24;
// Scan radius for weapons on the floor (immediate adjacency + self tile).
const WEAPON_SCAN_RADIUS = 1;

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiWeaponPickupSystem(world) {
  let playerPos = null;
  for (const [, , pos] of world.query(Player, Position)) {
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  forEachInRadius(world, playerPos.x, playerPos.y, WEAPON_PICKUP_ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "enemy") return;

    const ni  = world.get(id, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    if (!def) return;

    // Only sapient humanoids pick up weapons.
    if ((def.intelligence ?? 0) < 10) return;
    if (!Array.isArray(def.tags) || !def.tags.includes("humanoid")) return;

    // Only bother when actively hunting (no arming during idle wandering).
    const aggro = world.get(id, AggroState);
    if (!aggro || aggro.alertLevel !== AGGRO_LEVELS.hunting) return;

    // Only arm when currently unarmed.
    const eq = world.get(id, Equipment);
    if (!eq || resolveEquipmentView(world, id).weapon > 0) return;

    // Scan adjacent floor tiles for a droppable weapon.
    let weaponId = null;
    forEachInRadius(world, pos.x | 0, pos.y | 0, WEAPON_SCAN_RADIUS, (itemId) => {
      if (weaponId !== null) return;   // already found one
      if (itemId === id) return;       // don't try to equip yourself

      const info = world.get(itemId, ItemInfo);
      if (!info || info.type !== "weapon") return;

      // Must be a floor item, not a living entity.
      if (world.get(itemId, Vitality)) return;

      // Don't steal from shops.
      if (world.get(itemId, Unpaid)) return;

      weaponId = itemId;
    });

    if (weaponId === null) return;

    // Pick it up: remove from floor and slot it as the weapon.
    try { world.remove(weaponId, Position); } catch {}
    world.mutate(id, Equipment, r => { r.weapon = weaponId; });
    setEquippedSlotTopology(world, id, "weapon", weaponId);

    world.emit("pickup",  { id, itemId: weaponId, at: { x: pos.x | 0, y: pos.y | 0 } });
    world.emit("message", { text: `The ${def.name} snatches up a weapon!`, kind: "warning" });
  });
}

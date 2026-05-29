import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Traits } from "../components/Traits.js";
import { getPassiveBonuses } from "./passiveBonuses.js";

function addSource(sources, source) {
  const key = String(source || "");
  if (key && !sources.includes(key)) sources.push(key);
}

function collectEquipmentControlSources(world, actorId, sources) {
  const eq = world.get(actorId, Equipment);
  if (!eq) return;
  for (const slot of NON_AMMO_GEAR_SLOTS) {
    const itemId = Number(eq[slot] || 0) | 0;
    if (!(itemId > 0) || !world.isAlive?.(itemId)) continue;
    const info = world.get(itemId, ItemInfo);
    const amount = Number(info?.bonuses?.polymorphControl || 0);
    if (!(amount > 0)) continue;
    const ident = world.get(itemId, NamedIdentity);
    addSource(sources, String(ident?.identity || ident?.name || `item:${itemId}`));
  }
}

/**
 * Resolve the actor's polymorph-control capability from permanent traits and
 * derived passive bonuses. Future surfaces should extend this function, not
 * scroll or UI code.
 *
 * @param {any} world
 * @param {number} actorId
 * @returns {{ hasControl:boolean, controlScore:number, powerScore:number, sources:string[] }}
 */
export function getPolymorphControl(world, actorId) {
  const id = Number(actorId || 0) | 0;
  const sources = [];
  if (!(id > 0) || !world?.isAlive?.(id)) {
    return Object.freeze({ hasControl: false, controlScore: 0, powerScore: 0, sources });
  }

  const traits = world.get(id, Traits);
  let controlScore = traits?.polymorph_control ? 1 : 0;
  if (traits?.polymorph_control) addSource(sources, "trait:polymorph_control");

  const passive = getPassiveBonuses(world, id);
  const passiveControl = Number(passive?.polymorphControlDerived || 0);
  const powerScore = Number(passive?.polymorphPowerDerived || 0);
  if (passiveControl > 0) {
    controlScore += passiveControl;
    collectEquipmentControlSources(world, id, sources);
    if (!sources.some((source) => source.startsWith("ring_") || source.startsWith("item:"))) {
      addSource(sources, "passive:polymorph_control");
    }
  }

  return Object.freeze({
    hasControl: controlScore > 0,
    controlScore,
    powerScore,
    sources: Object.freeze(sources),
  });
}


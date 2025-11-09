import { Potion } from "../components/Potion.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { DrinkIntent } from "../components/Intents/DrinkIntent.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { DamageSpec } from "../components/DamageSpec.js";
import { Vitality } from "../components/Vitality.js";
// import { Physiology } from "../components/Physiology.js"; // optional for advanced toxicity scaling

/**
 * drinkSystem — resolves DrinkIntent:
 * - validates route
 * - consumes one dose
 * - pushes time-phased effects into ActiveEffects
 * - applies immediate channels (DamageSpec) if present
 * - schedules hangover if any
 */
export function drinkSystem(world) {
  for (const [actor, intent] of world.query(DrinkIntent)) {
    const item = intent.itemId;
    if (!world.has(item, Potion)) {
      world.remove(actor, DrinkIntent);
      continue;
    }

    const pot = world.get(item, Potion);
    const target = intent.targetId || actor;

    // // Route gating (extend as needed)
    // const allowed = (
    //   pot.route === "oral" ||
    //   pot.route === "inhale" ||
    //   pot.route === "inject" ||
    //   pot.route === "topical" ||
    //   pot.route === "splash"
    // );
    // if (!allowed) {
    //   world.remove(actor, DrinkIntent);
    //   continue;
    // }

    // 1) consume dose; if empty, decrement stack or remove from inventory then destroy
    pot.doses -= 1;
    if (pot.doses <= 0) {
      // If item stacks via ItemInfo.count, decrement stack instead of destroying immediately
      const info = world.get(item, ItemInfo);
      if (info && Number.isFinite(info.count) && (info.count | 0) > 1) {
        // reset doses for the next item in the stack (assume each unit has default doses=1)
        world.mutate(item, ItemInfo, /** @param {any} r */ (r) => { r.count = (r.count | 0) - 1; });
        pot.doses = 1; // refresh dose for the remaining stacked unit
      } else {
        // remove from actor inventory list before destroying to avoid dangling references
        const inv = world.get(actor, Inventory);
        if (inv && Array.isArray(inv.items)) {
          const idx = inv.items.indexOf(item);
          if (idx >= 0) inv.items.splice(idx, 1);
        }
        world.destroy(item);
      }
    }

    // 2) immediate channels (beneficial or harmful)
    if (pot.channels?.length) {
      let spec = world.get(target, DamageSpec);
      if (!spec) { try { world.add(target, DamageSpec, { channels: [] }); spec = world.get(target, DamageSpec); } catch {} }
      if (spec) spec.channels.push(...pot.channels);
    }

    // 3) staged effects with stacking policies
  let ae = world.get(target, ActiveEffects);
  if (!ae) { try { world.add(target, ActiveEffects, { effects: [] }); ae = world.get(target, ActiveEffects); } catch {} }
    for (const e of pot.effects) {
      // Resolve percent-of-max potency into absolute numbers at use time
      let eff = { ...e };
      if (eff?.meta && typeof eff.meta.percentOfMaxHp === 'number') {
        const vit = world.get(target, Vitality);
        const pct = Math.max(0, Math.min(1, Number(eff.meta.percentOfMaxHp || 0)));
        const base = Math.max(1, Math.floor((vit?.maxHp || 0) * pct));
        eff.potency = base;
      }
      const existing = ae.effects.filter((x) => x.key === eff.key);
      if (eff.stack === "refresh" && existing.length) {
        for (const x of existing) {
          x.potency = eff.potency;
          x.onsetLeft = eff.onset;
          x.peakLeft = eff.peak;
          x.turnsLeft = eff.duration;
        }
      } else if (eff.stack === "cap" && existing.length >= (eff.maxStacks ?? 1)) {
        strongest(existing).turnsLeft = eff.duration;
      } else {
        ae.effects.push({
          key: eff.key,
          potency: eff.potency,
          onsetLeft: eff.onset,
          peakLeft: eff.peak,
          turnsLeft: eff.duration,
          startedAtTurn: world.step,
          sourceId: item,
          meta: { route: pot.route, name: pot.name },
        });
      }
    }

    // 4) optional hangover scheduling
    if (pot.toxicity?.hangover) {
      const delay = Math.max(1, Math.round(meanDuration(pot.effects) * 0.6));
      ae.effects.push({
        key: "hangover",
        potency: pot.toxicity.hangover,
        onsetLeft: delay,
        peakLeft: 0,
        turnsLeft: Math.max(2, delay),
        startedAtTurn: world.step,
        sourceId: item,
        meta: { name: `${pot.name} (rebound)` },
      });
    }

    // Emit events via world (bridge-friendly)
  try { world.emit && world.emit('effectsChanged', { entity: target, effects: ae.effects }); } catch {}
  try { world.emit && world.emit('drank', { actor, itemId: item, target }); } catch {}
  // Align with useItemSystem: signal UI to refresh and systems to react uniformly
  try { world.emit && world.emit('item:used', { actor, itemId: item }); } catch {}

    // clear intent
    world.remove(actor, DrinkIntent);
  }
}

function strongest(arr) {
  return arr.reduce((a, b) => (a.potency >= b.potency ? a : b));
}
function meanDuration(effects) {
  return Math.max(
    1,
    Math.round(
      effects.reduce((s, e) => s + e.duration, 0) / (effects.length || 1)
    )
  );
}

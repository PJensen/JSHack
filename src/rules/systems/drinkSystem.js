import { Potion } from "../components/Potion.js";
import { DrinkIntent } from "../components/Intents/DrinkIntent.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { DamageSpec } from "../components/DamageSpec.js";
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

    // Route gating (extend as needed)
    const allowed = (
      pot.route === "oral" ||
      pot.route === "inhale" ||
      pot.route === "inject" ||
      pot.route === "topical" ||
      pot.route === "splash"
    );
    if (!allowed) {
      world.remove(actor, DrinkIntent);
      continue;
    }

    // 1) consume dose (destroy item if empty)
    pot.doses -= 1;
    if (pot.doses <= 0) world.destroy(item);

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
      const existing = ae.effects.filter((x) => x.key === e.key);
      if (e.stack === "refresh" && existing.length) {
        for (const x of existing) {
          x.potency = e.potency;
          x.onsetLeft = e.onset;
          x.peakLeft = e.peak;
          x.turnsLeft = e.duration;
        }
      } else if (e.stack === "cap" && existing.length >= (e.maxStacks ?? 1)) {
        strongest(existing).turnsLeft = e.duration;
      } else {
        ae.effects.push({
          key: e.key,
          potency: e.potency,
          onsetLeft: e.onset,
          peakLeft: e.peak,
          turnsLeft: e.duration,
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

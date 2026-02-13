// Consumable item use scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { Hunger } from "../components/Hunger.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";

// Eat food: reduce hunger by nutrition, convert surplus to satiation,
// and apply special corpse effects (poison, disease, shock, etc.)
// Params: { nutrition: number, special?: string|null }
registerScript('consumable:eat', {
  [ScriptVerb.ItemUse]: (world, ctx) => {
    const actor = Number(ctx?.actor || 0) || 0;
    const itemId = Number(ctx?.itemId || 0) || 0;
    const nutrition = Number(ctx?.params?.nutrition || 0);
    const special = ctx?.params?.special || null;

    const hc = world.get(actor, Hunger);
    if (!hc) return;

    // Check if this is a pet corpse being eaten (desecration!)
    if (itemId > 0 && world.has(itemId, Pet)) {
      const owner = world.get(itemId, Owner);
      const corpseIdent = world.get(itemId, NamedIdentity);
      try {
        world.emit && world.emit('corpse:desecrated', {
          actor,
          itemId,
          ownerId: owner?.ownerId || 0,
          corpseName: corpseIdent?.name || 'pet corpse',
        });
      } catch { /* */ }
    }

    const newHunger = hc.hunger - nutrition;
    if (newHunger < 0) {
      hc.satiation = Math.min(hc.satiation + Math.abs(newHunger), 200);
      hc.hunger = 0;
    } else {
      hc.hunger = newHunger;
    }

    try {
      world.emit && world.emit('hunger:ate', {
        actor, nutrition, newHunger: hc.hunger, satiation: hc.satiation,
      });
    } catch { /* */ }

    if (!special) return;

    let ae = world.get(actor, ActiveEffects);
    if (!ae) {
      try { world.add(actor, ActiveEffects, { effects: [] }); ae = world.get(actor, ActiveEffects); } catch { /* */ }
    }
    if (!ae) return;

    switch (special) {
      case 'poison':
        ae.effects.push({ key: 'poison', turnsLeft: 8, potency: 2, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'poison' }); } catch { /* */ }
        break;
      case 'disease':
        ae.effects.push({ key: 'disease', turnsLeft: 20, potency: 1, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'disease' }); } catch { /* */ }
        break;
      case 'shock': {
        const vit = world.get(actor, Vitality);
        if (vit) {
          const dmg = 3;
          vit.hp = Math.max(0, vit.hp - dmg);
          try { world.emit && world.emit('damage', { id: actor, amount: dmg, source: 'corpse' }); } catch { /* */ }
        }
        break;
      }
      case 'mindwipe':
        ae.effects.push({ key: 'mindwipe', turnsLeft: 15, potency: 1, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'mindwipe' }); } catch { /* */ }
        break;
      case 'hallucination':
        ae.effects.push({ key: 'mindwipe', turnsLeft: 30, potency: 2, stacks: 1, sourceId: actor });
        try { world.emit && world.emit('hunger:sickened', { actor, type: 'hallucination' }); } catch { /* */ }
        break;
    }
  },
});

// Scroll of Mapping: reveal entire dungeon map.
registerScript('consumable:mapping', {
  [ScriptVerb.ItemUse]: (_world, _ctx) => {
    forEachLoadedTile((x, y) => markExplored(x, y));
  },
});

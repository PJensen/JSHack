import { defineItem } from '../define.js';
import {
  canPoisonDipTarget,
  createPoisonCoatDipHook,
  createPoisonCloudThrowHook,
  canParalysisDipTarget,
  createParalysisCoatDipHook,
  canStonecoatDipTarget,
  createWaterPotionHooks,
  createPotionSplashThrowHook,
  createWeaponCoatingDipHook,
  resolveApplyTargetName,
} from '../../rules/data/itemCatalogHooks.js';
import { Vitality } from '../../rules/components/Vitality.js';
import { Stamina } from '../../rules/components/Stamina.js';
import { ActiveEffects } from '../../rules/components/ActiveEffects.js';
import { createStatusEvent } from '../../shared/events/statusEvent.js';
import { getPassiveBonuses } from '../../rules/utils/passiveBonuses.js';
import { attachDerivedExpression, exprAddConst } from '../../rules/utils/statProcAuthoring.js';

function cleanupPriorExprEntity(ctx, targetId, effectKey) {
  const ae = ctx.query.get(targetId, ActiveEffects);
  if (!ae || !Array.isArray(ae.effects)) return;
  for (const e of ae.effects) {
    if (e?.key !== effectKey) continue;
    const exprId = e?.meta?.exprEntityId;
    if (typeof exprId === 'number' && exprId > 0) {
      try { ctx.world.destroy(exprId); } catch {}
    }
  }
}

function throwLandingPoint(ctx, state) {
  const actorId = Number(state?.actor || ctx.actor || 0) | 0;
  const throwSpec = (state?.throw && typeof state.throw === 'object') ? state.throw : null;
  const fallback = ctx.helpers.adjacentPoint(actorId);
  return {
    x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0),
    y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0),
  };
}

function forEachLivingInSplash(ctx, at, radius, actorId, fn) {
  const r = Math.max(0, Number(radius || 0) | 0);
  const seen = new Set();
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const ids = ctx.query.livingAt((at.x | 0) + dx, (at.y | 0) + dy, {});
      for (const id of (Array.isArray(ids) ? ids : [])) {
        const hitId = Number(id || 0) | 0;
        if (!(hitId > 0) || hitId === actorId || seen.has(hitId)) continue;
        seen.add(hitId);
        fn(hitId);
      }
    }
  }
  return seen.size;
}

defineItem('potion_poison', {
  name: 'Potion of Poison', type: 'potion', material: 'glass', rarity: 'common', value: 20, weight: 0.5,
  coating_color: '#66dd66',
  description: 'A toxic brew that can be used to coat a weapon.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'poison', duration: 10, turnsLeft: 10, potency: 2, stack: 'add', maxStacks: 3 }], toxicity: null, feel: 'It tastes acrid and vile. Your stomach heaves!' },
  hooks: {
    can_dip_target: canPoisonDipTarget,
    on_dip: createPoisonCoatDipHook({ chargesGranted: 12, coatingColor: '#66dd66', messageTemplate: 'You coat $targetName with poison (+$chargesGranted charges, total $chargesTotal).' }),
    on_throw: createPoisonCloudThrowHook({ turnsLeft: 3, radius: 1, tickDamage: 2, medium: 'floor' }),
  },
});

defineItem('potion_water', {
  name: 'Potion of Water', type: 'potion', material: 'glass', rarity: 'common', value: 12, weight: 0.5,
  description: 'Clear water in a fragile vial. Useful for quenching, blessing, and splashing.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, beatitude: 'uncursed', feel: 'It tastes like plain water.' },
  hooks: createWaterPotionHooks(),
});

defineItem('potion_holy_water', {
  name: 'Vial of Holy Water', type: 'potion', material: 'glass', rarity: 'magic', value: 30, weight: 0.5,
  description: 'Consecrated water that purges flame and carries a blessing.',
  beatitude: 'blessed',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'It tastes pure and faintly warm.' },
  hooks: createWaterPotionHooks(),
});

defineItem('potion_stoneskin', {
  name: 'Potion of Stoneskin', type: 'potion', material: 'glass', rarity: 'magic', value: 60, weight: 0.5,
  description: 'Turns skin to granite, can harden gear, and can shatter into a taunting statue.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Your skin prickles and feels curiously heavy.' },
  hooks: {
    can_dip_target: canStonecoatDipTarget,
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      const turns = ctx.helpers.int(30, 40);
      const potency = ctx.helpers.int(2, 3);
      ctx.helpers.addEffect(targetId, { key: 'stoneskin', potency, turnsLeft: turns, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_stoneskin', kind: 'armor_buff', masked: !state.identified } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'stoneskin', source: actorId, masked: !state.identified }));
      return { turns, potency };
    },
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const throwSpec = (state?.throw && typeof state.throw === 'object') ? state.throw : null;
      const fallbackPoint = ctx.helpers.adjacentPoint(actorId);
      const rawLandingX = Number(throwSpec?.to?.x ?? state?.targetX);
      const rawLandingY = Number(throwSpec?.to?.y ?? state?.targetY);
      const spawnAt = { x: Number.isFinite(rawLandingX) ? (rawLandingX | 0) : (fallbackPoint.x | 0), y: Number.isFinite(rawLandingY) ? (rawLandingY | 0) : (fallbackPoint.y | 0) };
      const rawFromX = Number(throwSpec?.from?.x);
      const rawFromY = Number(throwSpec?.from?.y);
      const from = (Number.isFinite(rawFromX) && Number.isFinite(rawFromY)) ? { x: rawFromX | 0, y: rawFromY | 0 } : null;
      const taunts = ['A stone statue lurches upright and starts heckling you.', 'The shattered potion hardens into a taunting idol.', 'Granite dust spirals into a jeering stone sentinel.'];
      const tauntMessage = ctx.helpers.pick(taunts, taunts[0]);
      ctx.helpers.spawnMonster('stone_taunter', spawnAt, { name: 'Taunting Statue', faction: 'stone_taunter', tauntMessage });
      ctx.io.emit('item:thrown', { actor: actorId, itemId: Number(state?.itemId || ctx.primary || 0) | 0, targetId: Number(state?.targetId || ctx.target || 0) | 0, from, to: { x: spawnAt.x, y: spawnAt.y }, range: Number.isFinite(Number(throwSpec?.range)) ? (Number(throwSpec.range) | 0) : null, maxRange: Number.isFinite(Number(throwSpec?.maxRange)) ? (Number(throwSpec.maxRange) | 0) : null, weight: Number.isFinite(Number(throwSpec?.weight)) ? Number(throwSpec.weight) : null, path: 'itemHooks', result: { type: 'stone_statue' } });
      return { consumed: true, spawned: 'stone_taunter', at: spawnAt };
    },
    on_dip: (ctx, state) => {
      const actor = Number(state?.actor || ctx.actor || 0) | 0;
      const toolId = Number(state?.toolId || ctx.primary || 0) | 0;
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      const acBonus = 1;
      if (!(targetId > 0) || !ctx.query.alive(targetId)) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const info = ctx.query.itemInfo(targetId);
      const bonuses = (info?.bonuses && typeof info.bonuses === 'object') ? { ...info.bonuses } : {};
      bonuses.defense = Number(bonuses.defense || 0) + acBonus;
      const targetName = resolveApplyTargetName(ctx, state, 'item');
      const acText = acBonus > 0 ? `+${acBonus}` : `${acBonus}`;
      ctx.helpers.setMaterial(targetId, 'stone');
      ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || 'Item')} Its surface is plated with living stone.` });
      ctx.io.emit('item:applied', { actor, toolId, targetId, result: { type: 'stonecoat', acBonus, defenseBonus: acBonus, message: `You harden ${targetName} into living stone (AC ${acText}).` } });
      return { applied: true, consumedTool: true, resultType: 'stonecoat' };
    },
  },
});

defineItem('potion_vigor', {
  name: 'Health Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 40, weight: 0.5,
  description: 'A crimson draught that mends wounds in a single heartbeat.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Your wounds knit closed with a rush of heat.' },
  hooks: {
    can_dip_target: canPoisonDipTarget,
    on_drink: (ctx, state) => {
      const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
      const vit = ctx.query.get(targetId, Vitality);
      if (!vit) return { healed: 0 };
      const amount = Math.max(1, Math.floor(vit.maxHp * 0.25));
      ctx.helpers.heal(targetId, amount);
      return { healed: amount };
    },
    on_dip: createWeaponCoatingDipHook({
      kind: 'lifedraw',
      chargesGranted: 8,
      coatingColor: '#b82228',
      resultType: 'lifedraw_coat',
      messageTemplate: 'You wake a red thirst in $targetName (+$chargesGranted charges, total $chargesTotal).',
    }),
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const at = throwLandingPoint(ctx, state);
      ctx.helpers.hazardSpawn({
        kind: 'blood_pool',
        medium: 'floor',
        turnsLeft: 4,
        radius: 1,
        tickDamage: 0,
        damageType: 'holy',
        cause: 'vigor_blood_pool',
        sourceId: itemId,
        sourceKind: 'potion_vigor',
        identity: 'blood_pool',
        name: 'Pool of Blood',
        meta: { source: 'potion_vigor', healAmount: 1, undeadDamage: 2 },
      }, at);
      ctx.io.emit('potion:splash', { actor: actorId, itemId, at: { ...at }, effectKey: 'blood_pool', hitCount: 0, sourceKind: 'potion_vigor' });
      return { consumed: true, at, hazardKind: 'blood_pool' };
    },
  },
});

defineItem('potion_adrenaline', {
  name: 'Berserk Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 45, weight: 0.5,
  description: 'A jolt of pure energy that instantly restores all stamina.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Your heart pounds with sudden, explosive energy.' },
  hooks: {
    can_dip_target: canPoisonDipTarget,
    on_drink: (ctx, state) => {
      const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
      const stam = ctx.query.get(targetId, Stamina);
      if (!stam) return { restored: 0 };
      const maxBonus = Number(getPassiveBonuses(ctx.world, targetId)?.maxStaminaDerived ?? 0);
      const cap = stam.maxStamina + maxBonus;
      const before = stam.stamina;
      stam.stamina = cap;
      return { restored: stam.stamina - before };
    },
    on_dip: createWeaponCoatingDipHook({
      kind: 'adrenaline',
      chargesGranted: 8,
      coatingColor: '#ff3a2e',
      resultType: 'adrenaline_coat',
      messageTemplate: 'You prime $targetName with adrenal heat (+$chargesGranted charges, total $chargesTotal).',
    }),
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const at = throwLandingPoint(ctx, state);
      const hitCount = forEachLivingInSplash(ctx, at, 1, actorId, (hitId) => {
        ctx.helpers.addEffect(hitId, { key: 'berserk', potency: 1, turnsLeft: 8, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: itemId, meta: { source: 'potion_adrenaline', delivery: 'splash' } });
      });
      ctx.io.emit('potion:splash', { actor: actorId, itemId, at: { ...at }, effectKey: 'berserk', hitCount, sourceKind: 'potion_adrenaline' });
      return { consumed: true, at, effectKey: 'berserk' };
    },
  },
});

defineItem('potion_mana', {
  name: 'Mana Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 50, weight: 0.5,
  identified: true,
  description: 'A shimmering azure elixir that accelerates mana recovery for a short time.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Your mind buzzes with arcane static.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      cleanupPriorExprEntity(ctx, targetId, 'mana_potion_regen');
      const exprId = attachDerivedExpression(ctx.world, targetId, exprAddConst('manaRegen', 3, { stage: 'derived' }));
      ctx.helpers.addEffect(targetId, { key: 'mana_potion_regen', turnsLeft: 20, potency: 1, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_mana', exprEntityId: exprId } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'mana_regen', source: actorId, masked: !state.identified }));
      return { turns: 20 };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'silenced', duration: 6, potency: 1, sourceKind: 'potion_mana' }),
  },
});

defineItem('potion_endurance', {
  name: 'Stamina Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 35, weight: 0.5,
  description: 'Liquid lightning that floods the muscles with stamina.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'stamina_restore', potency: 1, onset: 0, peak: 0, duration: 100, stack: 'refresh', maxStacks: 1 }], toxicity: null, feel: 'Your muscles surge with newfound vigour.' },
  hooks: {
    on_throw: createPotionSplashThrowHook({ effectKey: 'stamina_restore', duration: 50, potency: 1, sourceKind: 'potion_endurance' }),
  },
});

defineItem('potion_second_wind', {
  name: 'Stamina Elixir', type: 'potion', material: 'glass', rarity: 'magic', value: 50, weight: 0.5,
  description: 'A cool teal elixir that quickens stamina recovery for several turns.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'stamina_regen_boost', potency: 3, onset: 0, peak: 0, duration: 25, stack: 'refresh', maxStacks: 1 }], toxicity: null, feel: 'Your lungs open; your breathing quickens and steadies.' },
  hooks: {
    on_throw: createPotionSplashThrowHook({ effectKey: 'stamina_regen_boost', duration: 12, potency: 3, sourceKind: 'potion_second_wind' }),
  },
});

defineItem('potion_resist_fire', {
  name: 'Fire Ward Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 55, weight: 0.5,
  description: 'An icy draught that coats the drinker in a shimmering heat ward.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'A cool wave washes over your body.' },
  hooks: {
    on_drink: (ctx, state) => {
      const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
      ctx.helpers.addEffect(targetId, { key: 'resist_fire', potency: 0.3, turnsLeft: 40, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_resist_fire', kind: 'resist_buff', masked: !state.identified } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'resist_fire', source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
      return { resist: 'fire', duration: 40 };
    },
    can_dip_target: canStonecoatDipTarget,
    on_dip: (ctx, state) => {
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const info = ctx.query.itemInfo(targetId);
      const bonuses = (info?.bonuses && typeof info.bonuses === 'object') ? { ...info.bonuses } : {};
      bonuses.fireResist = Math.min(0.5, Number(bonuses.fireResist || 0) + 0.1);
      const targetName = resolveApplyTargetName(ctx, state, 'item');
      ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || 'Item')} Infused with fire resistance (+10%).` });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId, result: { type: 'resist_enchant', resistType: 'fire', bonus: 0.1, message: `You infuse ${targetName} with fire resistance (+10%, max 50%).` } });
      return { applied: true, consumedTool: true, resultType: 'resist_fire_enchant' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'resist_fire', duration: 20, potency: 0.3, sourceKind: 'potion_resist_fire' }),
  },
});

defineItem('potion_resist_poison', {
  name: 'Poison Ward Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 55, weight: 0.5,
  description: 'A bitter emerald tonic that fortifies the body against toxins.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'It burns your throat with a sharp intensity.' },
  hooks: {
    on_drink: (ctx, state) => {
      const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
      ctx.helpers.addEffect(targetId, { key: 'resist_poison', potency: 0.3, turnsLeft: 40, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_resist_poison', kind: 'resist_buff', masked: !state.identified } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'resist_poison', source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
      return { resist: 'poison', duration: 40 };
    },
    can_dip_target: canStonecoatDipTarget,
    on_dip: (ctx, state) => {
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const info = ctx.query.itemInfo(targetId);
      const bonuses = (info?.bonuses && typeof info.bonuses === 'object') ? { ...info.bonuses } : {};
      bonuses.poisonResist = Math.min(0.5, Number(bonuses.poisonResist || 0) + 0.1);
      const targetName = resolveApplyTargetName(ctx, state, 'item');
      ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || 'Item')} Infused with poison resistance (+10%).` });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId, result: { type: 'resist_enchant', resistType: 'poison', bonus: 0.1, message: `You infuse ${targetName} with poison resistance (+10%, max 50%).` } });
      return { applied: true, consumedTool: true, resultType: 'resist_poison_enchant' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'resist_poison', duration: 20, potency: 0.3, sourceKind: 'potion_resist_poison' }),
  },
});

defineItem('potion_anti_venom', {
  name: 'Anti-Venom', type: 'potion', material: 'glass', rarity: 'magic', value: 40, weight: 0.5,
  description: 'A milky white serum that instantly neutralises all poisons in the body.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'It tastes medicinal and faintly chalky.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      const hadPoison = ctx.helpers.hasStatus(targetId, 'poisoned') || ctx.helpers.hasStatus(targetId, 'poison');
      ctx.helpers.clearEffects(targetId, ['poison', 'poisoned']);
      if (hadPoison) ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'cure', effect: 'poison', source: actorId }));
      return { cured: hadPoison ? 'poison' : 'none' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'resist_poison', duration: 15, potency: 0.2, sourceKind: 'potion_anti_venom' }),
  },
});

defineItem('potion_resist_electric', {
  name: 'Lightning Ward Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 55, weight: 0.5,
  description: 'A crackling blue elixir that grounds the drinker against electrical surges.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'A faint tingle runs over your skin.' },
  hooks: {
    on_drink: (ctx, state) => {
      const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
      ctx.helpers.addEffect(targetId, { key: 'resist_electric', potency: 0.3, turnsLeft: 40, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_resist_electric', kind: 'resist_buff', masked: !state.identified } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'resist_electric', source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
      return { resist: 'electric', duration: 40 };
    },
    can_dip_target: canStonecoatDipTarget,
    on_dip: (ctx, state) => {
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const info = ctx.query.itemInfo(targetId);
      const bonuses = (info?.bonuses && typeof info.bonuses === 'object') ? { ...info.bonuses } : {};
      bonuses.electricResist = Math.min(0.5, Number(bonuses.electricResist || 0) + 0.1);
      const targetName = resolveApplyTargetName(ctx, state, 'item');
      ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || 'Item')} Infused with lightning resistance (+10%).` });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId, result: { type: 'resist_enchant', resistType: 'electric', bonus: 0.1, message: `You infuse ${targetName} with lightning resistance (+10%, max 50%).` } });
      return { applied: true, consumedTool: true, resultType: 'resist_electric_enchant' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'resist_electric', duration: 20, potency: 0.3, sourceKind: 'potion_resist_electric' }),
  },
});

defineItem('potion_resist_acid', {
  name: 'Acid Ward Potion', type: 'potion', material: 'glass', rarity: 'magic', value: 55, weight: 0.5,
  description: 'A thick amber syrup that shields the skin from corrosive burns.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'It coats your throat with a thick, amber warmth.' },
  hooks: {
    on_drink: (ctx, state) => {
      const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
      ctx.helpers.addEffect(targetId, { key: 'resist_acid', potency: 0.3, turnsLeft: 40, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_resist_acid', kind: 'resist_buff', masked: !state.identified } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'resist_acid', source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
      return { resist: 'acid', duration: 40 };
    },
    can_dip_target: canStonecoatDipTarget,
    on_dip: (ctx, state) => {
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const info = ctx.query.itemInfo(targetId);
      const bonuses = (info?.bonuses && typeof info.bonuses === 'object') ? { ...info.bonuses } : {};
      bonuses.acidResist = Math.min(0.5, Number(bonuses.acidResist || 0) + 0.1);
      const targetName = resolveApplyTargetName(ctx, state, 'item');
      ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || 'Item')} Infused with acid resistance (+10%).` });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId, result: { type: 'resist_enchant', resistType: 'acid', bonus: 0.1, message: `You infuse ${targetName} with acid resistance (+10%, max 50%).` } });
      return { applied: true, consumedTool: true, resultType: 'resist_acid_enchant' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'resist_acid', duration: 20, potency: 0.3, sourceKind: 'potion_resist_acid' }),
  },
});

defineItem('potion_sickness', {
  name: 'Potion of Sickness', type: 'potion', material: 'glass', rarity: 'common', value: 5, weight: 0.5,
  description: 'A foul brew that turns your stomach.',
  potion: { route: 'oral', doses: 1, channels: [{ type: 'damage', amount: 4 }], effects: [{ key: 'poison', potency: 2, onset: 0, peak: 0, duration: 15, stack: 'add', meta: { source: 'potion_sickness' } }], feel: 'Your stomach lurches violently.' },
  hooks: {
    on_drink: (ctx, state) => { const actor = Number(state?.actor || ctx.actor || 0) | 0; ctx.io.emit('potion:sickness', { actor }); return { consumed: true }; },
    on_throw: createPotionSplashThrowHook({ effectKey: 'poison', duration: 8, potency: 2, damage: 4, damageType: 'poison', sourceKind: 'potion_sickness' }),
  },
});

defineItem('potion_paralysis', {
  name: 'Potion of Paralysis', type: 'potion', material: 'glass', rarity: 'common', value: 5, weight: 0.5,
  description: 'A thick, syrupy liquid that locks every muscle in place. Can be used to coat weapons or arrows.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'stun', potency: 1, onset: 0, peak: 0, duration: 10, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_paralysis' } }], feel: 'Your body goes rigid. You can\'t move!' },
  hooks: {
    on_drink: (ctx, state) => { const actor = Number(state?.actor || ctx.actor || 0) | 0; ctx.io.emit('potion:paralysis', { actor }); return { consumed: true }; },
    on_throw: createPotionSplashThrowHook({ effectKey: 'stun', duration: 5, potency: 1, sourceKind: 'potion_paralysis' }),
    can_dip_target: canParalysisDipTarget,
    on_dip: createParalysisCoatDipHook({ chargesGranted: 8, coatingColor: '#ccaa44', messageTemplate: 'You coat $targetName with paralytic venom (+$chargesGranted charges, total $chargesTotal).' }),
  },
});

defineItem('potion_hallucination', {
  name: 'Potion of Hallucination', type: 'potion', material: 'glass', rarity: 'common', value: 5, weight: 0.5,
  description: 'A swirling iridescent brew. The walls are breathing.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'hallucinating', potency: 1, onset: 0, peak: 0, duration: 35, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_hallucination' } }], feel: 'The colours... they\'re singing.' },
  hooks: {
    can_dip_target: canParalysisDipTarget,
    on_dip: (ctx, state) => {
      const targetInfo = state?.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
      const chargesGranted = 4;
      const nextCharges = currentCharges + chargesGranted;
      const coating = { kind: 'hallucination', charges: nextCharges };
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(state.targetId, { coating });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: 'hallucination_coat', coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with mind-bending vapour (+${chargesGranted} charges, total ${nextCharges}).` } });
      return { applied: true, consumedTool: true, resultType: 'hallucination_coat' };
    },
    on_drink: (ctx, state) => { const actor = Number(state?.actor || ctx.actor || 0) | 0; ctx.io.emit('potion:hallucination', { actor }); return { consumed: true }; },
    on_throw: createPotionSplashThrowHook({ effectKey: 'confused', duration: 10, potency: 1, sourceKind: 'potion_hallucination' }),
  },
});

defineItem('potion_blindness', {
  name: 'Potion of Blindness', type: 'potion', material: 'glass', rarity: 'common', value: 5, weight: 0.5,
  description: 'A pitch-black draught that steals the light from your eyes.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], feel: 'Everything goes dark.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actor = Number(state?.actor || ctx.actor || 0) | 0;
      const startValue = Number(ctx.query.effectiveVisionRange(actor) || 0);
      ctx.mutate.pushEffect(actor, { key: 'stat_envelope', stat: 'visionRange', turnsLeft: 20, potency: 1, startValue, toValue: 0, endValue: startValue, rampIn: 0, hold: 20, rampOut: 0, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, startedAtTurn: Number(ctx.params?.stepHint || 0) | 0, stack: 'refresh' });
      ctx.io.emit('potion:blindness', { actor });
      return { consumed: true };
    },
    can_dip_target: canParalysisDipTarget,
    on_dip: (ctx, state) => {
      const targetInfo = state?.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
      const chargesGranted = 6;
      const nextCharges = currentCharges + chargesGranted;
      const coating = { kind: 'blindness', charges: nextCharges };
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(state.targetId, { coating });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: 'blindness_coat', coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with blinding ichor (+${chargesGranted} charges, total ${nextCharges}).` } });
      return { applied: true, consumedTool: true, resultType: 'blindness_coat' };
    },
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const throwSpec = (state?.throw && typeof state.throw === 'object') ? state.throw : null;
      const fallback = ctx.helpers.adjacentPoint(actorId);
      const at = { x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0), y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0) };
      const hitIds = ctx.query.livingAt(at.x, at.y, {});
      for (const hitId of (Array.isArray(hitIds) ? hitIds : [])) {
        const duration = 10;
        ctx.helpers.addEffect(hitId, { key: 'blinded', potency: 1, turnsLeft: duration, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: itemId, meta: { source: 'potion_blindness', delivery: 'splash' } });
        const startValue = Number(ctx.query.effectiveVisionRange(hitId) || 0);
        ctx.mutate.pushEffect(hitId, { key: 'stat_envelope', stat: 'visionRange', turnsLeft: duration, potency: 1, startValue, toValue: 0, endValue: startValue, rampIn: 0, hold: duration, rampOut: 0, sourceId: itemId, stack: 'refresh' });
      }
      ctx.io.emit('potion:splash', { at, actorId, sourceKind: 'potion_blindness' });
      return { consumed: true };
    },
  },
});

defineItem('potion_weakness', {
  name: 'Potion of Weakness', type: 'potion', material: 'glass', rarity: 'magic', value: 5, weight: 0.5,
  description: 'A thin grey liquid that drains your life force.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'weakened', potency: 1, onset: 0, peak: 0, duration: 40, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_weakness' } }], feel: 'Your strength fades. Everything feels heavier.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actor = Number(state?.actor || ctx.actor || 0) | 0;
      const vit = ctx.query.get(actor, Vitality);
      if (vit) { vit.maxHp = Math.max(1, (vit.maxHp | 0) - 8); if (vit.hp > vit.maxHp) vit.hp = vit.maxHp; }
      const stam = ctx.query.get(actor, Stamina);
      if (stam) { stam.max = Math.max(1, (stam.max | 0) - 8); if (stam.current > stam.max) stam.current = stam.max; }
      ctx.io.emit('potion:weakness', { actor, hpLost: 8, staminaLost: 8 });
      return { consumed: true };
    },
    can_dip_target: canParalysisDipTarget,
    on_dip: (ctx, state) => {
      const targetInfo = state?.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
      const chargesGranted = 8;
      const nextCharges = currentCharges + chargesGranted;
      const coating = { kind: 'weakness', charges: nextCharges };
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(state.targetId, { coating });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: 'weakness_coat', coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with enervating tincture (+${chargesGranted} charges, total ${nextCharges}).` } });
      return { applied: true, consumedTool: true, resultType: 'weakness_coat' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'weakened', duration: 20, potency: 1, sourceKind: 'potion_weakness' }),
  },
});

defineItem('potion_mana_surge', {
  name: 'Mana Elixir', type: 'potion', material: 'glass', rarity: 'magic', value: 55, weight: 0.5,
  description: 'A luminous azure draught that accelerates mana recovery for several turns.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Arcane energy crackles through your veins.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      cleanupPriorExprEntity(ctx, targetId, 'mana_surge_expr');
      const exprId = attachDerivedExpression(ctx.world, targetId, exprAddConst('manaRegen', 2, { stage: 'derived' }));
      ctx.helpers.addEffect(targetId, { key: 'mana_surge_expr', turnsLeft: 30, potency: 1, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_mana_surge', exprEntityId: exprId } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'mana_surge', source: actorId, masked: !state.identified }));
      return { turns: 30 };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'silenced', duration: 10, potency: 1, sourceKind: 'potion_mana_surge' }),
  },
});

defineItem('potion_keen_edge', {
  name: 'Potion of Precision', type: 'potion', material: 'glass', rarity: 'rare', value: 70, weight: 0.5,
  description: 'A razor-sharp elixir that hones your instincts, greatly improving critical strike chance.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Your senses sharpen to a razor\'s edge.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      cleanupPriorExprEntity(ctx, targetId, 'crit_boost');
      const exprId = attachDerivedExpression(ctx.world, targetId, exprAddConst('critChancePhysical', 0.10, { stage: 'derived' }));
      ctx.helpers.addEffect(targetId, { key: 'crit_boost', turnsLeft: 35, potency: 1, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_keen_edge', exprEntityId: exprId } });
      ctx.io.emit('status', createStatusEvent({ id: targetId, kind: 'buff', effect: 'crit_boost', source: actorId, masked: !state.identified }));
      return { turns: 35 };
    },
    can_dip_target: canPoisonDipTarget,
    on_dip: (ctx, state) => {
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      const info = ctx.query.itemInfo(targetId);
      if (!(targetId > 0) || !info) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const bonuses = (info?.bonuses && typeof info.bonuses === 'object') ? { ...info.bonuses } : {};
      const bonus = 0.02;
      bonuses.critChance = Number(bonuses.critChance || 0) + bonus;
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(targetId, { bonuses });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId, result: { type: 'keen_edge_temper', bonus, critChance: bonuses.critChance, message: `You hone ${targetName} to a hungrier edge (+2% crit chance).` } });
      return { applied: true, consumedTool: true, resultType: 'keen_edge_temper' };
    },
    on_throw: createPotionSplashThrowHook({ sourceKind: 'potion_keen_edge', eventName: 'potion:splash:dud' }),
  },
});

defineItem('potion_lethargy', {
  name: 'Potion of Sluggishness', type: 'potion', material: 'glass', rarity: 'common', value: 5, weight: 0.5,
  description: 'A thick, sluggish grey brew that saps your endurance.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], feel: 'Your limbs grow heavy and sluggish.' },
  hooks: {
    can_dip_target: canParalysisDipTarget,
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      cleanupPriorExprEntity(ctx, targetId, 'lethargic');
      const exprId = attachDerivedExpression(ctx.world, targetId, exprAddConst('staminaRegen', -0.5, { stage: 'derived' }));
      ctx.helpers.addEffect(targetId, { key: 'lethargic', turnsLeft: 30, potency: 1, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_lethargy', exprEntityId: exprId } });
      ctx.io.emit('potion:lethargy', { actorId });
      return { turns: 30 };
    },
    on_dip: createWeaponCoatingDipHook({
      kind: 'lethargy',
      chargesGranted: 6,
      coatingColor: '#77716b',
      resultType: 'lethargy_coat',
      messageTemplate: 'You glaze $targetName with dragging syrup (+$chargesGranted charges, total $chargesTotal).',
    }),
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const at = throwLandingPoint(ctx, state);
      const hitCount = forEachLivingInSplash(ctx, at, 1, actorId, (hitId) => {
        ctx.helpers.addEffect(hitId, { key: 'slowed', potency: 1, turnsLeft: 12, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: itemId, meta: { source: 'potion_lethargy', delivery: 'splash' } });
      });
      ctx.helpers.hazardSpawn({
        kind: 'sticky_syrup',
        medium: 'floor',
        turnsLeft: 4,
        radius: 1,
        tickDamage: 0,
        damageType: 'generic',
        cause: 'lethargy_syrup',
        sourceId: itemId,
        sourceKind: 'potion_lethargy',
        identity: 'sticky_syrup',
        name: 'Sticky Syrup',
        meta: { source: 'potion_lethargy', slowTurns: 3, slowPotency: 1 },
      }, at);
      ctx.io.emit('potion:splash', { actor: actorId, itemId, at: { ...at }, effectKey: 'slowed', hitCount, sourceKind: 'potion_lethargy' });
      return { consumed: true, at, effectKey: 'slowed', hazardKind: 'sticky_syrup' };
    },
  },
});

defineItem('potion_speed', {
  name: 'Potion of Speed', type: 'potion', material: 'glass', rarity: 'magic', value: 55, weight: 0.5,
  description: 'A crackling silver draught. Everything slows but you.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'The world snaps into sharp focus. You feel impossibly fast.' },
  hooks: {
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      const turns = ctx.helpers.int(20, 30);
      ctx.helpers.addEffect(targetId, { key: 'hastened', potency: 2, turnsLeft: turns, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_speed', masked: !state.identified } });
      ctx.io.emit('potion:speed', { actor: actorId, turns });
      return { hastened: true, turns };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'slowed', duration: 10, potency: 2, sourceKind: 'potion_speed' }),
  },
});

defineItem('potion_confusion', {
  name: 'Potion of Confusion', type: 'potion', material: 'glass', rarity: 'common', value: 5, weight: 0.5,
  description: 'A fizzing, disorienting concoction.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [{ key: 'confused', potency: 1, onset: 0, peak: 0, duration: 15, stack: 'refresh', maxStacks: 1, meta: { source: 'potion_confusion' } }], feel: 'Which way is up? You can\'t tell anymore.' },
  hooks: {
    on_drink: (ctx, state) => { const actor = Number(state?.actor || ctx.actor || 0) | 0; ctx.io.emit('potion:confusion', { actor }); return { consumed: true }; },
    can_dip_target: canParalysisDipTarget,
    on_dip: (ctx, state) => {
      const targetInfo = state?.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
      const chargesGranted = 5;
      const nextCharges = currentCharges + chargesGranted;
      const coating = { kind: 'confusion', charges: nextCharges };
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(state.targetId, { coating });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: 'confusion_coat', coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with disorienting vapour (+${chargesGranted} charges, total ${nextCharges}).` } });
      return { applied: true, consumedTool: true, resultType: 'confusion_coat' };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'confused', duration: 12, potency: 1, sourceKind: 'potion_confusion' }),
  },
});

defineItem('potion_acid', {
  name: 'Potion of Acid', type: 'potion', material: 'glass', rarity: 'magic', value: 40, weight: 0.5,
  description: 'A hissing viridian brew that eats through most things it touches.',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Your stomach burns like a forge. Not your best decision.' },
  hooks: {
    can_dip_target: canParalysisDipTarget,
    on_dip: (ctx, state) => {
      const targetInfo = state?.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
      const chargesGranted = 8;
      const nextCharges = currentCharges + chargesGranted;
      const coating = { kind: 'acid', charges: nextCharges };
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(state.targetId, { coating });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: 'acid_coat', coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with caustic acid (+${chargesGranted} charges, total ${nextCharges}).` } });
      return { applied: true, consumedTool: true, resultType: 'acid_coat' };
    },
    on_drink: (ctx, state) => {
      const actor = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actor);
      const dmg = ctx.helpers.roll('2d6');
      ctx.helpers.damage(targetId, dmg, 'acid');
      ctx.helpers.addEffect(targetId, { key: 'burning', potency: 1, turnsLeft: 3, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_acid' } });
      ctx.io.emit('potion:acid_drink', { actor, damage: dmg });
      return { consumed: true };
    },
    on_throw: createPotionSplashThrowHook({ effectKey: 'burning', duration: 3, potency: 1, sourceKind: 'potion_acid' }),
  },
});

defineItem('potion_oil', {
  name: 'Flask of Oil', type: 'potion', material: 'glass', rarity: 'magic', value: 30, weight: 0.5,
  description: 'Thick, flammable oil. Coat a weapon in it, throw it, or drink it (not recommended).',
  potion: { route: 'oral', doses: 1, channels: [], effects: [], toxicity: null, feel: 'Oily, slick, and deeply wrong. Your throat is now a fire hazard.' },
  hooks: {
    can_dip_target: canParalysisDipTarget,
    on_dip: (ctx, state) => {
      const targetInfo = state?.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: 'nothing' };
      const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
      const chargesGranted = 10;
      const nextCharges = currentCharges + chargesGranted;
      const coating = { kind: 'oil', charges: nextCharges };
      const targetName = resolveApplyTargetName(ctx, state, 'weapon');
      ctx.helpers.patchItemInfo(state.targetId, { coating });
      ctx.io.emit('item:applied', { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: 'oil_coat', coating, chargesGranted, chargesTotal: nextCharges, message: `You slick ${targetName} with oil (+${chargesGranted} charges, total ${nextCharges}).` } });
      return { applied: true, consumedTool: true, resultType: 'oil_coat' };
    },
    on_drink: (ctx, state) => {
      const actor = Number(state?.actor || ctx.actor || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actor);
      ctx.helpers.addEffect(targetId, { key: 'burning', potency: 2, turnsLeft: 5, onsetLeft: 0, peakLeft: 0, stack: 'refresh', maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: 'potion_oil' } });
      ctx.io.emit('potion:oil_drink', { actor });
      return { consumed: true };
    },
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const throwSpec = (state?.throw && typeof state.throw === 'object') ? state.throw : null;
      const fallback = ctx.helpers.adjacentPoint(actorId);
      const at = { x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0), y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0) };
      ctx.helpers.hazardSpawn({ kind: 'fire', medium: 'floor', turnsLeft: 4, radius: 1, tickDamage: 3, damageType: 'fire', cause: 'oil_splash', sourceId: actorId, sourceKind: 'potion_oil', identity: 'oil_fire', name: 'Oil Fire', meta: { source: 'potion_oil', delivery: 'thrown' } }, at);
      const fromRaw = throwSpec?.from;
      const from = fromRaw ? { x: Number(fromRaw.x) | 0, y: Number(fromRaw.y) | 0 } : null;
      ctx.io.emit('item:thrown', { actor: actorId, itemId, from, to: { ...at }, path: 'itemHooks', result: { type: 'oil_splash' } });
      ctx.io.emit('potion:oil_splash', { actor: actorId, at });
      return { consumed: true, at, hazardKind: 'fire' };
    },
  },
});

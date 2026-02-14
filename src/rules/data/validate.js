// rules/data/validate.js
// Assert that item-catalog and affix data conform to expected shapes.

export function validateItemCatalog(ITEM_CATALOG) {
  if (typeof ITEM_CATALOG !== 'object' || !ITEM_CATALOG) throw new Error('ITEM_CATALOG must be an object');
  for (const [id, rec] of Object.entries(ITEM_CATALOG)) {
    if (rec.id !== id) throw new Error(`item ${id}: id mismatch`);
    if (typeof rec.name !== 'string' || !rec.name) throw new Error(`item ${id}: name required`);
    if (typeof rec.type !== 'string' || !rec.type) throw new Error(`item ${id}: type required`);
    if (typeof rec.catalogKind !== 'string' || !rec.catalogKind) throw new Error(`item ${id}: catalogKind required`);
    if (typeof rec.rarity !== 'number' || rec.rarity < 1) throw new Error(`item ${id}: rarity >= 1`);
    if (typeof rec.rarityName !== 'string' || !rec.rarityName) throw new Error(`item ${id}: rarityName required`);

    if (rec.catalogKind === 'equipment') {
      if (rec.type !== 'equip') throw new Error(`item ${id}: equipment must have type 'equip'`);
      if (typeof rec.slot !== 'string' || !rec.slot) throw new Error(`item ${id}: equipment slot required`);
      if (rec.bonuses && typeof rec.bonuses !== 'object') throw new Error(`item ${id}: bonuses must be object`);
      if (rec.bonuses) {
        for (const [k, v] of Object.entries(rec.bonuses)) {
          if (typeof v !== 'number') throw new Error(`item ${id}: bonus ${k} must be number`);
        }
      }
    }
  }
  return true;
}

export function validateAffixes(AFFIX_DEFS) {
  if (typeof AFFIX_DEFS !== 'object' || !AFFIX_DEFS) throw new Error('AFFIX_DEFS must be an object');
  for (const [id, rec] of Object.entries(AFFIX_DEFS)) {
    if (typeof rec.name !== 'string' || !rec.name) throw new Error(`affix ${id}: name required`);
    if (!Array.isArray(rec.slots) || rec.slots.length === 0) throw new Error(`affix ${id}: slots required`);
    if (!Array.isArray(rec.triggers)) throw new Error(`affix ${id}: triggers must be array`);
    if (rec.script && typeof rec.script !== 'string' && typeof rec.script !== 'function') throw new Error(`affix ${id}: script must be string or function`);
    if (rec.passive && typeof rec.passive !== 'string' && typeof rec.passive !== 'function') throw new Error(`affix ${id}: passive must be string or function`);
  }
  return true;
}

export function validateMaterialReactionRules(MATERIAL_REACTION_RULES, opts = {}) {
  if (!Array.isArray(MATERIAL_REACTION_RULES)) throw new Error('MATERIAL_REACTION_RULES must be an array');
  const outcomeIds = new Set(Array.isArray(opts.outcomeIds) ? opts.outcomeIds : []);
  const ruleIds = new Set();

  for (let i = 0; i < MATERIAL_REACTION_RULES.length; i++) {
    const rule = MATERIAL_REACTION_RULES[i];
    const id = String(rule?.id || '');
    if (!id) throw new Error(`material reaction rule[${i}]: id required`);
    if (ruleIds.has(id)) throw new Error(`material reaction rule ${id}: duplicate id`);
    ruleIds.add(id);

    if (!Array.isArray(rule.sourceStatuses) || rule.sourceStatuses.length === 0) {
      throw new Error(`material reaction rule ${id}: sourceStatuses required`);
    }
    for (const status of rule.sourceStatuses) {
      if (typeof status !== 'string' || !status.trim()) {
        throw new Error(`material reaction rule ${id}: sourceStatuses must contain non-empty strings`);
      }
    }

    if (!Array.isArray(rule.itemScopes) || rule.itemScopes.length === 0) {
      throw new Error(`material reaction rule ${id}: itemScopes required`);
    }
    for (const scope of rule.itemScopes) {
      if (scope !== 'ground' && scope !== 'inventory') {
        throw new Error(`material reaction rule ${id}: itemScopes must be 'ground' or 'inventory'`);
      }
    }

    if (typeof rule.eventKind !== 'string' || !rule.eventKind.trim()) {
      throw new Error(`material reaction rule ${id}: eventKind required`);
    }

    if (!Array.isArray(rule.reactions) || rule.reactions.length === 0) {
      throw new Error(`material reaction rule ${id}: reactions required`);
    }

    const reactionIds = new Set();
    for (let r = 0; r < rule.reactions.length; r++) {
      const reaction = rule.reactions[r];
      const reactionId = String(reaction?.id || '');
      if (!reactionId) throw new Error(`material reaction rule ${id}: reaction[${r}] id required`);
      if (reactionIds.has(reactionId)) throw new Error(`material reaction rule ${id}: duplicate reaction id ${reactionId}`);
      reactionIds.add(reactionId);

      const match = reaction?.match;
      if (!match || typeof match !== 'object') {
        throw new Error(`material reaction rule ${id}.${reactionId}: match object required`);
      }

      const itemTypes = Array.isArray(match.itemTypes) ? match.itemTypes : [];
      const materials = Array.isArray(match.materials) ? match.materials : [];
      const identities = Array.isArray(match.identities) ? match.identities : [];

      if (itemTypes.length + materials.length + identities.length === 0) {
        throw new Error(`material reaction rule ${id}.${reactionId}: match must include at least one clause`);
      }

      for (const arr of [itemTypes, materials, identities]) {
        for (const val of arr) {
          if (typeof val !== 'string' || !val.trim()) {
            throw new Error(`material reaction rule ${id}.${reactionId}: match values must be non-empty strings`);
          }
        }
      }

      if (typeof reaction.outcome !== 'string' || !reaction.outcome.trim()) {
        throw new Error(`material reaction rule ${id}.${reactionId}: outcome required`);
      }
      if (outcomeIds.size > 0 && !outcomeIds.has(reaction.outcome)) {
        throw new Error(`material reaction rule ${id}.${reactionId}: unknown outcome ${reaction.outcome}`);
      }
    }
  }

  return true;
}

export function validateItemUseDefs(ITEM_USE_DEFS, opts = {}) {
  if (!Array.isArray(ITEM_USE_DEFS)) throw new Error('ITEM_USE_DEFS must be an array');
  const actionIds = new Set(Array.isArray(opts.actionIds) ? opts.actionIds : []);
  const defIds = new Set();

  for (let i = 0; i < ITEM_USE_DEFS.length; i++) {
    const def = ITEM_USE_DEFS[i];
    const id = String(def?.id || '');
    if (!id) throw new Error(`item use def[${i}]: id required`);
    if (defIds.has(id)) throw new Error(`item use def ${id}: duplicate id`);
    defIds.add(id);

    const match = def?.match;
    if (!match || typeof match !== 'object') throw new Error(`item use def ${id}: match object required`);

    const itemTypes = Array.isArray(match.itemTypes) ? match.itemTypes : [];
    const identityPrefix = String(match.identityPrefix || '');
    if (itemTypes.length === 0 && !identityPrefix) {
      throw new Error(`item use def ${id}: match requires itemTypes or identityPrefix`);
    }
    for (const type of itemTypes) {
      if (typeof type !== 'string' || !type.trim()) throw new Error(`item use def ${id}: itemTypes must be non-empty strings`);
    }
    if (identityPrefix && (typeof identityPrefix !== 'string' || !identityPrefix.trim())) {
      throw new Error(`item use def ${id}: identityPrefix must be non-empty string`);
    }

    const action = def?.action;
    if (!action || typeof action !== 'object') throw new Error(`item use def ${id}: action object required`);
    const kind = String(action.kind || '');
    if (!kind) throw new Error(`item use def ${id}: action.kind required`);
    if (actionIds.size > 0 && !actionIds.has(kind)) throw new Error(`item use def ${id}: unknown action kind ${kind}`);

    const actionPrefix = String(action.identityPrefix || '');
    if (!actionPrefix) throw new Error(`item use def ${id}: action.identityPrefix required`);

    const targetMode = String(action.targetMode || '');
    if (targetMode && targetMode !== 'intentTarget' && targetMode !== 'self' && targetMode !== 'none') {
      throw new Error(`item use def ${id}: invalid targetMode ${targetMode}`);
    }
  }

  return true;
}

export function validateEffectDefs(EFFECT_DEFS, opts = {}) {
  if (!Array.isArray(EFFECT_DEFS)) throw new Error('EFFECT_DEFS must be an array');
  const operationIds = new Set(Array.isArray(opts.operationIds) ? opts.operationIds : []);
  const defIds = new Set();
  const seenKeys = new Set();

  for (let i = 0; i < EFFECT_DEFS.length; i++) {
    const def = EFFECT_DEFS[i];
    const id = String(def?.id || '');
    if (!id) throw new Error(`effect def[${i}]: id required`);
    if (defIds.has(id)) throw new Error(`effect def ${id}: duplicate id`);
    defIds.add(id);

    if (!Array.isArray(def.keys) || def.keys.length === 0) {
      throw new Error(`effect def ${id}: keys required`);
    }
    for (const key of def.keys) {
      if (typeof key !== 'string' || !key.trim()) {
        throw new Error(`effect def ${id}: keys must be non-empty strings`);
      }
      const normalized = key.trim().toLowerCase();
      if (seenKeys.has(normalized)) throw new Error(`effect def ${id}: duplicate key ${normalized}`);
      seenKeys.add(normalized);
    }

    const operation = String(def.operation || '');
    if (!operation) throw new Error(`effect def ${id}: operation required`);
    if (operationIds.size > 0 && !operationIds.has(operation)) {
      throw new Error(`effect def ${id}: unknown operation ${operation}`);
    }

    if (!Array.isArray(def.statuses)) throw new Error(`effect def ${id}: statuses must be an array`);
    for (const status of def.statuses) {
      if (typeof status !== 'string' || !status.trim()) {
        throw new Error(`effect def ${id}: statuses must contain non-empty strings`);
      }
    }
  }

  return true;
}

export function validateMonsterStatusProcDefs(MONSTER_STATUS_PROC_DEFS, opts = {}) {
  if (!Array.isArray(MONSTER_STATUS_PROC_DEFS)) throw new Error('MONSTER_STATUS_PROC_DEFS must be an array');
  const triggerIds = new Set(Array.isArray(opts.triggerIds) ? opts.triggerIds : []);
  const defIds = new Set();
  const scriptTriggerPairs = new Set();

  for (let i = 0; i < MONSTER_STATUS_PROC_DEFS.length; i++) {
    const def = MONSTER_STATUS_PROC_DEFS[i];
    const id = String(def?.id || '');
    if (!id) throw new Error(`monster status proc def[${i}]: id required`);
    if (defIds.has(id)) throw new Error(`monster status proc def ${id}: duplicate id`);
    defIds.add(id);

    const script = String(def?.script || '');
    if (!script) throw new Error(`monster status proc def ${id}: script required`);

    const trigger = String(def?.trigger || '');
    if (!trigger) throw new Error(`monster status proc def ${id}: trigger required`);
    if (triggerIds.size > 0 && !triggerIds.has(trigger)) {
      throw new Error(`monster status proc def ${id}: unknown trigger ${trigger}`);
    }

    const pair = `${script}::${trigger}`;
    if (scriptTriggerPairs.has(pair)) {
      throw new Error(`monster status proc def ${id}: duplicate script+trigger pair ${pair}`);
    }
    scriptTriggerPairs.add(pair);

    const chancePct = Number(def?.chancePct);
    if (!Number.isInteger(chancePct) || chancePct < 1 || chancePct > 100) {
      throw new Error(`monster status proc def ${id}: chancePct must be an integer from 1 to 100`);
    }

    if (!Number.isInteger(def?.seedSalt)) {
      throw new Error(`monster status proc def ${id}: seedSalt must be an integer`);
    }

    const effect = def?.effect;
    if (!effect || typeof effect !== 'object') {
      throw new Error(`monster status proc def ${id}: effect object required`);
    }
    if (typeof effect.key !== 'string' || !effect.key.trim()) {
      throw new Error(`monster status proc def ${id}: effect.key required`);
    }
    if (!Number.isInteger(effect.turnsLeft) || effect.turnsLeft < 0) {
      throw new Error(`monster status proc def ${id}: effect.turnsLeft must be integer >= 0`);
    }
    if (typeof effect.potency !== 'number') {
      throw new Error(`monster status proc def ${id}: effect.potency must be numeric`);
    }
    if (effect.stacks != null && (!Number.isInteger(effect.stacks) || effect.stacks < 1)) {
      throw new Error(`monster status proc def ${id}: effect.stacks must be integer >= 1`);
    }

    if (def.emitEvent != null && (typeof def.emitEvent !== 'string' || !def.emitEvent.trim())) {
      throw new Error(`monster status proc def ${id}: emitEvent must be non-empty string when provided`);
    }
  }

  return true;
}

export function validateMonsterCombatProcDefs(MONSTER_COMBAT_PROC_DEFS, opts = {}) {
  if (!Array.isArray(MONSTER_COMBAT_PROC_DEFS)) throw new Error('MONSTER_COMBAT_PROC_DEFS must be an array');
  const triggerIds = new Set(Array.isArray(opts.triggerIds) ? opts.triggerIds : []);
  const actionIds = new Set(Array.isArray(opts.actionIds) ? opts.actionIds : []);
  const emitPayloadIds = new Set(Array.isArray(opts.emitPayloadIds) ? opts.emitPayloadIds : []);
  const defIds = new Set();
  const scriptTriggerPairs = new Set();

  for (let i = 0; i < MONSTER_COMBAT_PROC_DEFS.length; i++) {
    const def = MONSTER_COMBAT_PROC_DEFS[i];
    const id = String(def?.id || '');
    if (!id) throw new Error(`monster combat proc def[${i}]: id required`);
    if (defIds.has(id)) throw new Error(`monster combat proc def ${id}: duplicate id`);
    defIds.add(id);

    const script = String(def?.script || '');
    if (!script) throw new Error(`monster combat proc def ${id}: script required`);

    const trigger = String(def?.trigger || '');
    if (!trigger) throw new Error(`monster combat proc def ${id}: trigger required`);
    if (triggerIds.size > 0 && !triggerIds.has(trigger)) {
      throw new Error(`monster combat proc def ${id}: unknown trigger ${trigger}`);
    }

    const pair = `${script}::${trigger}`;
    if (scriptTriggerPairs.has(pair)) {
      throw new Error(`monster combat proc def ${id}: duplicate script+trigger pair ${pair}`);
    }
    scriptTriggerPairs.add(pair);

    const chancePct = Number(def?.chancePct);
    if (!Number.isInteger(chancePct) || chancePct < 1 || chancePct > 100) {
      throw new Error(`monster combat proc def ${id}: chancePct must be an integer from 1 to 100`);
    }

    if (!Number.isInteger(def?.seedSalt)) {
      throw new Error(`monster combat proc def ${id}: seedSalt must be an integer`);
    }

    const action = def?.action;
    if (!action || typeof action !== 'object') throw new Error(`monster combat proc def ${id}: action object required`);
    const kind = String(action.kind || '');
    if (!kind) throw new Error(`monster combat proc def ${id}: action.kind required`);
    if (actionIds.size > 0 && !actionIds.has(kind)) {
      throw new Error(`monster combat proc def ${id}: unknown action kind ${kind}`);
    }

    if (kind === 'add_damage_flat' || kind === 'heal_defender_flat' || kind === 'retaliate_flat') {
      if (!Number.isFinite(action.amount)) {
        throw new Error(`monster combat proc def ${id}: action.amount required for ${kind}`);
      }
    }
    if (kind === 'heal_attacker_fraction_damage') {
      if (!Number.isInteger(action.numerator) || action.numerator < 1) {
        throw new Error(`monster combat proc def ${id}: action.numerator must be integer >= 1`);
      }
      if (!Number.isInteger(action.denominator) || action.denominator < 1) {
        throw new Error(`monster combat proc def ${id}: action.denominator must be integer >= 1`);
      }
      if (action.minAmount != null && (!Number.isFinite(action.minAmount) || action.minAmount < 0)) {
        throw new Error(`monster combat proc def ${id}: action.minAmount must be >= 0 when provided`);
      }
    }

    if (def.emitEvent != null && (typeof def.emitEvent !== 'string' || !def.emitEvent.trim())) {
      throw new Error(`monster combat proc def ${id}: emitEvent must be non-empty string when provided`);
    }
    if (def.emitPayload != null) {
      const emitPayload = String(def.emitPayload || '');
      if (!emitPayloadIds.has(emitPayload)) {
        throw new Error(`monster combat proc def ${id}: unknown emitPayload ${emitPayload}`);
      }
    }
    if (def.emitAmount != null && typeof def.emitAmount !== 'boolean') {
      throw new Error(`monster combat proc def ${id}: emitAmount must be boolean when provided`);
    }
  }

  return true;
}

export function validateAll({
  ITEM_CATALOG,
  AFFIX_DEFS,
  MATERIAL_REACTION_RULES,
  MATERIAL_REACTION_OUTCOME_IDS,
  ITEM_USE_DEFS,
  ITEM_USE_ACTION_IDS,
  EFFECT_DEFS,
  EFFECT_OPERATION_IDS,
  MONSTER_STATUS_PROC_DEFS,
  MONSTER_PROC_TRIGGER_IDS,
  MONSTER_COMBAT_PROC_DEFS,
  MONSTER_COMBAT_PROC_TRIGGER_IDS,
  MONSTER_COMBAT_PROC_ACTION_IDS,
  MONSTER_COMBAT_PROC_EMIT_PAYLOAD_IDS,
}) {
  return validateItemCatalog(ITEM_CATALOG)
    && validateAffixes(AFFIX_DEFS)
    && (MATERIAL_REACTION_RULES
      ? validateMaterialReactionRules(MATERIAL_REACTION_RULES, { outcomeIds: MATERIAL_REACTION_OUTCOME_IDS })
      : true)
    && (ITEM_USE_DEFS
      ? validateItemUseDefs(ITEM_USE_DEFS, { actionIds: ITEM_USE_ACTION_IDS })
      : true)
    && (EFFECT_DEFS
      ? validateEffectDefs(EFFECT_DEFS, { operationIds: EFFECT_OPERATION_IDS })
      : true)
    && (MONSTER_STATUS_PROC_DEFS
      ? validateMonsterStatusProcDefs(MONSTER_STATUS_PROC_DEFS, { triggerIds: MONSTER_PROC_TRIGGER_IDS })
      : true)
    && (MONSTER_COMBAT_PROC_DEFS
      ? validateMonsterCombatProcDefs(
        MONSTER_COMBAT_PROC_DEFS,
        {
          triggerIds: MONSTER_COMBAT_PROC_TRIGGER_IDS,
          actionIds: MONSTER_COMBAT_PROC_ACTION_IDS,
          emitPayloadIds: MONSTER_COMBAT_PROC_EMIT_PAYLOAD_IDS,
        },
      )
      : true);
}

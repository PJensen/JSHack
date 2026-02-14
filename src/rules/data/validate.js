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

export function validateAll({
  ITEM_CATALOG,
  AFFIX_DEFS,
  MATERIAL_REACTION_RULES,
  MATERIAL_REACTION_OUTCOME_IDS,
}) {
  return validateItemCatalog(ITEM_CATALOG)
    && validateAffixes(AFFIX_DEFS)
    && (MATERIAL_REACTION_RULES
      ? validateMaterialReactionRules(MATERIAL_REACTION_RULES, { outcomeIds: MATERIAL_REACTION_OUTCOME_IDS })
      : true);
}

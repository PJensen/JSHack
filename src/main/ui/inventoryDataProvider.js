// src/main/ui/inventoryDataProvider.js
// addEventListener handlers that feed inventory, usable, throwable, apply,
// message-log and death-log data to display overlays.

import { playerEntity, itemsAt } from "../../rules/utils/queries.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { inventoryItems } from "../../rules/utils/inventoryFacade.js";
import { Equipment, GEAR_SLOTS, GEAR_SLOT_SET, getEquippedSlot } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Unpaid } from "../../rules/components/Unpaid.js";
import { Settings } from "../../rules/components/Settings.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { Mana } from "../../rules/components/Mana.js";
import { Stamina } from "../../rules/components/Stamina.js";
import { Hunger } from "../../rules/components/Hunger.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { Status } from "../../rules/components/Status.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { Speed } from "../../rules/components/Speed.js";
import { getSpell, describeSpellDetailLines, describeSpellTargetEffects } from "../../rules/data/spells.js";
import { getHungerLevel } from "../../rules/data/food.js";
import { resolveCombatSnapshot } from "../../rules/utils/resolveCombatSnapshot.js";
import { isApplyTool, listApplyTargetsForTool } from "../../rules/content/items/applyPayloads.js";
import { canonicalStatusKey } from "../../rules/utils/effectSemantics.js";
import { resolveItemDisplayName, resolveAffixes, buildItemDisplayData as _buildItemDisplayData } from "../wiring/itemName.js";
import { makeRulesDispatcher } from "../input/rulesDispatch.js";
import { isIdentificationEnabled, setIdentificationEnabled } from "../../rules/data/identification.js";
import { createItemById, listAllItemIds } from "../../rules/utils/itemFactory.js";
import { addToInventory } from "../../rules/utils/inventoryFacade.js";
import { listAllMonsterIds } from "../../rules/data/monsters.js";
import { Pet } from "../../rules/components/Pet.js";
import { ItemCooldown } from "../../rules/components/ItemCooldown.js";
import { groupDisplayItems } from "./itemGrouping.js";
import { spawnDebugMonsterNearPlayer } from "../debug/spawnDebugMonster.js";
import { isChestIdentity } from "../../shared/chests.js";
import { getPassiveBonuses } from "../../rules/utils/passiveBonuses.js";
import { QuestDefRef } from "../../rules/components/QuestDefRef.js";
import { QuestState } from "../../rules/components/QuestState.js";
import { getQuestDef } from "../../rules/quests/registry.js";

const _installed = Symbol.for('inventoryDataProvider');
const _uiEventTarget = globalThis.window || globalThis;

/**
 * Install event listeners that supply inventory/use/throw/apply/message/death
 * data to the display overlays.
 *
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   getActiveSpellId: () => string|null,
 *   isSimUiBlocked: () => boolean,
 *   getMessageLog: () => { getEntries(): any[] },
 *   tombstoneRepo: { getAll(): any[] },
 * }} deps
 * @returns {{ buildGroundPickupDetailAt: (actorId: number, x: number, y: number) => object|null }}
 */
export function installInventoryDataProvider({ world, getActiveSpellId, isSimUiBlocked, getMessageLog, tombstoneRepo }) {
  if (/** @type {any} */ (world)[_installed]) return { buildGroundPickupDetailAt };
  /** @type {any} */ (world)[_installed] = true;

  function findScrollOfIdentify(playerId) {
    for (const id of inventoryItems(world, playerId)) {
      const ni = world.get(id, NamedIdentity);
      if (ni && ni.identity === 'scroll_identify') return id;
    }
    return 0;
  }

  function buildItemDisplayData(info, itemId) {
    return _buildItemDisplayData(world, itemId) || {
      id: itemId,
      type: info.type || 'item',
      name: resolveItemDisplayName(world, itemId),
      slot: info.slot || '',
      count: 1,
      rarityName: 'common',
      description: '',
      bonuses: {},
      affixes: [],
      damageDice: null,
      staminaCost: null,
      twoHanded: false,
      coating: null,
    };
  }

  const _slotMap = Object.freeze({
    ...Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, [slot]])),
    ring: ['ring1', 'ring2'],
  });

  function buildEquippedComparison(eq, slot, currentItemId) {
    const fields = _slotMap[slot];
    if (!fields) return null;
    for (const field of fields) {
      const eqId = eq[field];
      if (!Number.isInteger(eqId) || eqId <= 0 || eqId === currentItemId) continue;
      const eqInfo = world.get(eqId, ItemInfo);
      if (!eqInfo) continue;
      return {
        name: resolveItemDisplayName(world, eqId),
        bonuses: eqInfo.bonuses || {},
        damageDice: eqInfo.damageDice || null,
        staminaCost: eqInfo.staminaCost ?? null,
        twoHanded: !!eqInfo.twoHanded,
        affixes: resolveAffixes(eqInfo.affixes),
      };
    }
    return null;
  }

  function buildEquippedBySlot(eq) {
    const out = Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, { item: null, blocked: false }]));
    if (!eq) return out;

    for (const slot of GEAR_SLOTS) {
      const eqId = Number(eq[slot] || 0) | 0;
      if (!(eqId > 0)) continue;
      const info = world.get(eqId, ItemInfo);
      if (!info) continue;
      out[slot] = {
        item: buildItemDisplayData(info, eqId),
        blocked: false,
      };
    }

    const weaponId = Number(eq.weapon || 0) | 0;
    const weaponInfo = weaponId > 0 ? world.get(weaponId, ItemInfo) : null;
    if (weaponInfo?.twoHanded) {
      out.offhand = {
        ...out.offhand,
        blocked: true,
        blockedBy: "weapon",
        reason: "Two-hand",
      };
    }

    return out;
  }

  function buildActiveSpellItem() {
    const activeSpellId = String(getActiveSpellId() || "").trim();
    const spell = activeSpellId ? getSpell(activeSpellId) : null;
    if (!spell) return null;
    return {
      id: `spell:${spell.id}`,
      type: "spell",
      name: spell.symbol ? `${spell.symbol} ${spell.name}` : spell.name,
      description: String(spell.description || "").trim(),
      detailLines: describeSpellDetailLines(spell),
      targetEffects: describeSpellTargetEffects(spell),
    };
  }

  function buildStatusRows(playerId) {
    /** @type {Map<string, { key: string, turns: number, stacks: number }>} */
    const byKey = new Map();
    const effectComp = world.get(playerId, ActiveEffects);
    const statusComp = world.get(playerId, Status);
    if (Array.isArray(effectComp?.effects)) {
      for (const entry of effectComp.effects) {
        const key = canonicalStatusKey(String(entry?.key || ""));
        if (!key) continue;
        const turns = Math.max(0, Number(entry?.turnsLeft || 0) | 0);
        const stacks = Math.max(1, Number(entry?.stacks || 1) | 0);
        const prev = byKey.get(key);
        if (!prev) byKey.set(key, { key, turns, stacks });
        else byKey.set(key, { key, turns: Math.max(prev.turns, turns), stacks: Math.max(prev.stacks, stacks) });
      }
    }
    if (Array.isArray(statusComp?.statuses)) {
      for (const entry of statusComp.statuses) {
        const key = canonicalStatusKey(String(entry?.type || entry?.key || ""));
        if (!key) continue;
        const turns = Math.max(0, Number(entry?.duration || entry?.turns || 0) | 0);
        const stacks = Math.max(1, Number(entry?.stacks || 1) | 0);
        const prev = byKey.get(key);
        if (!prev) byKey.set(key, { key, turns, stacks });
        else byKey.set(key, { key, turns: Math.max(prev.turns, turns), stacks: Math.max(prev.stacks, stacks) });
      }
    }
    return Array.from(byKey.values());
  }

  function sumPlayerGold(playerId) {
    if (!(playerId > 0)) return 0;
    let total = 0;
    for (const id of inventoryItems(world, playerId)) {
      const info = world.get(id, ItemInfo);
      if (!info || info.type !== 'currency') continue;
      total += Math.max(0, Number(info.count || 0) | 0);
    }
    return Math.max(0, total | 0);
  }

  function buildGroundPickupDetailAt(actorId, x, y) {
    const tx = Number.isFinite(x) ? (x | 0) : 0;
    const ty = Number.isFinite(y) ? (y | 0) : 0;
    const ids = [...itemsAt(world, tx, ty)];
    // Include chest contents on the tile.
    let chestId = 0;
    for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
      if (!isChestIdentity(ni.identity) || pos.x !== tx || pos.y !== ty) continue;
      chestId = eid;
      for (const itemId of inventoryItems(world, eid)) ids.push(itemId);
    }

    const nonCurrencyItems = [];
    for (const itemId of ids) {
      const info = world.get(itemId, ItemInfo);
      if (!info || info.type === 'currency') continue;
      nonCurrencyItems.push(buildItemDisplayData(info, itemId));
    }

    const groupedItems = groupDisplayItems(nonCurrencyItems);
    const totalCount = groupedItems.reduce((sum, item) => sum + Math.max(1, Number(item?.count || 0) | 0), 0);

    if (!groupedItems.length && !chestId) return null;

    if (chestId) {
      return {
        mode: 'multi',
        count: totalCount,
        items: groupedItems,
        fromChest: true,
        chestId,
      };
    }
    if (groupedItems.length > 1) {
      return {
        mode: 'multi',
        count: totalCount,
        items: groupedItems,
        fromChest: false,
      };
    }

    const single = groupedItems[0];
    const set = world.get(actorId, Settings);
    const pickupRange = Math.max(0, Number(set?.pickupRange ?? 0));
    return {
      mode: 'single',
      item: single,
      pickupRange,
    };
  }

  const SLOT_FILTER_MAP = Object.freeze({
    ring1: 'ring',
    ring2: 'ring',
  });
  /**
   * @param {any} raw
   * @returns {string|null}
   */
  function normalizeSlotFilter(raw) {
    const slot = String(raw || '').trim().toLowerCase();
    if (!slot) return null;
    return SLOT_FILTER_MAP[slot] || slot;
  }
  /**
   * @param {any} it
   * @param {string|null} slotFilter
   * @returns {boolean}
   */
  function matchesSlotFilter(it, slotFilter) {
    if (!slotFilter) return true;
    if (!it || !Number.isInteger(it.id) || it.id <= 0) return false;
    const itemSlot = String(it.slot || '').toLowerCase();
    const itemType = String(it.type || '').toLowerCase();
    if (slotFilter === 'ammo') return itemType === 'ammo' || itemSlot === 'ammo';
    if (slotFilter === 'ranged') return itemSlot === 'ranged' || itemType === 'wand';
    return itemSlot === slotFilter;
  }

  // Provide inventory data to overlay when requested
  addEventListener('ui:requestInventoryData', (ev) => {
    const slotFilter = normalizeSlotFilter(ev?.detail?.slotFilter);
    const p = playerEntity(world);
    const items = [];
    let ground = null;
    let equippedBySlot = Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, { item: null, blocked: false }]));
    if (p) {
      const inv = world.get(p.id, Inventory);
      const eq = world.get(p.id, Equipment);
      equippedBySlot = buildEquippedBySlot(eq);
      for (const id of inventoryItems(world, p.id)) {
        const info = world.get(id, ItemInfo);
        if (!info || info.type === 'currency') continue;
        const equippedSlot = eq ? getEquippedSlot(eq, id) : null;
        const applyTargetIds = listApplyTargetsForTool(world, p.id, id);
        const applyTargetCount = applyTargetIds.length;
        const canApply = isApplyTool(world, p.id, id);
        items.push({
          ...buildItemDisplayData(info, id),
          equipped: Boolean(equippedSlot),
          equippedSlot,
          equippedComparison: null,
          unpaid: world.has(id, Unpaid),
          unpaidPrice: world.get(id, Unpaid)?.price || 0,
          unpaidShopkeeperId: world.get(id, Unpaid)?.shopkeeperId || 0,
          canApply,
          applyTargetCount,
          cooldownTurnsRemaining: world.get(id, ItemCooldown)?.turnsRemaining ?? 0,
          cooldownTurnsMax: world.get(id, ItemCooldown)?.turnsMax ?? 0,
        });
      }
      // Attach comparison data for unequipped equippable items
      if (eq) {
        for (const it of items) {
          if (it.equipped || !(it.type === 'equip' || it.type === 'ammo' || it.type === 'wand' || it.slot === 'ranged')) continue;
          it.equippedComparison = buildEquippedComparison(eq, it.slot, it.id);
        }
      }
      ground = buildGroundPickupDetailAt(p.id, p.pos.x, p.pos.y);
    }
      const bagItems = items.filter((it) => !GEAR_SLOT_SET.has(String(it?.equippedSlot || "")));
      const groupedBagItems = groupDisplayItems(bagItems);
      const filteredItems = slotFilter ? groupedBagItems.filter((it) => matchesSlotFilter(it, slotFilter)) : groupedBagItems;
    const scrollOfIdentifyId = p ? findScrollOfIdentify(p.id) : 0;
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:inventoryData', {
      detail: {
        items: filteredItems,
        bagItems: filteredItems,
        equippedBySlot,
        ground,
        slotFilter,
        scrollOfIdentifyId,
      },
    }));
  });

  addEventListener('ui:requestCharacterData', () => {
    const p = playerEntity(world);
    let equippedBySlot = Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, { item: null, blocked: false }]));
    let playerName = 'Hero';
    const stats = {
      hp: 0,
      maxHp: 0,
      mana: 0,
      maxMana: 0,
      stamina: 0,
      maxStamina: 0,
      attack: 0,
      defense: 0,
      armorClass: 10,
      luck: 0,
      critChancePercent: 0,
      critMult: 0,
      damageFlatBonus: 0,
      manaRegen: 0,
      manaRegenDerived: 0,
      staminaRegen: 0,
      staminaRegenDerived: 0,
      maxHpDerived: 0,
      speed: 1,
      kineticDR: 0,
      fireResist: 0,
      poisonResist: 0,
      acidResist: 0,
      radiationResist: 0,
      electricResist: 0,
      bluntResist: 0,
      slashResist: 0,
      pierceResist: 0,
      hunger: 0,
      hungerLevel: "normal",
      gold: 0,
      turn: Math.max(0, Number(world.step || 0) | 0),
      depth: 0,
    };
    let activeEffects = [];
    equippedBySlot.brain = { item: null, blocked: false };
    if (p) {
      const eq = world.get(p.id, Equipment);
      const passive = getPassiveBonuses(world, p.id);
      const vit = world.get(p.id, Vitality);
      const mana = world.get(p.id, Mana);
      const stamina = world.get(p.id, Stamina);
      const hunger = world.get(p.id, Hunger);
      const combat = resolveCombatSnapshot(world, p.id, { mode: "melee" });
      equippedBySlot = buildEquippedBySlot(eq);
      equippedBySlot.brain = { item: null, blocked: false };
      playerName = String(world.get(p.id, NamedIdentity)?.name || 'Hero');
      const spellItem = buildActiveSpellItem();
      if (spellItem) {
        equippedBySlot.brain = { item: spellItem, blocked: false };
      }
      const maxManaBonus = Number(passive?.maxManaDerived ?? 0);
      const maxStaminaBonus = Number(passive?.maxStaminaDerived ?? 0);
      const rawHunger = Math.max(0, Number(hunger?.hunger || 0) | 0);
      const hungerLevel = (hunger?.satiation > 0) ? "satiated" : getHungerLevel(rawHunger);
      stats.hp = Math.max(0, Number(vit?.hp || 0) | 0);
      stats.maxHp = Math.max(0, Number(vit?.maxHp || 0) | 0);
      stats.mana = Math.max(0, Number(mana?.mana || 0) | 0);
      stats.maxMana = Math.max(0, (Number(mana?.maxMana || 0) | 0) + maxManaBonus);
      stats.stamina = Math.max(0, Number(stamina?.stamina || 0) | 0);
      stats.maxStamina = Math.max(0, (Number(stamina?.maxStamina || 0) | 0) + maxStaminaBonus);
      stats.attack = Math.max(0, Number(combat?.attackBonus ?? passive?.attackDerived ?? 0));
      stats.defense = Math.max(0, Number(combat?.defenseDerived ?? passive?.defenseDerived ?? 0));
      stats.armorClass = Math.max(0, Number(combat?.armorClass ?? (10 + stats.defense)));
      stats.luck = Number(combat?.luck ?? passive?.luckDerived ?? 0);
      stats.critChancePercent = (Number(combat?.critChance ?? passive?.critChanceDerived ?? 0) * 100) + stats.luck;
      stats.critMult = Number(combat?.critMult ?? passive?.critMultDerived ?? 0);
      stats.damageFlatBonus = Number(combat?.damageFlatBonus ?? 0);
      stats.manaRegen = Number(mana?.manaRegen ?? 0) + Number(passive?.manaRegenDerived ?? 0);
      stats.manaRegenDerived = Number(passive?.manaRegenDerived ?? 0);
      stats.staminaRegen = Number(stamina?.staminaRegen ?? 0) + Number(passive?.staminaRegenDerived ?? 0);
      stats.staminaRegenDerived = Number(passive?.staminaRegenDerived ?? 0);
      stats.maxHpDerived = Number(passive?.maxHpDerived ?? 0);
      const spd = world.get(p.id, Speed);
      stats.speed = Number(spd?.actEvery ?? 1);
      stats.kineticDR = Number(passive?.kineticDRDerived ?? 0);
      stats.fireResist = Number(passive?.fireResistDerived ?? 0);
      stats.poisonResist = Number(passive?.poisonResistDerived ?? 0);
      stats.acidResist = Number(passive?.acidResistDerived ?? 0);
      stats.radiationResist = Number(passive?.radiationResistDerived ?? 0);
      stats.electricResist = Number(passive?.electricOhmsDerived ?? 0);
      stats.bluntResist = Number(passive?.bluntResistDerived ?? 0);
      stats.slashResist = Number(passive?.slashResistDerived ?? 0);
      stats.pierceResist = Number(passive?.pierceResistDerived ?? 0);
      stats.hunger = rawHunger;
      stats.hungerLevel = String(hungerLevel || "normal");
      stats.gold = sumPlayerGold(p.id);
      activeEffects = buildStatusRows(p.id);
      for (const [, ds] of world.query(DungeonState)) {
        stats.depth = Math.max(0, Number(ds?.currentDepth || 0) | 0);
        break;
      }
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:characterData', {
      detail: { equippedBySlot, playerName, stats, activeEffects },
    }));
  });

  addEventListener('ui:requestEquipmentData', () => {
    const p = playerEntity(world);
    let equippedBySlot = Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, { item: null, blocked: false }]));
    let playerName = 'Hero';
    equippedBySlot.brain = { item: null, blocked: false };
    if (p) {
      const eq = world.get(p.id, Equipment);
      equippedBySlot = buildEquippedBySlot(eq);
      equippedBySlot.brain = { item: null, blocked: false };
      playerName = String(world.get(p.id, NamedIdentity)?.name || 'Hero');
      const spellItem = buildActiveSpellItem();
      if (spellItem) {
        equippedBySlot.brain = { item: spellItem, blocked: false };
      }
    }
    const scrollOfIdentifyId = p ? findScrollOfIdentify(p.id) : 0;
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:equipmentData', {
      detail: { equippedBySlot, playerName, scrollOfIdentifyId },
    }));
  });

  // Provide usable items to the use-chooser overlay when requested
  const USABLE_TYPES = new Set(['wand', 'scroll', 'book', 'learn', 'food', 'potion', 'tool']);
  addEventListener('ui:requestUsableItemsData', () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      for (const id of inventoryItems(world, p.id)) {
        const info = world.get(id, ItemInfo);
        if (!info || !USABLE_TYPES.has(info.type)) continue;
        items.push(buildItemDisplayData(info, id));
      }
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:usableItemsData', { detail: { items } }));
  });

  // Provide all inventory items to the throw-chooser overlay when requested
  addEventListener('ui:requestThrowableItemsData', () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      for (const id of inventoryItems(world, p.id)) {
        const info = world.get(id, ItemInfo);
        if (!info) continue;
        items.push(buildItemDisplayData(info, id));
      }
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:throwableItemsData', { detail: { items } }));
  });

  // Provide applicable tools to the apply-tool chooser
  addEventListener('ui:requestApplyToolsData', () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      for (const id of inventoryItems(world, p.id)) {
        if (!isApplyTool(world, p.id, id)) continue;
        items.push({ id, name: resolveItemDisplayName(world, id) });
      }
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:applyToolsData', { detail: { items } }));
  });

  // Provide filtered targets for an apply tool
  addEventListener('ui:requestApplyTargetsData', (ev) => {
    const toolId = ev?.detail?.toolId || 0;
    const p = playerEntity(world);
    const items = [];
    if (p && toolId) {
      const targetIds = listApplyTargetsForTool(world, p.id, toolId);
      for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        const info = world.get(id, ItemInfo);
        items.push({ id, name: resolveItemDisplayName(world, id), description: info?.description || '' });
      }
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:applyTargetsData', { detail: { items } }));
  });

  // When user confirms an apply action from the UI
  addEventListener('ui:requestApply', (ev) => {
    if (isSimUiBlocked()) return;
    const toolId = ev?.detail?.toolId || 0;
    const targetItemId = ev?.detail?.targetItemId || 0;
    if (!toolId || !targetItemId) return;
    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    rulesHandler({ type: 'rules.applyItem', payload: { itemId: toolId, targetItemId } });
  });

  // Provide message log entries
  addEventListener('ui:requestMessageLogData', () => {
    const entries = getMessageLog().getEntries();
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:messageLogData', { detail: { entries } }));
  });

  // Provide death log records from tombstone repository
  addEventListener('ui:requestDeathLogData', () => {
    const records = tombstoneRepo.getAll();
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:deathLogData', { detail: { records } }));
  });

  // --- Settings panel data & actions ---

  addEventListener('ui:requestBugReportData', () => {
    const p = playerEntity(world);
    let playerName = 'Hero';
    let playerClass = 'unknown';
    const stats = {};
    const gear = [];
    const inv = [];
    const effects = [];
    if (p) {
      const ni = world.get(p.id, NamedIdentity);
      playerName = String(ni?.name || 'Hero');
      playerClass = String(ni?.identity || '').replace(/^player_/, '') || 'unknown';
      const eq = world.get(p.id, Equipment);
      const passive = getPassiveBonuses(world, p.id);
      const vit = world.get(p.id, Vitality);
      const mana = world.get(p.id, Mana);
      const stamina = world.get(p.id, Stamina);
      const hunger = world.get(p.id, Hunger);
      const combat = resolveCombatSnapshot(world, p.id, { mode: "melee" });
      const rawHunger = Math.max(0, Number(hunger?.hunger || 0) | 0);
      stats.hp = `${Math.max(0, Number(vit?.hp || 0) | 0)}/${Math.max(0, Number(vit?.maxHp || 0) | 0)}`;
      stats.mana = `${Math.max(0, Number(mana?.mana || 0) | 0)}/${Math.max(0, Number(mana?.maxMana || 0) | 0)}`;
      stats.stamina = `${Math.max(0, Number(stamina?.stamina || 0) | 0)}/${Math.max(0, Number(stamina?.maxStamina || 0) | 0)}`;
      stats.attack = Math.max(0, Number(combat?.attackBonus ?? passive?.attackDerived ?? 0));
      stats.defense = Math.max(0, Number(combat?.defenseDerived ?? passive?.defenseDerived ?? 0));
      stats.armorClass = Math.max(0, Number(combat?.armorClass ?? (10 + stats.defense)));
      stats.luck = Number(combat?.luck ?? passive?.luckDerived ?? 0);
      stats.gold = sumPlayerGold(p.id);
      stats.hungerLevel = (hunger?.satiation > 0) ? "satiated" : getHungerLevel(rawHunger);
      stats.turn = Math.max(0, Number(world.step || 0) | 0);
      for (const [, ds] of world.query(DungeonState)) {
        stats.depth = Math.max(0, Number(ds?.currentDepth || 0) | 0);
        break;
      }
      if (eq) {
        for (const slot of GEAR_SLOTS) {
          const eqId = Number(eq[slot] || 0) | 0;
          if (!(eqId > 0)) continue;
          gear.push({ slot, name: resolveItemDisplayName(world, eqId) });
        }
      }
      for (const id of inventoryItems(world, p.id)) {
        const info = world.get(id, ItemInfo);
        if (!info || info.type === 'currency') continue;
        const name = resolveItemDisplayName(world, id);
        const count = Number(info.count || 1);
        inv.push(count > 1 ? `${name} ×${count}` : name);
      }
      for (const { key, turns, stacks } of buildStatusRows(p.id)) {
        effects.push(stacks > 1 ? `${key}×${stacks}(${turns}t)` : `${key}(${turns}t)`);
      }
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:bugReportData', {
      detail: { playerName, playerClass, stats, gear, inv, effects },
    }));
  });

  addEventListener('ui:requestSettingsData', () => {
    let hasPet = false;
    let petAlive = false;
    for (const [petId] of world.query(Pet)) {
      hasPet = true;
      petAlive = world.has(petId, Position);
      break;
    }
    const p = playerEntity(world);
    const set = p ? world.get(p.id, Settings) : null;
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:settingsData', {
      detail: {
        identificationEnabled: isIdentificationEnabled(),
        hungerEnabled: set ? set.hungerEnabled !== false : true,
        allItemIds: listAllItemIds(),
        allMonsterIds: listAllMonsterIds(),
        hasPet,
        petAlive,
      },
    }));
  });

  addEventListener('ui:setIdentification', (ev) => {
    const enabled = !!ev?.detail?.enabled;
    setIdentificationEnabled(enabled);
  });

  addEventListener('ui:setHunger', (ev) => {
    const enabled = !!ev?.detail?.enabled;
    const p = playerEntity(world);
    if (!p) return;
    const cur = world.get(p.id, Settings);
    if (cur) {
      cur.hungerEnabled = enabled;
    }
  });

  addEventListener('ui:debugGiveItem', (ev) => {
    const itemId = String(ev?.detail?.itemId || '').trim();
    if (!itemId) return;
    const p = playerEntity(world);
    if (!p) return;
    const inv = world.get(p.id, Inventory);
    if (!inv) return;
    const created = createItemById(world, itemId);
    if (created === null) {
      console.warn(`[settings] Unknown item: "${itemId}"`);
      return;
    }
    addToInventory(world, p.id, created);
    console.debug(`[settings] Gave 1x ${itemId}`);
  });

  addEventListener('ui:debugSpawnMonster', (ev) => {
    const monsterId = String(ev?.detail?.monsterId || '').trim();
    if (!monsterId) return;
    const result = spawnDebugMonsterNearPlayer(world, monsterId);
    if (!result.ok) {
      console.warn(`[settings] ${result.error}`);
      return;
    }
    console.debug(`[settings] Spawned ${result.monsterId} at (${result.x}, ${result.y})`);
  });

  addEventListener('ui:debugResurrectPet', () => {
    const p = playerEntity(world);
    if (!p) return;
    const pPos = world.get(p.id, Position);
    if (!pPos) return;
    for (const [petId] of world.query(Pet)) {
      if (world.has(petId, Position)) continue; // already alive
      const vit = world.get(petId, Vitality);
      if (vit) {
        vit.hp = vit.maxHp;
      }
      if (!world.has(petId, Position)) {
        world.add(petId, Position, { x: pPos.x, y: pPos.y });
      }
      console.debug(`[settings] Resurrected pet ${petId}`);
      break;
    }
  });

  addEventListener('ui:requestQuestJournalData', () => {
    const quests = [];
    for (const [, def, state] of world.query(QuestDefRef, QuestState)) {
      const questDef = getQuestDef(def.id);
      quests.push({
        questId: String(def.id || ''),
        title: String(questDef?.title || def.id || ''),
        status: String(state.status || 'active'),
        node: String(state.node || ''),
        t0: Number(state.t0 || 0),
      });
    }
    _uiEventTarget.dispatchEvent(new CustomEvent('ui:questJournalData', { detail: { quests } }));
  });

  return { buildGroundPickupDetailAt };
}

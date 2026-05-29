// src/main/wiring/scrollWandWiring.js
// Scroll and wand effect handlers that need UI interaction (targeting reticle,
// prompts, etc.). Pure rules-side scroll effects (aggravation, teleportation,
// summoning, decay) are also wired here since they share the same pattern.

import { scanVisibleEnemies } from "../targeting/targetingController.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from "../../rules/components/AggroState.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { Faction } from "../../rules/components/Faction.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Traits } from "../../rules/components/Traits.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { setItemCooldown } from "../../rules/utils/itemCooldowns.js";
import { listAllMonsterIds, getMonster } from "../../rules/data/monsters.js";
import { Polymorph } from "../../rules/components/Polymorph.js";
import { resolvePolymorph } from "../../rules/systems/polymorphSystem.js";
import { buildMonsterChoiceOptions, buildPolymorphTargetOptions } from "../monsters/monsterChoices.js";
import { spawnMonsterEntity } from "../../rules/utils/spawnMonsterEntity.js";
import { pickMonster } from "../../rules/environment/dungeon/tables.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { findNearestValidTileAround } from "../../rules/utils/queries.js";
import { chebyshevScalar } from "../../rules/utils/distance.js";
import { isWalkable, forEachLoadedTile } from "../../rules/environment/dungeon/tileMap.js";
import { emitSafe } from "../../rules/utils/emitSafe.js";
import { inventoryItems, removeFromInventory } from "../../rules/utils/inventoryFacade.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { getEffectiveVisionRange, blind } from "../../rules/utils/blind.js";
import { listApplyTargetsForTool } from "../../rules/content/items/applyPayloads.js";

const INSTALLED_KEY = Symbol.for('jshack:scrollWandWiring:installed');

/**
 * @param {object} deps
 * @param {object} deps.world
 * @param {object} deps.targeting  TargetingController instance
 * @param {() => ({id:number, pos:{x:number,y:number}}|null)} deps.playerEntity
 */
export function installScrollWandWiring({ world, targeting, playerEntity }) {
  if (world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  const pendingMonsterChoices = new Map();
  let nextMonsterChoiceRequestId = 1;

  function currentDepth() {
    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth ?? 1; }
    return Math.max(1, Number(depth || 1) | 0);
  }

  function applyPolymorphSelection({ actor, enemyId, targetIdentity, depth, trigger = 'scroll', reason = 'scroll_polymorph' }) {
    if (!getMonster(targetIdentity)) {
      world.emit?.('message', { text: 'You cannot picture such a creature. The scroll fizzles.', type: 'system' });
      return;
    }

    const fromIdent = world.get(enemyId, NamedIdentity);
    const fromName = fromIdent?.identity ? (getMonster(fromIdent.identity)?.name || fromIdent.identity) : 'creature';

    try {
      world.add(enemyId, Polymorph, { targetIdentity, depth, trigger, once: true, revealed: false, hookKey: '' });
    } catch {
      world.mutate(enemyId, Polymorph, (r) => { r.targetIdentity = targetIdentity; r.depth = depth; r.revealed = false; });
    }

    const spawnedId = resolvePolymorph(world, { entityId: enemyId, targetIdentity, depth, actorId: actor, trigger, reason });
    const toName = getMonster(targetIdentity)?.name || targetIdentity;
    if (spawnedId > 0) {
      world.emit?.('message', { text: `The ${fromName} shudders and transforms into a ${toName}!`, type: 'system' });
      const pos = world.get(spawnedId, Position);
      if (pos) world.emit?.('scroll:polymorph:vfx', { x: pos.x | 0, y: pos.y | 0 });
    } else {
      world.emit?.('message', { text: 'The scroll fizzles.', type: 'system' });
    }
  }

  addEventListener('ui:monsterChosen', (ev) => {
    const detail = /** @type {CustomEvent} */ (ev).detail || {};
    const requestId = Number(detail.requestId || 0) | 0;
    const pending = pendingMonsterChoices.get(requestId);
    if (!pending) return;
    pendingMonsterChoices.delete(requestId);
    window.dispatchEvent(new CustomEvent('ui:closeMonsterChooser'));
    const monsterId = String(detail.monsterId || '');
    if (pending.kind === 'genocide') {
      world.emit?.('scroll:genocide:request', { actor: pending.actor, query: monsterId });
      return;
    }
    if (pending.kind === 'polymorph') {
      applyPolymorphSelection({
        ...pending,
        targetIdentity: monsterId,
      });
    }
  });

  addEventListener('ui:monsterChooserCanceled', (ev) => {
    const detail = /** @type {CustomEvent} */ (ev).detail || {};
    const requestId = Number(detail.requestId || 0) | 0;
    const pending = pendingMonsterChoices.get(requestId);
    if (!pending) return;
    pendingMonsterChoices.delete(requestId);
    window.dispatchEvent(new CustomEvent('ui:closeMonsterChooser'));
    const text = pending.kind === 'genocide' ? 'The scroll crumbles to dust, unused.' : 'The scroll fizzles.';
    world.emit?.('message', { text, type: 'system' });
  });

  // ── Scroll of Genocide ──────────────────────────────────────────────────
  world.on('scroll:genocide', ({ actor }) => {
    const requestId = nextMonsterChoiceRequestId++;
    pendingMonsterChoices.set(requestId, { kind: 'genocide', actor });
    window.dispatchEvent(new CustomEvent('ui:openMonsterChooser', {
      detail: {
        requestId,
        title: 'Scroll of Genocide',
        subtitle: 'Choose one species to erase from this run.',
        searchPlaceholder: 'Search species',
        choices: buildMonsterChoiceOptions({ currentDepth: currentDepth() }),
      },
    }));
  });

  // ── Scroll of Polymorph ─────────────────────────────────────────────────
  world.on('scroll:polymorph', ({ actor }) => {
    const pe = playerEntity();
    if (!pe) return;
    const px = pe.pos.x | 0;
    const py = pe.pos.y | 0;
    const range = 8;
    const enemies = scanVisibleEnemies(world, px, py, range, { playerId: pe.id });
    if (enemies.length === 0) {
      world.emit?.('message', { text: 'No visible enemies to polymorph.', type: 'system' });
      return;
    }

    targeting.openEnemyTargeting({
      spellId: '__scroll_polymorph__',
      spellName: 'Scroll of Polymorph',
      range,
      enemies,
      onConfirm: (enemyId) => {
        let targetIdentity;
        const traits = world.get(actor, Traits);
        if (traits?.polymorph_control) {
          const depth = currentDepth();
          const requestId = nextMonsterChoiceRequestId++;
          const fromIdent = world.get(enemyId, NamedIdentity);
          const targetName = fromIdent?.identity ? (getMonster(fromIdent.identity)?.name || fromIdent.identity) : 'creature';
          pendingMonsterChoices.set(requestId, { kind: 'polymorph', actor, enemyId, depth, trigger: 'scroll', reason: 'scroll_polymorph' });
          window.dispatchEvent(new CustomEvent('ui:openMonsterChooser', {
            detail: {
              requestId,
              title: 'Polymorph Control',
              subtitle: `Target: ${targetName}`,
              searchPlaceholder: 'Search forms',
              choices: buildPolymorphTargetOptions({ currentDepth: depth }),
            },
          }));
          return;
        } else {
          const allIds = listAllMonsterIds();
          targetIdentity = allIds[Math.floor(world.rand() * allIds.length)];
        }

        applyPolymorphSelection({ actor, enemyId, targetIdentity, depth: currentDepth(), trigger: 'scroll', reason: 'scroll_polymorph' });
      },
    });
  });

  // ── Scroll of Taming ────────────────────────────────────────────────────
  world.on('scroll:taming', ({ actor }) => {
    const pe = playerEntity();
    if (!pe) return;
    const enemies = scanVisibleEnemies(world, pe.pos.x | 0, pe.pos.y | 0, 8, { playerId: pe.id });
    if (enemies.length === 0) {
      world.emit?.('message', { text: 'No visible enemies to tame.', type: 'system' });
      return;
    }

    targeting.openEnemyTargeting({
      spellId: '__scroll_taming__',
      spellName: 'Scroll of Taming',
      range: 8,
      enemies,
      onConfirm: (enemyId) => {
        world.emit?.('scroll:taming:apply', { actor, target: enemyId });
      },
    });
  });

  // ── Scroll of Identify (Use verb with no apply target selected) ────────
  world.on('scroll:identify', ({ actor, scrollId }) => {
    const targets = listApplyTargetsForTool(world, actor, scrollId);
    if (targets.length === 0) {
      world.emit?.('message', { text: 'You have nothing that needs identifying.', type: 'system' });
      return;
    }
    window.dispatchEvent(new CustomEvent('ui:openApplyForTool', { detail: { toolId: scrollId } }));
  });

  // ── Wand of Stasis ──────────────────────────────────────────────────────
  world.on('wand:stasis', ({ actor }) => {
    const pe = playerEntity();
    if (!pe) return;
    const range = 6;
    const enemies = scanVisibleEnemies(world, pe.pos.x | 0, pe.pos.y | 0, range, { playerId: pe.id });
    if (enemies.length === 0) {
      world.emit?.('message', { text: 'No visible enemies to freeze.', type: 'system' });
      return;
    }

    targeting.openEnemyTargeting({
      spellId: '__wand_stasis__',
      spellName: 'Wand of Stasis',
      range,
      enemies,
      onConfirm: (enemyId) => {
        const ae = world.get(enemyId, ActiveEffects);
        const stasisEffect = { key: 'stasis', turnsLeft: 8, stacks: 1, potency: 1 };
        if (ae) {
          ae.effects.push(stasisEffect);
        } else {
          try { world.add(enemyId, ActiveEffects, { effects: [stasisEffect] }); } catch {}
        }
        const ni = world.get(enemyId, NamedIdentity);
        const name = ni?.name || 'creature';
        world.emit?.('message', { text: `The ${name} is frozen outside of time!`, type: 'system' });
        const pos = world.get(enemyId, Position);
        if (pos) world.emit?.('wand:stasis:vfx', { id: enemyId, x: pos.x | 0, y: pos.y | 0 });
      },
    });
  });

  // Sunsword Blinding Ray: migrated to content DSL (src/content/items/sunsword.js)

  // ── Scroll of Aggravation ───────────────────────────────────────────────
  world.on('scroll:aggravation', ({ actor }) => {
    const pe = playerEntity();
    if (!pe) return;
    const px = pe.pos.x | 0;
    const py = pe.pos.y | 0;
    for (const [eid, aggro, fac] of world.query(AggroState, Faction)) {
      if (fac.key !== 'enemy') continue;
      const vit = world.get(eid, Vitality);
      if (!vit || (vit.hp | 0) <= 0) continue;
      aggro.alertLevel = AGGRO_LEVELS.hunting;
      aggro.lastKnownX = px;
      aggro.lastKnownY = py;
      aggro.searchTurnsLeft = SEARCH_TURNS_HUNTING_GRACE;
    }
  });

  // ── Scroll of Teleportation ─────────────────────────────────────────────
  world.on('scroll:teleportation', ({ actor }) => {
    const pos = world.get(actor, Position);
    if (!pos) return;
    const from = { x: pos.x | 0, y: pos.y | 0 };
    const candidates = [];
    forEachLoadedTile((x, y) => {
      if (!isWalkable(x, y)) return;
      const dist = chebyshevScalar(x, y, from.x, from.y);
      if (dist < 6) return;
      candidates.push({ x, y });
    });
    if (candidates.length === 0) {
      world.emit?.('message', { text: 'The scroll fizzles.', type: 'system' });
      return;
    }
    const to = candidates[Math.floor(world.rand() * candidates.length)];
    world.set(actor, Position, { x: to.x, y: to.y });
    emitSafe(world, 'moved', { id: actor, from, to });
    emitSafe(world, 'teleported', { id: actor, from, to, source: 'scroll:teleportation' });
  });

  // ── Scroll of Summoning ─────────────────────────────────────────────────
  world.on('scroll:summoning', ({ actor }) => {
    const pos = world.get(actor, Position);
    if (!pos) return;
    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth ?? 1; }
    const rng = createRng(((world.seed ^ (world.step * 0x1337 + 0xDEAD)) >>> 0));
    const count = 2 + (world.rand() * 3 | 0);
    for (let i = 0; i < count; i++) {
      const params = pickMonster(rng, Math.max(1, depth));
      const tile = findNearestValidTileAround(world, pos, { maxDistance: 5, exclude: [pos] });
      if (!tile) continue;
      const eid = spawnMonsterEntity(world, { ...params, x: tile.x, y: tile.y });
      if (eid > 0) {
        const aggro = world.get(eid, AggroState);
        if (aggro) {
          aggro.alertLevel = AGGRO_LEVELS.hunting;
          aggro.lastKnownX = pos.x | 0;
          aggro.lastKnownY = pos.y | 0;
          aggro.searchTurnsLeft = SEARCH_TURNS_HUNTING_GRACE;
        }
      }
    }
  });

  // ── Scroll of Decay ─────────────────────────────────────────────────────
  world.on('scroll:decay', ({ actor }) => {
    const items = inventoryItems(world, actor);
    const organic = [];
    for (const itemId of items) {
      const info = world.get(itemId, ItemInfo);
      if (!info) continue;
      if (info.type === 'scroll' || info.type === 'potion' || info.type === 'food') {
        organic.push(itemId);
      }
    }
    if (organic.length === 0) return;
    for (let i = organic.length - 1; i > 0; i--) {
      const j = world.rand() * (i + 1) | 0;
      [organic[i], organic[j]] = [organic[j], organic[i]];
    }
    const destroyCount = Math.min(organic.length, 1 + (world.rand() * 3 | 0));
    for (let i = 0; i < destroyCount; i++) {
      removeFromInventory(world, actor, organic[i]);
      try { world.destroy(organic[i]); } catch {}
    }
  });
}

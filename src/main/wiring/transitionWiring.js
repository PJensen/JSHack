// src/main/wiring/transitionWiring.js
// Stair, portal, and depth-transition controller.
// Owns pending-transition state and the flush logic called each frame.

import { transitionToDepth } from "../../rules/environment/dungeon/transition.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Interactable } from "../../rules/components/Interactable.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { Player } from "../../rules/components/Player.js";
import { Pet } from "../../rules/components/Pet.js";
import { PetState } from "../../rules/components/PetState.js";

const RETURN_PORTAL_IDENTITY = 'return_portal';
const STAIR_TRANSITION_COOLDOWN_MS = 220;

/**
 * @param {object} deps
 * @param {object} deps.world
 * @param {() => ({id:number, pos:{x:number,y:number}}|null)} deps.playerEntity
 * @param {object} deps.tombstoneRepo
 * @param {() => void} deps.onTransitioned  callback after floor change (invalidate caches)
 */
export function createTransitionController({ world, playerEntity, tombstoneRepo, onTransitioned }) {
  /** @type {object|null} */
  let _pending = null;
  let _inFlight = false;
  let _lockUntilMs = 0;

  function isLocked() { return _inFlight || Date.now() < _lockUntilMs; }
  function armCooldown() { _lockUntilMs = Date.now() + STAIR_TRANSITION_COOLDOWN_MS; }

  function queueStair(direction, stairX = null, stairY = null) {
    const dir = direction === 'up' ? 'up' : (direction === 'down' ? 'down' : null);
    if (!dir) return;
    if (_pending || isLocked()) return;
    const stairPos = (stairX != null && stairY != null) ? { x: stairX, y: stairY } : null;
    _pending = { direction: dir, stairPos };
  }

  function queueDepth(targetDepth, opts = {}) {
    const depth = Number(targetDepth);
    if (!Number.isFinite(depth)) return;
    if (_pending || isLocked()) return;
    const x = Number(opts?.targetPos?.x);
    const y = Number(opts?.targetPos?.y);
    const targetPos = (Number.isFinite(x) && Number.isFinite(y))
      ? { x: Math.floor(x), y: Math.floor(y) }
      : undefined;
    const tDepth = Number(opts?.returnTicket?.depth);
    const tx = Number(opts?.returnTicket?.x);
    const ty = Number(opts?.returnTicket?.y);
    const returnTicket = (Number.isFinite(tDepth) && Number.isFinite(tx) && Number.isFinite(ty))
      ? { depth: Math.max(0, Math.floor(tDepth)), x: Math.floor(tx), y: Math.floor(ty) }
      : null;
    _pending = {
      targetDepth: Math.max(0, Math.floor(depth)),
      targetPos,
      fragActorsAtTarget: opts?.fragActorsAtTarget === true,
      returnTicket,
      homecomingLanding: opts?.homecomingLanding === true,
      source: typeof opts?.source === "string" ? opts.source : "",
    };
  }

  // ── Floor entity tracking ─────────────────────────────────────────────

  function trackFloorEntity(entityId) {
    const eid = Number(entityId) | 0;
    if (!(eid > 0)) return;
    for (const [id, ds] of world.query(DungeonState)) {
      if (!Array.isArray(ds.floorEntityIds)) ds.floorEntityIds = [];
      if (!ds.floorEntityIds.includes(eid)) ds.floorEntityIds.push(eid);
      try { world.set(id, DungeonState, ds); } catch {}
      break;
    }
  }

  function untrackFloorEntity(entityId) {
    const eid = Number(entityId) | 0;
    if (!(eid > 0)) return;
    for (const [id, ds] of world.query(DungeonState)) {
      if (!Array.isArray(ds.floorEntityIds)) break;
      ds.floorEntityIds = ds.floorEntityIds.filter((v) => (Number(v) | 0) !== eid);
      try { world.set(id, DungeonState, ds); } catch {}
      break;
    }
  }

  function destroyReturnPortals() {
    const ids = [];
    for (const [id, ni] of world.query(NamedIdentity)) {
      if (ni?.identity === RETURN_PORTAL_IDENTITY) ids.push(id);
    }
    for (const id of ids) {
      try { world.destroy(id); } catch {}
      untrackFloorEntity(id);
    }
  }

  function spawnReturnPortal(ticket, atFountain = false) {
    const pe = playerEntity();
    if (!pe) return 0;
    destroyReturnPortals();

    let fountainPos = null;
    let bedPos = null;
    let chestPos = null;
    for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
      if (ni?.identity === 'fountain') fountainPos = { x: pos.x | 0, y: pos.y | 0 };
      else if (ni?.identity === 'bed_home') bedPos = { x: pos.x | 0, y: pos.y | 0 };
      else if (ni?.identity === 'chest') chestPos = { x: pos.x | 0, y: pos.y | 0 };
    }

    let portalPos;
    if (atFountain && fountainPos) {
      portalPos = { x: fountainPos.x, y: fountainPos.y + 1 };
    } else if (bedPos && chestPos) {
      portalPos = { x: Math.floor((bedPos.x + chestPos.x) / 2), y: Math.floor((bedPos.y + chestPos.y) / 2) };
    } else {
      portalPos = { x: pe.pos.x, y: pe.pos.y };
    }

    const portalId = world.create();
    world.add(portalId, Position, { x: portalPos.x, y: portalPos.y });
    world.add(portalId, NamedIdentity, { name: 'Return Portal', identity: RETURN_PORTAL_IDENTITY });
    world.add(portalId, Interactable, {
      action: 'returnPortal',
      params: {
        targetDepth: Math.max(0, Math.floor(Number(ticket?.depth || 0))),
        targetX: Math.floor(Number(ticket?.x || 0)),
        targetY: Math.floor(Number(ticket?.y || 0)),
      },
    });
    trackFloorEntity(portalId);
    try {
      world.emit?.('portal:spawned', {
        portalId,
        at: { x: portalPos.x, y: portalPos.y },
        targetDepth: Math.max(0, Math.floor(Number(ticket?.depth || 0))),
        target: { x: Math.floor(Number(ticket?.x || 0)), y: Math.floor(Number(ticket?.y || 0)) },
      });
    } catch (e) { console.debug('[transition] emit portal:spawned failed:', e); }
    return portalId;
  }

  function fragActorsAt(x, y, excludeId = 0) {
    const tx = Math.floor(Number(x));
    const ty = Math.floor(Number(y));
    let count = 0;
    for (const [id, pos, _vit] of world.query(Position, Vitality)) {
      if (id === excludeId) continue;
      if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
      try { world.destroy(id); } catch {}
      untrackFloorEntity(id);
      count++;
    }
    if (count > 0) {
      try { world.emit?.('portal:return:fragged', { count, at: { x: tx, y: ty } }); } catch (e) { console.debug('[transition] emit portal:return:fragged failed:', e); }
    }
    return count;
  }

  // ── Flush pending transition (called each frame) ──────────────────────

  async function flush() {
    const pending = _pending;
    if (!pending) return;
    if (isLocked()) return;
    _inFlight = true;
    _pending = null;

    try {
      let currentDepth = 1;
      for (const [, state] of world.query(DungeonState)) { currentDepth = state.currentDepth; break; }

      let newDepth = currentDepth;
      if (Number.isFinite(pending.targetDepth)) {
        newDepth = Math.max(0, Math.floor(Number(pending.targetDepth)));
      } else if (pending.direction === 'down') {
        newDepth = currentDepth + 1;
      } else if (pending.direction === 'up') {
        newDepth = currentDepth - 1;
      }
      if (newDepth < 0 || newDepth === currentDepth) return;

      const hasTargetPos = Number.isFinite(pending.targetPos?.x) && Number.isFinite(pending.targetPos?.y);
      if (hasTargetPos) {
        await transitionToDepth(world, newDepth, { x: pending.targetPos.x | 0, y: pending.targetPos.y | 0 }, { tombstoneRepo });
        if (pending.fragActorsAtTarget) {
          const pe = playerEntity();
          const playerId = pe?.id || 0;
          fragActorsAt(pending.targetPos.x, pending.targetPos.y, playerId);
          if (playerId > 0) {
            world.set(playerId, Position, { x: pending.targetPos.x | 0, y: pending.targetPos.y | 0 });
          }
        }
      } else {
        const direction = newDepth > currentDepth ? 'down' : 'up';
        await transitionToDepth(world, newDepth, { x: 0, y: 0 }, { direction, stairPos: pending.stairPos || null, tombstoneRepo });
      }

      // Homecoming landing: reposition player at the town fountain
      if (newDepth === 0 && pending.homecomingLanding) {
        let fountainPos = null;
        for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
          if (ni?.identity === 'fountain') { fountainPos = { x: pos.x | 0, y: pos.y | 0 }; break; }
        }
        if (fountainPos) {
          for (const [id] of world.query(Player)) { world.set(id, Position, { x: fountainPos.x, y: fountainPos.y }); break; }
          for (const [id] of world.query(Pet, PetState)) { world.set(id, Position, { x: fountainPos.x, y: fountainPos.y }); }
        }
      }

      if (newDepth === 0 && pending.returnTicket && pending.returnTicket.depth > 0) {
        spawnReturnPortal(pending.returnTicket, pending.homecomingLanding);
      }

      onTransitioned();
      if (pending.source) {
        const pe = playerEntity();
        try {
          world.emit?.('teleported', {
            id: pe?.id || 0,
            to: pe?.pos || null,
            source: pending.source,
            depth: newDepth,
          });
        } catch (e) { console.debug('[transition] emit teleported failed:', e); }
      }
    } finally {
      _inFlight = false;
      armCooldown();
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────

  function install() {
    world.on('stair:traverse', ({ actor, direction, targetId }) => {
      const sid = Number(targetId) | 0;
      if (!(sid > 0)) return;
      const stairPos = world.get(sid, Position);
      if (!stairPos) return;
      const actorId = Number(actor) | 0;
      const actorPos = actorId > 0 ? world.get(actorId, Position) : null;
      if (!actorPos) return;
      if ((actorPos.x | 0) !== (stairPos.x | 0) || (actorPos.y | 0) !== (stairPos.y | 0)) return;
      queueStair(direction, stairPos.x | 0, stairPos.y | 0);
    });

    world.on('dungeon:teleport-depth', ({ targetDepth, source, returnTicket }) => {
      const isHomecoming = String(source || '') === 'scroll_homecoming' || String(source || '') === 'hearthstone';
      queueDepth(targetDepth, {
        source: String(source || 'dungeon:teleport-depth'),
        returnTicket: isHomecoming ? returnTicket : null,
        homecomingLanding: isHomecoming,
      });
    });

    world.on('portal:return', ({ portalId }) => {
      const pid = Number(portalId) | 0;
      if (!(pid > 0)) return;
      const ni = world.get(pid, NamedIdentity);
      if (ni?.identity !== RETURN_PORTAL_IDENTITY) return;
      const inter = world.get(pid, Interactable);
      const targetDepth = Number(inter?.params?.targetDepth);
      const targetX = Number(inter?.params?.targetX);
      const targetY = Number(inter?.params?.targetY);
      if (!Number.isFinite(targetDepth) || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
      try { world.destroy(pid); } catch {}
      untrackFloorEntity(pid);
      queueDepth(targetDepth, { targetPos: { x: targetX, y: targetY }, fragActorsAtTarget: true, source: 'portal:return' });
    });

    world.on('trap:pit:fall', ({ targetId, x, y }) => {
      const pe = playerEntity();
      if (!pe || pe.id !== (Number(targetId) | 0)) return;
      let currentDepth = 1;
      for (const [, ds] of world.query(DungeonState)) { currentDepth = ds.currentDepth; break; }
      queueDepth(currentDepth + 1, { targetPos: { x: x | 0, y: y | 0 } });
    });

    world.on("dungeon:transitioned", () => {
      destroyReturnPortals();
    });
  }

  return {
    flush,
    install,
    queueStair,
    queueDepth,
    trackFloorEntity,
    untrackFloorEntity,
    isLocked,
    RETURN_PORTAL_IDENTITY,
  };
}

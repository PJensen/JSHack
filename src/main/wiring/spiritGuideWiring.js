// main/wiring/spiritGuideWiring.js
// Contextual tutorial wiring: the spirit wisp guides first-time players
// by watching world events and queuing speech bubbles at key milestones.
//
// Each tip fires at most once per player lifetime (localStorage-tracked).
// The wiring is fully isolated — disable by not calling installSpiritGuideWiring.

import {
  GUIDANCE_TIPS,
  readSeenTips,
  markTipSeen,
} from "../../shared/data/spiritGuidance.js";
import { Position } from "../../rules/components/Position.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Player } from "../../rules/components/Player.js";
import { Vitality } from "../../rules/components/Vitality.js";

const INSTALLED = Symbol.for("jshack:main:spiritGuideWiring:installed");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   sceneRuntime: { queueSpeechBubble: Function },
 *   getPlayerEntity: () => ({ id: number } | null),
 *   spiritWispFx: { setGuideMode: (v:boolean) => void, getWispPos?: () => ({x:number,y:number}|null) },
 *   spiritPointerFx?: { flyTo: (selector:string) => void } | null,
 * }} opts
 */
export function installSpiritGuideWiring({
  world,
  sceneRuntime,
  getPlayerEntity,
  spiritWispFx,
  spiritPointerFx = null,
}) {
  if (!world || world[INSTALLED]) return;
  world[INSTALLED] = true;

  const seen = readSeenTips();
  const tipMap = new Map(GUIDANCE_TIPS.map((t) => [t.id, t]));

  // Track turn count for the movement tip.
  let turnCount = 0;
  // Track whether a ground item has been flagged (debounce).
  let itemGroundFired = false;

  // ── Helpers ──────────────────────────────────────────────────────────

  function remaining() {
    for (const tip of GUIDANCE_TIPS) {
      if (!seen.has(tip.id)) return true;
    }
    return false;
  }

  function fire(id) {
    if (seen.has(id)) return false;
    const tip = tipMap.get(id);
    if (!tip) return false;
    markTipSeen(seen, id);

    const pe = getPlayerEntity();
    const entityId = Number(pe?.id || 0) | 0;
    if (!(entityId > 0)) return false;

    sceneRuntime.queueSpeechBubble({
      entityId,
      text: tip.text,
      delaySec: tip.delaySec ?? 0.6,
      durationSec: tip.durationSec ?? 5,
      // Anchor bubble to the wisp's VFX position for clean visual alignment.
      resolveAnchor: () => spiritWispFx.getWispPos?.() || null,
    });

    // Let the wisp pulse when delivering guidance.
    world.emit?.("guidance:pulse", { tipId: id });

    // If the tip wants the wisp to fly somewhere, resolve the target.
    if (tip.flyTo) {
      const target = resolveFlightTarget(tip.flyTo, entityId);
      if (target) {
        world.emit?.("guidance:flyTo", { x: target.x, y: target.y });
      }
    }

    // Screen-space pointer: wisp orb flies from canvas to a UI button.
    if (tip.pointTo && spiritPointerFx) {
      const delay = ((tip.delaySec ?? 0.6) + 1.2) * 1000;
      setTimeout(() => spiritPointerFx.flyTo(tip.pointTo), delay);
    }

    // Disable guide mode once all tips are exhausted.
    if (!remaining()) {
      spiritWispFx.setGuideMode(false);
    }
    return true;
  }

  function resolveFlightTarget(kind, playerId) {
    const pp = world.has(playerId, Position) ? world.get(playerId, Position) : null;
    if (!pp) return null;
    const px = pp.x | 0;
    const py = pp.y | 0;

    let best = null;
    let bestDist = Infinity;

    const scan = (predicate) => {
      for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
        if (id === playerId) continue;
        if (!predicate(ni, id)) continue;
        const dist = Math.max(Math.abs((pos.x | 0) - px), Math.abs((pos.y | 0) - py));
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: pos.x, y: pos.y };
        }
      }
    };

    switch (kind) {
      case "item":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return !ident.startsWith("townfolk_");
        });
        break;
      case "stair":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident.includes("stair");
        });
        break;
      case "altar":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "altar" || ident === "shrine" || ident === "church_altar";
        });
        break;
      case "npc":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident.startsWith("townfolk_");
        });
        break;
      case "enemy":
        // Nearest non-player creature with Brain component — but we keep it
        // simple and just return null (wisp stays near player for combat tips).
        break;
    }
    return best;
  }

  // ── Welcome + Movement + Pet + Quick Items ────────────────────────────

  // Staggered on turn count so the player isn't overwhelmed.
  // 1st move: welcome, 2nd: pet companion, 3rd: quick items, 5th: movement.
  world.on("moved", ({ id }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(id || 0) !== pe.id) return;
    turnCount++;
    if (turnCount === 1) fire("welcome");
    if (turnCount === 2) fire("pet_companion");
    if (turnCount === 3) fire("quick_items");
    if (turnCount === 5) fire("movement");
  });

  // ── Item on ground (player walks near an item) ───────────────────────

  world.on("moved", ({ id, to }) => {
    if (itemGroundFired || seen.has("item_ground")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(id || 0) !== pe.id) return;
    const px = Number(to?.x || 0) | 0;
    const py = Number(to?.y || 0) | 0;

    // Scan for any ground item within 2 tiles.
    for (const [eid, pos] of world.query(Position)) {
      if (eid === pe.id) continue;
      // Quick identity check: anything with an ItemInfo component-ish name
      // We just check anything nearby that is NOT the player, an NPC, or a monster.
      const ni = world.get(eid, NamedIdentity);
      if (!ni) continue;
      const ident = String(ni.identity || "").toLowerCase();
      if (ident.startsWith("townfolk_")) continue;
      if (ident === "altar" || ident === "shrine") continue;
      const dist = Math.max(Math.abs((pos.x | 0) - px), Math.abs((pos.y | 0) - py));
      if (dist <= 2) {
        itemGroundFired = true;
        fire("item_ground");
        return;
      }
    }
  });

  // ── First pickup ─────────────────────────────────────────────────────

  world.on("item:pickup", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_pickup");
  });

  // ── First equip ──────────────────────────────────────────────────────

  world.on("item:equipped", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_equip");
  });

  // ── First combat (enemy deals or receives damage near player) ────────

  world.on("damaged", ({ target, source }) => {
    const pe = getPlayerEntity();
    if (!pe) return;
    const pid = pe.id;
    if (Number(target || 0) === pid || Number(source || 0) === pid) {
      fire("first_combat");
    }
  });

  // ── Low HP ───────────────────────────────────────────────────────────

  world.on("damaged", ({ target }) => {
    if (seen.has("low_hp")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(target || 0) !== pe.id) return;
    const vit = world.get(pe.id, Vitality);
    if (!vit) return;
    const ratio = (Number(vit.hp) || 0) / Math.max(1, Number(vit.maxHp) || 1);
    if (ratio < 0.4 && ratio > 0) fire("low_hp");
  });

  // ── Wait action (fires once after first combat is done) ──────────────

  world.on("damaged", ({ target }) => {
    if (seen.has("wait_action") || !seen.has("first_combat")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(target || 0) !== pe.id) return;
    fire("wait_action");
  });

  // ── First stair (dungeon transition) ─────────────────────────────────

  world.on("dungeon:transitioned", () => {
    fire("first_stair");
  });

  // ── First NPC dialogue ───────────────────────────────────────────────

  world.on("npc:dialogue", () => {
    fire("first_npc");
  });

  // ── First altar interaction ──────────────────────────────────────────

  world.on("altar:pray", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_altar");
  });

  // ── First spell ──────────────────────────────────────────────────────

  world.on("spell:learned", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_spell");
  });

  // ── Spell selection (second spell learned) ────────────────────────────

  let spellCount = 0;
  world.on("spell:learned", ({ actor }) => {
    if (seen.has("spell_select")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    spellCount++;
    if (spellCount >= 2) fire("spell_select");
  });

  // Enable guide mode on the wisp so it appears on the overworld.
  if (remaining()) {
    spiritWispFx.setGuideMode(true);
  }
}

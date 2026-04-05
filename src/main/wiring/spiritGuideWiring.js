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
import { DungeonState } from "../../rules/components/DungeonState.js";

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
      case "door":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "door" || ident === "door_locked";
        });
        break;
      case "fountain":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "fountain";
        });
        break;
      case "chest":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "chest" || ident === "chest_locked";
        });
        break;
      case "trap":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident.includes("trap");
        });
        break;
      case "craft":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "anvil" || ident === "furnace" || ident === "cooking_fire" || ident === "alchemy_bench";
        });
        break;
      case "shrine":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "shrine";
        });
        break;
      case "rack":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "weapon_rack";
        });
        break;
      case "sarcophagus":
        scan((ni) => {
          const ident = String(ni?.identity || "").toLowerCase();
          return ident === "sarcophagus";
        });
        break;
    }
    return best;
  }

  // ── Welcome (first move) ──────────────────────────────────────────────

  world.on("moved", ({ id }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(id || 0) !== pe.id) return;
    turnCount++;
    if (turnCount === 1) fire("welcome");
    if (turnCount === 8) fire("movement");
  });

  // ── Pet companion (pet delivers an item to the player) ──────────────

  world.on("pet:deliver", () => {
    fire("pet_companion");
  });

  // ── Quick items (first potion / consumable pickup) ──────────────────

  world.on("item:pickup", ({ actor, itemId }) => {
    if (seen.has("quick_items")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    // Check if the picked-up item is a consumable (potion, scroll, food).
    const ni = world.has(itemId, NamedIdentity) ? world.get(itemId, NamedIdentity) : null;
    const ident = String(ni?.identity || "").toLowerCase();
    if (ident.includes("potion") || ident.includes("scroll") || ident.includes("food") || ident.includes("stew")) {
      fire("quick_items");
    }
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

  // ── First gem pickup ──────────────────────────────────────────────────

  world.on("item:pickup", ({ actor, itemId }) => {
    if (seen.has("first_gem")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    const ni = world.has(itemId, NamedIdentity) ? world.get(itemId, NamedIdentity) : null;
    const ident = String(ni?.identity || "").toLowerCase();
    if (ident.startsWith("gem_")) fire("first_gem");
  });

  // ── First spellbook pickup ───────────────────────────────────────────

  world.on("item:pickup", ({ actor, itemId }) => {
    if (seen.has("first_spellbook")) return;
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    const ni = world.has(itemId, NamedIdentity) ? world.get(itemId, NamedIdentity) : null;
    const ident = String(ni?.identity || "").toLowerCase();
    if (ident.startsWith("book_")) fire("first_spellbook");
  });

  // ── First equip ──────────────────────────────────────────────────────

  world.on("item:equipped", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_equip");
  });

  // ── First combat (enemy spots the player — status:alert from aiChase) ──

  world.on("status", ({ kind }) => {
    if (kind !== "alert") return;
    fire("first_combat");
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

  // ── On-sight proximity tips (player walks near a feature) ────────────

  /** @type {Array<[string, (ident: string) => boolean]>} */
  const sightTips = [
    ["first_stair", (ident) => ident.includes("stair")],
    ["first_fountain", (ident) => ident === "fountain"],
    ["first_door", (ident) => ident === "door" || ident === "door_locked"],
    ["first_chest", (ident) => ident === "chest" || ident === "chest_locked"],
    ["first_shrine", (ident) => ident === "shrine"],
    ["first_weapon_rack", (ident) => ident === "weapon_rack"],
    ["first_sarcophagus", (ident) => ident === "sarcophagus"],
  ];

  world.on("moved", ({ id, to }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(id || 0) !== pe.id) return;

    // Quick-exit: if all sight tips are already seen, skip the scan.
    const unseen = sightTips.filter(([tipId]) => !seen.has(tipId));
    if (unseen.length === 0) return;

    const px = Number(to?.x || 0) | 0;
    const py = Number(to?.y || 0) | 0;

    for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
      if (eid === pe.id) continue;
      const dist = Math.max(Math.abs((pos.x | 0) - px), Math.abs((pos.y | 0) - py));
      if (dist > 4) continue;
      const ident = String(ni?.identity || "").toLowerCase();
      for (const [tipId, predicate] of unseen) {
        if (predicate(ident)) {
          fire(tipId);
          return; // one tip per move — don't overwhelm
        }
      }
    }
  });

  // ── First NPC dialogue (overworld only — townfolk don't exist in the dungeon) ──

  world.on("npc:dialogue", () => {
    for (const [, ds] of world.query(DungeonState)) {
      if ((ds.currentDepth | 0) !== 0) return;
    }
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

  // (fountain, door, chest, shrine, weapon rack, sarcophagus — handled by
  //  on-sight proximity scanner above)

  // ── First trap (player takes trap damage) ─────────────────────────

  world.on("trap:triggered", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_trap");
  });

  // ── First shop ────────────────────────────────────────────────────

  world.on("shop:open", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_shop");
  });

  // ── First harvest ─────────────────────────────────────────────────

  world.on("harvest:picked", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_harvest");
  });

  // ── First crafting station ────────────────────────────────────────

  world.on("alchemy:open", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_craft");
  });
  world.on("cooking:open", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_craft");
  });
  world.on("smithy:open", ({ actor }) => {
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_craft");
  });

  // ── First weather (rain) ──────────────────────────────────────────

  world.on("weather:changed", ({ weather }) => {
    if (weather !== "rain" && weather !== "heavy_rain") return;
    fire("first_weather");
  });

  // ── First dual wield ──────────────────────────────────────────────

  world.on("item:equipped", ({ actor, slot }) => {
    if (slot !== "offhand") return;
    const pe = getPlayerEntity();
    if (!pe || Number(actor || 0) !== pe.id) return;
    fire("first_dual_wield");
  });

  // Enable guide mode on the wisp so it appears on the overworld.
  if (remaining()) {
    spiritWispFx.setGuideMode(true);
  }
}

// src/rules/systems/channelingSystem.js
// Counts down active channel timers each tick. When a channel completes,
// injects a CastSpellIntent so castSpellSystem fires the spell.
// Cancellation from the app layer (ESC) removes Channeling directly.

import { Channeling } from "../components/Channeling.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { Mana } from "../components/Mana.js";
import { Stamina } from "../components/Stamina.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { Equipment, getEquippedSlot } from "../components/Equipment.js";
import { getSpell } from "../data/spells.js";
import { MANA_REGEN_COOLDOWN, STAMINA_REGEN_COOLDOWN } from "../data/regenConstants.js";
import { runSpellScript } from "../scripts/spells.js";
import { effectiveMaxMana, effectiveMaxStamina } from "../utils/passiveBonuses.js";
import { getChannelInterruptionReason } from "../utils/channelInterruptionPolicy.js";
import { emitSafe } from "../utils/emitSafe.js";
import { hasLOS } from "../../shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";
import { spellCostPerTick, spellCostResource } from "../data/spells.js";
import { createItemById } from "../utils/itemFactory.js";
import { addToInventory } from "../utils/inventoryFacade.js";
import { getTile } from "../environment/dungeon/tileMap.js";
import {
  TILE_CORAL_REEF,
  TILE_KELP_FOREST,
  TILE_SEAGRASS,
  TILE_SHALLOW_WATER,
  TILE_WATER,
  TILE_WATER_DEEP,
} from "../environment/dungeon/constants.js";

const DRAIN_LIFE_DAMAGE_INTERRUPT_INSTALLED = Symbol.for("jshack:channeling:drainLifeDamageInterrupt:installed");
const FISHING_CAST_REQUEST_INSTALLED = Symbol.for("jshack:fishing:castRequest:installed");

function isFishableTile(tile) {
  return tile === TILE_WATER
    || tile === TILE_WATER_DEEP
    || tile === TILE_SHALLOW_WATER
    || tile === TILE_KELP_FOREST
    || tile === TILE_SEAGRASS
    || tile === TILE_CORAL_REEF;
}

function findFishingWater(world, actor, intent) {
  const rawX = Number(intent?.x);
  const rawY = Number(intent?.y);
  if (Number.isFinite(rawX) && Number.isFinite(rawY) && isFishableTile(getTile(rawX | 0, rawY | 0))) {
    return { x: rawX | 0, y: rawY | 0 };
  }

  const pos = world.get(actor, Position);
  if (!pos) return null;
  let best = null;
  let bestDist = Infinity;
  for (let y = (pos.y | 0) - 3; y <= (pos.y | 0) + 3; y++) {
    for (let x = (pos.x | 0) - 3; x <= (pos.x | 0) + 3; x++) {
      const dist = Math.max(Math.abs(x - (pos.x | 0)), Math.abs(y - (pos.y | 0)));
      if (dist <= 0 || dist > 3 || dist >= bestDist) continue;
      if (!isFishableTile(getTile(x, y))) continue;
      best = { x, y };
      bestDist = dist;
    }
  }
  return best;
}

export function requestFishingCast(world, actor, itemId, opts = {}) {
  const turns = Math.max(1, Number(opts?.turns || 4) | 0);
  const eq = world.get(actor, Equipment);
  if (!getEquippedSlot(eq, itemId)) {
    emitSafe(world, "item:use-cancelled", {
      actor,
      itemId,
      code: "FISHING_ROD_NOT_EQUIPPED",
      message: "Equip the fishing rod before casting.",
      consumesTurn: false,
    });
    return false;
  }
  if (world.has(actor, Channeling)) {
    emitSafe(world, "item:use-cancelled", {
      actor,
      itemId,
      code: "FISHING_ALREADY_CHANNELING",
      message: "You are already channeling.",
      consumesTurn: false,
    });
    return false;
  }

  const water = findFishingWater(world, actor, opts?.intent || opts);
  if (!water) {
    emitSafe(world, "item:use-cancelled", {
      actor,
      itemId,
      code: "FISHING_NO_WATER",
      message: "There is no fishable water in casting range.",
      consumesTurn: false,
    });
    return false;
  }

  const pos = world.get(actor, Position);
  try {
    world.add(actor, Channeling, {
      mode: "cast",
      turnsRemaining: turns,
      turnsTotal: turns,
      spellId: "fishing",
      targetId: itemId,
      x: water.x,
      y: water.y,
      breakOnMove: true,
      anchorX: pos ? (pos.x | 0) : null,
      anchorY: pos ? (pos.y | 0) : null,
    });
  } catch {}
  emitSafe(world, "channeling:start", { actor, spellId: "fishing", castTime: turns, mode: "fish", itemId, x: water.x, y: water.y });
  emitSafe(world, "fishing:cast", { actor, itemId, x: water.x, y: water.y, turns });
  return true;
}

export function installFishingCastRequestListener(world) {
  if (world[FISHING_CAST_REQUEST_INSTALLED]) return;
  world[FISHING_CAST_REQUEST_INSTALLED] = true;

  world.on("fishing:cast:request", ({ actor, itemId, turns, x, y }) => {
    requestFishingCast(world, Number(actor || 0) | 0, Number(itemId || 0) | 0, { turns, x, y });
  });
}

function resolveFishingChannel(world, actor, ch) {
  const roll = typeof world.rand === "function" ? world.rand() : 0.42;
  const itemId = roll < 0.70 ? "food_raw_fish" : roll < 0.82 ? "food_wild_herbs" : roll < 0.90 ? "bone" : "";
  const caught = itemId ? createItemById(world, itemId) : 0;
  const pos = world.get(actor, Position);
  let stored = false;
  if (caught > 0) {
    stored = addToInventory(world, actor, caught);
    if (!stored && pos) {
      try { world.add(caught, Position, { x: pos.x | 0, y: pos.y | 0 }); } catch {}
    }
  }
  emitSafe(world, "fishing:caught", {
    actor,
    itemId,
    caughtId: caught || 0,
    stored,
    x: ch.x,
    y: ch.y,
  });
}

/**
 * Drain Life-specific interrupt policy:
 * only this sustained spell breaks on incoming damage.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installDrainLifeDamageInterruptListener(world) {
  if (world[DRAIN_LIFE_DAMAGE_INTERRUPT_INSTALLED]) return;
  world[DRAIN_LIFE_DAMAGE_INTERRUPT_INSTALLED] = true;

  world.on("damaged", ({ target, source, amount, cause }) => {
    const actor = Number(target || 0) | 0;
    if (!(actor > 0)) return;

    const ch = world.get(actor, Channeling);
    if (!ch || String(ch.spellId || "") !== "drain_life") return;

    try { world.remove(actor, Channeling); } catch {}

    const ae = world.get(actor, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) {
      ae.effects = ae.effects.filter((e) => String(e?.key || "").toLowerCase() !== "drain_life_channel");
    }

    emitSafe(world, "spell:drain_life:break", {
      actor,
      targetId: Number(source || 0) | 0,
      spellId: "drain_life",
      reason: "damage_interrupt",
      amount: Number(amount || 0) | 0,
      cause: String(cause || ""),
    });

    emitSafe(world, "channeling:cancelled", {
      actor,
      spellId: "drain_life",
      reason: "damage_interrupt",
    });
  });
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function channelingSystem(world) {
  let _isBlocked = null; // lazily built for breakOnNoLos checks
  for (const [id, ch] of world.query(Channeling)) {
    // Dead actors lose their channel
    const vit = world.get(id, Vitality);
    if (vit && (vit.hp | 0) <= 0) {
      try { world.remove(id, Channeling); } catch {}
      emitSafe(world, 'channeling:cancelled', { actor: id, spellId: ch.spellId, reason: 'dead' });
      continue;
    }

    const interruption = getChannelInterruptionReason(world, id);
    if (interruption) {
      try { world.remove(id, Channeling); } catch {}
      emitSafe(world, 'channeling:cancelled', {
        actor: id,
        spellId: ch.spellId,
        reason: interruption,
      });
      continue;
    }

    // breakOnMove: cancel if caster left anchor position
    if (ch.breakOnMove && ch.anchorX != null && ch.anchorY != null) {
      const cPos = world.get(id, Position);
      if (cPos && ((cPos.x | 0) !== (ch.anchorX | 0) || (cPos.y | 0) !== (ch.anchorY | 0))) {
        try { world.remove(id, Channeling); } catch {}
        emitSafe(world, 'channeling:cancelled', {
          actor: id,
          spellId: ch.spellId,
          reason: 'caster_moved',
        });
        continue;
      }
    }

    // breakOnNoLos: cancel if caster no longer has LOS to target
    if (ch.breakOnNoLos && ch.targetId) {
      const cPos = world.get(id, Position);
      const tPos = world.get(ch.targetId, Position);
      if (cPos && tPos) {
        if (!_isBlocked) _isBlocked = blockedCallback(buildBlocksVisionMap(world));
        if (!hasLOS(cPos.x | 0, cPos.y | 0, tPos.x | 0, tPos.y | 0, _isBlocked)) {
          try { world.remove(id, Channeling); } catch {}
          emitSafe(world, 'channeling:cancelled', {
            actor: id,
            spellId: ch.spellId,
            reason: 'los_break',
          });
          continue;
        }
      }
    }

    if (String(ch.mode || "cast") === "sustain") {
      const spell = getSpell(String(ch.spellId || ""));
      if (!spell) {
        try { world.remove(id, Channeling); } catch {}
        emitSafe(world, "channeling:cancelled", { actor: id, spellId: ch.spellId, reason: "invalid_spell" });
        continue;
      }

      const resource = spellCostResource(spell);
      const mana = world.get(id, Mana);
      const stamina = world.get(id, Stamina);
      const vitality = world.get(id, Vitality);
      const perTick = Math.max(0, Number(
        resource === "stamina"
          ? (ch.staminaPerTick ?? spellCostPerTick(spell))
          : resource === "life"
            ? (ch.lifePerTick ?? spellCostPerTick(spell))
            : (ch.manaPerTick ?? spellCostPerTick(spell))
      ));
      const have = Number(
        resource === "stamina"
          ? (stamina?.stamina ?? 0)
          : resource === "life"
            ? (vitality?.hp ?? 0)
            : (mana?.mana ?? 0)
      );
      const minLife = resource === "life" ? 1 : 0;
      if (have - perTick < minLife) {
        try { world.remove(id, Channeling); } catch {}
        emitSafe(world, "spell:oom", {
          actor: id,
          spellId: spell.id,
          need: perTick + minLife,
          have,
          costKind: resource === "stamina" ? "stamina" : resource === "life" ? "life" : "mana",
        });
        emitSafe(world, "channeling:cancelled", { actor: id, spellId: spell.id, reason: "oom" });
        continue;
      }

      if (resource === "stamina" && stamina) {
        stamina.stamina = have - perTick;
        stamina.regenCooldown = STAMINA_REGEN_COOLDOWN;
      } else if (resource === "life" && vitality) {
        vitality.hp = Math.max(1, have - perTick);
      } else if (mana) {
        mana.mana = have - perTick;
        mana.regenCooldown = MANA_REGEN_COOLDOWN;
      }

      try {
        runSpellScript(world, id, spell, {
          targetId: ch.targetId || id,
          x: ch.x,
          y: ch.y,
          _fromChanneling: true,
          _channelTick: true,
        });
      } catch {}

      emitSafe(world, "channeling:tick", {
        actor: id,
        spellId: spell.id,
        mode: "sustain",
        manaPerTick: resource === "mana" ? perTick : 0,
        staminaPerTick: resource === "stamina" ? perTick : 0,
        lifePerTick: resource === "life" ? perTick : 0,
        manaRemaining: Number(mana?.mana ?? 0),
        manaMax: effectiveMaxMana(world, id, mana),
        staminaRemaining: Number(stamina?.stamina ?? 0),
        staminaMax: effectiveMaxStamina(world, id, stamina),
        lifeRemaining: Number(vitality?.hp ?? 0),
      });
      continue;
    }

    ch.turnsRemaining -= 1;

    if (ch.turnsRemaining <= 0) {
      if (String(ch.spellId || "").toLowerCase() === "fishing") {
        try { world.remove(id, Channeling); } catch {}
        resolveFishingChannel(world, id, ch);
        emitSafe(world, 'channeling:complete', { actor: id, spellId: ch.spellId, mode: "fish" });
        continue;
      }

      // Channel complete — inject CastSpellIntent for castSpellSystem
      const castData = {
        spellId: ch.spellId,
        targetId: ch.targetId || id,
        _fromChanneling: true,
      };
      if (ch.x != null) castData.x = ch.x;
      if (ch.y != null) castData.y = ch.y;

      try { world.remove(id, Channeling); } catch {}
      try { world.add(id, CastSpellIntent, castData); } catch {}
      emitSafe(world, 'channeling:complete', { actor: id, spellId: ch.spellId });
    } else {
      // Still channeling — emit progress for UI
      emitSafe(world, 'channeling:tick', {
        actor: id,
        spellId: ch.spellId,
        mode: 'cast',
        turnsRemaining: ch.turnsRemaining,
        turnsTotal: ch.turnsTotal,
      });
    }
  }
}

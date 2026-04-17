// src/main/debug/debugCommands.js
// Process ?give, ?effects, and ?audio URL param debug commands at boot.

import { playerEntity } from "../../rules/utils/queries.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { addToInventory } from "../../rules/utils/inventoryFacade.js";
import { inventoryItems } from "../../rules/utils/inventoryFacade.js";
import { Brain } from "../../rules/components/Brain.js";
import { Position } from "../../rules/components/Position.js";
import { setTile } from "../../rules/environment/dungeon/tileMap.js";
import { TILE_VOID, TILE_GRASS, CHUNK_SIZE } from "../../rules/environment/dungeon/constants.js";

// All player-castable spells (from SPELL_DEFS) granted instantly in ?audio mode.
const AUDIO_SPELLS = [
  "agony", "arcane_bolt", "barkskin", "blastwave", "blind", "blink",
  "blizzard", "bloodthirst", "cheap_shot", "cleave", "consecrate",
  "corpses", "dead", "divine_shield", "drain_life", "earthshatter",
  "entangle", "evocation", "fireball", "firestorm", "flash_heal", "frost",
  "gridbugs", "harmony_ward", "heal", "hearthstone", "homecoming",
  "holy_strike", "ignite_weapons", "iron_flesh", "kitty", "leech_spores",
  "lifetap", "lightning", "mark_of_death", "meteor", "natures_touch",
  "phase_strike", "plague_swarm", "poison_blade", "primal_roar", "purify",
  "quicken", "rampage", "savage_strike", "scorch", "shadow_bolt",
  "shadow_veil", "smite", "smoke_bomb", "snakes", "spikes", "summon_skeleton",
  "thorn_burst", "touchstone", "verdant_ward", "war_cry",
];

// Items scattered on the floor around the player in ?audio mode.
// Each entry is either a string (count=1) or { id, count }.
const AUDIO_FLOOR_ITEMS = [
  // --- Gems: precious ---
  "gem_dilithium", "gem_diamond", "gem_ruby", "gem_jacinth", "gem_sapphire",
  "gem_black_opal", "gem_emerald", "gem_turquoise", "gem_citrine", "gem_aquamarine",
  "gem_amber", "gem_topaz", "gem_jet", "gem_opal", "gem_chrysoberyl",
  "gem_garnet", "gem_amethyst", "gem_jasper", "gem_fluorite", "gem_jade",
  "gem_obsidian", "gem_voidstone", "gem_agate",
  // --- Gems: glass ---
  "glass_white", "glass_blue", "glass_red", "glass_brown", "glass_orange",
  "glass_yellow", "glass_black", "glass_green", "glass_violet",
  // --- Stones ---
  "stone_luckstone", "stone_loadstone", "stone_touchstone", "stone_flint", "stone_rock",
  // --- Lights ---
  "lantern", "lantern", "lantern", "torch", "torch", "torch",
  // --- Named / unique weapons ---
  "sunsword", "dawnbreaker", "sun_vessel",
  // --- Legendary / epic weapons ---
  "stormcaller_blade", "soulreaver_axe", "blade_of_echoes", "tolling_blade",
  "debtbringer", "hollow_greatsword", "soul_ascendant_scythe", "thundergod_maul",
  "cataclysm_axe", "eclipse_maul", "howling_maul", "doom_crossbow",
  "predator_stakebow", "wardkeeper_shield", "aegis_of_the_ancient",
  // --- Common / magic weapons ---
  "staff_oak", "longsword", "sword_plain", "dagger_quick", "axe_heavy",
  "iron_mace", "morningstar", "bow_short", "bow_recurve", "bow_long",
  "warhammer", "flail", "iron_pickaxe",
  // --- Potions: beneficial ---
  "potion_health", "potion_water", "potion_holy_water", "potion_stoneskin",
  "potion_vigor", "potion_adrenaline", "potion_mana", "potion_endurance",
  "potion_second_wind", "potion_resist_fire", "potion_resist_poison",
  "potion_anti_venom", "potion_resist_electric", "potion_resist_acid",
  "potion_radiance",
  // --- Potions: cursed / bad ---
  "potion_poison", "potion_sickness", "potion_paralysis", "potion_hallucination",
  "potion_blindness", "potion_weakness", "potion_mana_surge", "potion_keen_edge",
  "potion_lethargy", "potion_confusion",
  // --- Scrolls ---
  "scroll_mapping", "scroll_blastwave", "scroll_homecoming", "scroll_heal",
  "scroll_summon_skeleton", "scroll_taming", "scroll_identify", "scroll_remove_curse",
  "scroll_amnesia", "scroll_fire", "scroll_aggravation", "scroll_genocide",
  "scroll_teleportation", "scroll_polymorph", "scroll_cursing", "scroll_summoning",
  "scroll_decay",
  // --- Ammo (stacks of 20) ---
  { id: "ammo_arrows",          count: 20 },
  { id: "ammo_fire_arrows",     count: 20 },
  { id: "ammo_piercing_arrows", count: 20 },
  { id: "ammo_bodkin_arrows",   count: 20 },
  { id: "ammo_blunt_arrows",    count: 20 },
  // --- Spellbooks (one of every player-readable book) ---
  "book_agony", "book_arcane_bolt", "book_barkskin", "book_blastwave", "book_blind",
  "book_blink", "book_blizzard", "book_bloodthirst", "book_cheap_shot", "book_cleave",
  "book_consecrate", "book_corpses", "book_dead", "book_divine_shield", "book_drain_life",
  "book_earthshatter", "book_entangle", "book_evocation", "book_fireball", "book_firestorm",
  "book_flash_heal", "book_frost", "book_gridbugs", "book_harmony_ward", "book_heal",
  "book_hearthstone", "book_homecoming", "book_holy_strike", "book_ignite_weapons",
  "book_iron_flesh", "book_kitty", "book_leech_spores", "book_lightning",
  "book_mark_of_death", "book_meteor", "book_natures_touch", "book_phase_strike",
  "book_plague_swarm", "book_poison_blade", "book_primal_roar", "book_purify",
  "book_quicken", "book_rampage", "book_savage_strike", "book_scorch",
  "book_shadow_bolt", "book_shadow_veil", "book_smite", "book_smoke_bomb",
  "book_snakes", "book_spikes", "book_summon_skeleton", "book_thorn_burst",
  "book_touchstone", "book_verdant_ward", "book_war_cry",
];

/**
 * Apply URL-param debug commands (?give, ?effects) to the player.
 * @param {{ world: import('../../lib/ecs-js/index.js').World, runtimeConfig: { giveParam?: string, effectsParam?: string } }} deps
 */
export function applyDebugCommands({ world, runtimeConfig }) {
  // Process ?give query string parameter to spawn items in player inventory
  // Format: ?give=item_id*count,item_id*count
  // Example: ?give=gold*1000,potion_health*5,sword_plain*1
  {
    const giveParam = runtimeConfig.giveParam;
    if (giveParam) {
      const pe = playerEntity(world);
      if (pe) {
        const inv = world.get(pe.id, Inventory);
        if (inv) {
          // Parse comma-separated item specs
          const specs = giveParam.split(',').map(s => s.trim()).filter(Boolean);

          for (const spec of specs) {
            // Parse "item_id*count" format
            const match = spec.match(/^([a-z_]+)(?:\*(\d+))?$/i);
            if (!match) {
              console.warn(`[?give] Invalid format: "${spec}" (expected: item_id*count)`);
              continue;
            }

            const itemId = match[1];
            const count = parseInt(match[2] || '1', 10);

            if (!Number.isFinite(count) || count < 1) {
              console.warn(`[?give] Invalid count for "${itemId}": ${match[2]}`);
              continue;
            }

            try {
              // Use centralized item factory
              const createdItemId = createItemById(world, itemId, { count });

              if (createdItemId !== null) {
                addToInventory(world, pe.id, createdItemId);
                console.debug(`[?give] Created ${count}x ${itemId}`);
              } else {
                console.warn(`[?give] Unknown item: "${itemId}"`);
              }
            } catch (err) {
              console.error(`[?give] Error creating item "${itemId}":`, err);
            }
          }
        }
      }
    }
  }

  // Process ?effects query string parameter to apply status effects to the player.
  // Format: ?effects=key*turns,key*turns   (turns defaults to 5 if omitted)
  // Example: ?effects=bleed*2,poison*10,burning,confused*3
  {
    const effectsParam = runtimeConfig.effectsParam;
    if (effectsParam) {
      const pe = playerEntity(world);
      if (pe) {
        const ae = world.get(pe.id, ActiveEffects);
        const specs = effectsParam.split(',').map(s => s.trim()).filter(Boolean);
        for (const spec of specs) {
          const match = spec.match(/^([a-z_]+)(?:\*(\d+))?$/i);
          if (!match) {
            console.warn(`[?effects] Invalid format: "${spec}" (expected: key or key*turns)`);
            continue;
          }
          const key = match[1].toLowerCase();
          const turnsLeft = parseInt(match[2] || '5', 10);
          if (!Number.isFinite(turnsLeft) || turnsLeft < 1) {
            console.warn(`[?effects] Invalid turns for "${key}": ${match[2]}`);
            continue;
          }
          const effect = { key, turnsLeft, potency: 1, stacks: 1 };
          if (ae && Array.isArray(ae.effects)) {
            ae.effects.push(effect);
          } else {
            world.add(pe.id, ActiveEffects, { effects: [effect] });
          }
          console.debug(`[?effects] Applied ${key} for ${turnsLeft} turn(s)`);
        }
      }
    }
  }

  // Process ?audio: nuke overworld to void, carve a grass stage, grant all spells,
  // and scatter audio-relevant items on the floor.
  if (runtimeConfig.audioMode) {
    const pe = playerEntity(world);
    if (!pe) return;

    const pos = world.get(pe.id, Position);
    if (!pos) return;

    // Layout constants — compute before carving so stage bounds are correct.
    const COLS    = 14;
    const startX  = pos.x + 3;
    const startY  = pos.y - Math.floor(AUDIO_FLOOR_ITEMS.length / COLS / 2);
    const rows    = Math.ceil(AUDIO_FLOOR_ITEMS.length / COLS);

    // 1. Nuke all overworld tiles to TILE_VOID (0).
    //    Overworld extent: chunks cx/cy -2..2, each CHUNK_SIZE tiles wide.
    const mapMin = -2 * CHUNK_SIZE;
    const mapMax =  3 * CHUNK_SIZE; // exclusive
    for (let wx = mapMin; wx < mapMax; wx++) {
      for (let wy = mapMin; wy < mapMax; wy++) {
        setTile(wx, wy, TILE_VOID);
      }
    }

    // 2. Carve a walkable grass stage: covers player standing area + full item grid
    //    with a 3-tile border on all sides.
    const stageLeft   = Math.min(pos.x, startX) - 3;
    const stageRight  = startX + COLS + 2;
    const stageTop    = startY - 3;
    const stageBottom = startY + rows + 2;
    for (let wx = stageLeft; wx <= stageRight; wx++) {
      for (let wy = stageTop; wy <= stageBottom; wy++) {
        setTile(wx, wy, TILE_GRASS);
      }
    }

    // 3. Learn every player-castable spell directly (mirrors mutations.js learnSpell).
    let brain = world.get(pe.id, Brain);
    if (!brain) {
      try { world.add(pe.id, Brain, {}); } catch {}
      brain = world.get(pe.id, Brain);
    }
    if (brain) {
      if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
      for (const spellId of AUDIO_SPELLS) {
        if (!brain.learnedSpellIds.includes(spellId)) {
          brain.learnedSpellIds.push(spellId);
        }
      }
      console.debug(`[?audio] Learned ${AUDIO_SPELLS.length} spells.`);
    }

    // 4. Scatter floor items in a grid east of player spawn.
    let placed = 0;
    for (let i = 0; i < AUDIO_FLOOR_ITEMS.length; i++) {
      const entry  = AUDIO_FLOOR_ITEMS[i];
      const itemId = typeof entry === "string" ? entry : entry.id;
      const count  = typeof entry === "string" ? 1     : (entry.count ?? 1);
      const col    = i % COLS;
      const row    = Math.floor(i / COLS);
      try {
        const eid = createItemById(world, itemId, { count });
        if (eid !== null) {
          world.add(eid, Position, { x: startX + col, y: startY + row });
          placed++;
        } else {
          console.warn(`[?audio] Unknown item: "${itemId}"`);
        }
      } catch (err) {
        console.warn(`[?audio] Failed to create "${itemId}":`, err);
      }
    }
    console.debug(`[?audio] Placed ${placed} items on floor.`);
  }
}

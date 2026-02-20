// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "./main/scheduler.js";
import { playerEntity, findNearestValidTileAround } from "./rules/utils/queries.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera, screenToWorld as cameraScreenToWorld } from "./display/camera/controller.js";
import { updateShake, startShake } from "./display/camera/shake.js";
import { zoomTo, jumpTo, easeTo } from "./display/camera/utils.js";

// display/ particles (pure display-side FX; no ECS, no rules)
import { ParticleFX } from "./display/passes/vfx/particles/particlePool.js";
// input wiring (display-only router)
import { setupInput } from "./display/input/InputRouter.js";
import { enableInputLockdown } from "./display/input/lockdown.js";
import { makeRulesDispatcher } from "./main/input/rulesDispatch.js";
// simple UI overlays
import { initOverlays } from "./display/ui/overlay.js";
import { initHUD } from "./display/ui/hud.js";
import { initPetMenu } from "./display/ui/petMenu.js";
import { initStatusLine } from "./display/ui/statusLine.js";
import { createHudFeeds } from "./main/ui/hudFeeds.js";
import { readRuntimeConfig } from "./main/config/runtimeConfig.js";
import { createMessageLog } from "./main/ui/messageLog.js";
import { installDeityUiWiring } from "./main/wiring/deityUiWiring.js";
import { installMessageWiring } from "./main/wiring/messageWiring.js";
import { installShopWiring } from "./main/wiring/shopWiring.js";
import { installChestWiring } from "./main/wiring/chestWiring.js";
import { installDigWiring } from "./main/wiring/digWiring.js";
import { installSavegameWiring } from "./main/wiring/savegameWiring.js";
import {
  hasSavegame,
  readSavegamePayload,
  clearSavegamePayload,
  readSavedDepth,
  readSavedSeed,
  restoreSnapshotFromSavegame,
} from "./main/wiring/savegameLoad.js";
import { loadGameData } from "./main/bootstrap/loadGameData.js";
import { Inventory } from "./rules/components/Inventory.js";
import { Equipment } from "./rules/components/Equipment.js";
import { ItemInfo } from "./rules/components/ItemInfo.js";
import { NamedIdentity } from "./rules/components/NamedIdentity.js";
import { Position } from "./rules/components/Position.js";
import { Player } from "./rules/components/Player.js";
import { Unpaid } from "./rules/components/Unpaid.js";
import { buildWorldView } from "./bridge/schema/worldView.js";
import { createPlayer } from "./rules/archetypes/Player.js";
import { followEntity } from "./display/camera/follow.js";
import { ActiveEffects } from "./rules/components/ActiveEffects.js";
import { Brain } from "./rules/components/Brain.js";
import { Mana } from "./rules/components/Mana.js";
import { getSpell } from "./rules/data/spells.js";
import { AFFIX_DEFS } from "./rules/data/affixes.js";
import { buildPalette } from "./display/palette/index.js";
import { itemsAt } from "./rules/utils/queries.js";
import { createGlyphAtlas, drawKind } from "./display/passes/glyphs/atlas.js";
import { FloatText } from "./display/passes/vfx/text/floatText.js";
import { Settings } from "./rules/components/Settings.js";
import { Vitality } from "./rules/components/Vitality.js";
import { Devotion } from "./rules/components/Devotion.js";
import { initDeity } from "./rules/systems/deitySystem.js";
import { DungeonState } from "./rules/components/DungeonState.js";
import { Interactable } from "./rules/components/Interactable.js";
import { Faction } from "./rules/components/Faction.js";
import { TombstoneRepository } from "./rules/repositories/TombstoneRepository.js";
import { installTombstoneDeathListener } from "./rules/systems/tombstoneSystem.js";
import TombstoneComponent from "./rules/components/Tombstone.js";
import { installDeathShareListener } from "./rules/systems/shareDeathSystem.js";
import { createItemById } from "./rules/utils/itemFactory.js";
import { forEachInRadius } from "./rules/utils/spatialIndex.js";
import { hasLOS } from "./shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "./rules/utils/vision.js";
import {
  addItemEntityToInventory,
  coalesceInventoryStacks,
  findInventoryStackTargetForItem,
} from "./rules/utils/inventoryStacking.js";
import { Engraving } from "./rules/components/Engraving.js";
import { Pet } from "./rules/components/Pet.js";
import { PetState } from "./rules/components/PetState.js";
import { PetCommandIntent } from "./rules/components/Intents/PetCommandIntent.js";
import { Owner } from "./rules/components/Owner.js";
import { Hunger } from "./rules/components/Hunger.js";
import { getHungerLevel } from "./rules/data/food.js";
import { listApplyTargetsForTool } from "./rules/content/items/applyPayloads.js";
import { resolveItemDisplayName } from "./main/wiring/itemName.js";
import { resetIdentification, identify, restoreIdentification } from "./rules/data/identification.js";
import { initGemPricing, restoreGemPricing } from "./rules/data/gemPricing.js";
import { createRng } from "./lib/ecs-js/rng.js";

// ---- Canvas & sizing -------------------------------------------------------
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
// Optional backbuffer to mirror DPR and present once per frame (reduces state churn)
const back = document.createElement('canvas');
const bctx = back.getContext('2d', { alpha: false });
bctx.imageSmoothingEnabled = false;

// Lock down browser-driven inputs/scroll/zoom so the app fully controls them
enableInputLockdown({ canvas });

const runtimeConfig = readRuntimeConfig();
const PERF = runtimeConfig.perf;
const chosenDeityId = runtimeConfig.chosenDeityId;
const BOOT_STATIC_UNITS = 9;
let _bootDoneUnits = 0;
let _bootTotalUnits = BOOT_STATIC_UNITS;

function hasValidFloorOverride() {
  const raw = runtimeConfig?.params?.get("floor");
  if (raw == null) return false;
  const value = Number.parseInt(String(raw), 10);
  return Number.isFinite(value) && value >= 0;
}

const _hasFloorOverride = hasValidFloorOverride();
const _pendingSavegame = _hasFloorOverride ? null : readSavegamePayload();

/**
 * @param {string} label
 * @param {number} [done]
 */
function updateBootProgress(label, done = _bootDoneUnits) {
  try {
    const fn = /** @type {any} */ (window).__JSHACK_BOOT_PROGRESS;
    if (typeof fn === 'function') {
      fn({
        label,
        done: Math.max(0, done),
        total: Math.max(1, _bootTotalUnits),
      });
    }
  } catch {}
}

/** @param {string} label */
function bootAdvance(label) {
  _bootDoneUnits += 1;
  updateBootProgress(label);
}

function finishBoot() {
  try {
    const fn = /** @type {any} */ (window).__JSHACK_BOOT_DONE;
    if (typeof fn === 'function') fn();
  } catch {}
}

// Use tile-sized world units: 1 world unit == 1 tile on screen
const TILE_PX = 28;

let _cssW = 0, _cssH = 0, _dpr = 1;
function resize() {
  // Limit device pixel ratio and align CSS size to tile grid to avoid fractional resampling
  const rawDpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const maxCap = Math.max(1, Math.floor(PERF.dprCap || 1));
  const dpr = Math.max(1, Math.min(rawDpr, maxCap));

  const vw = Math.max(1, (window.innerWidth | 0));
  const vh = Math.max(1, (window.innerHeight | 0));
  const cols = Math.max(1, Math.floor(vw / TILE_PX));
  const rows = Math.max(1, Math.floor(vh / TILE_PX));
  const cssW = cols * TILE_PX;
  const cssH = rows * TILE_PX;

  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Backbuffer mirrors visible canvas size and DPR transform
  back.width = canvas.width;
  back.height = canvas.height;
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  _cssW = cssW; _cssH = cssH; _dpr = dpr;
}
addEventListener("resize", resize);
resize();
updateBootProgress((!_hasFloorOverride && hasSavegame()) ? "Loading from Save" : "Loading...");

// ---- App wires rules/ (no display logic here) ------------------------------
const _bootSeed = (_hasFloorOverride ? null : readSavedSeed(_pendingSavegame)) ?? 0xa77a77;
const world = new World({ seed: _bootSeed });
configureWorld(world);
bootAdvance("Configured ECS systems");

// Initialize identification & gem pricing for this game run
resetIdentification();
if (_pendingSavegame) {
  restoreIdentification(_pendingSavegame.identified);
  if (!Array.isArray(_pendingSavegame.identified)) identify('stone_touchstone');
  restoreGemPricing(_pendingSavegame.gemPricing);
  if (!Array.isArray(_pendingSavegame.gemPricing)) initGemPricing(createRng(world.seed ^ 0x6E45));
  bootAdvance("Prepared saved item state");
} else {
  identify('stone_touchstone');
  initGemPricing(createRng(world.seed ^ 0x6E45));
  bootAdvance("Prepared run-specific item state");
}

// Initialize tombstone system
const tombstoneRepo = new TombstoneRepository();
installTombstoneDeathListener(world, tombstoneRepo);
installDeathShareListener(world);
bootAdvance("Installed run listeners");

// Warm data registries with per-dataset progress callbacks.
let _bootDataUnits = 0;
const _bootDataBase = _bootDoneUnits;
loadGameData({
  onProgress: (progress) => {
    if (!progress || progress.phase !== 'data') return;
    const total = Math.max(1, Number(progress.overallTotal) || 1);
    if (_bootDataUnits === 0) {
      _bootDataUnits = total;
      _bootTotalUnits += _bootDataUnits;
    }
    const completed = Math.max(0, Math.min(_bootDataUnits, Number(progress.completed) || 0));
    const dsProcessed = Math.max(0, Number(progress.processed) || 0);
    const dsTotal = Math.max(1, Number(progress.total) || 1);
    updateBootProgress(`${progress.label} ${dsProcessed}/${dsTotal}`, _bootDataBase + completed);
  },
});
_bootDoneUnits = _bootDataBase + _bootDataUnits;
updateBootProgress("Game data loaded", _bootDoneUnits);

// Only app/scenes step the sim (deterministic). We'll keep it paused here.
function stepSim(dtTurns = 0) { if (dtTurns > 0) { world.tick(dtTurns); } }

// --- Active spell selection (app-side state) ---------------------------------
/** @type {string|null} */
let _activeSpellId = null;
const TARGETED_SPELL_CONFIG = Object.freeze({
  blink: Object.freeze({
    fallbackRange: 10,
    requiresLOS: false,
    describePrompt(range) {
      return `Choose blink destination (up to ${range} tiles). Tap a tile, or press Esc to cancel.`;
    },
  }),
  meteor: Object.freeze({
    fallbackRange: 12,
    requiresLOS: true,
    describePrompt(range) {
      return `Tap meteor target (LOS, range ${range}). Tap cast again or press Esc to cancel.`;
    },
  }),
});
/** @type {{ spellId: string, spellName: string, range: number, requiresLOS: boolean }|null} */
let _pendingSpellTargeting = null;
/** @type {{ actorId: number, itemId: number, itemName: string, range: number }|null} */
let _pendingThrowTargeting = null;
/** @type {Array<{ itemId:number, from:{x:number,y:number}, to:{x:number,y:number}, t:number, duration:number, kind:string }>} */
const _thrownItemFx = [];
const _hiddenThrownItemIds = new Set();
const THROW_FX_SPEED_TILES_PER_SEC = 26;
const THROW_FX_MIN_DURATION = 0.09;
const THROW_FX_MAX_DURATION = 0.32;
const THROW_FX_ARC_HEIGHT = 0.38;

/**
 * @param {string} spellId
 */
function getTargetedSpellConfig(spellId) {
  return TARGETED_SPELL_CONFIG[String(spellId || "").toLowerCase()] || null;
}

/**
 * Keep display-side throw target prompt aligned with rules throw range.
 * @param {number} weight
 */
function computeThrowRange(weight) {
  const w = Number.isFinite(weight) && weight > 0 ? weight : 1;
  const range = Math.round(6 - Math.log2(w + 1));
  return Math.max(1, Math.min(8, range | 0));
}

function isSimUiBlocked() {
  return _thrownItemFx.length > 0;
}

function syncSimInputLockFlag() {
  try { /** @type {any} */ (window).__JSHACK_INPUT_LOCKED = isSimUiBlocked(); } catch {}
}
syncSimInputLockFlag();

function learnedSpells() {
  const pe = playerEntity(world);
  if (!pe) return [];
  /** @type {{ learnedSpellIds?: string[] }|null} */
  const brain = /** @type any */ (world.get(pe.id, Brain));
  const ids = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
  return ids.map((id) => ({ id, ...(getSpell(id) || {}) }));
}
function getPlayerMana() {
  const pe = playerEntity(world);
  if (!pe) return { mana: 0, maxMana: 0 };
  /** @type {{ mana?:number, maxMana?:number }|null} */
  const m = /** @type any */ (world.get(pe.id, Mana));
  return { mana: Number(m?.mana || 0), maxMana: Number(m?.maxMana || 0) };
}

// Initialize HUD feed updaters with stamina support
const hudFeeds = createHudFeeds(world, { getPlayerMana });

function ensureActiveSpell() {
  if (_activeSpellId) return _activeSpellId;
  const list = learnedSpells();
  _activeSpellId = (list[0]?.id) || null;
  updateActiveSpellLabel();
  return _activeSpellId;
}
function setActiveSpell(id) {
  _activeSpellId = (typeof id === 'string' && id.length) ? id : null;
  if (_pendingSpellTargeting && _pendingSpellTargeting.spellId !== _activeSpellId) {
    _pendingSpellTargeting = null;
  }
  updateActiveSpellLabel();
}
function updateActiveSpellLabel() {
  const s = _activeSpellId ? getSpell(_activeSpellId) : null;
  const name = s?.name || (_activeSpellId || '');
  const cost = Number(s?.manaCost || 0);
  const { mana } = getPlayerMana();
  const canCast = mana >= cost && !!_activeSpellId;
  try { window.dispatchEvent(new CustomEvent('ui:updateActiveSpellLabel', { detail: { id: _activeSpellId, name, cost, canCast } })); } catch {}
}

// ---- Dungeon initialization -------------------------------------------------
import { initDungeon, generateFloorPlan } from "./rules/environment/dungeon/index.js";
import { transitionToDepth } from "./rules/environment/dungeon/transition.js";
import {
  TILE_FLOOR,
  TILE_WALL,
  TILE_DOOR,
  TILE_STAIR_DOWN,
  TILE_STAIR_UP,
  TILE_GRASS,
  TILE_WATER,
  TILE_MOUNTAIN,
  TILE_TREE,
} from "./rules/environment/dungeon/constants.js";
import { dungeonConfig } from "./rules/environment/dungeon/dungeonConfig.js";
const _tileKindMap = {
  [TILE_FLOOR]: 'floor',
  [TILE_WALL]: 'wall',
  [TILE_DOOR]: 'floor',
  [TILE_STAIR_DOWN]: 'stair_down',
  [TILE_STAIR_UP]: 'stair_up',
  [TILE_GRASS]: 'grass',
  [TILE_WATER]: 'water',
  [TILE_MOUNTAIN]: 'mountain',
  [TILE_TREE]: 'tree',
};

// Allow URL override: ?dungeonScale=0.3 for compact debugging floors
{
  const ds = runtimeConfig.dungeonScale;
  if (Number.isFinite(ds) && ds > 0) dungeonConfig.dungeonScale = ds;
}

// Allow URL override: ?floor=0|1|... to choose start depth.
const _startDepth = _hasFloorOverride
  ? runtimeConfig.startDepth
  : (readSavedDepth(_pendingSavegame) ?? runtimeConfig.startDepth);
const _initialDepth = (Number.isFinite(_startDepth) && _startDepth >= 0) ? _startDepth : 0;
const _bootFloorPlan = generateFloorPlan(world.seed >>> 0, _initialDepth);
const _bootChunkTotal = Math.max(
  1,
  (_bootFloorPlan.extent.maxCX - _bootFloorPlan.extent.minCX + 1)
  * (_bootFloorPlan.extent.maxCY - _bootFloorPlan.extent.minCY + 1),
);
let _bootChunkUnits = _bootChunkTotal;
_bootTotalUnits += _bootChunkUnits;
const _bootDungeonBase = _bootDoneUnits;
updateBootProgress(`Generating dungeon 0/${_bootChunkTotal} chunks`, _bootDungeonBase);

// Initialize the procedural dungeon (entire floor generated up front)
const spawnPos = initDungeon(world, {
  startDepth: _startDepth,
  tombstoneRepo,
  onProgress: (progress) => {
    if (!progress || progress.phase !== 'chunks') return;
    const total = Math.max(1, Number(progress.total) || _bootChunkTotal);
    const processed = Math.max(0, Math.min(total, Number(progress.processed) || 0));
    if (total !== _bootChunkUnits) {
      _bootTotalUnits += (total - _bootChunkUnits);
      _bootChunkUnits = total;
    }
    updateBootProgress(`Generating dungeon ${processed}/${total} chunks`, _bootDungeonBase + processed);
  },
});
_bootDoneUnits = _bootDungeonBase + _bootChunkUnits;
updateBootProgress(`Dungeon ready (${_bootChunkUnits} chunks)`, _bootDoneUnits);

let _savegameLoaded = false;
if (_pendingSavegame) {
  updateBootProgress("Applying save snapshot...", _bootDoneUnits);
  try {
    restoreSnapshotFromSavegame(world, _pendingSavegame);
    const savedSpell = _pendingSavegame?.app?.activeSpellId;
    if (typeof savedSpell === "string" && savedSpell.length > 0) _activeSpellId = savedSpell;
    _savegameLoaded = true;
    updateBootProgress("Loaded save snapshot", _bootDoneUnits);
  } catch (err) {
    console.error("[SAVE] Failed to apply snapshot, continuing as new game.", err);
    clearSavegamePayload();
    _activeSpellId = null;
    resetIdentification();
    identify('stone_touchstone');
    initGemPricing(createRng(world.seed ^ 0x6E45));
    updateBootProgress("Save was invalid; starting new run", _bootDoneUnits);
  }
}

// Diagnostic: log all stair entities so we can confirm they exist
{
  let stairCount = 0;
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity === 'stair_down' || ni.identity === 'stair_up') {
      console.log(`[DUNGEON] ${ni.identity} entity #${id} at (${pos.x}, ${pos.y})`);
      stairCount++;
    }
  }
  if (stairCount === 0) console.warn('[DUNGEON] WARNING: No stair entities were created!');
}

if (!_savegameLoaded) {
  // Create player at the spawn position (center of first room in origin chunk)
  if (!playerEntity(world)) {
    createPlayer(world, { x: spawnPos.x, y: spawnPos.y, name: "Hero" });
  }

  // Set player stats
  {
    const pe = playerEntity(world);
    if (pe) {
      // Mana
      world.add(pe.id, Mana, { mana: 50, maxMana: 50, manaRegen: 0.1 });
      // 10-turn invulnerability at start
      const ae = world.get(pe.id, ActiveEffects);
      if (ae && Array.isArray(ae.effects)) {
        ae.effects.push({ key: 'invulnerable', turnsLeft: 10, potency: 1 });
      } else {
        world.add(pe.id, ActiveEffects, { effects: [{ key: 'invulnerable', turnsLeft: 10, potency: 1 }] });
      }
      // Hunger: start with 100 turns of satiation ("you ate before entering the dungeon")
      world.add(pe.id, Hunger, { hunger: 0, satiation: 100 });

      const inv = world.get(pe.id, Inventory);
      const eq = world.get(pe.id, Equipment);
      const addStarterItem = (itemId, opts = {}) => {
        if (!inv) return 0;
        const createdId = createItemById(world, itemId, opts);
        if (!(createdId > 0)) return 0;
        const moved = addItemEntityToInventory(world, inv, createdId);
        if (!moved.ok) return 0;
        return moved.mode === "stacked" ? moved.stackedIntoId : createdId;
      };

      // Demo loadout: fun melee setup with caster utility.
      if (eq) {
        eq.weapon = addStarterItem('stormtouched_mace') || null;
        eq.armor = addStarterItem('leadweave_mantle') || null;
        eq.shield = addStarterItem('grounded_buckler') || null;
        eq.ring1 = addStarterItem('ring_arcana') || null;
        eq.ring2 = addStarterItem('ring_endurance') || null;
      }

      // Keep a pickaxe around for digging fun.
      addStarterItem('iron_pickaxe');

      // Useful inventory extras for demos.
      addStarterItem('potion_stoneskin', { count: 3 });
      addStarterItem('potion_health', { count: 3 });
      addStarterItem('wand_frost');
      addStarterItem('stone_touchstone');
      addStarterItem('book_dead');

      // Start with Lightning learned and first in brain order.
      const brain = /** @type {{ learnedSpellIds?: string[] }|null } */ (world.get(pe.id, Brain));
      if (brain) {
        if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
        const filtered = brain.learnedSpellIds.filter((id) => id !== 'lightning');
        brain.learnedSpellIds = ['lightning', ...filtered];
      }
    }
  }

  // Spawn pet (kitty) next to the player
  {
    const pe = playerEntity(world);
    if (pe) {
      const ppos = world.get(pe.id, Position);
      const spawnTile = findNearestValidTileAround(world, ppos, {
        maxDistance: 1,
        exclude: [{ x: ppos.x, y: ppos.y }],
      });
      const petId = world.create();
      world.add(petId, Pet);
      world.add(petId, Position, spawnTile || { x: ppos.x, y: ppos.y });
      world.add(petId, NamedIdentity, { name: "Kitty", identity: "kitty" });
      world.add(petId, Faction, { key: "pet" });
      world.add(petId, Owner, { ownerId: pe.id });
      world.add(petId, Inventory, { items: [], capacity: 1, weightLimit: null });
      world.add(petId, Settings, { autoPickup: true, autoPickupKinds: ['currency', 'potion', 'ammo', 'scroll', 'equip'] });
      // Pet combat components
      world.add(petId, Vitality, { maxHp: 30, hp: 30 });
      world.add(petId, Equipment, {
        attackDerived: 2,   // Base attack bonus
        defenseDerived: 2   // Base defense (armorClass = 10 + defense = 12)
      });
      // Pet state machine
      world.add(petId, PetState, {
        state: 'following',
        targetX: null,
        targetY: null,
        targetItemId: 0,
        stateEnteredTurn: world.step,
        lastPlayerX: ppos.x,
        lastPlayerY: ppos.y,
        commandCooldown: 0,
      });

      // Notify UI that pet exists
      try {
        window.dispatchEvent(new CustomEvent('ui:petExists', {
          detail: { exists: true }
        }));
      } catch {}
    }
  }

  // Process ?give query string parameter to spawn items in player inventory
  // Format: ?give=item_id*count,item_id*count
  // Example: ?give=gold*1000,potion_health*5,sword_plain*1
  {
    const giveParam = runtimeConfig.giveParam;
    if (giveParam) {
      const pe = playerEntity(world);
      if (pe) {
        const inv = world.get(pe.id, Inventory);
        if (inv && Array.isArray(inv.items)) {
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
                addItemEntityToInventory(world, inv, createdItemId);
                console.log(`[?give] Created ${count}x ${itemId}`);
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
}

// Ensure deity state is initialized for current player (new game or loaded save).
{
  const pe = playerEntity(world);
  if (pe) {
    const dev = world.get(pe.id, Devotion);
    const deityId = String(dev?.deityId || chosenDeityId || "");
    if (deityId) {
      if (!dev) world.add(pe.id, Devotion, { deityId });
      initDeity(deityId, world);
    }
  }
}

bootAdvance(_savegameLoaded ? "Restored saved player state" : "Spawned player state");

function findNearestTraversalTarget(world, x, y) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'stair_down' && ni.identity !== 'stair_up' && ni.identity !== 'return_portal') continue;
    const dist = Math.max(Math.abs(pos.x - x), Math.abs(pos.y - y));
    if (dist > 1) continue;
    const prefer = dist < nearestDist
      || (dist === nearestDist && ni.identity === 'return_portal' && nearest?.identity !== 'return_portal');
    if (prefer) {
      nearestDist = dist;
      nearest = { id: eid, identity: ni.identity };
    }
  }
  return nearest;
}

// ---- Input setup (display/input → rules/display) ---------------------------
const inputDisposers = [];
{
  const rulesHandler = makeRulesDispatcher(
    /** @type any */(world),
    () => (playerEntity(world)?.id || 0)
  );

  const displayHandler = (action) => {
    if (isSimUiBlocked()) return;
    switch (action.type) {
      case "display.openInventory":
        window.dispatchEvent(new CustomEvent("ui:openInventory"));
        break;
      case "display.openMessageLog":
        window.dispatchEvent(new CustomEvent("ui:openMessageLog"));
        break;
      case "display.zoom": {
        const f = Math.max(0.5, Math.min(1.5, Number(action.payload?.factor) || 1));
        const minS = TILE_PX * 0.5;
        const maxS = TILE_PX * 4.0;
        const current = (cam.targetScale || cam.scale || TILE_PX);
        const next = Math.max(minS, Math.min(maxS, current * f));
        zoomTo(cam, next);
        break;
      }
      case "display.openPickupChooser": {
        // Contextual get/interact key:
        // 1) If standing on a chest, open chest UI.
        // 2) Otherwise run normal pickup flow.
        const p = playerEntity(world);
        if (!p) break;

        let chestId = 0;
        for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
          if (ni.identity !== 'chest') continue;
          if (pos.x === p.pos.x && pos.y === p.pos.y) {
            chestId = eid;
            break;
          }
        }
        if (chestId) {
          const chestInv = world.get(chestId, Inventory);
          try {
            world.emit?.('chest:open', {
              actor: p.id,
              targetId: chestId,
              chestItems: [...(chestInv?.items || [])],
            });
          } catch {}
          break;
        }

        // Gather items at player's position. Open chooser only when there are >1 items.
        const ids = itemsAt(world, p.pos.x, p.pos.y);
        if (ids.length === 0) {
          break;
        }
        if (ids.length === 1) {
          const only = ids[0];
          rulesHandler({ type: 'rules.pickupItem', payload: { itemId: only } });
        } else {
          const items = ids.map((id) => {
            const info = world.get(id, ItemInfo);
            return { id, type: info?.type || 'item', name: resolveItemDisplayName(world, id), count: info?.count || 1 };
          });
          window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items } }));
        }
        break;
      }
      case "display.traverseStairs": {
        const p = playerEntity(world);
        if (!p) break;
        const target = findNearestTraversalTarget(world, p.pos.x, p.pos.y);
        if (!target) break;
        if (target.identity === 'return_portal') {
          world.emit?.('portal:return', {
            actor: p.id,
            portalId: target.id,
            targetId: target.id,
          });
          break;
        }
        const direction = target.identity === 'stair_down' ? 'down' : 'up';
        world.emit?.('stair:traverse', {
          actor: p.id,
          targetId: target.id,
          direction,
        });
        break;
      }
      case "display.openApplyChooser":
        window.dispatchEvent(new CustomEvent("ui:openApplyChooser"));
        break;
      case "display.openDeathLog":
        window.dispatchEvent(new CustomEvent("ui:openDeathLog"));
        break;
      default:
        break;
    }
  };

  setupInput({ canvas, rulesHandler, displayHandler, onDispose: inputDisposers, touchFeedback: true });
}
bootAdvance("Bound input handlers");

// ---- Display UI overlays + data feeds -------------------------------------
initOverlays();
initHUD();
initPetMenu();
initStatusLine();
bootAdvance("Initialized HUD and overlays");

// Provide inventory data to overlay when requested
addEventListener('ui:requestInventoryData', () => {
  const p = playerEntity(world);
  const items = [];
  if (p) {
    const inv = world.get(p.id, Inventory);
    const eq = world.get(p.id, Equipment);
    if (inv && Array.isArray(inv.items)) {
      coalesceInventoryStacks(world, inv);
      for (const id of inv.items) {
        const info = world.get(id, ItemInfo);
        if (info) {
          const equippedSlot = (eq && (
            (eq.weapon === id && 'weapon') ||
            (eq.armor === id && 'armor') ||
            (eq.shield === id && 'shield') ||
            (eq.ring1 === id && 'ring1') ||
            (eq.ring2 === id && 'ring2') ||
            (eq.ammo === id && 'ammo') ||
            (eq.ranged === id && 'ranged')
          )) || null;
          const applyTargetIds = listApplyTargetsForTool(world, p.id, id);
          const applyTargetCount = applyTargetIds.length;
          const canApply = applyTargetCount > 0;
          items.push({
            id,
            type: info.type,
            description: info.description,
            count: info.count,
            slot: info.slot,
            name: resolveItemDisplayName(world, id),
            rarityName: info.rarityName,
            bonuses: info.bonuses || {},
            affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
            equipped: Boolean(equippedSlot),
            equippedSlot,
            unpaid: world.has(id, Unpaid),
            unpaidPrice: world.get(id, Unpaid)?.price || 0,
            unpaidShopkeeperId: world.get(id, Unpaid)?.shopkeeperId || 0,
            canApply,
            applyTargetCount,
          });
        }
      }
    }
    // Append learned spells as virtual brain-slot items
    const brain = world.get(p.id, Brain);
    const spellIds = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
    for (const sid of spellIds) {
      const s = getSpell(sid);
      if (!s) continue;
      items.push({
        id: `spell:${sid}`,
        type: 'spell',
        description: `Mana ${s.manaCost}`,
        count: 1,
        slot: 'brain',
        name: s.name,
        rarityName: 'rare',
        bonuses: {},
        affixes: [],
        equipped: _activeSpellId === sid,
        equippedSlot: _activeSpellId === sid ? 'brain' : null,
      });
    }
  }
  window.dispatchEvent(new CustomEvent('ui:inventoryData', { detail: { items } }));
});

// Provide usable items to the use-chooser overlay when requested
const USABLE_TYPES = new Set(['wand', 'scroll', 'book', 'learn', 'food', 'potion']);
addEventListener('ui:requestUsableItemsData', () => {
  const p = playerEntity(world);
  const items = [];
  if (p) {
    const inv = world.get(p.id, Inventory);
    if (inv && Array.isArray(inv.items)) {
      for (const id of inv.items) {
        const info = world.get(id, ItemInfo);
        if (!info || !USABLE_TYPES.has(info.type)) continue;
        items.push({
          id,
          type: info.type,
          description: info.description,
          count: info.count,
          name: resolveItemDisplayName(world, id),
          rarityName: info.rarityName,
        });
      }
    }
  }
  window.dispatchEvent(new CustomEvent('ui:usableItemsData', { detail: { items } }));
});

// Provide all inventory items to the throw-chooser overlay when requested
addEventListener('ui:requestThrowableItemsData', () => {
  const p = playerEntity(world);
  const items = [];
  if (p) {
    const inv = world.get(p.id, Inventory);
    if (inv && Array.isArray(inv.items)) {
      for (const id of inv.items) {
        const info = world.get(id, ItemInfo);
        if (!info) continue;
        items.push({
          id,
          type: info.type,
          description: info.description,
          count: info.count,
          name: resolveItemDisplayName(world, id),
          rarityName: info.rarityName,
        });
      }
    }
  }
  window.dispatchEvent(new CustomEvent('ui:throwableItemsData', { detail: { items } }));
});

// Provide applicable tools to the apply-tool chooser
addEventListener('ui:requestApplyToolsData', () => {
  const p = playerEntity(world);
  const items = [];
  if (p) {
    const inv = world.get(p.id, Inventory);
    if (inv && Array.isArray(inv.items)) {
      for (const id of inv.items) {
        const targetIds = listApplyTargetsForTool(world, p.id, id);
        if (targetIds.length <= 0) continue;
        items.push({ id, name: resolveItemDisplayName(world, id) });
      }
    }
  }
  window.dispatchEvent(new CustomEvent('ui:applyToolsData', { detail: { items } }));
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
  window.dispatchEvent(new CustomEvent('ui:applyTargetsData', { detail: { items } }));
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

// Provide message log entries (placeholder until rules log is wired)
addEventListener('ui:requestMessageLogData', () => {
  const entries = messageLog.getEntries();
  window.dispatchEvent(new CustomEvent('ui:messageLogData', { detail: { entries } }));
});

// Provide death log records from tombstone repository
addEventListener('ui:requestDeathLogData', () => {
  const records = tombstoneRepo.getAll();
  window.dispatchEvent(new CustomEvent('ui:deathLogData', { detail: { records } }));
});

// Active spell button click → cast (or open spell picker if none active)
addEventListener('ui:castActiveSpell', () => {
  if (isSimUiBlocked()) return;
  const id = ensureActiveSpell();
  if (!id) {
    try { window.dispatchEvent(new CustomEvent('ui:openSpellPicker')); } catch {}
    return;
  }
  _pendingThrowTargeting = null;

  const targetedCfg = getTargetedSpellConfig(id);
  if (targetedCfg) {
    const spell = getSpell(id);
    const spellName = String(spell?.name || id);
    const range = Math.max(
      1,
      Number.isFinite(spell?.range) ? (Number(spell.range) | 0) : (Number(targetedCfg.fallbackRange) | 0),
    );
    if (_pendingSpellTargeting?.spellId === id) {
      _pendingSpellTargeting = null;
      try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch {}
      return;
    }
    _pendingSpellTargeting = {
      spellId: id,
      spellName,
      range,
      requiresLOS: targetedCfg.requiresLOS === true,
    };
    try {
      messageLog.log({
        text: targetedCfg.describePrompt(range),
        type: 'system',
      });
    } catch {}
    return;
  }

  _pendingSpellTargeting = null;
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler({ type: 'rules.castActiveSpell', payload: { spellId: id } });
});

addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (_pendingSpellTargeting) {
    const spellName = _pendingSpellTargeting.spellName;
    _pendingSpellTargeting = null;
    ev.preventDefault();
    try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch {}
    return;
  }
  if (_pendingThrowTargeting) {
    const itemName = _pendingThrowTargeting.itemName;
    _pendingThrowTargeting = null;
    ev.preventDefault();
    try { messageLog.log({ text: `${bracketizeName(itemName)} throw cancelled.`, type: 'system' }); } catch {}
  }
});

// When user selects items from the pickup chooser overlay
addEventListener('ui:requestPickup', (e) => {
  if (isSimUiBlocked()) return;
  const arr = e.detail?.itemIds;
  if (!Array.isArray(arr) || !arr.length) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  for (const id of arr) {
    if (!Number.isInteger(id) || id <= 0) continue;
    // Check if the item is inside a chest inventory (no Position)
    if (!world.get(id, Position)) {
      const playerInv = world.get(pe.id, Inventory);
      if (!playerInv) continue;
      const stackIntoId = findInventoryStackTargetForItem(world, playerInv, id);
      const hasCapacity = stackIntoId || playerInv.capacity == null || playerInv.items.length < playerInv.capacity;
      if (!hasCapacity && !playerInv.items.includes(id)) continue;
      // Find and remove from the chest that holds it
      for (const [cid, , ni] of world.query(Position, NamedIdentity)) {
        if (ni.identity !== 'chest') continue;
        const cInv = world.get(cid, Inventory);
        if (!cInv) continue;
        const idx = cInv.items.indexOf(id);
        if (idx === -1) continue;
        cInv.items.splice(idx, 1);
        addItemEntityToInventory(world, playerInv, id);
        const count = world.get(id, ItemInfo)?.count || 1;
        try { world.emit?.('item:pickup', { actor: pe.id, itemId: id, count }); } catch {}
        break;
      }
    } else {
      rulesHandler({ type: 'rules.pickupItem', payload: { itemId: id } });
    }
  }
});

// Ranged shoot button / 'r' key → auto-target nearest visible enemy and fire
addEventListener('ui:shootRanged', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const eq = /** @type any */ (world.get(pe.id, Equipment));
  const rangedId = Number(eq?.ranged || 0);
  const rangedInfo = rangedId ? world.get(rangedId, ItemInfo) : null;
  if (!rangedInfo) {
    log('Nothing equipped in ranged slot.');
    return;
  }

  const isWand = rangedInfo.type === 'wand';
  const isBow = rangedInfo.subtype === 'bow';
  if (!isWand && !isBow) {
    log('Nothing equipped in ranged slot.');
    return;
  }

  let maxRange = Number(rangedInfo.range || 0);
  if (!Number.isFinite(maxRange) || maxRange <= 0) {
    const identity = String(world.get(rangedId, NamedIdentity)?.identity || '');
    const spellId = identity.startsWith('wand_') ? identity.slice(5) : '';
    const spell = spellId ? getSpell(spellId) : null;
    maxRange = Number(spell?.range || 8);
  }
  maxRange = Math.max(1, maxRange | 0);

  const px = pe.pos.x | 0, py = pe.pos.y | 0;
  const blocked = buildBlocksVisionMap(world);
  const isBlocked = blockedCallback(blocked);

  let bestId = 0, bestDist = Infinity;
  forEachInRadius(world, px, py, maxRange, (id, pos) => {
    if (id === pe.id) return;
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== 'enemy') return;
    const vit = /** @type any */ (world.get(id, Vitality));
    if (!vit || (vit.hp | 0) <= 0) return;
    const tx = pos.x | 0, ty = pos.y | 0;
    if (!hasLOS(px, py, tx, ty, isBlocked)) return;
    const dist = Math.max(Math.abs(tx - px), Math.abs(ty - py));
    if (dist < bestDist) { bestDist = dist; bestId = id; }
  });

  if (!bestId) {
    log('No target in range.');
    return;
  }

  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  if (isBow) {
    rulesHandler({ type: 'rules.rangedAttack', payload: { targetId: bestId } });
    return;
  }

  const targetPos = world.get(bestId, Position);
  const payload = { itemId: rangedId, targetId: bestId };
  if (targetPos && Number.isFinite(targetPos.x) && Number.isFinite(targetPos.y)) {
    payload.x = targetPos.x | 0;
    payload.y = targetPos.y | 0;
  }
  rulesHandler({ type: 'rules.useItem', payload });
});

// Engrave button → prompt for text, then dispatch engrave action
addEventListener('ui:engrave', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const text = prompt('Engrave what on the ground?');
  if (!text || !text.trim()) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.engrave', payload: { text: text.trim() } });
});

// Pray button → dispatch pray action
addEventListener('ui:pray', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.pray', payload: {} });
});

// Spell picker data feed and selection
addEventListener('ui:requestSpellData', () => {
  const spells = learnedSpells();
  const activeSpellId = ensureActiveSpell();
  try { window.dispatchEvent(new CustomEvent('ui:spellData', { detail: { spells, activeSpellId } })); } catch {}
});
addEventListener('ui:selectActiveSpell', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const spellId = e?.detail?.spellId;
  if (typeof spellId === 'string' && spellId.length) {
    setActiveSpell(spellId);
    // Refresh inventory so the brain-slot active marker updates
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
  }
});

// Basic app-side message log collector (bridge-free for now)
const messageLog = createMessageLog({
  maxEntries: 50,
  onUpdate: (entries) => {
    try { window.dispatchEvent(new CustomEvent('ui:updateMessageTicker', { detail: { entries } })); } catch {}
  },
});
// Message formatting and logging now handled in messageWiring module

installDeityUiWiring(world, { log: messageLog.log.bind(messageLog) });
installMessageWiring({
  world,
  messageLog,
  playerEntity,
  bracketizeName,
  getSpell
});

// Dismiss the quick-slot chip when item is used
world.on('drank', ({ itemId }) => {
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch {}
});
// Bolt segments for display VFX (world-space; display-only state)
/** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number, chainIndex:number}>} */
const _boltFx = [];
/** @type {Array<{x:number,y:number, ttl:number}>} */
const _lightPulses = [];
world.on('spell:bolt', ({ actor, targetId, spellId, from, to, chainIndex=0 }) => {
  if (from && to) {
    _boltFx.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, ttl: 0.14, max: 0.14, chainIndex: Number(chainIndex||0) });
    _lightPulses.push({ x: to.x, y: to.y, ttl: 0.12 });
    startShake(cam, 4, 0.18);
  }
});
// Meteor impact VFX (world-space; display-only state)
/** @type {Array<{x:number, y:number, radius:number, ttl:number, max:number}>} */
const _meteorFx = [];
world.on('spell:meteor', ({ actor, origin, radius }) => {
  if (origin && Number.isFinite(origin.x)) {
    _meteorFx.push({ x: origin.x, y: origin.y, radius: radius || 2, ttl: 0.45, max: 0.45 });
    startShake(cam, 7, 0.30);
    // Fire particle burst
    const N = 30;
    for (let i = 0; i < N; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.0 + Math.random() * 2.5;
      const life = 0.3 + Math.random() * 0.4;
      fx.pool.spawn({
        x: origin.x + (Math.random() - 0.5) * 0.4,
        y: origin.y + (Math.random() - 0.5) * 0.4,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        ax: 0, ay: 0.8,
        life,
        size0: 0.25 + Math.random() * 0.15,
        size1: 0.04,
        r: 255, g: 140 + Math.random() * 80 | 0, b: 30,
        a0: 0.95, a1: 0.0,
        rot: 0, rotVel: 0
      });
    }
  }
});
// Blastwave ring VFX (world-space; display-only state)
/** @type {Array<{x:number, y:number, radius:number, ttl:number, max:number}>} */
const _blastwaveFx = [];
world.on('spell:blastwave', ({ actor, origin, knockbacks, radius }) => {
  if (origin && Number.isFinite(origin.x)) {
    _blastwaveFx.push({ x: origin.x, y: origin.y, radius: radius || 2, ttl: 0.35, max: 0.35 });
    startShake(cam, 5, 0.22);
    // Radial particle burst
    const N = 24;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const spd = 2.0 + Math.random() * 1.5;
      fx.pool.spawn({
        x: origin.x, y: origin.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        ax: 0, ay: 0,
        life: 0.25 + Math.random() * 0.15,
        size0: 0.18, size1: 0.03,
        r: 200, g: 220, b: 255,
        a0: 0.8, a1: 0.0,
        rot: 0, rotVel: 0
      });
    }
  }
});
// Frost VFX (world-space; display-only state)
/** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number}>} */
const _frostBeamFx = [];
/** @type {Array<{x:number, y:number, radius:number, ttl:number, max:number}>} */
const _frostImpactFx = [];
world.on('spell:frost', ({ actor, targetId, from, at, duration, mass, fizzle }) => {
  if (fizzle) return; // no target; skip VFX
  if (!from || !at) return;
  // Icy beam from caster → target
  _frostBeamFx.push({ from: { x: from.x, y: from.y }, to: { x: at.x, y: at.y }, ttl: 0.22, max: 0.22 });
  // Impact crystallisation burst at target
  _frostImpactFx.push({ x: at.x, y: at.y, radius: 0.8, ttl: 0.55, max: 0.55 });
  // Light camera shake (cold snap)
  startShake(cam, 3, 0.14);
  // Ice shard particles radiating outward from impact
  const N = 20;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const spd = 0.6 + Math.random() * 1.8;
    const life = 0.35 + Math.random() * 0.35;
    fx.pool.spawn({
      x: at.x + (Math.random() - 0.5) * 0.3,
      y: at.y + (Math.random() - 0.5) * 0.3,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 0.4, // slight upward drift
      ax: 0, ay: 0.3, // gentle downward settle
      life,
      size0: 0.12 + Math.random() * 0.10,
      size1: 0.02,
      r: 140 + (Math.random() * 60 | 0), g: 220 + (Math.random() * 35 | 0), b: 255,
      a0: 0.9, a1: 0.0,
      rot: Math.random() * Math.PI * 2,
      rotVel: (Math.random() - 0.5) * 4
    });
  }
  // Slow-falling snowflake motes (lingering cold)
  const M = 8;
  for (let i = 0; i < M; i++) {
    fx.pool.spawn({
      x: at.x + (Math.random() - 0.5) * 1.2,
      y: at.y + (Math.random() - 0.5) * 0.6,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.2 + Math.random() * 0.3,
      ax: 0, ay: 0,
      life: 0.7 + Math.random() * 0.5,
      size0: 0.06 + Math.random() * 0.05,
      size1: 0.01,
      r: 220, g: 240, b: 255,
      a0: 0.6, a1: 0.0,
      rot: 0, rotVel: (Math.random() - 0.5) * 2
    });
  }
});
// Arrow tracer VFX (world-space; display-only state)
/** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, t:number, duration:number, dx:number, dy:number, len:number, style:string}>} */
const _arrowFx = [];
/** @type {Array<{x:number, y:number, ttl:number, style:string}>} */
const _arrowSparks = [];
/** @type {Map<number, { x:number, y:number, radius:number, turnsLeft:number, maxTurns:number, flash:number, phase:number, fading:boolean, fadeLeft:number, fadeMax:number }>} */
const _plasmaCloudFx = new Map();
/** @type {Map<number, { x:number, y:number, radius:number, turnsLeft:number, maxTurns:number, pulseFlash:number, phase:number, fading:boolean, fadeLeft:number, fadeMax:number, medium:string, bubbleClock:number }>} */
const _poisonCloudFx = new Map();
/** @type {Array<{x:number, y:number, ttl:number, max:number, r0:number, r1:number, rise:number, phase:number}>} */
const _poisonBubblePops = [];

function spawnPlasmaCloudSparks(x, y, count = 8) {
  if (!fx?.pool) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;
    fx.pool.spawn({
      x: x + (Math.random() - 0.5) * 0.35,
      y: y + (Math.random() - 0.5) * 0.35,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ax: 0,
      ay: 0,
      life: 0.22 + Math.random() * 0.18,
      size0: 0.09 + Math.random() * 0.06,
      size1: 0.02,
      r: 170 + ((Math.random() * 60) | 0),
      g: 235 + ((Math.random() * 20) | 0),
      b: 255,
      a0: 0.9,
      a1: 0.0,
      rot: 0,
      rotVel: 0,
    });
  }
}

function spawnPoisonCloudMotes(x, y, count = 8) {
  if (!fx?.pool) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.12 + Math.random() * 0.45;
    fx.pool.spawn({
      x: x + (Math.random() - 0.5) * 0.4,
      y: y + (Math.random() - 0.5) * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (0.08 + Math.random() * 0.12),
      ax: 0,
      ay: -0.03,
      life: 0.50 + Math.random() * 0.30,
      size0: 0.09 + Math.random() * 0.05,
      size1: 0.03,
      r: 120 + ((Math.random() * 50) | 0),
      g: 205 + ((Math.random() * 45) | 0),
      b: 90 + ((Math.random() * 40) | 0),
      a0: 0.52,
      a1: 0.0,
      rot: 0,
      rotVel: (Math.random() - 0.5) * 0.9,
    });
  }
}

/**
 * Choose a bubbling point within a cloud's Chebyshev footprint.
 * @param {{x:number, y:number, radius:number}} cloud
 */
function randomPoisonBubblePoint(cloud) {
  const r = Math.max(0, Number(cloud?.radius || 0) | 0);
  if (r <= 0) {
    return {
      x: cloud.x + (Math.random() - 0.5) * 0.28,
      y: cloud.y + (Math.random() - 0.5) * 0.28,
    };
  }
  const ox = (Math.random() * (r * 2 + 1) - r) + (Math.random() - 0.5) * 0.25;
  const oy = (Math.random() * (r * 2 + 1) - r) + (Math.random() - 0.5) * 0.25;
  return { x: cloud.x + ox, y: cloud.y + oy };
}

function spawnPoisonBubblePop(x, y, strength = 1) {
  const s = Math.max(1, Number(strength || 1) | 0);

  if (fx?.pool) {
    const count = 2 + s;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.1; // mostly upward
      const speed = 0.08 + Math.random() * 0.24;
      fx.pool.spawn({
        x: x + (Math.random() - 0.5) * 0.12,
        y: y + (Math.random() - 0.5) * 0.08,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed - 0.04,
        ax: 0,
        ay: -0.04,
        life: 0.18 + Math.random() * 0.20,
        size0: 0.05 + Math.random() * 0.04,
        size1: 0.01,
        r: 170 + ((Math.random() * 45) | 0),
        g: 240 + ((Math.random() * 15) | 0),
        b: 150 + ((Math.random() * 40) | 0),
        a0: 0.48,
        a1: 0.0,
        rot: 0,
        rotVel: (Math.random() - 0.5) * 0.6,
      });
    }
  }

  const pops = 1 + ((Math.random() < 0.35 * s) ? 1 : 0);
  for (let i = 0; i < pops; i++) {
    const ttl = 0.28 + Math.random() * 0.22;
    _poisonBubblePops.push({
      x: x + (Math.random() - 0.5) * 0.10,
      y: y + (Math.random() - 0.5) * 0.08,
      ttl,
      max: ttl,
      r0: 0.02 + Math.random() * 0.04,
      r1: 0.15 + Math.random() * 0.10,
      rise: 0.08 + Math.random() * 0.10,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

world.on('plasmaCloud:spawned', ({ cloudId, at, radius, turnsLeft }) => {
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
  const id = Number(cloudId || 0) | 0;
  if (!(id > 0)) return;
  const r = Math.max(0, Number(radius || 1) | 0);
  const ttl = Math.max(1, Number(turnsLeft || 1) | 0);
  _plasmaCloudFx.set(id, {
    x: at.x,
    y: at.y,
    radius: r,
    turnsLeft: ttl,
    maxTurns: ttl,
    flash: 0.24,
    phase: Math.random() * Math.PI * 2,
    fading: false,
    fadeLeft: 0,
    fadeMax: 0,
  });
  // Fill every dangerous tile with initial spark activity.
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
      spawnPlasmaCloudSparks(at.x + dx, at.y + dy, 2);
    }
  }
  startShake(cam, 2, 0.10);
});

world.on('plasmaCloud:pulse', ({ cloudId, at, radius, turnsLeft, affectedIds }) => {
  const id = Number(cloudId || 0) | 0;
  if (!(id > 0)) return;
  const r = Math.max(0, Number(radius || 1) | 0);
  const ttl = Math.max(0, Number(turnsLeft || 0) | 0);
  const prev = _plasmaCloudFx.get(id);
  const next = {
    x: (at && Number.isFinite(at.x)) ? at.x : (prev?.x ?? 0),
    y: (at && Number.isFinite(at.y)) ? at.y : (prev?.y ?? 0),
    radius: r,
    turnsLeft: ttl,
    maxTurns: Math.max(prev?.maxTurns ?? 0, ttl),
    flash: 0.26,
    phase: prev?.phase ?? (Math.random() * Math.PI * 2),
    fading: false,
    fadeLeft: 0,
    fadeMax: 0,
  };
  _plasmaCloudFx.set(id, next);

  if (Array.isArray(affectedIds)) {
    for (let i = 0; i < affectedIds.length; i++) {
      const tpos = world.get(Number(affectedIds[i] || 0), Position);
      if (!tpos) continue;
      spawnPlasmaCloudSparks(tpos.x, tpos.y, 5);
    }
  } else {
    // Fallback: keep it visually loud even if the payload omits affected ids.
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
        if (Math.random() < 0.35) spawnPlasmaCloudSparks(next.x + dx, next.y + dy, 2);
      }
    }
  }
  startShake(cam, 2, 0.08);
});

world.on('plasmaCloud:expired', ({ cloudId, at, radius }) => {
  const id = Number(cloudId || 0) | 0;
  if (!(id > 0)) return;
  const cloud = _plasmaCloudFx.get(id);
  if (!cloud) return;
  if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) {
    cloud.x = at.x;
    cloud.y = at.y;
  }
  if (Number.isFinite(radius)) cloud.radius = Math.max(0, Number(radius) | 0);
  cloud.fading = true;
  cloud.fadeMax = 0.45;
  cloud.fadeLeft = cloud.fadeMax;
  cloud.flash = Math.max(cloud.flash, 0.16);
});

world.on('hazard:spawned', ({ hazardId, kind, at, radius, turnsLeft, medium }) => {
  if (String(kind || '').toLowerCase() !== 'poison') return;
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
  const id = Number(hazardId || 0) | 0;
  if (!(id > 0)) return;
  const r = Math.max(0, Number(radius || 1) | 0);
  const ttl = Math.max(1, Number(turnsLeft || 1) | 0);
  _poisonCloudFx.set(id, {
    x: at.x,
    y: at.y,
    radius: r,
    turnsLeft: ttl,
    maxTurns: ttl,
    pulseFlash: 0.20,
    phase: Math.random() * Math.PI * 2,
    fading: false,
    fadeLeft: 0,
    fadeMax: 0,
    medium: String(medium || 'air').toLowerCase() === 'floor' ? 'floor' : 'air',
    bubbleClock: 0.08 + Math.random() * 0.16,
  });
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
      if (Math.random() < 0.85) spawnPoisonCloudMotes(at.x + dx, at.y + dy, 2);
    }
  }
  const seedCloud = { x: at.x, y: at.y, radius: r };
  const popBursts = Math.max(2, 1 + r);
  for (let i = 0; i < popBursts; i++) {
    const p = randomPoisonBubblePoint(seedCloud);
    spawnPoisonBubblePop(p.x, p.y, Math.random() < 0.28 ? 2 : 1);
  }
});

world.on('hazard:pulse', ({ hazardId, kind, at, radius, turnsLeft, affectedIds, medium }) => {
  if (String(kind || '').toLowerCase() !== 'poison') return;
  const id = Number(hazardId || 0) | 0;
  if (!(id > 0)) return;
  const r = Math.max(0, Number(radius || 1) | 0);
  const ttl = Math.max(0, Number(turnsLeft || 0) | 0);
  const prev = _poisonCloudFx.get(id);
  const next = {
    x: (at && Number.isFinite(at.x)) ? at.x : (prev?.x ?? 0),
    y: (at && Number.isFinite(at.y)) ? at.y : (prev?.y ?? 0),
    radius: r,
    turnsLeft: ttl,
    maxTurns: Math.max(prev?.maxTurns ?? 0, ttl),
    pulseFlash: 0.24,
    phase: prev?.phase ?? (Math.random() * Math.PI * 2),
    fading: false,
    fadeLeft: 0,
    fadeMax: 0,
    medium: String(medium || prev?.medium || 'air').toLowerCase() === 'floor' ? 'floor' : 'air',
    bubbleClock: Number.isFinite(prev?.bubbleClock)
      ? Math.max(0.04, Number(prev?.bubbleClock || 0))
      : (0.08 + Math.random() * 0.14),
  };
  _poisonCloudFx.set(id, next);

  if (Array.isArray(affectedIds)) {
    for (let i = 0; i < affectedIds.length; i++) {
      const tpos = world.get(Number(affectedIds[i] || 0), Position);
      if (!tpos) continue;
      spawnPoisonCloudMotes(tpos.x, tpos.y, 4);
      if (Math.random() < 0.72) {
        spawnPoisonBubblePop(
          tpos.x + (Math.random() - 0.5) * 0.18,
          tpos.y + (Math.random() - 0.5) * 0.12,
          Math.random() < 0.22 ? 2 : 1,
        );
      }
    }
  } else {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
        if (Math.random() < 0.28) spawnPoisonCloudMotes(next.x + dx, next.y + dy, 2);
      }
    }
    const popBursts = Math.max(1, r);
    for (let i = 0; i < popBursts; i++) {
      const p = randomPoisonBubblePoint(next);
      spawnPoisonBubblePop(p.x, p.y, 1);
    }
  }
});

world.on('hazard:expired', ({ hazardId, kind, at, radius }) => {
  if (String(kind || '').toLowerCase() !== 'poison') return;
  const id = Number(hazardId || 0) | 0;
  if (!(id > 0)) return;
  const cloud = _poisonCloudFx.get(id);
  if (!cloud) return;
  if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) {
    cloud.x = at.x;
    cloud.y = at.y;
  }
  if (Number.isFinite(radius)) cloud.radius = Math.max(0, Number(radius) | 0);
  cloud.fading = true;
  cloud.fadeMax = 0.55;
  cloud.fadeLeft = cloud.fadeMax;
  cloud.pulseFlash = Math.max(cloud.pulseFlash, 0.12);
  const popBursts = Math.max(1, 1 + (cloud.radius | 0));
  for (let i = 0; i < popBursts; i++) {
    const p = randomPoisonBubblePoint(cloud);
    spawnPoisonBubblePop(p.x, p.y, 1);
  }
});

function computeThrowFxDuration(distance) {
  const d = Number.isFinite(distance) ? Math.max(0, Number(distance)) : 0;
  if (d <= 0) return THROW_FX_MIN_DURATION;
  const raw = d / THROW_FX_SPEED_TILES_PER_SEC;
  return Math.max(THROW_FX_MIN_DURATION, Math.min(THROW_FX_MAX_DURATION, raw));
}

world.on('item:thrown', ({ itemId, from, to }) => {
  const id = Number(itemId || 0) | 0;
  if (!(id > 0)) return;
  if (!from || !to) return;
  const fx0 = Number(from.x);
  const fy0 = Number(from.y);
  const fx1 = Number(to.x);
  const fy1 = Number(to.y);
  if (!Number.isFinite(fx0) || !Number.isFinite(fy0) || !Number.isFinite(fx1) || !Number.isFinite(fy1)) return;
  const dx = fx1 - fx0;
  const dy = fy1 - fy0;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0)) return;

  for (let i = _thrownItemFx.length - 1; i >= 0; i--) {
    if ((_thrownItemFx[i].itemId | 0) !== id) continue;
    _thrownItemFx.splice(i, 1);
  }

  _hiddenThrownItemIds.add(id);
  _thrownItemFx.push({
    itemId: id,
    from: { x: fx0, y: fy0 },
    to: { x: fx1, y: fy1 },
    t: 0,
    duration: computeThrowFxDuration(dist),
    kind: "",
  });
  syncSimInputLockFlag();
});

world.on('ranged:shot', ({ attacker, target, hit, style }) => {
  const apos = world.get(Number(attacker||0), Position);
  const dpos = world.get(Number(target||0), Position);
  if (!apos || !dpos) return;
  const dx = dpos.x - apos.x, dy = dpos.y - apos.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 18; // tiles per second
  const duration = Math.max(0.06, Math.min(0.4, len / speed));
  const s = String(style || 'plain');
  _arrowFx.push({
    from: { x: apos.x, y: apos.y }, to: { x: dpos.x, y: dpos.y },
    t: 0, duration, dx: dx / len, dy: dy / len, len, style: s
  });
  startShake(cam, s === 'fire' ? 3 : 2, s === 'fire' ? 0.10 : 0.08);
  // Fire arrow: spawn trailing embers
  if (s === 'fire' && fx?.pool) {
    for (let i = 0; i < 4; i++) {
      fx.pool.spawn({
        x: apos.x + dx / len * 0.5, y: apos.y + dy / len * 0.5,
        vx: (dx / len) * 3 + (Math.random() - 0.5) * 1.5,
        vy: (dy / len) * 3 + (Math.random() - 0.5) * 1.5,
        ax: 0, ay: 0.4, life: 0.25 + Math.random() * 0.15,
        size0: 0.12 + Math.random() * 0.08, size1: 0.02,
        r: 255, g: 160 + Math.random() * 60 | 0, b: 30,
        a0: 0.9, a1: 0, rot: 0, rotVel: 0
      });
    }
  }
});
// Proc VFX: vampiric life-steal
world.on('proc:vampiric', ({ actor, target, amount }) => {
  const apos = world.get(Number(actor || 0), Position);
  const tpos = world.get(Number(target || 0), Position);
  if (!apos) return;
  ftext.addStatus(apos.x, apos.y - 0.3, 'LIFESTEAL', { color: '#ff4040', life: 0.6 });
  if (tpos) {
    const dx = apos.x - tpos.x, dy = apos.y - tpos.y;
    const dist = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 6; i++) {
      const spd = 1.5 + Math.random() * 1.0;
      fx.pool.spawn({
        x: tpos.x + (Math.random() - 0.5) * 0.3,
        y: tpos.y + (Math.random() - 0.5) * 0.3,
        vx: (dx / dist) * spd + (Math.random() - 0.5) * 0.5,
        vy: (dy / dist) * spd + (Math.random() - 0.5) * 0.5,
        ax: 0, ay: 0,
        life: 0.35 + Math.random() * 0.15,
        size0: 0.15, size1: 0.04,
        r: 200, g: 50, b: 50,
        a0: 0.85, a1: 0.0,
        rot: 0, rotVel: 0
      });
    }
  }
});
// Proc VFX: thorns retaliation
world.on('proc:thorns', ({ actor, target }) => {
  const tpos = world.get(Number(target || 0), Position);
  if (!tpos) return;
  ftext.addStatus(tpos.x, tpos.y - 0.3, 'THORNS', { color: '#78ff78', life: 0.6 });
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 0.8 + Math.random() * 0.6;
    fx.pool.spawn({
      x: tpos.x, y: tpos.y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      ax: 0, ay: 0,
      life: 0.2 + Math.random() * 0.15,
      size0: 0.12, size1: 0.03,
      r: 120, g: 255, b: 120,
      a0: 0.9, a1: 0.0,
      rot: 0, rotVel: 0
    });
  }
});
// Proc VFX: burning applied (one-shot ignite burst)
world.on('proc:burning', ({ actor, target }) => {
  const tpos = world.get(Number(target || 0), Position);
  if (!tpos) return;
  ftext.addStatus(tpos.x, tpos.y - 0.3, 'BURNING', { color: '#ff6600', life: 0.6 });
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
    const spd = 0.6 + Math.random() * 0.8;
    fx.pool.spawn({
      x: tpos.x + (Math.random() - 0.5) * 0.2,
      y: tpos.y + (Math.random() - 0.5) * 0.2,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      ax: 0, ay: -0.4,
      life: 0.3 + Math.random() * 0.2,
      size0: 0.18, size1: 0.04,
      r: 255, g: 140 + (Math.random() * 60) | 0, b: 20,
      a0: 0.9, a1: 0.0,
      rot: 0, rotVel: 0
    });
  }
});
// Proc VFX: fierce bonus damage
world.on('proc:fierce', ({ actor, target }) => {
  const tpos = world.get(Number(target || 0), Position);
  if (!tpos) return;
  ftext.addStatus(tpos.x, tpos.y + 0.3, '+1', { color: '#ffa040', life: 0.4 });
});
// Spell and attack error messages now handled in messageWiring
// Heal floating text (message handled in messageWiring)
world.on('healed', ({ id, amount }) => {
  const pos = world.get(Number(id||0), Position);
  if (pos && Number.isFinite(amount)) {
    try { ftext.addHeal(pos.x, pos.y, amount, { color: '#7BFF7B' }); } catch {}
  }
});
// Pet death UI notification (message handled in messageWiring)
world.on('died', ({ id }) => {
  if (world.has(id, Pet)) {
    try {
      window.dispatchEvent(new CustomEvent('ui:petExists', {
        detail: { exists: false }
      }));
    } catch {}
  }
});
// Floating text hooks: damage (messages handled in messageWiring)
world.on('damaged', ({ target, amount, critical, crit, at }) => {
  const t = Number(target||0) || 0;
  const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : /** @type any */ (world.get(t, Position));
  const pe = playerEntity(world);
  const isPlayer = !!pe && pe.id === t;
  if (pos && Number.isFinite(amount)) {
    const col = isPlayer ? '#ff6060' : '#ffd966';
    ftext.addDamage(pos.x, pos.y, amount, { dmg: amount, color: col, crit: !!(critical || crit) });
  }
});
// Status floating text (messages handled in messageWiring)
world.on('status', ({ id, kind, at, text }) => {
  const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : world.get(Number(id||0), Position);
  if (!pos) return;
  const style = (String(kind||'')).toLowerCase() === 'miss' ? 'miss' : ((String(kind||'')).toLowerCase() === 'immune' ? 'immune' : 'status');
  const label = String(text || kind || '').toUpperCase() || (style === 'miss' ? 'MISS' : (style === 'immune' ? 'IMMUNE' : 'STATUS'));
  try { ftext.addStatus(pos.x, pos.y, label, { style }); } catch {}
});
// Ranged combat floating text (messages handled in messageWiring)
world.on('ranged:no-ammo', ({ attacker }) => {
  const pos = world.get(Number(attacker||0), Position);
  if (pos) try { ftext.addStatus(pos.x, pos.y, 'NO AMMO', { style: 'status' }); } catch {}
});
// Insufficient stamina floating flavor text (message handled in messageWiring)
const _staminaLines = [
  'Too exhausted!',
  'Your arms feel heavy...',
  'You can barely lift your weapon!',
  'You gasp for breath...',
  'Your muscles refuse!',
  'Not enough strength...',
  'You stagger with fatigue!',
  'Your body protests!',
];
world.on('attack:insufficient-stamina', ({ attacker }) => {
  const pos = world.get(Number(attacker || 0), Position);
  if (pos) {
    const line = _staminaLines[Math.floor(Math.random() * _staminaLines.length)];
    try { ftext.addStatus(pos.x, pos.y - 0.3, line, { color: '#ff8c00', life: 1.0 }); } catch {}
  }
});
world.on('item:pickup', ({ actor, itemId, count }) => {
  const info = world.get(itemId, ItemInfo);
  if (!info || info.type !== 'currency') return;
  const pos = world.get(actor, Position);
  if (!pos) return;
  const n = Number.isFinite(count) ? Number(count) : Number(info.count||1);
  if (n > 0) {
    ftext.addGold(pos.x, pos.y, n, { color: '#ffcd45' });
  }
});
// Dispatch quick-slot notification for non-currency pickups
world.on('item:pickup', ({ actor, itemId }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  const info = world.get(itemId, ItemInfo);
  if (!info || info.type === 'currency') return;
  try {
    window.dispatchEvent(new CustomEvent('ui:recentPickup', {
      detail: {
        item: {
          id: Number(itemId),
          type: info.type || 'item',
          slot: info.slot || '',
          name: resolveItemDisplayName(world, itemId),
          count: info.count || 1
        }
      }
    }));
  } catch {}
});
// Pet deliver UI refresh (message handled in messageWiring)
world.on('pet:deliver', ({ petId, actor, itemId, itemName, count }) => {
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});

// Pet state UI updates (messages handled in messageWiring)
world.on('pet:state:changed', ({ newState }) => {
  try {
    window.dispatchEvent(new CustomEvent('ui:updatePetButton', {
      detail: { state: newState }
    }));
  } catch {}
});

world.on('pet:state:auto', ({ newState }) => {
  try {
    window.dispatchEvent(new CustomEvent('ui:updatePetButton', {
      detail: { state: newState }
    }));
  } catch {}
});

// Handle UI pet commands (instant, no tick consumed)
window.addEventListener('ui:petCommand', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const command = e?.detail?.command;
  if (!command) return;

  // Find pet and directly update state (instant, no tick needed)
  for (const [petId, _pet, vit] of world.query(Pet, Vitality)) {
    if (!vit || vit.hp <= 0) continue;
    const petPos = world.get(petId, Position);
    if (!petPos) break;

    // Get or create PetState
    let petState = world.get(petId, PetState);
    if (!petState) {
      const pe = playerEntity(world);
      const playerPos = pe ? world.get(pe.id, Position) : null;
      world.add(petId, PetState, {
        state: 'following',
        targetX: null,
        targetY: null,
        targetItemId: 0,
        stateEnteredTurn: world.step,
        lastPlayerX: playerPos?.x ?? null,
        lastPlayerY: playerPos?.y ?? null,
        commandCooldown: 0,
      });
      petState = world.get(petId, PetState);
    }

    const prevState = petState.state;

    // Update state directly based on command
    switch (command) {
      case 'follow':
        petState.state = 'following';
        petState.targetX = null;
        petState.targetY = null;
        petState.targetItemId = 0;
        break;

      case 'stay':
        petState.state = 'staying';
        petState.targetX = petPos.x;
        petState.targetY = petPos.y;
        petState.targetItemId = 0;
        break;

      case 'guard':
        petState.state = 'guarding';
        petState.targetX = petPos.x;
        petState.targetY = petPos.y;
        petState.targetItemId = 0;
        break;

      case 'idle':
        petState.state = 'idle';
        petState.targetX = null;
        petState.targetY = null;
        petState.targetItemId = 0;
        break;

      case 'fetch':
        // TODO: Need item selection for fetch
        break;
    }

    // Update state metadata and emit event
    if (prevState !== petState.state) {
      petState.stateEnteredTurn = world.step;
      petState.commandCooldown = 0;
      try {
        world.emit?.('pet:state:changed', {
          petId,
          prevState,
          newState: petState.state,
          command
        });
      } catch {}
    }

    break; // Only one pet for now
  }
});

// Rotate pet state through common commands (instant, no tick)
window.addEventListener('ui:rotatePetState', () => {
  // State rotation cycle: following → staying → guarding → idle → following
  const stateOrder = ['following', 'staying', 'guarding', 'idle'];

  for (const [petId, _pet, vit] of world.query(Pet, Vitality)) {
    if (!vit || vit.hp <= 0) continue;
    const petPos = world.get(petId, Position);
    if (!petPos) break;

    // Get or create PetState
    let petState = world.get(petId, PetState);
    if (!petState) {
      const pe = playerEntity(world);
      const playerPos = pe ? world.get(pe.id, Position) : null;
      world.add(petId, PetState, {
        state: 'following',
        targetX: null,
        targetY: null,
        targetItemId: 0,
        stateEnteredTurn: world.step,
        lastPlayerX: playerPos?.x ?? null,
        lastPlayerY: playerPos?.y ?? null,
        commandCooldown: 0,
      });
      petState = world.get(petId, PetState);
    }

    const currentState = petState.state;

    // Find next state in rotation (skip automatic states like fetching, returning, fleeing)
    let nextState = 'following';
    const currentIndex = stateOrder.indexOf(currentState);
    if (currentIndex >= 0) {
      nextState = stateOrder[(currentIndex + 1) % stateOrder.length];
    } else {
      // If in an automatic state, go to following
      nextState = 'following';
    }

    const prevState = petState.state;

    // Directly update state based on next state
    petState.state = nextState;

    if (nextState === 'staying' || nextState === 'guarding') {
      petState.targetX = petPos.x;
      petState.targetY = petPos.y;
      petState.targetItemId = 0;
    } else {
      petState.targetX = null;
      petState.targetY = null;
      petState.targetItemId = 0;
    }

    // Update state metadata and emit event
    if (prevState !== petState.state) {
      petState.stateEnteredTurn = world.step;
      petState.commandCooldown = 0;
      const command = nextState === 'staying' ? 'stay' :
                     nextState === 'guarding' ? 'guard' :
                     nextState === 'idle' ? 'idle' : 'follow';
      try {
        world.emit?.('pet:state:changed', {
          petId,
          prevState,
          newState: petState.state,
          command
        });
      } catch {}
    }

    break; // Only one pet for now
  }
});

// Engrave floating text (messages handled in messageWiring)
world.on('engrave', ({ text, x, y }) => {
  try { ftext.addStatus(x, y - 0.3, `"${text}"`, { color: '#8899aa', life: 1.2 }); } catch {}
});

// Refresh inventory UI when any item is used (consumed/learned/etc.)
world.on('item:used', ({ actor, itemId }) => {
  // Dismiss the quick-slot chip for this item
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch {}
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});
// Spell learning logic (messages handled in messageWiring)
world.on('spell:learned', ({ spellId }) => {
  // Set active spell if none selected
  if (!_activeSpellId) {
    setActiveSpell(String(spellId));
  }
  const learnedId = String(spellId || '');
  if (learnedId === 'lightning' || learnedId === 'meteor' || learnedId === 'blastwave') {
    try {
      window.dispatchEvent(new CustomEvent('ui:showSpellGestureHint', {
        detail: { id: learnedId, mode: 'learn', quality: 1 },
      }));
    } catch {}
  }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});
// Interaction UI logic (messages handled in messageWiring)
world.on('interaction', ({ action, items: droppedIds }) => {
  if (action === 'openChest') {
    // Auto-pickup currency drops silently
    const nonCurrency = [];
    if (Array.isArray(droppedIds)) {
      for (const eid of droppedIds) {
        const info = world.get(eid, ItemInfo);
        if (!info) continue;
        if (info.type === 'currency') {
          const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
          rulesHandler({ type: 'rules.pickupItem', payload: { itemId: eid } });
        } else {
          nonCurrency.push({
            id: eid,
            type: info.type || 'item',
            name: resolveItemDisplayName(world, eid),
            count: info.count || 1,
            rarityName: info.rarityName || 'common',
            bonuses: info.bonuses || {},
            affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
          });
        }
      }
    }
    if (nonCurrency.length === 1) {
      const it = nonCurrency[0];
      try {
        window.dispatchEvent(new CustomEvent('ui:showGroundItem', {
          detail: { mode: 'single', item: it, pickupRange: 2 }
        }));
      } catch {}
    } else if (nonCurrency.length > 1) {
      try {
        window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items: nonCurrency } }));
      } catch {}
    }
  }
});

// Harvest updates: refresh inventory UI after gather actions.
// Deferred so the tick's command queue (component adds) flushes first.
world.on('harvest:picked', ({ actor, count, kind }) => {
  setTimeout(() => {
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
    try { window.dispatchEvent(new CustomEvent('ui:requestUsableItemsData')); } catch {}
  }, 0);
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  const label = String(kind || '') === 'herbs' ? 'herb' : 'berry';
  try { ftext.addStatus(pe.pos.x, pe.pos.y - 0.3, `+${Math.max(1, Number(count || 1) | 0)} ${label}`, { color: '#b6e38d', life: 1.0 }); } catch {}
});

// Stair traversal logic (messages handled in messageWiring)
const RETURN_PORTAL_IDENTITY = 'return_portal';

/** @type {{
 *   direction?: 'up' | 'down',
 *   targetDepth?: number,
 *   targetPos?: { x: number, y: number },
 *   fragActorsAtTarget?: boolean,
 *   returnTicket?: { depth: number, x: number, y: number } | null,
 * } | null} */
let _pendingStairTransition = null;

function queueStairTransition(direction) {
  const dir = direction === 'up' ? 'up' : (direction === 'down' ? 'down' : null);
  if (!dir) return;
  // Keep transitions at the app loop boundary so we never mutate floors mid-tick.
  if (_pendingStairTransition) return;
  _pendingStairTransition = { direction: dir };
}

function queueDepthTransition(targetDepth, opts = {}) {
  const depth = Number(targetDepth);
  if (!Number.isFinite(depth)) return;
  // Keep transitions at the app loop boundary so we never mutate floors mid-tick.
  if (_pendingStairTransition) return;
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
  _pendingStairTransition = {
    targetDepth: Math.max(0, Math.floor(depth)),
    targetPos,
    fragActorsAtTarget: opts?.fragActorsAtTarget === true,
    returnTicket,
  };
}

function trackCurrentFloorEntity(entityId) {
  const eid = Number(entityId) | 0;
  if (!(eid > 0)) return;
  for (const [id, ds] of world.query(DungeonState)) {
    if (!Array.isArray(ds.floorEntityIds)) ds.floorEntityIds = [];
    if (!ds.floorEntityIds.includes(eid)) ds.floorEntityIds.push(eid);
    try { world.set(id, DungeonState, ds); } catch {}
    break;
  }
}

function untrackCurrentFloorEntity(entityId) {
  const eid = Number(entityId) | 0;
  if (!(eid > 0)) return;
  for (const [id, ds] of world.query(DungeonState)) {
    if (!Array.isArray(ds.floorEntityIds)) break;
    const next = ds.floorEntityIds.filter((v) => (Number(v) | 0) !== eid);
    ds.floorEntityIds = next;
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
    untrackCurrentFloorEntity(id);
  }
}

function spawnReturnPortal(ticket) {
  const pe = playerEntity(world);
  if (!pe) return 0;
  destroyReturnPortals();

  /** @type {{ x:number, y:number }|null} */
  let bedPos = null;
  /** @type {{ x:number, y:number }|null} */
  let chestPos = null;
  for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni?.identity === 'bed_home') {
      bedPos = { x: pos.x | 0, y: pos.y | 0 };
      continue;
    }
    if (ni?.identity === 'chest') {
      chestPos = { x: pos.x | 0, y: pos.y | 0 };
    }
  }

  const portalPos = (bedPos && chestPos)
    ? {
      x: Math.floor((bedPos.x + chestPos.x) / 2),
      y: Math.floor((bedPos.y + chestPos.y) / 2),
    }
    : { x: pe.pos.x, y: pe.pos.y };

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
  trackCurrentFloorEntity(portalId);
  try {
    world.emit?.('portal:spawned', {
      portalId,
      at: { x: portalPos.x, y: portalPos.y },
      targetDepth: Math.max(0, Math.floor(Number(ticket?.depth || 0))),
      target: { x: Math.floor(Number(ticket?.x || 0)), y: Math.floor(Number(ticket?.y || 0)) },
    });
  } catch {}
  return portalId;
}

function fragActorsAt(worldRef, x, y, excludeId = 0) {
  const tx = Math.floor(Number(x));
  const ty = Math.floor(Number(y));
  let count = 0;
  for (const [id, pos, _vit] of worldRef.query(Position, Vitality)) {
    if (id === excludeId) continue;
    if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
    try { worldRef.destroy(id); } catch {}
    untrackCurrentFloorEntity(id);
    count++;
  }
  if (count > 0) {
    try { worldRef.emit?.('portal:return:fragged', { count, at: { x: tx, y: ty } }); } catch {}
  }
  return count;
}

function flushPendingStairTransition() {
  const pending = _pendingStairTransition;
  if (!pending) return;
  _pendingStairTransition = null;

  let currentDepth = 1;
  for (const [, state] of world.query(DungeonState)) {
    currentDepth = state.currentDepth;
    break;
  }

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
    transitionToDepth(
      world,
      newDepth,
      { x: pending.targetPos.x | 0, y: pending.targetPos.y | 0 },
      { tombstoneRepo },
    );
    if (pending.fragActorsAtTarget) {
      const pe = playerEntity(world);
      const playerId = pe?.id || 0;
      fragActorsAt(world, pending.targetPos.x, pending.targetPos.y, playerId);
      if (playerId > 0) {
        world.set(playerId, Position, { x: pending.targetPos.x | 0, y: pending.targetPos.y | 0 });
      }
    }
  } else {
    const direction = newDepth > currentDepth ? 'down' : 'up';
    transitionToDepth(world, newDepth, { x: 0, y: 0 }, { direction, tombstoneRepo });
  }

  if (newDepth === 0 && pending.returnTicket && pending.returnTicket.depth > 0) {
    spawnReturnPortal(pending.returnTicket);
  }

  // Invalidate cached world view
  _cachedView = null;
  _cachedStep = -1;
}

world.on('stair:traverse', ({ direction }) => {
  queueStairTransition(direction);
});

world.on('dungeon:teleport-depth', ({ targetDepth, source, returnTicket }) => {
  queueDepthTransition(targetDepth, {
    returnTicket: String(source || '') === 'scroll_homecoming' ? returnTicket : null,
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
  untrackCurrentFloorEntity(pid);
  queueDepthTransition(targetDepth, {
    targetPos: { x: targetX, y: targetY },
    fragActorsAtTarget: true,
  });
});

// UI stair tooltip tap → trigger stair traverse
addEventListener('ui:requestStairTraverse', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const stairId = e?.detail?.stairId;
  const direction = e?.detail?.direction || 'down';
  const pe = playerEntity(world);
  if (!pe) return;

  if (direction === 'return') {
    world.emit?.('portal:return', {
      actor: pe.id,
      targetId: stairId,
      portalId: stairId,
    });
  } else {
    world.emit?.('stair:traverse', {
      actor: pe.id,
      targetId: stairId,
      direction
    });
  }
});

const shopWiring = installShopWiring({ world, playerEntity, log: (msg) => messageLog.log({ text: msg, type: 'system' }), bracketizeName });
installChestWiring({ world, playerEntity, log: (msg) => messageLog.log({ text: msg, type: 'system' }), bracketizeName });
installDigWiring({ world });
installSavegameWiring({
  world,
  playerEntity,
  getActiveSpellId: () => _activeSpellId,
  log: (msg) => messageLog.log({ text: msg, type: 'system' }),
});
bootAdvance("Installed world/UI wiring");

// Item equipped UI updates (message handled in messageWiring)
world.on('item:equipped', ({ itemId }) => {
  try { window.dispatchEvent(new CustomEvent('ui:itemEquipped', { detail: { itemId } })); } catch {}
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});

// When player moves, show a mobile-friendly ground item tooltip for non-currency items on the tile
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  const ids = itemsAt(world, to.x, to.y);
  // Also include items from chests at this tile
  let hasChest = false;
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'chest' || pos.x !== to.x || pos.y !== to.y) continue;
    hasChest = true;
    const inv = world.get(eid, Inventory);
    if (inv) for (const itemId of inv.items) ids.push(itemId);
  }
  // Filter out currency; we want deliberate pickup for non-gold
  const nonCurrency = ids.filter((eid) => {
    const info = world.get(eid, ItemInfo);
    return info && info.type !== 'currency';
  });
  if (!nonCurrency.length) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch {}
    return;
  }
  // Chest items always use the chooser with "Open Chest" label
  if (hasChest || nonCurrency.length > 1) {
    const items = nonCurrency.map((eid) => {
      const info = world.get(eid, ItemInfo);
      return { id: eid, type: info?.type || 'item', name: resolveItemDisplayName(world, eid), count: info?.count || 1 };
    });
    try {
      window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail: { mode: 'multi', count: items.length, items, fromChest: hasChest } }));
    } catch {}
    return;
  }
  // Single item: build tooltip content
  const itemId = nonCurrency[0];
  const info = world.get(itemId, ItemInfo);
  const set = world.get(pe.id, Settings);
  const pickupRange = Math.max(0, Number(set?.pickupRange ?? 0));
  const affixes = Array.isArray(info?.affixes) ? info.affixes.slice() : [];
  const bonuses = info?.bonuses && typeof info.bonuses === 'object' ? { ...info.bonuses } : {};
  const payload = {
    mode: 'single',
    item: {
      id: itemId,
      name: resolveItemDisplayName(world, itemId),
      rarityName: info?.rarityName || 'common',
      description: info?.description || '',
      count: info?.count || 1,
      bonuses,
      affixes
    },
    pickupRange
  };
  try { window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail: payload })); } catch {}
});

// When player moves, show stair tooltip if near stairs
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  shopWiring.handlePlayerMoved();

  // Find traversable targets (stairs or return portal) within Chebyshev distance 1
  const nearestTarget = findNearestTraversalTarget(world, to.x, to.y);

  if (nearestTarget) {
    const direction = nearestTarget.identity === 'stair_down'
      ? 'down'
      : (nearestTarget.identity === 'stair_up' ? 'up' : 'return');
    try {
      window.dispatchEvent(new CustomEvent('ui:showStairTooltip', {
        detail: { stairId: nearestTarget.id, direction }
      }));
    } catch {}
  } else {
    try { window.dispatchEvent(new CustomEvent('ui:hideStairTooltip')); } catch {}
  }

  // Check for adjacent shopkeeper
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'shopkeeper') continue;
    const dist = Math.max(Math.abs(pos.x - to.x), Math.abs(pos.y - to.y));
    if (dist === 1) {
      log('A shopkeeper is nearby. Bump to trade.');
      break;
    }
  }

  // Tombstone tooltip: show epitaph when standing on a tombstone
  let tombstone = null;
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'tombstone') continue;
    if (pos.x === to.x && pos.y === to.y) {
      tombstone = { id: eid };
      break;
    }
  }
  if (tombstone) {
    const tc = world.get(tombstone.id, TombstoneComponent);
    try {
      window.dispatchEvent(new CustomEvent('ui:showTombstoneTooltip', {
        detail: { epitaph: tc?.epitaph || '' }
      }));
    } catch {}
  } else {
    try { window.dispatchEvent(new CustomEvent('ui:hideTombstoneTooltip')); } catch {}
  }
});

// When player moves onto a tile with an engraving, show it in the log
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  for (const [eid, eng, pos] of world.query(Engraving, Position)) {
    if (pos.x === to.x && pos.y === to.y) {
      log(`You see "${eng.text}" engraved on the ground here.`);
      break;
    }
  }
});

// Hide ground tooltip after pickups to avoid stale UI
world.on('item:pickup', ({ actor, itemId }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch {}
});

/** @param {string} s */
function bracketizeName(s) {
  const str = String(s ?? '');
  if (str.startsWith('[') && str.endsWith(']')) return str;
  return `[${str}]`;
}

// When user clicks an inventory item to drink
addEventListener('ui:requestDrink', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const itemId = e?.detail?.itemId;
  if (!Number.isInteger(itemId)) return;
  const action = { type: 'rules.drinkPotion', payload: { itemId } };
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler(action);
});

// When user clicks an inventory item to equip
addEventListener('ui:requestEquip', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const itemId = e?.detail?.itemId;
  if (!Number.isInteger(itemId)) return;
  const action = { type: 'rules.equipItem', payload: { itemId } };
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler(action);
});

// When user clicks an inventory item to use (e.g., read a spellbook)
addEventListener('ui:requestUse', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const itemId = e?.detail?.itemId;
  if (!Number.isInteger(itemId)) return;
  const action = { type: 'rules.useItem', payload: { itemId } };
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler(action);
});

// When user throws an inventory item
addEventListener('ui:requestThrow', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const itemId = Number(e?.detail?.itemId || 0);
  if (!Number.isInteger(itemId) || itemId <= 0) return;

  const targetId = Number(e?.detail?.targetId || 0);
  const x = Number(e?.detail?.x);
  const y = Number(e?.detail?.y);
  const hasTileTarget = Number.isFinite(x) && Number.isFinite(y);

  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  if (hasTileTarget || (Number.isInteger(targetId) && targetId > 0)) {
    _pendingThrowTargeting = null;
    const payload = { itemId };
    if (Number.isInteger(targetId) && targetId > 0) payload.targetId = targetId;
    if (hasTileTarget) {
      payload.x = Math.floor(x);
      payload.y = Math.floor(y);
    }
    rulesHandler({ type: 'rules.throwItem', payload });
    return;
  }

  const pe = playerEntity(world);
  if (!pe) return;
  const inv = world.get(pe.id, Inventory);
  if (!inv || !Array.isArray(inv.items) || !inv.items.includes(itemId)) {
    try { messageLog.log({ text: 'You are not carrying that item.', type: 'system' }); } catch {}
    return;
  }

  const itemName = resolveItemDisplayName(world, itemId) || 'item';
  const info = world.get(itemId, ItemInfo);
  const range = computeThrowRange(Number(info?.weight));
  _pendingSpellTargeting = null;
  _pendingThrowTargeting = { actorId: pe.id, itemId, itemName, range };
  try {
    messageLog.log({
      text: `Throw ${bracketizeName(itemName)} where? Tap/click a tile (up to ${range}). Press Esc to cancel.`,
      type: 'system',
    });
  } catch {}
});

// When user requests dropping an inventory item
addEventListener('ui:requestDrop', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const itemId = e?.detail?.itemId;
  const count = e?.detail?.count;
  if (!Number.isInteger(itemId)) return;
  const payload = { itemId };
  if (Number.isFinite(count) && count > 0) payload.count = count;
  const action = { type: 'rules.dropItem', payload };
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler(action);
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});

// ---- Display camera (resource) ---------------------------------------------
const cam = createCamera(); // { x,y, scale, target*, shake* }
cam.scale = TILE_PX;
cam.targetScale = TILE_PX;
if (PERF.cameraLerp !== null && Number.isFinite(PERF.cameraLerp)) cam.lerpSpeed = Math.max(0, PERF.cameraLerp);

// Tile-targeted spell casts and throws capture the next tap on the stage.
canvas.addEventListener('pointerdown', (ev) => {
  const pendingSpell = _pendingSpellTargeting;
  const pendingThrow = _pendingThrowTargeting;
  if (!pendingSpell?.spellId && !pendingThrow?.itemId) return;

  const pe = playerEntity(world);
  if (!pe) {
    _pendingSpellTargeting = null;
    _pendingThrowTargeting = null;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
  const sy = (ev.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
  const [wx, wy] = cameraScreenToWorld(cam, sx, sy, canvas);
  const tx = Math.floor(wx);
  const ty = Math.floor(wy);

  ev.preventDefault();
  ev.stopPropagation();
  if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();

  if (pendingSpell?.spellId) {
    const px = pe.pos.x | 0;
    const py = pe.pos.y | 0;
    const dist = Math.max(Math.abs(tx - px), Math.abs(ty - py));
    if (!(dist > 0) || dist > pendingSpell.range) {
      try {
        messageLog.log({
          text: `${pendingSpell.spellName} target must be within ${pendingSpell.range} tiles.`,
          type: 'system',
        });
      } catch {}
      return;
    }
    if (pendingSpell.requiresLOS) {
      const blocked = buildBlocksVisionMap(world);
      const isBlocked = blockedCallback(blocked);
      if (!hasLOS(px, py, tx, ty, isBlocked)) {
        try {
          messageLog.log({
            text: `${pendingSpell.spellName} target must be in line of sight.`,
            type: 'system',
          });
        } catch {}
        return;
      }
    }

    _pendingSpellTargeting = null;

    const rulesHandler = makeRulesDispatcher(world, () => pe.id);
    rulesHandler({
      type: 'rules.castActiveSpell',
      payload: {
        spellId: pendingSpell.spellId,
        targetId: pe.id,
        x: tx,
        y: ty,
      },
    });
    return;
  }

  if (!pendingThrow?.itemId) return;
  if ((pendingThrow.actorId | 0) !== (pe.id | 0)) {
    _pendingThrowTargeting = null;
    return;
  }

  const px = pe.pos.x | 0;
  const py = pe.pos.y | 0;
  const dist = Math.max(Math.abs(tx - px), Math.abs(ty - py));
  if (!(dist > 0)) {
    try {
      messageLog.log({
        text: `${bracketizeName(pendingThrow.itemName)} must target another tile.`,
        type: 'system',
      });
    } catch {}
    return;
  }

  _pendingThrowTargeting = null;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({
    type: 'rules.throwItem',
    payload: {
      itemId: pendingThrow.itemId,
      x: tx,
      y: ty,
    },
  });
}, { capture: true });

function worldToScreen({ x, y, size = 1 }) {
  const sx = (x - cam.x) * cam.scale + canvas.width / (ctx.getTransform().a || 1) * 0.5;
  const sy = (y - cam.y) * cam.scale + canvas.height / (ctx.getTransform().d || 1) * 0.5;
  return { x: sx, y: sy, size: size * cam.scale };
}

// ---- Particle FX (display-only) -------------------------------------------
const fx = new ParticleFX({ capacity: PERF.particleCapacity, seedBase: (world.seed >>> 0) });
fx.ctx = bctx;
// Avoid expensive per-particle transforms: draw in world units under camera transform
fx.worldToScreen = (p) => ({ x: p.x, y: p.y, size: p.size });

// Burning fire emitter tracking (display-only reconciliation)
const _burningEmitters = new Set();

// Floating combat text (display-only, world-space)
const ftext = new FloatText();
// Debug/testing helper: expose a global to spawn text at world coords
try {
  /** @type any */ (window).float_text = /**
   * @param {number} x
   * @param {number} y
   * @param {string|number} text
   * @param {any} [opts]
   */
  (x,y,text,opts)=> ftext.add(x,y,text,opts||{});
} catch {}

// ---- Visual mappings (display contract) ------------------------------------
const palette = buildPalette();
const glyphAtlas = createGlyphAtlas(palette, { glowLayers: PERF.glowLayers, sizePx: (PERF.quality==='low'?32:64), fontPx: (PERF.quality==='low'?28:56) });
bootAdvance("Prepared render resources");

// ---- Render (display-only; consumes WorldView DTO) -------------------------
let _bgGradH = 0; let _bgGrad = null;
let _fxTime = 0; // display-side time accumulator for simple glyph FX
function render(worldView) {
  const W = _cssW;
  const H = _cssH;

  // Background (cache gradient by height to avoid per-frame allocations)
  bctx.save();
  if (!_bgGrad || _bgGradH !== H) {
    _bgGrad = bctx.createLinearGradient(0, 0, 0, H);
    _bgGrad.addColorStop(0, "#0b0e16");
    _bgGrad.addColorStop(1, "#0a0c14");
    _bgGradH = H;
  }
  bctx.fillStyle = _bgGrad; bctx.fillRect(0, 0, W, H);
  bctx.restore();

  // Camera transform for world-space draws
  bctx.save();
  applyCamera(bctx, cam, back);

  // Compute view bounds in world units for culling
  const viewHalfW = W * 0.5 / (cam.scale || 1);
  const viewHalfH = H * 0.5 / (cam.scale || 1);
  const vx0 = cam.x - viewHalfW - 1; // add small margin
  const vy0 = cam.y - viewHalfH - 1;
  const vx1 = cam.x + viewHalfW + 1;
  const vy1 = cam.y + viewHalfH + 1;

  // Pass 1: tiles from TileMap grid (3-state fog-of-war)
  if (worldView.tileGrid) {
    const isVisible = worldView.isVisible;
    const isExplored = worldView.isExplored;
    worldView.tileGrid.forEachTileInRect(
      Math.floor(vx0), Math.floor(vy0), Math.ceil(vx1), Math.ceil(vy1),
      (x, y, tile) => {
        if (isVisible && isVisible(x, y)) {
          const kind = _tileKindMap[tile];
          if (kind) drawKind(glyphAtlas, bctx, kind, x, y);
        } else if (isExplored && isExplored(x, y)) {
          bctx.globalAlpha = 0.35;
          const kind = _tileKindMap[tile];
          if (kind) drawKind(glyphAtlas, bctx, kind, x, y);
          bctx.globalAlpha = 1.0;
        }
        // unexplored: skip — background gradient is already black
      }
    );
  }

  // Pass 1.5: engravings on the ground (between tiles and entities)
  if (worldView.engravings && worldView.engravings.length) {
    const isVis = worldView.isVisible;
    bctx.save();
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.font = '0.32px monospace';
    for (let i = 0; i < worldView.engravings.length; i++) {
      const eng = worldView.engravings[i];
      if (eng.pos.x < vx0 || eng.pos.x > vx1 || eng.pos.y < vy0 || eng.pos.y > vy1) continue;
      bctx.globalAlpha = (isVis && isVis(eng.pos.x, eng.pos.y)) ? 0.6 : 0.2;
      bctx.fillStyle = '#8899aa';
      const label = eng.text.length > 8 ? eng.text.slice(0, 7) + '\u2026' : eng.text;
      bctx.fillText(label, eng.pos.x, eng.pos.y + 0.28);
    }
    bctx.globalAlpha = 1.0;
    bctx.restore();
  }

  // Pass 2: entities (doors, stairs, monsters, items, player)
  // Keep only the top-most ground item glyph per tile.
  const stackMeta = new Map(); // "x,y" -> topItemId
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const layer = Number.isFinite(e.layer) ? (e.layer | 0) : 300;
    if (layer !== 100) continue;
    if (_hiddenThrownItemIds.has(e.id)) continue;
    // worldView.entities is sorted by id within a tile/layer; later ids are drawn on top.
    stackMeta.set(`${e.pos.x},${e.pos.y}`, e.id);
  }

  // Draw order requirement:
  // 1) actors/terrain entities first
  // 2) top ground item second
  const deferredItems = [];

  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    const layer = Number.isFinite(e.layer) ? (e.layer | 0) : 300;

    if (layer === 100) {
      const topItemId = stackMeta.get(`${e.pos.x},${e.pos.y}`) || 0;
      if (topItemId === e.id) deferredItems.push(e);
      continue;
    }

    drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);

    // Glyph-FX: grid bug multi-color cycle (purple ↔ cyan)
    if (PERF.quality !== 'low' && k === 'grid_bug') {
      const t = _fxTime * 3.0;               // 3 Hz cycle
      const pct = (Math.sin(t) + 1) * 0.5;   // 0 → 1 → 0
      const r = Math.round(187 + (68  - 187) * pct);
      const g = Math.round(102 + (204 - 102) * pct);
      const b = Math.round(255 + (255 - 255) * pct);
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      bctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
      bctx.beginPath();
      bctx.arc(e.pos.x, e.pos.y, 0.35, 0, Math.PI * 2);
      bctx.fill();
      bctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
      bctx.lineWidth = 0.06;
      const rad = 0.42 + 0.04 * Math.sin(t * 1.7);
      bctx.beginPath();
      bctx.arc(e.pos.x, e.pos.y, rad, 0, Math.PI * 2);
      bctx.stroke();
      bctx.restore();
    }

    // Glyph-FX: show an invulnerability shimmer ring when tagged
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('invulnerable')) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      bctx.strokeStyle = 'rgba(160,255,255,0.9)';
      bctx.lineWidth = 0.08; // world units
      const r = 0.45 + 0.06 * Math.sin(_fxTime * 6.0);
      bctx.beginPath();
      bctx.arc(e.pos.x, e.pos.y, r, 0, Math.PI * 2);
      bctx.stroke();
      bctx.restore();
    }

    // Glyph-FX: simple green thorn spikes ring when wearing Thorns gear
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('thorns')) {
      /** @type {CanvasRenderingContext2D} */
      const g = /** @type any */ (bctx);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cx = e.pos.x, cy = e.pos.y;
      // soft inner glow
      g.fillStyle = 'rgba(120,255,120,0.10)';
      g.beginPath(); g.arc(cx, cy, 0.36, 0, Math.PI * 2); g.fill();
      // spikes
      const n = 8; // keep it subtle
      const base = 0.30; const out = 0.52;
      const wob = 0.02 * Math.sin(_fxTime * 5.0);
      g.lineWidth = 0.06;
      g.strokeStyle = 'rgba(120,255,120,0.85)';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + _fxTime * 0.8; // slow rotation
        const x0 = cx + Math.cos(a) * base;
        const y0 = cy + Math.sin(a) * base;
        const x1 = cx + Math.cos(a) * (out + wob);
        const y1 = cy + Math.sin(a) * (out + wob);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      // faint outer ring
      g.strokeStyle = 'rgba(120,255,160,0.35)';
      g.lineWidth = 0.05;
      g.beginPath(); g.arc(cx, cy, out + 0.02, 0, Math.PI * 2); g.stroke();
      g.restore();
    }

    // Glyph-FX: flickering fire aura (unused — burning uses particles only)
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('_fire_aura')) {
      /** @type {CanvasRenderingContext2D} */
      const g = /** @type any */ (bctx);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cx = e.pos.x, cy = e.pos.y;

      // Inner warm glow (pulsing)
      const pulse = 0.08 + 0.04 * Math.sin(_fxTime * 8.0);
      g.fillStyle = `rgba(255,120,20,${(0.12 + pulse).toFixed(2)})`;
      g.beginPath(); g.arc(cx, cy, 0.38, 0, Math.PI * 2); g.fill();

      // Flickering flame tongues (6 short strokes radiating outward)
      const nf = 6;
      const fBase = 0.28;
      g.lineWidth = 0.07;
      for (let j = 0; j < nf; j++) {
        const a = (j / nf) * Math.PI * 2 + _fxTime * 1.5;
        const flicker = 0.04 * Math.sin(_fxTime * 12.0 + j * 2.1);
        const tip = 0.42 + flicker;
        const x0 = cx + Math.cos(a) * fBase;
        const y0 = cy + Math.sin(a) * fBase;
        const x1 = cx + Math.cos(a) * tip;
        const y1 = cy + Math.sin(a) * tip;
        g.strokeStyle = (j % 2 === 0) ? 'rgba(255,160,40,0.85)' : 'rgba(255,80,20,0.75)';
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }

      // Outer heat ring (subtle, wobbly)
      g.strokeStyle = 'rgba(255,100,30,0.30)';
      g.lineWidth = 0.04;
      const rOuter = 0.46 + 0.03 * Math.sin(_fxTime * 6.0);
      g.beginPath(); g.arc(cx, cy, rOuter, 0, Math.PI * 2); g.stroke();

      g.restore();
    }
  }

  for (let i = 0; i < deferredItems.length; i++) {
    const e = deferredItems[i];
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);
  }

  if (bctx) drawThrownItemEffects(bctx, worldView);

  // Spell bolt VFX (world-space additive glow)
  if (bctx) drawBoltEffects(bctx);
  if (bctx) drawMeteorEffects(bctx);
  if (bctx) drawBlastwaveEffects(bctx);
  if (bctx) drawFrostEffects(bctx);
  if (bctx) drawArrowEffects(bctx);
  if (bctx) drawPoisonCloudEffects(bctx);
  if (bctx) drawPlasmaCloudEffects(bctx);

  // Particles (already in world space)
  fx.render({ mode: (PERF.quality === 'low' ? 'source-over' : 'lighter'), alphaScale: 0.9, shape: (PERF.quality === 'low' ? 'rect' : 'circle') });

  // Floating text, rendered in world space on top of particles
  if (bctx) ftext.render(bctx);

  bctx.restore();

  // Present backbuffer once (reset transform to identity for exact pixel copy)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(back, 0, 0);
  ctx.restore();

  // HUD
  if (PERF.quality !== 'low') {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#9cf";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    // const s = fx.stats();
    // ctx.fillText(`particles: ${s.active}/${s.capacity}  emitters:${s.emitters}`, 8, 8); // DEBUG
    // const fpsInt = Math.max(0, Math.round(_fpsEMA || 0));
    // ctx.fillText(`fx fps: ${fpsInt}`, 8, 24); // DEBUG

    // Optional rules profiler overlay (top 3 systems by last tick duration)
    const prof = /** @type any */ (window).__JSHACK_RULES_PROF;
    if (prof && prof.lastTick) {
      const t = prof.lastTick;
      ctx.fillText(`rules dt: ${t.totalMs.toFixed(2)}ms`, 8, 40);
      // flatten systems with phase labels
      const all = [];
      for (const ph of Object.keys(t.phases)) {
        const p = t.phases[ph];
        for (let i = 0; i < p.systems.length; i++) {
          const srec = p.systems[i];
          all.push({ ph, name: srec.name, ms: srec.ms });
        }
      }
      all.sort((a,b)=>b.ms - a.ms);
      for (let i = 0; i < Math.min(3, all.length); i++) {
        const r = all[i];
        ctx.fillText(`${r.ph}: ${r.name} ${r.ms.toFixed(2)}ms`, 8, 56 + i*14);
      }
    }
    ctx.restore();
  }
}

// ---- Frame loop (FXClock) --------------------------------------------------
let last = performance.now();
let _fpsEMA = 0; // FX FPS (EMA)
function frame(now) {
    /** @type {DOMHighResTimeStamp} */
    // @ts-ignore - annotate for JS type checking
  const dtSec = Math.max(0, (now - last) / 1000);
  last = now;

  // Update FX FPS (exponential moving average for stability)
  const instFps = dtSec > 0 ? (1 / dtSec) : 0;
  _fpsEMA = _fpsEMA ? (_fpsEMA * 0.9 + instFps * 0.1) : instFps;
  _fxTime += dtSec;

  // Sim step is scene-controlled; keep paused (no tick) unless a scene/input advances it.
  stepSim(0);
  flushPendingStairTransition();

  // Advance display-only systems (fx.step moved below — needs worldView for emitter origins)
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);
  // Display-only VFX lifetimes
  updateBoltFx(dtSec);
  updateMeteorFx(dtSec);
  updateBlastwaveFx(dtSec);
  updateFrostFx(dtSec);
  updateArrowFx(dtSec);
  updateThrownItemFx(dtSec);
  updatePoisonCloudFx(dtSec);
  updatePlasmaCloudFx(dtSec);
  ftext.step(dtSec);

  // Update vitals HUD if changed (lightweight per-frame check)
  hudFeeds.updateVitalsHUD();
  hudFeeds.updateCombatHUD();
  hudFeeds.updateDepthHUD();
  hudFeeds.updatePetHUD();

  // Render
  const view = getCachedView();
  // keep camera centered on player if present (unless debug-detached)
  if (view.player && !cam._detached) {
    // Directly set follow target at player world coords
    followEntity(cam, view.player.pos, dtSec, 6.0);
  }

  // Burning particle emitter reconciliation + advance particles
  if (PERF.particleCapacity > 0) {
    const _emitterOrigins = [];
    const nowBurning = new Set();
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if (Array.isArray(e.tags) && e.tags.includes('burning')) {
        nowBurning.add(e.id);
        if (!_burningEmitters.has(e.id)) {
          fx.ensureEmitter(`burn:${e.id}`, {
            continuous: true,
            rate: 18,
            angle: -Math.PI / 2,
            spread: Math.PI / 5,
            speed: 0.8,
            speedJitter: 0.4,
            ax: 0, ay: -0.5,
            life: 0.7,
            lifeJitter: 0.3,
            size: 0.28,
            sizeEnd: 0.06,
            color: '#ff8c00',
            alpha0: 0.9,
            alpha1: 0.0,
            offsetX: 0,
            offsetY: -0.15,
          });
          _burningEmitters.add(e.id);
        }
        _emitterOrigins.push({ key: `burn:${e.id}`, x: e.pos.x, y: e.pos.y });
      }
    }
    for (const id of _burningEmitters) {
      if (!nowBurning.has(id)) {
        fx.removeEmitter(`burn:${id}`);
        _burningEmitters.delete(id);
      }
    }
    fx.step(dtSec, _emitterOrigins);
  }

  render(view);

  requestAnimationFrame(frame);
}

// Update VFX lifetimes between frames
/** @param {number} dt */
function updateBoltFx(dt) {
  if (_boltFx && _boltFx.length) {
    for (const eff of _boltFx) eff.ttl -= dt;
    for (let i = _boltFx.length - 1; i >= 0; i--) {
      const seg = _boltFx[i];
      if (!seg) continue;
      if (seg.ttl <= 0) _boltFx.splice(i, 1);
    }
  }
  if (_lightPulses && _lightPulses.length) {
    for (const f of _lightPulses) f.ttl -= dt;
    for (let i = _lightPulses.length - 1; i >= 0; i--) {
      const p = _lightPulses[i];
      if (!p) continue;
      if (p.ttl <= 0) _lightPulses.splice(i, 1);
    }
  }
}

// Draw current bolt effects under camera transform
/** @param {CanvasRenderingContext2D} ctx */
function drawBoltEffects(ctx) {
  if ((!_boltFx || !_boltFx.length) && (!_lightPulses || !_lightPulses.length)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Light pulses at endpoints
  for (const p of _lightPulses) {
    const a = Math.max(0, Math.min(1, p.ttl / 0.12));
    ctx.fillStyle = `rgba(180,240,255,${0.18 * a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,220,${0.10 * a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 0.35, 0, Math.PI * 2); ctx.fill();
  }
  // Bolts
  for (const eff of _boltFx) {
    const alpha = Math.max(0, Math.min(1, eff.ttl / eff.max));
    const pts = jitterLine(eff.from, eff.to, 11, 0.10 * alpha);

    // Outer glow
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(120,200,255,${0.18 * alpha})`;
    ctx.lineWidth = 0.22;
    pathPolyline(ctx, pts); ctx.stroke();

    // Mid glow
    ctx.strokeStyle = `rgba(160,220,255,${0.35 * alpha})`;
    ctx.lineWidth = 0.10;
    pathPolyline(ctx, pts); ctx.stroke();

    // Core
  const core = jitterLine(eff.from, eff.to, 13, 0.05 * alpha);
    ctx.strokeStyle = `rgba(230,255,255,${0.9 * alpha})`;
    ctx.lineWidth = 0.045;
    pathPolyline(ctx, core); ctx.stroke();
  }
  ctx.restore();
}

// Update meteor/blastwave VFX lifetimes
/** @param {number} dt */
function updateMeteorFx(dt) {
  for (let i = _meteorFx.length - 1; i >= 0; i--) {
    _meteorFx[i].ttl -= dt;
    if (_meteorFx[i].ttl <= 0) _meteorFx.splice(i, 1);
  }
}
/** @param {number} dt */
function updateBlastwaveFx(dt) {
  for (let i = _blastwaveFx.length - 1; i >= 0; i--) {
    _blastwaveFx[i].ttl -= dt;
    if (_blastwaveFx[i].ttl <= 0) _blastwaveFx.splice(i, 1);
  }
}

// Update frost VFX lifetimes
/** @param {number} dt */
function updateFrostFx(dt) {
  for (let i = _frostBeamFx.length - 1; i >= 0; i--) {
    _frostBeamFx[i].ttl -= dt;
    if (_frostBeamFx[i].ttl <= 0) _frostBeamFx.splice(i, 1);
  }
  for (let i = _frostImpactFx.length - 1; i >= 0; i--) {
    _frostImpactFx[i].ttl -= dt;
    if (_frostImpactFx[i].ttl <= 0) _frostImpactFx.splice(i, 1);
  }
}

// Draw frost beam + crystallisation impact under camera transform
/** @param {CanvasRenderingContext2D} ctx */
function drawFrostEffects(ctx) {
  if (!_frostBeamFx.length && !_frostImpactFx.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Frost beam: icy ray from caster to target with jittered crystalline edges
  for (const eff of _frostBeamFx) {
    const alpha = Math.max(0, Math.min(1, eff.ttl / eff.max));
    const pts = jitterLine(eff.from, eff.to, 14, 0.07 * alpha);

    // Outer frost glow (wide, pale cyan)
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(100,200,255,${0.15 * alpha})`;
    ctx.lineWidth = 0.25;
    pathPolyline(ctx, pts); ctx.stroke();

    // Mid icy shimmer
    ctx.strokeStyle = `rgba(150,230,255,${0.35 * alpha})`;
    ctx.lineWidth = 0.10;
    pathPolyline(ctx, pts); ctx.stroke();

    // Core (bright white-blue)
    const core = jitterLine(eff.from, eff.to, 16, 0.03 * alpha);
    ctx.strokeStyle = `rgba(220,245,255,${0.85 * alpha})`;
    ctx.lineWidth = 0.04;
    pathPolyline(ctx, core); ctx.stroke();
  }

  // Impact crystallisation: expanding hexagonal frost bloom
  for (const imp of _frostImpactFx) {
    const t = 1 - imp.ttl / imp.max; // 0→1 over lifetime

    // Phase 1: bright white flash on impact (first 12%)
    if (t < 0.12) {
      const flashT = t / 0.12;
      const flashR = 0.15 + flashT * 0.6;
      const flashA = 0.8 * (1 - flashT);
      ctx.fillStyle = `rgba(230,245,255,${flashA})`;
      ctx.beginPath(); ctx.arc(imp.x, imp.y, flashR, 0, Math.PI * 2); ctx.fill();
    }

    // Phase 2: expanding ice ring (cyan, sharp)
    const ringR = t * (imp.radius + 0.3);
    const ringA = 0.5 * (1 - t);
    ctx.strokeStyle = `rgba(120,210,255,${ringA})`;
    ctx.lineWidth = 0.08 * (1 - t * 0.6);
    ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR, 0, Math.PI * 2); ctx.stroke();

    // Phase 3: inner frost disc (pale blue, fades fast)
    if (t < 0.5) {
      const discA = 0.18 * (1 - t / 0.5);
      ctx.fillStyle = `rgba(180,230,255,${discA})`;
      ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    // Phase 4: crystalline spokes (6 radial lines outward like ice cracks)
    const spokeA = 0.4 * (1 - t);
    if (spokeA > 0.01) {
      ctx.strokeStyle = `rgba(200,240,255,${spokeA})`;
      ctx.lineWidth = 0.03;
      for (let s = 0; s < 6; s++) {
        const angle = (s / 6) * Math.PI * 2 + 0.2; // slight offset for asymmetry
        const spokeLen = ringR * (0.7 + 0.3 * Math.sin(s * 1.7 + t * 4));
        ctx.beginPath();
        ctx.moveTo(imp.x, imp.y);
        ctx.lineTo(imp.x + Math.cos(angle) * spokeLen, imp.y + Math.sin(angle) * spokeLen);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// Draw meteor impact effects under camera transform
/** @param {CanvasRenderingContext2D} ctx */
function drawMeteorEffects(ctx) {
  if (!_meteorFx.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of _meteorFx) {
    const t = 1 - m.ttl / m.max; // 0→1 over lifetime
    // Phase 1: bright white impact flash
    if (t < 0.15) {
      const flashT = t / 0.15;
      const flashR = 0.3 + flashT * (m.radius + 0.5);
      const flashA = 0.7 * (1 - flashT);
      ctx.fillStyle = `rgba(255,255,220,${flashA})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, flashR, 0, Math.PI * 2); ctx.fill();
    }
    // Phase 2: orange-red glow fading out
    const glowA = 0.35 * (1 - t);
    const glowR = m.radius * 0.8 + t * 0.5;
    ctx.fillStyle = `rgba(255,120,40,${glowA})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, glowR, 0, Math.PI * 2); ctx.fill();
    // Inner hot core
    const coreA = 0.25 * (1 - t * t);
    ctx.fillStyle = `rgba(255,200,100,${coreA})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, glowR * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Draw blastwave shockwave ring under camera transform
/** @param {CanvasRenderingContext2D} ctx */
function drawBlastwaveEffects(ctx) {
  if (!_blastwaveFx.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bw of _blastwaveFx) {
    const t = 1 - bw.ttl / bw.max; // 0→1
    // Expanding ring
    const ringR = t * (bw.radius + 0.5);
    const ringA = 0.6 * (1 - t);
    ctx.strokeStyle = `rgba(180,210,255,${ringA})`;
    ctx.lineWidth = 0.12 * (1 - t * 0.7);
    ctx.beginPath(); ctx.arc(bw.x, bw.y, ringR, 0, Math.PI * 2); ctx.stroke();
    // Inner filled disc (fades fast)
    if (t < 0.4) {
      const discA = 0.2 * (1 - t / 0.4);
      ctx.fillStyle = `rgba(220,240,255,${discA})`;
      ctx.beginPath(); ctx.arc(bw.x, bw.y, ringR * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // Bright center flash
    if (t < 0.1) {
      const cFlashA = 0.5 * (1 - t / 0.1);
      ctx.fillStyle = `rgba(255,255,255,${cFlashA})`;
      ctx.beginPath(); ctx.arc(bw.x, bw.y, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function remapThrowArcProgress(t01) {
  const t = Math.max(0, Math.min(1, Number(t01) || 0));
  // Fast near release/impact, slower around apex.
  const k = 0.74;
  return t + (k / (2 * Math.PI)) * Math.sin(2 * Math.PI * t);
}

/** @param {number} dt */
function updateThrownItemFx(dt) {
  let changed = false;
  for (let i = _thrownItemFx.length - 1; i >= 0; i--) {
    const rec = _thrownItemFx[i];
    rec.t += dt;
    const done = rec.t >= rec.duration;
    const gone = !world.isAlive(rec.itemId);
    if (!done && !gone) continue;
    _hiddenThrownItemIds.delete(rec.itemId);
    _thrownItemFx.splice(i, 1);
    changed = true;
  }
  if (changed) syncSimInputLockFlag();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} worldView
 */
function drawThrownItemEffects(ctx, worldView) {
  if (!_thrownItemFx.length) return;

  const kindById = new Map();
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (!_hiddenThrownItemIds.has(e.id)) continue;
    kindById.set(e.id, typeof e.kind === "string" ? e.kind : "default");
  }

  for (let i = 0; i < _thrownItemFx.length; i++) {
    const rec = _thrownItemFx[i];
    if (!rec.kind) rec.kind = kindById.get(rec.itemId) || "default";
    const t01 = Math.max(0, Math.min(1, rec.t / Math.max(0.0001, rec.duration)));
    const u = remapThrowArcProgress(t01);
    const x = rec.from.x + (rec.to.x - rec.from.x) * u;
    const yGround = rec.from.y + (rec.to.y - rec.from.y) * u;
    const h = Math.sin(Math.PI * u);
    const y = yGround - h * THROW_FX_ARC_HEIGHT;

    // Ground shadow to sell "item is airborne".
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${(0.20 - h * 0.08).toFixed(3)})`;
    if (typeof ctx.ellipse === "function") {
      ctx.beginPath();
      ctx.ellipse(x, yGround + 0.08, 0.22 + h * 0.08, 0.12 + h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, yGround + 0.08, 0.16 + h * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawKind(glyphAtlas, ctx, rec.kind, x, y);
  }
}

// --- Arrow tracer update & draw --------------------------------------------
/** @param {number} dt */
function updateArrowFx(dt) {
  for (let i = _arrowFx.length - 1; i >= 0; i--) {
    const a = _arrowFx[i];
    a.t += dt;
    if (a.t >= a.duration) {
      // Arrow arrived — spawn impact spark
      _arrowSparks.push({ x: a.to.x, y: a.to.y, ttl: 0.18, style: a.style || 'plain' });
      _arrowFx.splice(i, 1);
    }
  }
  for (let i = _arrowSparks.length - 1; i >= 0; i--) {
    _arrowSparks[i].ttl -= dt;
    if (_arrowSparks[i].ttl <= 0) _arrowSparks.splice(i, 1);
  }
}
/** @param {CanvasRenderingContext2D} ctx */
function drawArrowEffects(ctx) {
  if (!_arrowFx.length && !_arrowSparks.length) return;
  ctx.save();

  // Draw flying arrows
  for (const a of _arrowFx) {
    const progress = Math.min(1, a.t / a.duration);
    const isFire = a.style === 'fire';
    // Current head position (lerp from→to)
    const hx = a.from.x + (a.to.x - a.from.x) * progress;
    const hy = a.from.y + (a.to.y - a.from.y) * progress;
    // Tail trails behind the head
    const tailLen = Math.min(isFire ? 0.8 : 0.6, a.len * progress);
    const tx = hx - a.dx * tailLen;
    const ty = hy - a.dy * tailLen;

    if (isFire) {
      // Fire arrow: outer glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,100,20,0.25)';
      ctx.lineWidth = 0.18;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.restore();
      // Fire arrow: bright orange shaft
      ctx.strokeStyle = 'rgba(255,160,40,0.95)';
      ctx.lineWidth = 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      // Fire arrowhead (hot white-yellow tip)
      ctx.fillStyle = 'rgba(255,240,180,1.0)';
      ctx.beginPath(); ctx.arc(hx, hy, 0.09, 0, Math.PI * 2); ctx.fill();
    } else {
      // Normal arrow: warm wood shaft
      ctx.strokeStyle = 'rgba(210,180,110,0.9)';
      ctx.lineWidth = 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      // Arrowhead (bright tip)
      ctx.fillStyle = 'rgba(240,230,200,0.95)';
      ctx.beginPath(); ctx.arc(hx, hy, 0.07, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Impact sparks
  for (const s of _arrowSparks) {
    const alpha = Math.max(0, s.ttl / 0.18);
    const isFire = s.style === 'fire';
    if (isFire) {
      // Fire impact: orange-red burst
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,120,30,${0.5 * alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 0.3 * alpha, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,200,80,${0.4 * alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 0.15 * alpha, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      // Normal impact: small warm flash
      ctx.fillStyle = `rgba(255,220,140,${0.5 * alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 0.2 * alpha, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,250,230,${0.3 * alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 0.1 * alpha, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

/** @param {number} dt */
function updatePlasmaCloudFx(dt) {
  for (const [cloudId, cloud] of _plasmaCloudFx) {
    cloud.flash = Math.max(0, cloud.flash - dt);
    if (cloud.fading) {
      cloud.fadeLeft = Math.max(0, cloud.fadeLeft - dt);
      if (cloud.fadeLeft <= 0) {
        _plasmaCloudFx.delete(cloudId);
      }
      continue;
    }
    // Safety net: if entity is gone but we missed expired event, start a soft fade.
    if (!world.isAlive(cloudId)) {
      cloud.fading = true;
      cloud.fadeMax = 0.35;
      cloud.fadeLeft = Math.max(cloud.fadeLeft, cloud.fadeMax);
      cloud.flash = Math.max(cloud.flash, 0.12);
    }
  }
}

/** @param {number} dt */
function updatePoisonCloudFx(dt) {
  for (const [hazardId, cloud] of _poisonCloudFx) {
    cloud.pulseFlash = Math.max(0, cloud.pulseFlash - dt);
    cloud.bubbleClock = Number.isFinite(cloud.bubbleClock)
      ? Number(cloud.bubbleClock)
      : (0.08 + Math.random() * 0.16);

    if (!cloud.fading) {
      cloud.bubbleClock -= dt;
      while (cloud.bubbleClock <= 0) {
        const p = randomPoisonBubblePoint(cloud);
        const dense = cloud.medium === 'floor';
        const strength = (dense && Math.random() < 0.32) ? 2 : 1;
        spawnPoisonBubblePop(p.x, p.y, strength);
        cloud.bubbleClock += (dense ? 0.10 : 0.15) + Math.random() * (dense ? 0.12 : 0.18);
      }
    }

    if (cloud.fading) {
      cloud.fadeLeft = Math.max(0, cloud.fadeLeft - dt);
      if (cloud.fadeLeft <= 0) {
        _poisonCloudFx.delete(hazardId);
      }
      continue;
    }
    if (!world.isAlive(hazardId)) {
      cloud.fading = true;
      cloud.fadeMax = 0.45;
      cloud.fadeLeft = Math.max(cloud.fadeLeft, cloud.fadeMax);
      cloud.pulseFlash = Math.max(cloud.pulseFlash, 0.10);
    }
  }

  for (let i = _poisonBubblePops.length - 1; i >= 0; i--) {
    const pop = _poisonBubblePops[i];
    pop.ttl = Math.max(0, pop.ttl - dt);
    pop.y -= pop.rise * dt;
    pop.phase += dt * 6.0;
    if (pop.ttl <= 0) _poisonBubblePops.splice(i, 1);
  }
}

/** @param {CanvasRenderingContext2D} ctx */
function drawPoisonCloudEffects(ctx) {
  if (!_poisonCloudFx.size && !_poisonBubblePops.length) return;
  ctx.save();
  const TAU = Math.PI * 2;

  for (const cloud of _poisonCloudFx.values()) {
    const cx = cloud.x;
    const cy = cloud.y;
    const r = Math.max(0, cloud.radius | 0);
    const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 4.7 + cloud.phase);
    const wobble = 0.5 + 0.5 * Math.sin(_fxTime * 2.1 + cloud.phase * 0.8);
    const lifeFactor = Math.max(0.32, Math.min(1, (cloud.maxTurns > 0) ? (cloud.turnsLeft / cloud.maxTurns) : 1));
    const fadeFactor = cloud.fading
      ? Math.max(0, Math.min(1, (cloud.fadeMax > 0) ? (cloud.fadeLeft / cloud.fadeMax) : 0))
      : 1;
    const pulseBoost = cloud.pulseFlash > 0 ? (cloud.pulseFlash / 0.24) : 0;
    const alphaScale = lifeFactor * fadeFactor;

    // A poisonous fog should read as murky and viscous, not crackling.
    ctx.globalCompositeOperation = 'source-over';
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (dist > r) continue;

        const tx = cx + dx;
        const ty = cy + dy;
        const ring = 1 - (dist / (r + 1));
        const alpha = (0.08 + ring * 0.10 + wobble * 0.04 + pulseBoost * 0.06) * alphaScale;

        ctx.fillStyle = `rgba(78,155,56,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 0.66 + 0.05 * wobble, 0, TAU);
        ctx.fill();

        ctx.fillStyle = `rgba(145,212,102,${(alpha * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 0.36 + 0.03 * pulse, 0, TAU);
        ctx.fill();
      }
    }

    // Slowly undulating perimeter, biased toward dense floor-slick pooling.
    const points = [];
    const pointCount = Math.max(10, 12 + r * 6);
    const baseR = r + 0.88;
    const driftX = 0.05 * Math.sin(_fxTime * 1.2 + cloud.phase);
    const driftY = 0.05 * Math.cos(_fxTime * 1.0 + cloud.phase * 0.6);
    for (let i = 0; i < pointCount; i++) {
      const t = i / pointCount;
      const a = t * TAU;
      const noise =
        0.10 * Math.sin(_fxTime * 2.7 + a * 2.4 + cloud.phase) +
        0.06 * Math.sin(_fxTime * 3.6 + a * 4.2 - cloud.phase * 0.4);
      const rr = baseR + noise + 0.05 * wobble;
      points.push({
        x: cx + driftX + Math.cos(a) * rr,
        y: cy + driftY + Math.sin(a) * (rr * 0.92),
      });
    }
    if (points.length >= 3) {
      const p0 = points[0];
      const p1 = points[1];
      const firstMid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
      ctx.beginPath();
      ctx.moveTo(firstMid.x, firstMid.y);
      for (let i = 1; i <= points.length; i++) {
        const p = points[i % points.length];
        const n = points[(i + 1) % points.length];
        const mid = { x: (p.x + n.x) * 0.5, y: (p.y + n.y) * 0.5 };
        ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
      }
      ctx.closePath();

      const fillA = (0.10 + wobble * 0.06 + pulseBoost * 0.08) * alphaScale;
      ctx.fillStyle = `rgba(84,150,62,${fillA.toFixed(3)})`;
      ctx.fill();

      const edgeA = (0.16 + wobble * 0.05 + pulseBoost * 0.08) * alphaScale;
      ctx.strokeStyle = `rgba(168,228,132,${edgeA.toFixed(3)})`;
      ctx.lineWidth = 0.06;
      ctx.stroke();
    }

    // Faint toxic core, intentionally less luminous than plasma.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(196,248,128,${((0.05 + pulse * 0.05 + pulseBoost * 0.07) * alphaScale).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.24 + pulse * 0.06, 0, TAU);
    ctx.fill();
  }

  if (_poisonBubblePops.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < _poisonBubblePops.length; i++) {
      const pop = _poisonBubblePops[i];
      const max = (pop.max > 0) ? pop.max : 1;
      const t = pop.max > 0 ? (1 - (pop.ttl / max)) : 1;
      const u = Math.max(0, Math.min(1, t));
      const alive = Math.max(0, Math.min(1, pop.ttl / max));
      const rr = pop.r0 + (pop.r1 - pop.r0) * u;
      const wob = 0.015 * Math.sin(_fxTime * 6.5 + pop.phase);
      const x = pop.x + wob;
      const y = pop.y;

      const ringA = (0.24 * alive) + 0.02;
      ctx.strokeStyle = `rgba(176,255,132,${ringA.toFixed(3)})`;
      ctx.lineWidth = 0.045 + (1 - u) * 0.015;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = `rgba(90,196,68,${(ringA * 0.65).toFixed(3)})`;
      ctx.lineWidth = 0.028;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.01, rr * 0.68), 0, TAU);
      ctx.stroke();

      const coreA = (0.10 + (1 - u) * 0.18) * alive;
      if (coreA > 0.01) {
        ctx.fillStyle = `rgba(206,255,170,${coreA.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.008, (1 - u) * 0.055), 0, TAU);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx */
function drawPlasmaCloudEffects(ctx) {
  if (!_plasmaCloudFx.size) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const TAU = Math.PI * 2;

  for (const cloud of _plasmaCloudFx.values()) {
    const cx = cloud.x;
    const cy = cloud.y;
    const r = Math.max(0, cloud.radius | 0);
    const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 8.5 + cloud.phase);
    const lifeFactor = Math.max(0.35, Math.min(1, (cloud.maxTurns > 0) ? (cloud.turnsLeft / cloud.maxTurns) : 1));
    const fadeFactor = cloud.fading
      ? Math.max(0, Math.min(1, (cloud.fadeMax > 0) ? (cloud.fadeLeft / cloud.fadeMax) : 0))
      : 1;
    const flashBoost = cloud.flash > 0 ? (cloud.flash / 0.26) : 0;
    const alphaScale = lifeFactor * fadeFactor;

    // Mark every hazardous tile with overlapping circular plasma pools (no grid boxes).
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (dist > r) continue;

        const tx = cx + dx;
        const ty = cy + dy;
        const ring = 1 - (dist / (r + 1));
        const alpha = (0.10 + ring * 0.08 + pulse * 0.05 + flashBoost * 0.08) * alphaScale;

        ctx.fillStyle = `rgba(80,220,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 0.62 + 0.04 * pulse, 0, TAU);
        ctx.fill();

        ctx.fillStyle = `rgba(180,250,255,${(alpha * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 0.34 + 0.03 * pulse, 0, TAU);
        ctx.fill();
      }
    }

    // Wobbling closed quadratic-Bezier contour around the hazardous footprint.
    const points = [];
    const pointCount = Math.max(12, 14 + r * 8);
    const baseR = r + 0.92;
    const driftX = 0.09 * Math.sin(_fxTime * 1.7 + cloud.phase);
    const driftY = 0.09 * Math.cos(_fxTime * 1.5 + cloud.phase * 0.7);
    for (let i = 0; i < pointCount; i++) {
      const t = i / pointCount;
      const a = t * TAU;
      const wobble =
        0.14 * Math.sin(_fxTime * 3.9 + a * 3.0 + cloud.phase) +
        0.09 * Math.sin(_fxTime * 5.3 + a * 5.0 - cloud.phase * 0.6);
      const rrX = baseR + wobble + 0.06 * pulse;
      const rrY = baseR + wobble * 0.75 + 0.05 * pulse;
      points.push({
        x: cx + driftX + Math.cos(a) * rrX,
        y: cy + driftY + Math.sin(a) * rrY,
      });
    }
    if (points.length >= 3) {
      const p0 = points[0];
      const p1 = points[1];
      const firstMid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
      ctx.beginPath();
      ctx.moveTo(firstMid.x, firstMid.y);
      for (let i = 1; i <= points.length; i++) {
        const p = points[i % points.length];
        const n = points[(i + 1) % points.length];
        const mid = { x: (p.x + n.x) * 0.5, y: (p.y + n.y) * 0.5 };
        ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
      }
      ctx.closePath();

      const blobA = (0.12 + pulse * 0.07 + flashBoost * 0.10) * alphaScale;
      ctx.fillStyle = `rgba(95,230,255,${blobA.toFixed(3)})`;
      ctx.fill();

      const edgeA = (0.25 + pulse * 0.08 + flashBoost * 0.16) * alphaScale;
      ctx.strokeStyle = `rgba(190,250,255,${edgeA.toFixed(3)})`;
      ctx.lineWidth = 0.08;
      ctx.stroke();
    }

    // Core energetic haze.
    ctx.fillStyle = `rgba(210,255,255,${((0.12 + pulse * 0.10 + flashBoost * 0.18) * alphaScale).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.28 + pulse * 0.08, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx 
  *  @param {{x:number,y:number}[]} pts */
function pathPolyline(ctx, pts) {
  if (!pts.length) return; 
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    ctx.lineTo(p.x, p.y);
  }
}

/** @param {{x:number,y:number}} a 
  *  @param {{x:number,y:number}} b 
  *  @param {number} [segments] 
  *  @param {number} [amp] */
function jitterLine(a, b, segments = 9, amp = 0.08) {
  const out = [];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // perpendicular
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const j = (i === 0 || i === segments) ? 0 : (Math.random() * 2 - 1) * amp;
    out.push({ x: a.x + dx * t + nx * j, y: a.y + dy * t + ny * j });
  }
  return out;
}
bootAdvance("Starting render loop");
requestAnimationFrame((now) => {
  frame(now);
  finishBoot();
});

// ---- Minimal demo “scene” controls (display-only) --------------------------
addEventListener("keydown", (e) => {
  const { key, code } = e;
  const deleteSaveHotkey = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (code === "Backspace" || key === "Backspace");
  const zoomIn  = key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
  const zoomOut = key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract";

  if (deleteSaveHotkey) {
    const hadSave = hasSavegame();
    clearSavegamePayload();
    messageLog.log({
      text: hadSave
        ? "Save game deleted. (Ctrl+Shift+Backspace)"
        : "No save game found to delete.",
      type: "system",
    });
    e.preventDefault();
    return;
  }

  if (zoomIn)  { zoomTo(cam, Math.min(TILE_PX * 4.0, cam.targetScale * 1.2)); e.preventDefault(); return; }
  if (zoomOut) { zoomTo(cam, Math.max(TILE_PX * 0.5, cam.targetScale / 1.2)); e.preventDefault(); return; }
  if (key === "0") { jumpTo(cam, { x: 0, y: 0 }); zoomTo(cam, TILE_PX); e.preventDefault(); return; }
  if (key === "9") {
    // Debug: toggle camera between nearest down-stair and player
    if (cam._detached) {
      cam._detached = false;
      console.log('[DEBUG] Camera re-attached to player');
    } else {
      let best = null, bestDist = Infinity;
      const pp = playerEntity(world);
      const px = pp ? world.get(pp.id, Position)?.x ?? 0 : 0;
      const py = pp ? world.get(pp.id, Position)?.y ?? 0 : 0;
      for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
        if (ni.identity === 'stair_down') {
          const d = Math.abs(pos.x - px) + Math.abs(pos.y - py);
          if (d < bestDist) { bestDist = d; best = pos; }
        }
      }
      if (best) {
        cam._detached = true;
        console.log(`[DEBUG] Easing to stair_down at (${best.x}, ${best.y})`);
        easeTo(cam, { x: best.x, y: best.y, dur: 0.8 });
      } else {
        console.warn('[DEBUG] No stair_down entity found on this floor!');
      }
    }
    e.preventDefault(); return;
  }
  if ((key || "").toLowerCase() === "x") { startShake(cam, 6, 0.35); e.preventDefault(); return; }
});

// Cache WorldView per rules step; if the sim hasn't advanced, reuse the view
let _cachedView = null; let _cachedStep = -1;
function getCachedView() {
  const step = world.step | 0;
  if (!_cachedView || step !== _cachedStep) {
    _cachedView = buildWorldView(world);
    _cachedStep = step;
  }
  return _cachedView;
}

// Cache FOV between frames; recompute when world turn changes or player moves.
// (FOV/Lightmask were removed per request; focusing strictly on tuning existing features.)

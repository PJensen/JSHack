// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "./main/scheduler.js";
import { playerEntity, findNearestValidTileAround } from "./rules/utils/queries.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera, clientToWorld as cameraClientToWorld } from "./display/camera/controller.js";
import { updateShake, startShake } from "./display/camera/shake.js";
import { zoomTo } from "./display/camera/utils.js";

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
import { createActiveSpellController } from "./main/spells/activeSpellController.js";
import { applyDebugCommands } from "./main/debug/debugCommands.js";
import { installSceneControls } from "./main/debug/sceneControls.js";
import { createCanvasSetup } from "./main/bootstrap/canvasSetup.js";
import { installInventoryDataProvider } from "./main/ui/inventoryDataProvider.js";
import { createThrowFxController } from "./main/fx/throwFxController.js";
import { readRuntimeConfig } from "./main/config/runtimeConfig.js";
import { createMessageLog } from "./main/ui/messageLog.js";
import { installDeityUiWiring } from "./main/wiring/deityUiWiring.js";
import { installMessageWiring } from "./main/wiring/messageWiring.js";
import { installShopWiring } from "./main/wiring/shopWiring.js";
import { installChestWiring } from "./main/wiring/chestWiring.js";
import { installAlchemyWiring } from "./main/wiring/alchemyWiring.js";
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
  findInventoryStackTargetForItem,
} from "./rules/utils/inventoryStacking.js";
import { Engraving } from "./rules/components/Engraving.js";
import { Pet } from "./rules/components/Pet.js";
import { PetState } from "./rules/components/PetState.js";
import { PetCommandIntent } from "./rules/components/Intents/PetCommandIntent.js";
import { Owner } from "./rules/components/Owner.js";
import { Hunger } from "./rules/components/Hunger.js";
import { getHungerLevel } from "./rules/data/food.js";
import { resolveItemDisplayName } from "./main/wiring/itemName.js";
import { resetIdentification, identify, restoreIdentification } from "./rules/data/identification.js";
import { initGemPricing, restoreGemPricing } from "./rules/data/gemPricing.js";
import { createRng } from "./lib/ecs-js/rng.js";

// ---- Config & canvas -------------------------------------------------------
const runtimeConfig = readRuntimeConfig();
const PERF = runtimeConfig.perf;
const chosenDeityId = runtimeConfig.chosenDeityId;
const TILE_PX = 28;

const _canvasSetup = createCanvasSetup({ canvasId: 'stage', TILE_PX, dprCap: PERF.dprCap });
const { canvas, ctx, back, bctx } = _canvasSetup;

// Lock down browser-driven inputs/scroll/zoom so the app fully controls them
enableInputLockdown({ canvas });

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
  } catch (e) { console.debug('[main] boot progress update failed:', e); }
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
  } catch (e) { console.debug('[main] boot done callback failed:', e); }
}

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
const throwFx = createThrowFxController({ world });

function getTargetedSpellConfig(spellId) {
  return TARGETED_SPELL_CONFIG[String(spellId || "").toLowerCase()] || null;
}
function computeThrowRange(weight) { return throwFx.computeThrowRange(weight); }
function isSimUiBlocked() { return throwFx.isBlocking(); }

const spellCtrl = createActiveSpellController(world);

// Initialize HUD feed updaters with stamina support
const hudFeeds = createHudFeeds(world, { getPlayerMana: spellCtrl.getPlayerMana });

function ensureActiveSpell() {
  const id = spellCtrl.ensureActiveSpell();
  _activeSpellId = spellCtrl.getActiveSpellId();
  return id;
}
function setActiveSpell(id) {
  spellCtrl.setActiveSpell(id);
  _activeSpellId = spellCtrl.getActiveSpellId();
  if (_pendingSpellTargeting && _pendingSpellTargeting.spellId !== _activeSpellId) {
    _pendingSpellTargeting = null;
  }
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
    if (typeof savedSpell === "string" && savedSpell.length > 0) { _activeSpellId = savedSpell; spellCtrl.setActiveSpell(savedSpell); }
    _savegameLoaded = true;
    updateBootProgress("Loaded save snapshot", _bootDoneUnits);
  } catch (err) {
    console.error("[SAVE] Failed to apply snapshot, continuing as new game.", err);
    clearSavegamePayload();
    _activeSpellId = null; spellCtrl.setActiveSpell(null);
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
      if (runtimeConfig.debug) console.log(`[DUNGEON] ${ni.identity} entity #${id} at (${pos.x}, ${pos.y})`);
      stairCount++;
    }
  }
  if (stairCount === 0 && runtimeConfig.debug) console.warn('[DUNGEON] WARNING: No stair entities were created!');
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
      } catch (e) { console.debug('[main] dispatch ui:petExists:', e); }
    }
  }

  applyDebugCommands({ world, runtimeConfig });
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
          } catch (e) { console.debug('[main] emit chest:open failed:', e); }
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

const { buildGroundPickupDetailAt } = installInventoryDataProvider({
  world,
  getActiveSpellId: () => _activeSpellId,
  isSimUiBlocked,
  messageLog,
  tombstoneRepo,
});

// Active spell button click → cast (or open spell picker if none active)
addEventListener('ui:castActiveSpell', () => {
  if (isSimUiBlocked()) return;
  const id = ensureActiveSpell();
  if (!id) {
    try { window.dispatchEvent(new CustomEvent('ui:openSpellPicker')); } catch (e) { console.debug('[main] dispatch ui:openSpellPicker:', e); }
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
      try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
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
    } catch (e) { console.debug('[main] messageLog failed:', e); }
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
    try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
    return;
  }
  if (_pendingThrowTargeting) {
    const itemName = _pendingThrowTargeting.itemName;
    _pendingThrowTargeting = null;
    ev.preventDefault();
    try { messageLog.log({ text: `${bracketizeName(itemName)} throw cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
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
        try { world.emit?.('item:pickup', { actor: pe.id, itemId: id, count }); } catch (e) { console.debug('[main] emit item:pickup failed:', e); }
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
  const spells = spellCtrl.learnedSpells();
  const activeSpellId = ensureActiveSpell();
  try { window.dispatchEvent(new CustomEvent('ui:spellData', { detail: { spells, activeSpellId } })); } catch (e) { console.debug('[main] dispatch ui:spellData:', e); }
});
addEventListener('ui:selectActiveSpell', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const spellId = e?.detail?.spellId;
  if (typeof spellId === 'string' && spellId.length) {
    setActiveSpell(spellId);
    // Refresh inventory so the brain-slot active marker updates
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
  }
});

// Basic app-side message log collector (bridge-free for now)
const messageLog = createMessageLog({
  maxEntries: 50,
  onUpdate: (entries) => {
    try { window.dispatchEvent(new CustomEvent('ui:updateMessageTicker', { detail: { entries } })); } catch (e) { console.debug('[main] dispatch ui:updateMessageTicker:', e); }
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
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch (e) { console.debug('[main] dispatch ui:itemUsed:', e); }
});
// Bolt segments for display VFX (world-space; display-only state)
/** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number, chainIndex:number}>} */
const _boltFx = [];
/** @type {Array<{x:number,y:number, ttl:number}>} */
const _lightPulses = [];
/**
 * Wrath effects are intentionally data-driven so gods can use different visuals later.
 * `behavior` is the switch for future non-lightning wrath spell families.
 */
const DEITY_WRATH_VFX = Object.freeze({
  default: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([95, 165, 255]),
    mid: Object.freeze([170, 220, 255]),
    core: Object.freeze([235, 250, 255]),
    pulse: Object.freeze([210, 245, 255]),
    spark: Object.freeze([130, 210, 255]),
    baseShake: 5,
  }),
  molkhar: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([255, 85, 40]),
    mid: Object.freeze([255, 170, 95]),
    core: Object.freeze([255, 240, 220]),
    pulse: Object.freeze([255, 205, 150]),
    spark: Object.freeze([255, 155, 90]),
    baseShake: 6,
  }),
  seraphine: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([110, 180, 255]),
    mid: Object.freeze([185, 225, 255]),
    core: Object.freeze([245, 255, 255]),
    pulse: Object.freeze([225, 250, 255]),
    spark: Object.freeze([165, 220, 255]),
    baseShake: 5,
  }),
  loki: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([145, 105, 255]),
    mid: Object.freeze([205, 165, 255]),
    core: Object.freeze([250, 240, 255]),
    pulse: Object.freeze([230, 205, 255]),
    spark: Object.freeze([195, 145, 255]),
    baseShake: 6,
  }),
  gaia: Object.freeze({
    behavior: 'lightning_bolt',
    outer: Object.freeze([95, 185, 140]),
    mid: Object.freeze([165, 225, 185]),
    core: Object.freeze([240, 255, 245]),
    pulse: Object.freeze([205, 245, 220]),
    spark: Object.freeze([140, 210, 165]),
    baseShake: 5,
  }),
});
/** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number, amp:number, branch:boolean, outer:[number,number,number], mid:[number,number,number], core:[number,number,number]}>} */
const _deityWrathBoltFx = [];
/** @type {Array<{x:number,y:number, ttl:number, max:number, pulse:[number,number,number]}>} */
const _deityWrathPulses = [];
/** @type {Array<{ttl:number, max:number, color:[number,number,number]}>} */
const _deityWrathScreenFlash = [];
/** @type {Array<{x:number,y:number, ttl:number, max:number, amp:number, color:[number,number,number]}>} */
const _deityWrathScreenBoltFx = [];

/**
 * @param {number} v
 */
function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * @param {string} deityId
 */
function getWrathVfxProfile(deityId) {
  const key = String(deityId || '').toLowerCase();
  return DEITY_WRATH_VFX[key] || DEITY_WRATH_VFX.default;
}

/**
 * Spawn downward "sky strike" lightning for deity wrath.
 * Origin is fixed at y=0 and x=player.x, then forks downward to the target.
 * @param {{ playerId:number, deityId?:string, intensity?:number, severityScale?:number, wrathDebt?:number }} payload
 */
function spawnDeityWrathLightning(payload) {
  const playerId = Number(payload?.playerId || 0) | 0;
  if (!(playerId > 0)) return;
  const pos = world.get(playerId, Position);
  if (!pos) return;

  const x = Number(pos.x);
  const yTarget = Number(pos.y);
  if (!Number.isFinite(x) || !Number.isFinite(yTarget)) return;

  const profile = getWrathVfxProfile(payload?.deityId || '');
  if (profile.behavior !== 'lightning_bolt') return;

  const intensity = clamp01(Number(payload?.intensity || 0));
  const severityScale = Math.max(1, Number(payload?.severityScale || 1));
  const wrathDebt = Math.max(0, Number(payload?.wrathDebt || 0));

  const ttlMain = 0.28
    + Math.min(0.14, intensity * 0.10)
    + Math.min(0.14, (severityScale - 1) * 0.08);
  const mainAmp = 0.08 + Math.min(0.18, (severityScale - 1) * 0.08 + wrathDebt * 0.03);

  _deityWrathBoltFx.push({
    from: { x, y: 0 },
    to: { x, y: yTarget },
    ttl: ttlMain,
    max: ttlMain,
    amp: mainAmp,
    branch: false,
    outer: profile.outer,
    mid: profile.mid,
    core: profile.core,
  });
  _deityWrathPulses.push({
    x,
    y: yTarget,
    ttl: 0.32,
    max: 0.32,
    pulse: profile.pulse,
  });
  _deityWrathScreenBoltFx.push({
    x,
    y: yTarget,
    ttl: ttlMain + 0.12,
    max: ttlMain + 0.12,
    amp: 6 + Math.min(10, (severityScale - 1) * 5 + wrathDebt * 2.5),
    color: profile.core,
  });

  const branchCount = Math.max(2, 2 + Math.floor((severityScale - 1) * 3 + Math.min(3, wrathDebt * 2)));
  for (let i = 0; i < branchCount; i++) {
    const tStart = 0.12 + Math.random() * 0.68;
    const yStart = yTarget * tStart;
    const xStart = x + (Math.random() - 0.5) * 0.26;
    const yEnd = Math.min(yTarget + 1.6, yStart + 0.9 + Math.random() * (2.4 + severityScale));
    const xEnd = xStart + (Math.random() - 0.5) * (0.8 + severityScale * 0.35);
    const ttl = ttlMain * (0.65 + Math.random() * 0.25);
    _deityWrathBoltFx.push({
      from: { x: xStart, y: yStart },
      to: { x: xEnd, y: yEnd },
      ttl,
      max: ttl,
      amp: mainAmp * 0.75,
      branch: true,
      outer: profile.outer,
      mid: profile.mid,
      core: profile.core,
    });
    _deityWrathPulses.push({
      x: xEnd,
      y: yEnd,
      ttl: 0.16 + Math.random() * 0.12,
      max: 0.26,
      pulse: profile.pulse,
    });
  }

  if (fx?.pool) {
    const lineLength = Math.max(1, Math.abs(yTarget));
    const sparkCount = Math.max(14, Math.round(lineLength * (0.7 + Math.min(2.2, severityScale))));
    for (let i = 0; i < sparkCount; i++) {
      const t = Math.random();
      fx.pool.spawn({
        x: x + (Math.random() - 0.5) * 0.34,
        y: yTarget * t + (Math.random() - 0.5) * 0.08,
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.8 + Math.random() * (2.1 + severityScale),
        ax: 0,
        ay: 0.9,
        life: 0.14 + Math.random() * 0.26,
        size0: 0.06 + Math.random() * 0.05,
        size1: 0.01,
        r: profile.spark[0],
        g: profile.spark[1],
        b: profile.spark[2],
        a0: 0.82,
        a1: 0.0,
        rot: 0,
        rotVel: (Math.random() - 0.5) * 2.4,
      });
    }
  }

  const shakePower = Math.min(
    12,
    Math.round(profile.baseShake + intensity * 3 + (severityScale - 1) * 4 + Math.min(2.5, wrathDebt * 1.5))
  );
  const shakeDur = 0.14 + Math.min(0.18, intensity * 0.07 + (severityScale - 1) * 0.05);
  startShake(cam, shakePower, shakeDur);

  const flashDuration = 0.12 + Math.min(0.12, intensity * 0.06 + (severityScale - 1) * 0.04);
  _deityWrathScreenFlash.push({
    ttl: flashDuration,
    max: flashDuration,
    color: profile.pulse,
  });
}

world.on('spell:bolt', ({ actor, targetId, spellId, from, to, chainIndex=0 }) => {
  if (from && to) {
    _boltFx.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, ttl: 0.14, max: 0.14, chainIndex: Number(chainIndex||0) });
    _lightPulses.push({ x: to.x, y: to.y, ttl: 0.12 });
    startShake(cam, 4, 0.18);
  }
});
world.on('deity:wrath', ({ playerId, deityId, intensity, severityScale, wrathDebt }) => {
  spawnDeityWrathLightning({
    playerId: Number(playerId || 0),
    deityId: String(deityId || ''),
    intensity: Number(intensity || 0),
    severityScale: Number(severityScale || 1),
    wrathDebt: Number(wrathDebt || 0),
  });
});
// Blink VFX (world-space; display-only state)
/** @type {Array<{from:{x:number,y:number}, to:{x:number,y:number}, ttl:number, max:number, phase:number, randomized:boolean}>} */
const _blinkFx = [];

function spawnBlinkBurst(x, y, intensity = 1) {
  const scale = PERF.quality === 'low' ? 0.7 : (PERF.quality === 'high' ? 1.2 : 1.0);
  const count = Math.max(4, Math.round((8 + intensity * 8) * scale));
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.4;
    const speed = 0.45 + Math.random() * 1.35;
    const life = 0.16 + Math.random() * 0.28;
    fx.pool.spawn({
      x: x + (Math.random() - 0.5) * 0.12,
      y: y + (Math.random() - 0.5) * 0.12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.05,
      ax: 0,
      ay: 0.12,
      life,
      size0: 0.09 + Math.random() * 0.09,
      size1: 0.02,
      r: 130 + ((Math.random() * 50) | 0),
      g: 210 + ((Math.random() * 40) | 0),
      b: 255,
      a0: 0.92,
      a1: 0.0,
      rot: 0,
      rotVel: (Math.random() - 0.5) * 2.2,
    });
  }
}

world.on('spell:blink', ({ from, to, randomized }) => {
  if (!from || !to) return;
  if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return;
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return;

  const src = { x: from.x, y: from.y };
  const dst = { x: to.x, y: to.y };
  _blinkFx.push({
    from: src,
    to: dst,
    ttl: 0.26,
    max: 0.26,
    phase: Math.random() * Math.PI * 2,
    randomized: !!randomized,
  });

  const intensity = randomized ? 1.15 : 1.0;
  spawnBlinkBurst(src.x, src.y, intensity);
  spawnBlinkBurst(dst.x, dst.y, intensity);

  const dx = dst.x - src.x;
  const dy = dst.y - src.y;
  const dist = Math.hypot(dx, dy);
  const sparkleCount = Math.max(6, Math.min(22, Math.round(dist * 1.8)));
  const sparkScale = PERF.quality === 'low' ? 0.6 : 1.0;
  const sparkleCountScaled = Math.max(4, Math.round(sparkleCount * sparkScale));
  for (let i = 0; i < sparkleCountScaled; i++) {
    const t = (i + Math.random()) / Math.max(1, sparkleCountScaled);
    const x = src.x + dx * t + (Math.random() - 0.5) * 0.18;
    const y = src.y + dy * t + (Math.random() - 0.5) * 0.18;
    fx.pool.spawn({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      ax: 0,
      ay: 0.04,
      life: 0.10 + Math.random() * 0.20,
      size0: 0.05 + Math.random() * 0.04,
      size1: 0.01,
      r: 190 + ((Math.random() * 40) | 0),
      g: 235 + ((Math.random() * 20) | 0),
      b: 255,
      a0: 0.7,
      a1: 0.0,
      rot: 0,
      rotVel: 0,
    });
  }

  startShake(cam, randomized ? 4 : 3, randomized ? 0.14 : 0.12);
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

throwFx.installListeners();

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
    try { ftext.addHeal(pos.x, pos.y, amount, { color: '#7BFF7B' }); } catch (e) { console.debug('[main] ftext failed:', e); }
  }
});
// Pet death UI notification (message handled in messageWiring)
world.on('died', ({ id }) => {
  if (world.has(id, Pet)) {
    try {
      window.dispatchEvent(new CustomEvent('ui:petExists', {
        detail: { exists: false }
      }));
    } catch (e) { console.debug('[main] dispatch ui:petExists:', e); }
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
  try { ftext.addStatus(pos.x, pos.y, label, { style }); } catch (e) { console.debug('[main] ftext failed:', e); }
});
// Ranged combat floating text (messages handled in messageWiring)
world.on('ranged:no-ammo', ({ attacker }) => {
  const pos = world.get(Number(attacker||0), Position);
  if (pos) try { ftext.addStatus(pos.x, pos.y, 'NO AMMO', { style: 'status' }); } catch (e) { console.debug('[main] ftext failed:', e); }
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
    try { ftext.addStatus(pos.x, pos.y - 0.3, line, { color: '#ff8c00', life: 1.0 }); } catch (e) { console.debug('[main] ftext failed:', e); }
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
  } catch (e) { console.debug('[main] dispatch ui:recentPickup:', e); }
});
// Pet deliver UI refresh (message handled in messageWiring)
world.on('pet:deliver', ({ petId, actor, itemId, itemName, count }) => {
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});

// Pet state UI updates (messages handled in messageWiring)
world.on('pet:state:changed', ({ newState }) => {
  try {
    window.dispatchEvent(new CustomEvent('ui:updatePetButton', {
      detail: { state: newState }
    }));
  } catch (e) { console.debug('[main] dispatch ui:updatePetButton:', e); }
});

world.on('pet:state:auto', ({ newState }) => {
  try {
    window.dispatchEvent(new CustomEvent('ui:updatePetButton', {
      detail: { state: newState }
    }));
  } catch (e) { console.debug('[main] dispatch ui:updatePetButton:', e); }
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
      } catch (e) { console.debug('[main] emit pet:state:changed failed:', e); }
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
      } catch (e) { console.debug('[main] emit pet:state:changed failed:', e); }
    }

    break; // Only one pet for now
  }
});

// Engrave floating text (messages handled in messageWiring)
world.on('engrave', ({ text, x, y }) => {
  try { ftext.addStatus(x, y - 0.3, `"${text}"`, { color: '#8899aa', life: 1.2 }); } catch (e) { console.debug('[main] ftext failed:', e); }
});

// Refresh inventory UI when any item is used (consumed/learned/etc.)
world.on('item:used', ({ actor, itemId }) => {
  // Dismiss the quick-slot chip for this item
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch (e) { console.debug('[main] dispatch ui:itemUsed:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
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
    } catch (e) { console.debug('[main] dispatch ui:showSpellGestureHint:', e); }
  }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
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
      } catch (e) { console.debug('[main] dispatch ui:showGroundItem:', e); }
    } else if (nonCurrency.length > 1) {
      try {
        window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items: nonCurrency } }));
      } catch (e) { console.debug('[main] dispatch ui:openPickupChooser:', e); }
    }
  }
});

// Harvest updates: refresh inventory UI after gather actions.
// Deferred so the tick's command queue (component adds) flushes first.
world.on('harvest:picked', ({ actor, count, kind }) => {
  setTimeout(() => {
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
    try { window.dispatchEvent(new CustomEvent('ui:requestUsableItemsData')); } catch (e) { console.debug('[main] dispatch ui:requestUsableItemsData:', e); }
  }, 0);
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  const qty = Math.max(1, Number(count || 1) | 0);
  const k = String(kind || '').toLowerCase();
  const labels = (
    k === 'herbs'
      ? { one: 'herb', many: 'herbs' }
      : (k === 'thorn_bramble'
        ? { one: 'thorn pod', many: 'thorn pods' }
        : (k === 'venom_fern'
          ? { one: 'venom frond', many: 'venom fronds' }
          : { one: 'berry', many: 'berries' }))
  );
  const label = qty === 1 ? labels.one : labels.many;
  try { ftext.addStatus(pe.pos.x, pe.pos.y - 0.3, `+${qty} ${label}`, { color: '#b6e38d', life: 1.0 }); } catch (e) { console.debug('[main] ftext failed:', e); }
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
    try { world.set(id, DungeonState, ds); } catch {} // ECS: component may not exist
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
    try { world.set(id, DungeonState, ds); } catch {} // ECS: component may not exist
    break;
  }
}

function destroyReturnPortals() {
  const ids = [];
  for (const [id, ni] of world.query(NamedIdentity)) {
    if (ni?.identity === RETURN_PORTAL_IDENTITY) ids.push(id);
  }
  for (const id of ids) {
    try { world.destroy(id); } catch {} // ECS: entity may already be destroyed
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
  } catch (e) { console.debug('[main] emit portal:spawned failed:', e); }
  return portalId;
}

function fragActorsAt(worldRef, x, y, excludeId = 0) {
  const tx = Math.floor(Number(x));
  const ty = Math.floor(Number(y));
  let count = 0;
  for (const [id, pos, _vit] of worldRef.query(Position, Vitality)) {
    if (id === excludeId) continue;
    if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
    try { worldRef.destroy(id); } catch {} // ECS: entity may already be destroyed
    untrackCurrentFloorEntity(id);
    count++;
  }
  if (count > 0) {
    try { worldRef.emit?.('portal:return:fragged', { count, at: { x: tx, y: ty } }); } catch (e) { console.debug('[main] emit portal:return:fragged failed:', e); }
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
  try { world.destroy(pid); } catch {} // ECS: entity may already be destroyed
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
installAlchemyWiring({
  world,
  playerEntity,
  dispatchRules: (action) => {
    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    rulesHandler(action);
  },
  log: (msg) => messageLog.log({ text: msg, type: "system" }),
});
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
  try { window.dispatchEvent(new CustomEvent('ui:itemEquipped', { detail: { itemId } })); } catch (e) { console.debug('[main] dispatch ui:itemEquipped:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});
world.on('item:unequipped', ({ itemId }) => {
  try { window.dispatchEvent(new CustomEvent('ui:itemUnequipped', { detail: { itemId } })); } catch (e) { console.debug('[main] dispatch ui:itemUnequipped:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});

// When player moves, show a mobile-friendly ground item tooltip for non-currency items on the tile
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  const detail = buildGroundPickupDetailAt(pe.id, to.x, to.y);
  if (!detail) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch (e) { console.debug('[main] dispatch ui:hideGroundItem:', e); }
    return;
  }
  try { window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail })); } catch (e) { console.debug('[main] dispatch ui:showGroundItem:', e); }
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
    } catch (e) { console.debug('[main] dispatch ui:showStairTooltip:', e); }
  } else {
    try { window.dispatchEvent(new CustomEvent('ui:hideStairTooltip')); } catch (e) { console.debug('[main] dispatch ui:hideStairTooltip:', e); }
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
    } catch (e) { console.debug('[main] dispatch ui:showTombstoneTooltip:', e); }
  } else {
    try { window.dispatchEvent(new CustomEvent('ui:hideTombstoneTooltip')); } catch (e) { console.debug('[main] dispatch ui:hideTombstoneTooltip:', e); }
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

// Refresh ground tooltip after pickups so remaining items stay discoverable.
world.on('item:pickup', ({ actor, itemId }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  const detail = buildGroundPickupDetailAt(pe.id, pe.pos.x, pe.pos.y);
  if (detail) {
    try { window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail })); } catch (e) { console.debug('[main] dispatch ui:showGroundItem:', e); }
  } else {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch (e) { console.debug('[main] dispatch ui:hideGroundItem:', e); }
  }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
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
    try { messageLog.log({ text: 'You are not carrying that item.', type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
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
  } catch (e) { console.debug('[main] messageLog failed:', e); }
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
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
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

  const [wx, wy] = cameraClientToWorld(cam, ev.clientX, ev.clientY, canvas);
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
      } catch (e) { console.debug('[main] messageLog failed:', e); }
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
        } catch (e) { console.debug('[main] messageLog failed:', e); }
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
    } catch (e) { console.debug('[main] messageLog failed:', e); }
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

// Per-entity particle emitter tracking sets (display-only, reconciled each frame)
const _burningEmitters = new Set();
const _bleedEmitters   = new Set();
const _poisonEmitters  = new Set();
const _regenEmitters   = new Set();
const _shockEmitters   = new Set();
const _frozenEmitters  = new Set();
const _cursedEmitters  = new Set();
const _blessedEmitters = new Set();

/** Reconcile a per-entity continuous particle emitter for one status tag. */
function reconcileStatusEmitter(view, fx, origins, trackerSet, tag, prefix, cfg) {
  const nowActive = new Set();
  for (let i = 0; i < view.entities.length; i++) {
    const e = view.entities[i];
    if (Array.isArray(e.tags) && e.tags.includes(tag)) {
      nowActive.add(e.id);
      if (!trackerSet.has(e.id)) {
        fx.ensureEmitter(`${prefix}:${e.id}`, { continuous: true, ...cfg });
        trackerSet.add(e.id);
      }
      origins.push({ key: `${prefix}:${e.id}`, x: e.pos.x, y: e.pos.y });
    }
  }
  for (const id of trackerSet) {
    if (!nowActive.has(id)) {
      fx.removeEmitter(`${prefix}:${id}`);
      trackerSet.delete(id);
    }
  }
}

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
} catch (e) { console.debug('[main] float_text global setup failed:', e); }

// ---- Visual mappings (display contract) ------------------------------------
const palette = buildPalette();
const glyphAtlas = createGlyphAtlas(palette, { glowLayers: PERF.glowLayers, sizePx: (PERF.quality==='low'?32:64), fontPx: (PERF.quality==='low'?28:56) });
bootAdvance("Prepared render resources");

// ---- Render (display-only; consumes WorldView DTO) -------------------------
let _bgGradH = 0; let _bgGrad = null;
let _fxTime = 0; // display-side time accumulator for simple glyph FX
function render(worldView) {
  const W = _canvasSetup.cssW;
  const H = _canvasSetup.cssH;

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
    if (throwFx.isItemHidden(e.id)) continue;
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

    // Glyph-FX: frozen — pulsing icy blue radial glow (outer halo + bright inner core)
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('frozen')) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 1.4);
      const cx = e.pos.x, cy = e.pos.y;
      // Outer halo — wide, soft
      const rOuter = 0.70 + 0.08 * pulse;
      const outer = bctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
      outer.addColorStop(0,   `rgba(160,230,255,${(0.45 + 0.20 * pulse).toFixed(3)})`);
      outer.addColorStop(0.5, `rgba(80,180,255,${(0.20 + 0.10 * pulse).toFixed(3)})`);
      outer.addColorStop(1,   'rgba(40,120,255,0)');
      bctx.fillStyle = outer;
      bctx.beginPath();
      bctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      bctx.fill();
      // Inner core — tight, bright
      const rInner = 0.28 + 0.04 * pulse;
      const inner = bctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
      inner.addColorStop(0, `rgba(220,245,255,${(0.55 + 0.25 * pulse).toFixed(3)})`);
      inner.addColorStop(1, 'rgba(100,200,255,0)');
      bctx.fillStyle = inner;
      bctx.beginPath();
      bctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }

    // Glyph-FX: electric shock — soft aura with sparks orbiting outside the glyph
    // Glyph-FX: electric shock — chaotic arcs from center, geometry rerolled every discharge
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('shocked')) {
      bctx.save();
      const cx = e.pos.x, cy = e.pos.y;
      const _sid = (e.id || 0) | 0;
      // Static hash: stable per-arc properties (base angle, frequency, phase)
      const _sh  = (n) => ((Math.imul(n * 73 + 1, 2654435761) ^ Math.imul(_sid | 1, 1664525)) >>> 0) / 4294967296;
      // Fire-event hash: rerolls geometry on every new discharge
      const _shF = (i, fi, s) => ((Math.imul((i * 97 + fi * 31 + s + 1) * 73 + 1, 2654435761) ^ Math.imul(_sid | 1, 1664525)) >>> 0) / 4294967296;

      bctx.globalCompositeOperation = 'lighter';
      bctx.lineCap = 'round'; bctx.lineJoin = 'round';

      // Soft ambient glow
      const _aura = 0.60 + 0.40 * Math.sin(_fxTime * 2.3 + _sh(99) * Math.PI * 2);
      const _fg = bctx.createRadialGradient(cx, cy, 0.05, cx, cy, 0.80);
      _fg.addColorStop(0,   `rgba(100,210,255,${(0.22 * _aura).toFixed(3)})`);
      _fg.addColorStop(0.6, `rgba(40,140,220,${(0.08 * _aura).toFixed(3)})`);
      _fg.addColorStop(1,   'rgba(0,80,200,0)');
      bctx.fillStyle = _fg;
      bctx.beginPath(); bctx.arc(cx, cy, 0.80, 0, Math.PI * 2); bctx.fill();

      // 14 arcs — each fires at its own rate, geometry randomised per discharge
      for (let _i = 0; _i < 14; _i++) {
        const _baseAng = _sh(_i * 5 + 1) * Math.PI * 2;   // stable base direction
        const _freq    = 3.0 + _sh(_i * 5 + 2) * 10.0;   // 3–13 Hz, wide spread
        const _phase   = _sh(_i * 5 + 3) * Math.PI * 2;
        const _bright  = Math.max(0, Math.sin(_fxTime * _freq + _phase));
        if (_bright < 0.05) continue;

        // Fire-event counter — integer that increments each new discharge
        const _fi = Math.floor(_fxTime * _freq + _phase) | 0;

        // Geometry rerolled every discharge via _shF
        const _ang  = _baseAng + (_shF(_i, _fi, 0) - 0.5) * 0.9;       // angle wobbles ±0.45 rad
        const _len  = 0.35 + _shF(_i, _fi, 1) * 0.40;                  // 0.35–0.75
        const _perp = _ang + Math.PI / 2;
        // Two kink points — independently jittered perpendicular each fire
        const _j1   = (_shF(_i, _fi, 2) - 0.5) * _len * 0.70;
        const _j2   = (_shF(_i, _fi, 3) - 0.5) * _len * 0.50;
        const _t1   = 0.30 + _shF(_i, _fi, 4) * 0.20;                  // kink 1 at 30–50%
        const _t2   = 0.62 + _shF(_i, _fi, 5) * 0.18;                  // kink 2 at 62–80%
        const _k1x  = cx + Math.cos(_ang) * _len * _t1 + Math.cos(_perp) * _j1;
        const _k1y  = cy + Math.sin(_ang) * _len * _t1 + Math.sin(_perp) * _j1;
        const _k2x  = cx + Math.cos(_ang) * _len * _t2 + Math.cos(_perp) * _j2;
        const _k2y  = cy + Math.sin(_ang) * _len * _t2 + Math.sin(_perp) * _j2;
        const _ex   = cx + Math.cos(_ang) * _len;
        const _ey   = cy + Math.sin(_ang) * _len;
        const _alpha = 0.55 + 0.45 * _bright;

        const _drawArc = () => { bctx.beginPath(); bctx.moveTo(cx, cy); bctx.lineTo(_k1x, _k1y); bctx.lineTo(_k2x, _k2y); bctx.lineTo(_ex, _ey); bctx.stroke(); };

        // Cyan glow
        bctx.save();
        bctx.globalAlpha = _alpha * 0.40;
        bctx.lineWidth = 0.12; bctx.strokeStyle = 'rgba(60,200,255,0.90)';
        _drawArc();
        bctx.restore();
        // White-hot core
        bctx.save();
        bctx.globalAlpha = _alpha;
        bctx.lineWidth = 0.045; bctx.strokeStyle = 'rgba(235,250,255,0.98)';
        _drawArc();
        bctx.restore();
        // Tip spark
        bctx.save();
        bctx.globalAlpha = _alpha * 0.85;
        bctx.fillStyle = 'rgba(210,245,255,0.95)';
        bctx.beginPath(); bctx.arc(_ex, _ey, 0.050, 0, Math.PI * 2); bctx.fill();
        bctx.restore();
      }

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

    // Glyph-FX: spinning 4-point stars above confused entities
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('confused')) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      bctx.lineWidth = 0.035;
      bctx.globalAlpha = 0.9;
      for (let j = 0; j < 3; j++) {
        const ang = _fxTime * 2.2 + (j / 3) * Math.PI * 2;
        const sx = e.pos.x + Math.cos(ang) * 0.32;
        const sy = e.pos.y + Math.sin(ang) * 0.12 - 0.52; // flattened orbit above head
        const r = 0.10;
        bctx.strokeStyle = j === 1 ? '#ffffff' : '#ffe033';
        bctx.beginPath();
        bctx.moveTo(sx - r, sy);           bctx.lineTo(sx + r, sy);
        bctx.moveTo(sx, sy - r);           bctx.lineTo(sx, sy + r);
        bctx.moveTo(sx - r*0.7, sy - r*0.7); bctx.lineTo(sx + r*0.7, sy + r*0.7);
        bctx.moveTo(sx + r*0.7, sy - r*0.7); bctx.lineTo(sx - r*0.7, sy + r*0.7);
        bctx.stroke();
      }
      bctx.restore();
    }

    // Glyph-FX: bleeding wound — pulsing red aura (particles handle the trail)
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('bleeding')) {
      bctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 7.0 + e.id * 0.3);
      bctx.globalCompositeOperation = 'source-over';
      bctx.fillStyle = `rgba(160,0,0,${(0.08 + 0.07 * pulse).toFixed(3)})`;
      bctx.beginPath();
      bctx.arc(e.pos.x, e.pos.y, 0.44 + 0.04 * pulse, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }
  }

  for (let i = 0; i < deferredItems.length; i++) {
    const e = deferredItems[i];
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);
  }

  if (bctx) throwFx.draw(bctx, worldView, glyphAtlas);

  // Spell bolt VFX (world-space additive glow)
  if (bctx) drawBoltEffects(bctx);
  if (bctx) drawDeityWrathEffects(bctx);
  if (bctx) drawBlinkEffects(bctx);
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

  // Screen-space wrath flash drawn after world present so lethal hits still read.
  if (_deityWrathScreenFlash.length) {
    drawDeityWrathScreenFlash(ctx, W, H);
  }
  if (_deityWrathScreenBoltFx.length) {
    drawDeityWrathScreenBolts(ctx, W, H);
  }

  // HUD
  if (PERF.quality !== 'low') {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#9cf";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
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
  updateDeityWrathFx(dtSec);
  updateBlinkFx(dtSec);
  updateMeteorFx(dtSec);
  updateBlastwaveFx(dtSec);
  updateFrostFx(dtSec);
  updateArrowFx(dtSec);
  throwFx.tick(dtSec);
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

  // Status particle emitter reconciliation + advance particles
  if (PERF.particleCapacity > 0) {
    const origins = [];
    reconcileStatusEmitter(view, fx, origins, _burningEmitters, 'burning', 'burn', {
      rate: 18, angle: -Math.PI / 2, spread: Math.PI / 5,
      speed: 0.8, speedJitter: 0.4, ax: 0, ay: -0.5,
      life: 0.7, lifeJitter: 0.3, size: 0.28, sizeEnd: 0.06,
      color: '#ff8c00', alpha0: 0.9, alpha1: 0.0, offsetX: 0, offsetY: -0.15,
    });
    reconcileStatusEmitter(view, fx, origins, _bleedEmitters, 'bleeding', 'bleed', {
      rate: 14, angle: Math.PI / 2, spread: Math.PI / 8,
      speed: 0.55, speedJitter: 0.3, ax: 0, ay: 1.2,
      life: 0.9, lifeJitter: 0.3, size: 0.14, sizeEnd: 0.05,
      color: '#bb1111', alpha0: 0.9, alpha1: 0.0,
    });
    reconcileStatusEmitter(view, fx, origins, _poisonEmitters, 'poisoned', 'poison', {
      rate: 8, angle: Math.PI / 2, spread: Math.PI / 6,
      speed: 0.3, speedJitter: 0.15, ax: 0, ay: 0.15,
      life: 1.0, lifeJitter: 0.4, size: 0.12, sizeEnd: 0.04,
      color: '#33ff55', alpha0: 0.8, alpha1: 0.0,
    });
    reconcileStatusEmitter(view, fx, origins, _regenEmitters, 'regen', 'regen', {
      rate: 10, angle: -Math.PI / 2, spread: Math.PI / 4,
      speed: 0.4, speedJitter: 0.15, ax: 0, ay: -0.1,
      life: 1.0, lifeJitter: 0.4, size: 0.10, sizeEnd: 0.02,
      color: '#44ff88', alpha0: 0.7, alpha1: 0.0,
    });
    reconcileStatusEmitter(view, fx, origins, _shockEmitters, 'shocked', 'shock', {
      rate: 30, angle: 0, spread: Math.PI * 2,
      speed: 1.2, speedJitter: 0.8, ax: 0, ay: 0,
      life: 0.2, lifeJitter: 0.1, size: 0.10, sizeEnd: 0.02,
      color: '#00ccff', alpha0: 1.0, alpha1: 0.0,
    });
    reconcileStatusEmitter(view, fx, origins, _frozenEmitters, 'frozen', 'frozen', {
      rate: 15, angle: 0, spread: Math.PI * 2,
      speed: 0.22, speedJitter: 0.14, ax: 0, ay: 0.04,
      life: 1.8, lifeJitter: 0.5, size: 0.12, sizeEnd: 0.04,
      color: '#aaeeff', alpha0: 0.6, alpha1: 0.0,
    });
    reconcileStatusEmitter(view, fx, origins, _cursedEmitters, 'cursed', 'cursed', {
      rate: 12, angle: -Math.PI / 2, spread: Math.PI,
      speed: 0.5, speedJitter: 0.3, ax: 0, ay: -0.25,
      life: 1.2, lifeJitter: 0.4, size: 0.14, sizeEnd: 0.02,
      color: '#8822cc', alpha0: 0.7, alpha1: 0.0,
    });
    reconcileStatusEmitter(view, fx, origins, _blessedEmitters, 'blessed', 'blessed', {
      rate: 10, angle: -Math.PI / 2, spread: Math.PI / 3,
      speed: 0.6, speedJitter: 0.2, ax: 0, ay: -0.35,
      life: 1.0, lifeJitter: 0.3, size: 0.09, sizeEnd: 0.02,
      color: '#ffcc00', alpha0: 0.8, alpha1: 0.0,
    });
    fx.step(dtSec, origins);
  }

  // Hallucination: Lissajous world-sway applied as a world-unit cam offset after follow.
  // cam.x/y are in world units; 0.15 ≈ 4px at default zoom — visually clear, not nauseating.
  if (view.player) {
    const pe = view.entities.find(e => e.id === view.player.id);
    if (pe && Array.isArray(pe.tags) && (pe.tags.includes('hallucinating') || pe.tags.includes('intoxicated'))) {
      cam.x += Math.sin(_fxTime * 0.27 * Math.PI * 2) * 0.15;
      cam.y += Math.sin(_fxTime * 0.41 * Math.PI * 2 + 1.3) * 0.15;
    }
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

/** @param {number} dt */
function updateDeityWrathFx(dt) {
  if (_deityWrathBoltFx.length) {
    for (let i = _deityWrathBoltFx.length - 1; i >= 0; i--) {
      const seg = _deityWrathBoltFx[i];
      seg.ttl -= dt;
      if (seg.ttl <= 0) _deityWrathBoltFx.splice(i, 1);
    }
  }
  if (_deityWrathPulses.length) {
    for (let i = _deityWrathPulses.length - 1; i >= 0; i--) {
      const pulse = _deityWrathPulses[i];
      pulse.ttl -= dt;
      if (pulse.ttl <= 0) _deityWrathPulses.splice(i, 1);
    }
  }
  if (_deityWrathScreenFlash.length) {
    for (let i = _deityWrathScreenFlash.length - 1; i >= 0; i--) {
      const flash = _deityWrathScreenFlash[i];
      flash.ttl -= dt;
      if (flash.ttl <= 0) _deityWrathScreenFlash.splice(i, 1);
    }
  }
  if (_deityWrathScreenBoltFx.length) {
    for (let i = _deityWrathScreenBoltFx.length - 1; i >= 0; i--) {
      const bolt = _deityWrathScreenBoltFx[i];
      bolt.ttl -= dt;
      if (bolt.ttl <= 0) _deityWrathScreenBoltFx.splice(i, 1);
    }
  }
}

/**
 * @param {[number, number, number]} rgb
 * @param {number} alpha
 */
function rgba(rgb, alpha) {
  const a = Math.max(0, Math.min(1, Number(alpha || 0)));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** @param {CanvasRenderingContext2D} ctx */
function drawDeityWrathEffects(ctx) {
  if (!_deityWrathBoltFx.length && !_deityWrathPulses.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let i = 0; i < _deityWrathPulses.length; i++) {
    const pulse = _deityWrathPulses[i];
    const a = Math.max(0, Math.min(1, pulse.ttl / Math.max(0.0001, pulse.max)));
    const outerR = 0.24 + (1 - a) * 0.7;
    const innerR = 0.08 + (1 - a) * 0.26;
    ctx.fillStyle = rgba(pulse.pulse, 0.16 * a);
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, outerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,245,${(0.12 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, innerR, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < _deityWrathBoltFx.length; i++) {
    const seg = _deityWrathBoltFx[i];
    const alpha = Math.max(0, Math.min(1, seg.ttl / Math.max(0.0001, seg.max)));
    const len = Math.max(1, Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y));
    const points = Math.max(8, Math.min(24, Math.floor(len * (seg.branch ? 1.3 : 1.6))));
    const pts = jitterLine(seg.from, seg.to, points, seg.amp * alpha);

    const widthScale = seg.branch ? 0.72 : 1.0;
    ctx.strokeStyle = rgba(seg.outer, 0.22 * alpha);
    ctx.lineWidth = 0.24 * widthScale;
    pathPolyline(ctx, pts);
    ctx.stroke();

    ctx.strokeStyle = rgba(seg.mid, 0.42 * alpha);
    ctx.lineWidth = 0.11 * widthScale;
    pathPolyline(ctx, pts);
    ctx.stroke();

    const core = jitterLine(seg.from, seg.to, points + 2, seg.amp * 0.45 * alpha);
    ctx.strokeStyle = rgba(seg.core, 0.95 * alpha);
    ctx.lineWidth = 0.05 * widthScale;
    pathPolyline(ctx, core);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawDeityWrathScreenFlash(ctx, width, height) {
  let strongest = null;
  for (let i = 0; i < _deityWrathScreenFlash.length; i++) {
    const flash = _deityWrathScreenFlash[i];
    if (!strongest || flash.ttl > strongest.ttl) strongest = flash;
  }
  if (!strongest) return;
  const a = Math.max(0, Math.min(1, strongest.ttl / Math.max(0.0001, strongest.max)));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(strongest.color, 0.18 * a);
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = `rgba(255,255,255,${(0.05 * a).toFixed(3)})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Screen-space fallback wrath bolt: guaranteed visible from top of viewport.
 * Keeps requested semantics: strike falls from y=0 with x aligned to player x.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawDeityWrathScreenBolts(ctx, width, height) {
  if (!_deityWrathScreenBoltFx.length) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const scale = Number(cam.scale || 1);

  for (let i = 0; i < _deityWrathScreenBoltFx.length; i++) {
    const bolt = _deityWrathScreenBoltFx[i];
    const alpha = Math.max(0, Math.min(1, bolt.ttl / Math.max(0.0001, bolt.max)));
    const sx = (bolt.x - cam.x) * scale + halfW;
    const sy = (bolt.y - cam.y) * scale + halfH;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
    if (sx < -80 || sx > width + 80 || sy < -120) continue;

    const endY = Math.max(0, Math.min(height + 120, sy));
    const start = { x: sx, y: 0 };
    const end = { x: sx + (Math.random() - 0.5) * 8, y: endY };
    const segments = Math.max(10, Math.min(26, Math.floor((endY / 34) + 10)));
    const pts = jitterLine(start, end, segments, bolt.amp * alpha);

    ctx.strokeStyle = rgba(bolt.color, 0.25 * alpha);
    ctx.lineWidth = 7.5;
    pathPolyline(ctx, pts);
    ctx.stroke();

    ctx.strokeStyle = rgba(bolt.color, 0.78 * alpha);
    ctx.lineWidth = 3.2;
    pathPolyline(ctx, pts);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,${(0.95 * alpha).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    pathPolyline(ctx, jitterLine(start, end, segments + 2, (bolt.amp * 0.42) * alpha));
    ctx.stroke();
  }

  ctx.restore();
}

/** @param {number} dt */
function updateBlinkFx(dt) {
  for (let i = _blinkFx.length - 1; i >= 0; i--) {
    _blinkFx[i].ttl -= dt;
    if (_blinkFx[i].ttl <= 0) _blinkFx.splice(i, 1);
  }
}

/** @param {CanvasRenderingContext2D} ctx */
function drawBlinkEffects(ctx) {
  if (!_blinkFx.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const TAU = Math.PI * 2;

  for (const eff of _blinkFx) {
    const alpha = Math.max(0, Math.min(1, eff.ttl / eff.max));
    const t = 1 - alpha;
    const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 15.0 + eff.phase);

    const dx = eff.to.x - eff.from.x;
    const dy = eff.to.y - eff.from.y;
    const dist = Math.hypot(dx, dy);
    const segments = Math.max(7, Math.min(18, Math.round(dist * 2.0)));
    const amp = (0.04 + pulse * 0.10) * alpha;
    const arc = jitterLine(eff.from, eff.to, segments, amp);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(130,220,255,${(0.22 * alpha).toFixed(3)})`;
    ctx.lineWidth = 0.18;
    pathPolyline(ctx, arc);
    ctx.stroke();

    ctx.strokeStyle = `rgba(210,245,255,${(0.80 * alpha).toFixed(3)})`;
    ctx.lineWidth = 0.045;
    pathPolyline(ctx, jitterLine(eff.from, eff.to, segments + 2, amp * 0.55));
    ctx.stroke();

    const sparkEvery = Math.max(1, Math.floor(arc.length / 6));
    for (let i = 1; i < arc.length - 1; i += sparkEvery) {
      const p = arc[i];
      if (!p) continue;
      const size = 0.03 + pulse * 0.03;
      ctx.fillStyle = `rgba(215,250,255,${(0.55 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, TAU);
      ctx.fill();
    }

    const fromR = 0.20 + t * 0.85 + pulse * 0.05;
    const toR = 0.24 + t * 1.05 + pulse * 0.06;
    const flare = eff.randomized ? 1.2 : 1.0;

    ctx.strokeStyle = `rgba(150,220,255,${(0.65 * alpha * flare).toFixed(3)})`;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(eff.from.x, eff.from.y, fromR, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eff.to.x, eff.to.y, toR, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = `rgba(230,250,255,${(0.20 * alpha * flare).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(eff.from.x, eff.from.y, Math.max(0.05, fromR * 0.42), 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eff.to.x, eff.to.y, Math.max(0.05, toR * 0.40), 0, TAU);
    ctx.fill();
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
// Initial world tick — runs all systems once so status effects, equipment stats,
// and other derived state are fully resolved before the first frame renders.
stepSim(1);

bootAdvance("Starting render loop");
requestAnimationFrame((now) => {
  frame(now);
  finishBoot();
});

installSceneControls({ world, cam, TILE_PX, messageLog, runtimeConfig });

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

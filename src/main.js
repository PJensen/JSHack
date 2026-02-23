// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "./main/scheduler.js";
import { playerEntity, findNearestValidTileAround } from "./rules/utils/queries.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera, clientToWorld as cameraClientToWorld } from "./display/camera/controller.js";
import { updateShake } from "./display/camera/shake.js";
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
import { createBoltFxController } from "./main/fx/boltFxController.js";
import { createProjectileFxController } from "./main/fx/projectileFx.js";
import { createSpellAreaFxController } from "./main/fx/spellAreaFx.js";
import { createCloudFxController } from "./main/fx/cloudFx.js";
import { readRuntimeConfig } from "./main/config/runtimeConfig.js";
import { createMessageLog } from "./main/ui/messageLog.js";
import { installDeityUiWiring } from "./main/wiring/deityUiWiring.js";
import { installMessageWiring } from "./main/wiring/messageWiring.js";
import { installShopWiring } from "./main/wiring/shopWiring.js";
import { installChestWiring } from "./main/wiring/chestWiring.js";
import { installRackWiring } from "./main/wiring/rackWiring.js";
import { installAlchemyWiring } from "./main/wiring/alchemyWiring.js";
import { installCookingWiring } from "./main/wiring/cookingWiring.js";
import { installDigWiring } from "./main/wiring/digWiring.js";
import { installFloatTextWiring } from "./main/wiring/floatTextWiring.js";
import { installEventUiWiring } from "./main/wiring/eventUiWiring.js";
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
import { Trap } from "./rules/components/Trap.js";
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
import { getClass, listClassIds } from "./rules/data/classes.js";
import { getDeity } from "./rules/data/deities.js";
import { showCharCreation } from "./display/ui/charCreation.js";

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
  TILE_GRASS_A,
  TILE_GRASS_C,
  TILE_GRASS_D,
  TILE_WATER,
  TILE_WATER_DEEP,
  TILE_MOUNTAIN,
  TILE_MOUNTAIN_B,
  TILE_MOUNTAIN_C,
  TILE_TREE,
} from "./rules/environment/dungeon/constants.js";
import { dungeonConfig } from "./rules/environment/dungeon/dungeonConfig.js";
const _tileKindMap = {
  [TILE_FLOOR]: 'floor',
  [TILE_WALL]: 'wall',
  [TILE_DOOR]: 'floor',
  [TILE_STAIR_DOWN]: 'stair_down',
  [TILE_STAIR_UP]: 'stair_up',
  [TILE_GRASS]:   'grass',
  [TILE_GRASS_A]: 'grass_a',
  [TILE_GRASS_C]: 'grass_c',
  [TILE_GRASS_D]: 'grass_d',
  [TILE_WATER]:      'water',
  [TILE_WATER_DEEP]: 'water_deep',
  [TILE_MOUNTAIN]:   'mountain',
  [TILE_MOUNTAIN_B]: 'mountain_b',
  [TILE_MOUNTAIN_C]: 'mountain_c',
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

// _finalizeNewGame: called after character creation confirms (new game)
// or immediately (savegame loaded). Creates the player, applies class loadout,
// initializes deity, then starts the simulation and render loop.
function _finalizeNewGame(classData) {
  const classDef = classData ? getClass(classData.classId) : null;

  if (!_savegameLoaded) {
    const stats = classDef?.stats ?? {};

    // Create player at the spawn position with class stats
    if (!playerEntity(world)) {
      createPlayer(world, {
        x: spawnPos.x, y: spawnPos.y,
        name: classData?.name ?? "Hero",
        identity: classDef ? `player_${classDef.id}` : "player",
        maxHp: stats.maxHp ?? 20,
        maxStamina: stats.maxStamina ?? 100,
        staminaRegen: stats.staminaRegen ?? 2.0,
      });
    }

    const pe = playerEntity(world);
    if (pe) {
      // Mana from class
      world.add(pe.id, Mana, {
        mana: stats.maxMana ?? 50,
        maxMana: stats.maxMana ?? 50,
        manaRegen: stats.manaRegen ?? 0.1,
      });
      // 10-turn invulnerability at start
      const ae = world.get(pe.id, ActiveEffects);
      if (ae && Array.isArray(ae.effects)) {
        ae.effects.push({ key: 'invulnerable', turnsLeft: 10, potency: 1 });
      } else {
        world.add(pe.id, ActiveEffects, { effects: [{ key: 'invulnerable', turnsLeft: 10, potency: 1 }] });
      }
      // Hunger: start with 100 turns of satiation ("you ate before entering the dungeon")
      world.add(pe.id, Hunger, { hunger: 0, satiation: 100 });

      // Brain stats from class (intelligence, visionRange)
      const brain = /** @type {{ learnedSpellIds?: string[], intelligence?: number, visionRange?: number }|null } */ (world.get(pe.id, Brain));
      if (brain) {
        if (stats.intelligence != null) brain.intelligence = stats.intelligence;
        if (stats.visionRange != null) brain.visionRange = stats.visionRange;
      }

      // Class-driven loadout
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

      if (eq && classDef) {
        if (classDef.equipment.weapon) eq.weapon = addStarterItem(classDef.equipment.weapon) || null;
        if (classDef.equipment.armor) eq.armor = addStarterItem(classDef.equipment.armor) || null;
        if (classDef.equipment.shield) eq.shield = addStarterItem(classDef.equipment.shield) || null;
      }
      if (classDef) {
        for (const { itemId, count } of classDef.inventoryItems) {
          addStarterItem(itemId, { count });
        }
      }

      // Starting spell from class
      if (brain && classDef?.startingSpell) {
        if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
        const filtered = brain.learnedSpellIds.filter((id) => id !== classDef.startingSpell);
        brain.learnedSpellIds = [classDef.startingSpell, ...filtered];
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
        world.add(petId, Vitality, { maxHp: 30, hp: 30 });
        world.add(petId, Equipment, {
          attackDerived: 2,
          defenseDerived: 2
        });
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
      const deityId = String(dev?.deityId || classDef?.deityId || chosenDeityId || "");
      if (deityId) {
        if (!dev) world.add(pe.id, Devotion, { deityId });
        initDeity(deityId, world);
      }
    }
  }

  bootAdvance(_savegameLoaded ? "Restored saved player state" : "Spawned player state");

  // Initial world tick — runs all systems once so status effects, equipment stats,
  // and other derived state are fully resolved before the first frame renders.
  stepSim(1);

  bootAdvance("Starting render loop");
  requestAnimationFrame((now) => {
    frame(now);
    finishBoot();
  });

  installSceneControls({ world, cam, TILE_PX, messageLog, runtimeConfig });
}

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
  getMessageLog: () => messageLog,
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

throwFx.installListeners();

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

// UI trap tooltip tap → attempt disarm
addEventListener('ui:requestDisarmTrap', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const trapId = e?.detail?.trapId || 0;
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler({ type: 'rules.disarmTrap', payload: { trapId } });
});

const shopWiring = installShopWiring({ world, playerEntity, log: (msg) => messageLog.log({ text: msg, type: 'system' }), bracketizeName });
installChestWiring({ world, playerEntity, log: (msg) => messageLog.log({ text: msg, type: 'system' }), bracketizeName });
installRackWiring({ world, log: (msg) => messageLog.log({ text: msg, type: 'system' }) });
installAlchemyWiring({
  world,
  playerEntity,
  dispatchRules: (action) => {
    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    rulesHandler(action);
  },
  log: (msg) => messageLog.log({ text: msg, type: "system" }),
});
installCookingWiring({
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

  // Trap tooltip: show when standing on an armed trap
  let foundTrap = null;
  for (const [tid, tpos, t] of world.query(Position, Trap)) {
    if (!tpos || !t || !t.armed) continue;
    if (tpos.x === to.x && tpos.y === to.y) {
      const ni = world.get(tid, NamedIdentity);
      foundTrap = { id: tid, name: ni?.name || t.type, difficulty: t.difficulty };
      break;
    }
  }
  if (foundTrap) {
    try {
      window.dispatchEvent(new CustomEvent('ui:showTrapTooltip', {
        detail: { trapId: foundTrap.id, trapType: foundTrap.name, difficulty: foundTrap.difficulty }
      }));
    } catch (e) { console.debug('[main] dispatch ui:showTrapTooltip:', e); }
  } else {
    try { window.dispatchEvent(new CustomEvent('ui:hideTrapTooltip')); } catch (e) { console.debug('[main] dispatch ui:hideTrapTooltip:', e); }
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

  // Check for adjacent weapon rack
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'weapon_rack') continue;
    const dist = Math.max(Math.abs(pos.x - to.x), Math.abs(pos.y - to.y));
    if (dist === 1) {
      log('A weapon rack is here. Bump to browse.');
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
fx.worldToScreen = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ size, /** @type {{x:number,y:number,size:number}} */ out) => { out.x = x; out.y = y; out.size = size; };

// Per-entity particle emitter tracking sets (display-only, reconciled each frame)
const _burningEmitters = new Set();
const _bleedEmitters   = new Set();
const _poisonEmitters  = new Set();
const _regenEmitters   = new Set();
const _shockEmitters   = new Set();
const _frozenEmitters  = new Set();
const _cursedEmitters  = new Set();
const _blessedEmitters = new Set();
const _fountainEmitters = new Set();
const _furnaceEmitters  = new Set();
const _cookFireEmitters = new Set();
const _torchEmitters    = new Set();

// Static emitter config tables — built once at module init, used every frame.
// Replaces repeated reconcileStatusEmitter() calls with a single entity pass.
/** @type {Record<string, {tracker: Set<number>, prefix: string, cfg: Record<string, any>}>} */
const _STATUS_EMITTER_CFG = {
  burning:  { tracker: _burningEmitters, prefix: 'burn',    cfg: { rate: 18, angle: -Math.PI / 2, spread: Math.PI / 5,  speed: 0.8,  speedJitter: 0.4,  ax: 0, ay: -0.5,  life: 0.7,  lifeJitter: 0.3, size: 0.28, sizeEnd: 0.06, color: '#ff8c00', alpha0: 0.9,  alpha1: 0.0, offsetX: 0, offsetY: -0.15 } },
  bleeding: { tracker: _bleedEmitters,   prefix: 'bleed',   cfg: { rate: 14, angle:  Math.PI / 2, spread: Math.PI / 8,  speed: 0.55, speedJitter: 0.3,  ax: 0, ay:  1.2,  life: 0.9,  lifeJitter: 0.3, size: 0.14, sizeEnd: 0.05, color: '#bb1111', alpha0: 0.9,  alpha1: 0.0 } },
  poisoned: { tracker: _poisonEmitters,  prefix: 'poison',  cfg: { rate:  8, angle:  Math.PI / 2, spread: Math.PI / 6,  speed: 0.3,  speedJitter: 0.15, ax: 0, ay:  0.15, life: 1.0,  lifeJitter: 0.4, size: 0.12, sizeEnd: 0.04, color: '#33ff55', alpha0: 0.8,  alpha1: 0.0 } },
  regen:    { tracker: _regenEmitters,   prefix: 'regen',   cfg: { rate: 10, angle: -Math.PI / 2, spread: Math.PI / 4,  speed: 0.4,  speedJitter: 0.15, ax: 0, ay: -0.1,  life: 1.0,  lifeJitter: 0.4, size: 0.10, sizeEnd: 0.02, color: '#44ff88', alpha0: 0.7,  alpha1: 0.0 } },
  shocked:  { tracker: _shockEmitters,   prefix: 'shock',   cfg: { rate: 30, angle:  0,            spread: Math.PI * 2,  speed: 1.2,  speedJitter: 0.8,  ax: 0, ay:  0,    life: 0.2,  lifeJitter: 0.1, size: 0.10, sizeEnd: 0.02, color: '#00ccff', alpha0: 1.0,  alpha1: 0.0 } },
  frozen:   { tracker: _frozenEmitters,  prefix: 'frozen',  cfg: { rate: 15, angle:  0,            spread: Math.PI * 2,  speed: 0.22, speedJitter: 0.14, ax: 0, ay:  0.04, life: 1.8,  lifeJitter: 0.5, size: 0.12, sizeEnd: 0.04, color: '#aaeeff', alpha0: 0.6,  alpha1: 0.0 } },
  cursed:   { tracker: _cursedEmitters,  prefix: 'cursed',  cfg: { rate: 12, angle: -Math.PI / 2, spread: Math.PI,      speed: 0.5,  speedJitter: 0.3,  ax: 0, ay: -0.25, life: 1.2,  lifeJitter: 0.4, size: 0.14, sizeEnd: 0.02, color: '#8822cc', alpha0: 0.7,  alpha1: 0.0 } },
  blessed:  { tracker: _blessedEmitters, prefix: 'blessed', cfg: { rate: 10, angle: -Math.PI / 2, spread: Math.PI / 3,  speed: 0.6,  speedJitter: 0.2,  ax: 0, ay: -0.35, life: 1.0,  lifeJitter: 0.3, size: 0.09, sizeEnd: 0.02, color: '#ffcc00', alpha0: 0.8,  alpha1: 0.0 } },
};
/** @type {Record<string, {tracker: Set<number>, prefix: string, cfg: Record<string, any>}>} */
const _KIND_EMITTER_CFG = {
  fountain:     { tracker: _fountainEmitters, prefix: 'fountain', cfg: { continuous: true, rate: 16, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 1.4,  speedJitter: 0.5, ax: 0, ay:  2.5,  life: 1.2,  lifeJitter: 0.3, size: 0.35, sizeEnd: 0.08, color: '#66ccff', alpha0: 0.7,  alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
  furnace:      { tracker: _furnaceEmitters,  prefix: 'furnace',  cfg: { continuous: true, rate: 22, angle: -Math.PI / 2, spread: Math.PI / 5, speed: 0.9,  speedJitter: 0.3, ax: 0, ay: -0.1,  life: 0.65, lifeJitter: 0.2, size: 0.42, sizeEnd: 0.04, color: '#ff6600', alpha0: 0.88, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
  cooking_fire: { tracker: _cookFireEmitters, prefix: 'cfire',    cfg: { continuous: true, rate: 14, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.65, speedJitter: 0.3, ax: 0, ay: -0.05, life: 0.9,  lifeJitter: 0.3, size: 0.35, sizeEnd: 0.04, color: '#ff8800', alpha0: 0.75, alpha1: 0.0, offsetX: 0, offsetY:  0   } },
  torch:        { tracker: _torchEmitters,    prefix: 'torch',    cfg: { continuous: true, rate: 10, angle: -Math.PI / 2, spread: Math.PI / 6, speed: 0.5,  speedJitter: 0.4, ax: 0, ay: -0.3,  life: 0.6,  lifeJitter: 0.3, size: 0.22, sizeEnd: 0.03, color: '#ffaa33', alpha0: 0.85, alpha1: 0.0, offsetX: 0, offsetY: -0.1 } },
};
// Reusable set for tracking which emitter keys are active in the current frame
const _seenEmitterKeys = new Set();

// FX controllers (depend on cam + fx)
const boltFx = createBoltFxController({ world, cam, fx });
boltFx.installListeners();
const projectileFx = createProjectileFxController({ world, cam, fx });
projectileFx.installListeners();
const spellAreaFx = createSpellAreaFxController({ world, cam, fx, PERF, getFxTime: () => _fxTime });
spellAreaFx.installListeners();
const cloudFx = createCloudFxController({ world, cam, fx, getFxTime: () => _fxTime });
cloudFx.installListeners();

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
installFloatTextWiring({ world, ftext, fx });
installEventUiWiring({ world, ftext, getActiveSpellId: () => _activeSpellId, setActiveSpell });

// ---- Visual mappings (display contract) ------------------------------------
const palette = buildPalette();
const glyphAtlas = createGlyphAtlas(palette, { glowLayers: PERF.glowLayers, sizePx: (PERF.quality==='low'?32:64), fontPx: (PERF.quality==='low'?28:56) });
bootAdvance("Prepared render resources");

// ---- Render (display-only; consumes WorldView DTO) -------------------------
let _bgGradH = 0; let _bgGrad = null;
let _fxTime = 0; // display-side time accumulator for simple glyph FX

// Reusable render buffers — hoisted out of hot functions to avoid per-frame GC
const _stackMeta = new Map();
/** @type {{ key: string, x: number, y: number }[]} */
const _origins = [];
/** @type {number[]} flat buffer [tile, x, y, ...] for explored-not-visible tiles */
const _exploredTileBuffer = [];
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
  // Single viewport scan: draw visible tiles immediately, buffer explored-not-visible
  // tiles into a flat array, then flush at reduced alpha. This halves the
  // forEachTileInRect iteration cost vs two separate passes (critical in large
  // open areas like the overworld where explored tile count grows with exploration).
  if (worldView.tileGrid) {
    const isVisible = worldView.isVisible;
    const isExplored = worldView.isExplored;
    const tx0 = Math.floor(vx0), ty0 = Math.floor(vy0);
    const tx1 = Math.ceil(vx1),  ty1 = Math.ceil(vy1);
    /** @type {Record<number, string>} */ const tileKinds = /** @type {any} */ (_tileKindMap);
    _exploredTileBuffer.length = 0;
    worldView.tileGrid.forEachTileInRect(tx0, ty0, tx1, ty1, (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ tile) => {
      if (isVisible && isVisible(x, y)) {
        const kind = tileKinds[tile];
        if (kind) drawKind(glyphAtlas, bctx, kind, x, y);
      } else if (isExplored && isExplored(x, y)) {
        _exploredTileBuffer.push(tile, x, y);
      }
    });
    // Flush explored-not-visible buffer at a single reduced alpha (no per-tile state changes)
    if (_exploredTileBuffer.length > 0) {
      bctx.globalAlpha = 0.35;
      for (let i = 0; i < _exploredTileBuffer.length; i += 3) {
        const kind = tileKinds[_exploredTileBuffer[i] ?? 0];
        if (kind) drawKind(glyphAtlas, bctx, kind, _exploredTileBuffer[i + 1] ?? 0, _exploredTileBuffer[i + 2] ?? 0);
      }
      bctx.globalAlpha = 1.0;
    }
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
  _stackMeta.clear(); // "x,y" -> topItemId
  const stackMeta = _stackMeta;
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

    // Glyph-FX: invulnerability aegis ward — rotating hex ward, gold aura, sweeping spark
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('invulnerable')) {
      const cx = e.pos.x, cy = e.pos.y + 0.09;
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 3.2);
      const spin  = _fxTime * 1.4;
      const rCore = 0.50 + 0.046 * pulse;
      const rRing = rCore * 1.22;

      bctx.save();
      bctx.globalCompositeOperation = 'lighter';

      // soft inner aura — warm gold radial gradient
      const _invAura = bctx.createRadialGradient(cx, cy, 0, cx, cy, rCore * 1.1);
      _invAura.addColorStop(0, `rgba(255,255,200,${(0.12 + 0.10 * pulse).toFixed(3)})`);
      _invAura.addColorStop(1, `rgba(240,200,100,${(0.08 + 0.10 * pulse).toFixed(3)})`);
      bctx.fillStyle = _invAura;
      bctx.beginPath();
      bctx.arc(cx, cy, rCore * 1.1, 0, Math.PI * 2);
      bctx.fill();

      // outer ring — warm gold stroke
      bctx.lineWidth = 0.032;
      bctx.strokeStyle = `rgba(255,240,160,${(0.40 + 0.25 * pulse).toFixed(3)})`;
      bctx.beginPath();
      bctx.arc(cx, cy, rRing, 0, Math.PI * 2);
      bctx.stroke();

      // chroma fringe — faint blue outer ring for refractive look
      bctx.strokeStyle = `rgba(120,220,255,${(0.18 + 0.12 * pulse).toFixed(3)})`;
      bctx.beginPath();
      bctx.arc(cx, cy, rRing * 1.04, 0, Math.PI * 2);
      bctx.stroke();

      // rotating hex ward
      bctx.save();
      bctx.translate(cx, cy);
      bctx.rotate(spin);
      const _invSides = 6;
      const _invHexR  = rCore * 0.80;
      bctx.globalAlpha = 0.45 + 0.25 * pulse;
      bctx.lineWidth = 0.018;
      bctx.strokeStyle = 'rgba(255,230,160,0.9)';
      bctx.beginPath();
      for (let i = 0; i < _invSides; i++) {
        const ang = (i / _invSides) * Math.PI * 2;
        const px = Math.cos(ang) * _invHexR, py = Math.sin(ang) * _invHexR;
        if (i === 0) bctx.moveTo(px, py); else bctx.lineTo(px, py);
      }
      bctx.closePath();
      bctx.stroke();

      // rune dots at hex vertices
      bctx.globalAlpha = 0.70;
      bctx.fillStyle = 'rgba(255,255,210,0.9)';
      for (let i = 0; i < _invSides; i++) {
        const ang = (i / _invSides) * Math.PI * 2;
        const px = Math.cos(ang) * _invHexR, py = Math.sin(ang) * _invHexR;
        const s = 1 + 0.4 * Math.sin(_fxTime * 6 + i * 1.047);
        bctx.beginPath();
        bctx.arc(px, py, 0.015 * s, 0, Math.PI * 2);
        bctx.fill();
      }
      bctx.restore();

      // sweeping specular spark along the outer ring
      const _invSweepA = (_fxTime * 2.6) % (Math.PI * 2);
      const _invSx = cx + Math.cos(_invSweepA) * rRing;
      const _invSy = cy + Math.sin(_invSweepA) * rRing;
      bctx.globalAlpha = 0.40 + 0.35 * pulse;
      bctx.fillStyle = 'rgba(255,255,255,0.95)';
      bctx.beginPath();
      bctx.ellipse(_invSx, _invSy, 0.05, 0.014, _invSweepA, 0, Math.PI * 2);
      bctx.fill();

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
  if (bctx) boltFx.drawBolts(bctx);
  if (bctx) boltFx.drawDeityWrath(bctx);
  if (bctx) spellAreaFx.drawBlink(bctx);
  if (bctx) spellAreaFx.drawMeteor(bctx);
  if (bctx) spellAreaFx.drawBlastwave(bctx);
  if (bctx) spellAreaFx.drawFrost(bctx);
  if (bctx) projectileFx.draw(bctx);
  if (bctx) cloudFx.drawPoison(bctx);
  if (bctx) cloudFx.drawPlasma(bctx);

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
  if (boltFx.hasScreenEffects()) {
    boltFx.drawScreenFlash(ctx, W, H);
    boltFx.drawScreenBolts(ctx, W, H);
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
  boltFx.tick(dtSec);
  spellAreaFx.tick(dtSec);
  projectileFx.tick(dtSec);
  throwFx.tick(dtSec);
  cloudFx.tick(dtSec);
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
    _origins.length = 0;
    const origins = _origins;
    // Single entity pass for all status + kind emitters (replaces 11 separate scans)
    _seenEmitterKeys.clear();
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if (Array.isArray(e.tags)) {
        for (let t = 0; t < e.tags.length; t++) {
          const sc = _STATUS_EMITTER_CFG[e.tags[t]];
          if (!sc) continue;
          const key = `${sc.prefix}:${e.id}`;
          _seenEmitterKeys.add(key);
          if (!sc.tracker.has(e.id)) {
            fx.ensureEmitter(key, { continuous: true, ...sc.cfg });
            sc.tracker.add(e.id);
          }
          origins.push({ key, x: e.pos.x, y: e.pos.y });
        }
      }
      const kc = _KIND_EMITTER_CFG[e.kind];
      if (kc) {
        const key = `${kc.prefix}:${e.id}`;
        _seenEmitterKeys.add(key);
        if (!kc.tracker.has(e.id)) {
          fx.ensureEmitter(key, kc.cfg);
          kc.tracker.add(e.id);
        }
        origins.push({ key, x: e.pos.x, y: e.pos.y });
      }
    }
    // Remove emitters for entities that left the view
    for (const tag in _STATUS_EMITTER_CFG) {
      const sc = _STATUS_EMITTER_CFG[tag];
      if (!sc) continue;
      for (const id of sc.tracker) {
        if (!_seenEmitterKeys.has(`${sc.prefix}:${id}`)) {
          fx.removeEmitter(`${sc.prefix}:${id}`);
          sc.tracker.delete(id);
        }
      }
    }
    for (const kind in _KIND_EMITTER_CFG) {
      const kc = _KIND_EMITTER_CFG[kind];
      if (!kc) continue;
      for (const id of kc.tracker) {
        if (!_seenEmitterKeys.has(`${kc.prefix}:${id}`)) {
          fx.removeEmitter(`${kc.prefix}:${id}`);
          kc.tracker.delete(id);
        }
      }
    }
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



// ---- Character creation gate -------------------------------------------------
// Savegames bypass char creation; new games show the selection screen first.
if (_savegameLoaded) {
  _finalizeNewGame(null);
} else {
  // Fade out the boot loader so the char creation panel is visible
  finishBoot();

  const classDisplayData = listClassIds().map(id => {
    const cls = getClass(id);
    const deity = getDeity(cls.deityId);
    return {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      deityName: deity?.name ?? cls.deityId,
      deityAlignment: deity?.alignment ?? '',
    };
  });

  showCharCreation({
    classes: classDisplayData,
    onConfirm: (result) => _finalizeNewGame(result),
  });
}

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

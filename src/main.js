// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "./main/scheduler.js";
import { playerEntity, findNearestValidTileAround } from "./rules/utils/queries.js";
import { emitSafe } from "./rules/utils/emitSafe.js";
import { getEffectiveVisionRange, blind } from "./rules/utils/blind.js";
import { FOV_CONE_DISABLED_KEY, getEntityFacingConeDegrees, getNormalizedEntityFacing, setFacingTurnCostEnabled } from "./rules/utils/facing.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera, worldToScreen, clientToWorld as cameraClientToWorld } from "./display/camera/controller.js";
import { updateShake } from "./display/camera/shake.js";
import { startZoomPunch, updateZoomPunch, getZoomPunchScale } from "./display/camera/zoomPunch.js";
import { zoomTo } from "./display/camera/utils.js";
import {
  setupDisplayRuntime,
  tickDisplayEffects,
  drawWorldEffects,
  drawScreenEffects,
  drawTargetingReticle,
  drawRulesProfilerOverlay,
  applyHallucinationSway,
} from "./display/composition/index.js";

// display/ particles (pure display-side FX; no ECS, no rules)
import { Particle, ParticleFX } from "./display/passes/vfx/particles/particlePool.js";
// input wiring (display-only router)
import { setupInput } from "./display/input/InputRouter.js";
import { isInputLocked } from "./display/input/inputLock.js";
import { enableInputLockdown } from "./display/input/lockdown.js";
import { readInputMode } from "./display/input/inputSettings.js";
import { makeRulesDispatcher } from "./main/input/rulesDispatch.js";
// simple UI overlays
import { initOverlays } from "./display/ui/overlay.js";
import { initHUD } from "./display/ui/hud.js";
import { initPetMenu } from "./display/ui/petMenu.js";
import { initStatusLine } from "./display/ui/statusLine.js";
import { createHudFeeds } from "./main/ui/hudFeeds.js";
import { createSceneRuntime } from "./main/sceneRuntime.js";
import { createActiveSpellController } from "./main/spells/activeSpellController.js";
import { applyDebugCommands } from "./main/debug/debugCommands.js";
import { installSceneControls } from "./main/debug/sceneControls.js";
import { initDebugConsole } from "./display/ui/debugConsole.js";
import { registerBuiltinCommands } from "./main/debug/consoleCommands.js";
import { createCanvasSetup } from "./main/bootstrap/canvasSetup.js";
import { installInventoryDataProvider } from "./main/ui/inventoryDataProvider.js";
import { shouldSuppressRecentPickupChipForEquippedDuplicate } from "./main/ui/quickChipPolicy.js";
import { impactTracker } from "./display/fx/projectileImpactTracker.js";
import { createThrowFxController } from "./display/fx/throwFxController.js";
import { createPickupFxController } from "./display/fx/pickupFxController.js";
import { createWeatherFxController } from "./display/fx/weatherFx.js";
import { createSlideFxController } from "./display/fx/slideFxController.js";
import { createLightingEngine } from "./display/lighting/engine.js";
import { collectLightSources, collectFxLights, computeAmbient, getVisionDef, installLightEventListeners } from "./display/lighting/sources/index.js";
import { drawProcStateBadges, getProcStateVisual, procBadgeWorldCenter } from "./display/fx/procStateGlyphs.js";
import { drawEquipmentBadges } from "./display/fx/equipBadges.js";
import { readRuntimeConfig } from "./main/config/runtimeConfig.js";
import { createMessageLog } from "./main/ui/messageLog.js";
import { installDeityUiWiring } from "./display/ui/wiring/deityUiWiring.js";
import { installMessageWiring } from "./display/ui/wiring/messageWiring.js";
import { installShopWiring } from "./main/wiring/shopWiring.js";
import { installChestWiring } from "./main/wiring/chestWiring.js";
import { installRackWiring } from "./main/wiring/rackWiring.js";
import { installAlchemyWiring } from "./main/wiring/alchemyWiring.js";
import { installAnvilWiring } from "./main/wiring/anvilWiring.js";
import { installCookingWiring } from "./main/wiring/cookingWiring.js";
import { installDigWiring } from "./main/wiring/digWiring.js";
import { installDialogWiring } from "./main/wiring/dialogWiring.js";
import { installSpeechBubbleWiring } from "./main/wiring/speechBubbleWiring.js";
import { installSpiritGuideWiring } from "./main/wiring/spiritGuideWiring.js";
import { createSpiritPointerFx } from "./display/fx/spiritPointerFx.js";
import { readSeenTips, GUIDANCE_TIPS, GUIDE_STORAGE_KEY } from "./shared/data/spiritGuidance.js";
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
import { PHASE_TURNS } from "./rules/data/calendar.js";
import { Inventory } from "./rules/components/Inventory.js";
import { Equipment, GEAR_SLOTS } from "./rules/components/Equipment.js";
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
import { BaseStats } from "./rules/components/BaseStats.js";
import { Mana } from "./rules/components/Mana.js";
import { getSpell, describeSpellDetailLines, describeSpellTargetEffects } from "./rules/data/spells.js";
import { getSpellCooldown } from "./rules/utils/spellCooldowns.js";
import { buildPalette } from "./display/palette/index.js";
import { itemsAt } from "./rules/utils/queries.js";
import { createGlyphAtlas, drawKind, drawKindScaled } from "./display/passes/glyphs/atlas.js";
import { aegisWard as drawAegisWardGlyphFx } from "./display/passes/vfx/glyph/effects/aegisWard.js";
import { Settings } from "./rules/components/Settings.js";
import { Vitality } from "./rules/components/Vitality.js";
import { Devotion } from "./rules/components/Devotion.js";
import { Anatomy, HEARING_TIERS } from "./rules/components/Anatomy.js";
import { Status } from "./rules/components/Status.js";
import { initDeity, getDeityInstance } from "./rules/systems/deitySystem.js";
import { DungeonState } from "./rules/components/DungeonState.js";
import { getTownEconomyData } from "./rules/systems/townSimulationSystem.js";
import { CastSpellIntent } from "./rules/components/Intents/CastSpellIntent.js";
import { Channeling } from "./rules/components/Channeling.js";
import { Interactable } from "./rules/components/Interactable.js";
import { Faction } from "./rules/components/Faction.js";
import { TombstoneRepository } from "./rules/repositories/TombstoneRepository.js";
import { installTombstoneDeathListener } from "./rules/systems/tombstoneSystem.js";
import { Tombstone as TombstoneComponent } from "./rules/components/Tombstone.js";
import { installDeathShareWiring } from "./main/wiring/deathShareWiring.js";
import { installProofWiring } from "./main/proof/proofWiring.js";
import { postVerifiedScore } from "./shared/tombstoneApi.js";
import { createItemById } from "./rules/utils/itemFactory.js";
import { forEachInRadius } from "./rules/utils/spatialIndex.js";
import { chebyshevScalar, manhattanScalar } from "./rules/utils/distance.js";
import { hasLOS } from "./shared/math/gridLOS.js";
import { isChestIdentity } from "./shared/chests.js";
import { buildBlocksVisionMap, blockedCallback } from "./rules/utils/vision.js";
import {
  inventoryItems, inventoryContains, addToInventory,
  hasCapacityForItem, transferItem, removeFromInventory,
} from "./rules/utils/inventoryFacade.js";
import { Engraving } from "./rules/components/Engraving.js";
import { Pet } from "./rules/components/Pet.js";
import { PetState } from "./rules/components/PetState.js";
import { PetCommandIntent } from "./rules/components/Intents/PetCommandIntent.js";
import { Owner } from "./rules/components/Owner.js";
import { Hunger } from "./rules/components/Hunger.js";
import { getHungerLevel } from "./rules/data/food.js";
import { resolveItemDisplayName, buildItemDisplayData, resolveAffixes } from "./main/wiring/itemName.js";
import { evaluateSound, thresholdForTier } from "./rules/utils/sound.js";
import { updateFOV, isVisible as isTileVisible, isExplored as isTileExplored, setFovDisabled } from "./rules/environment/dungeon/exploredMap.js";
import { getTile, isWalkable, isOpaque, isFlyable, isRoofed, forEachLoadedTile } from "./rules/environment/dungeon/tileMap.js";
import { resetIdentification, identify, restoreIdentification, setIdentificationEnabled } from "./rules/data/identification.js";
import { initGemPricing, restoreGemPricing } from "./rules/data/gemPricing.js";
import { createRng, mulberry32 } from "./lib/ecs-js/rng.js";
import { getClass, listClassIds } from "./rules/data/classes.js";
import { getDeity } from "./rules/data/deities.js";
import { showCharCreation } from "./display/ui/charCreation.js";
import { installPluralizationExtensions } from "./shared/utils/pluralization.js";
import { pickRandomSeed } from "./shared/utils/funSeeds.js";
import { ensureStarterQuests } from "./rules/quests/runtime.js";
import { ensureStarterFetchQuestItem } from "./rules/quests/definitions/graveyardWatch.js";
import {
  acceptNoticeBoardOffer,
  buildNoticeBoardPayload,
  ensureLocalGeneratedQuest,
} from "./rules/quests/localGenerator.js";
import { postCharacterCreated, getHighscores } from "./shared/tombstoneApi.js";
import { Traits } from "./rules/components/Traits.js";
import { Polymorph } from "./rules/components/Polymorph.js";
import { resolvePolymorph } from "./rules/systems/polymorphSystem.js";
import { listAllMonsterIds, MONSTERS, getMonster } from "./rules/data/monsters.js";
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from "./rules/components/AggroState.js";
import { spawnMonsterEntity } from "./rules/utils/spawnMonsterEntity.js";
import { pickMonster } from "./rules/environment/dungeon/tables.js";
import { isApplyTool, listApplyTargetsForTool } from "./rules/content/items/applyPayloads.js";

// ---- Config & canvas -------------------------------------------------------
const runtimeConfig = readRuntimeConfig();
const PERF = runtimeConfig.perf;
const chosenDeityId = runtimeConfig.chosenDeityId;
const TILE_PX = 28;
const CAMERA_START_SCALE_DESKTOP = TILE_PX * (1.2 ** 5);
const CAMERA_START_SCALE_MOBILE = TILE_PX * (1.2 ** 2);
const CAMERA_START_SCALE = (() => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return CAMERA_START_SCALE_DESKTOP;
  }
  return window.matchMedia("(max-width: 760px)").matches
    ? CAMERA_START_SCALE_MOBILE
    : CAMERA_START_SCALE_DESKTOP;
})();
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
const FIRST_RUN_DEV_NOTICE_KEY = "jshack:firstRunDevNoticeSeen:v1";
const FIRST_RUN_TILE_KEY_KEY = "jshack:firstRunTileKeySeen:v1";
const _shouldShowFirstRunDevNotice = consumeFirstRunDevNoticeFlag();
let _didShowFirstRunDevNotice = false;

function consumeFirstRunDevNoticeFlag() {
  if (typeof localStorage === "undefined") return false;
  try {
    if (localStorage.getItem(FIRST_RUN_DEV_NOTICE_KEY) === "1") return false;
    localStorage.setItem(FIRST_RUN_DEV_NOTICE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function maybeShowFirstRunDevNotice() {
  if (!_shouldShowFirstRunDevNotice || _didShowFirstRunDevNotice) return;
  _didShowFirstRunDevNotice = true;
  window.setTimeout(() => {
    try {
      window.dispatchEvent(new CustomEvent("ui:showDevNoticeTooltip", {
        detail: {
          title: "Active Development Notice",
          body: "JSHack is under very active development. Use the Bug button in the action bar to request features or report bugs!",
          closeText: "Got it",
        },
      }));
    } catch (e) { console.debug('[main] dispatch ui:showDevNoticeTooltip:', e); }
  }, 250);
}

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
  maybeShowFirstRunDevNotice();
}

updateBootProgress((!_hasFloorOverride && hasSavegame()) ? "Loading from Save" : "Loading...");
installPluralizationExtensions();

// ---- App wires rules/ (no display logic here) ------------------------------
const _bootSeed = runtimeConfig.seed ?? (_hasFloorOverride ? null : readSavedSeed(_pendingSavegame)) ?? pickRandomSeed();
const world = new World({ seed: _bootSeed });
setFovDisabled(runtimeConfig.disableFov === true);
world[FOV_CONE_DISABLED_KEY] = runtimeConfig.disableFovCone === true;
setFacingTurnCostEnabled(world, runtimeConfig.facingTurnCost === true);
configureWorld(world);
import { installChannelingController } from "./main/channelingController.js";
installChannelingController(world, () => (playerEntity(world)?.id || 0));
bootAdvance("Configured ECS systems");

// Initialize identification & gem pricing for this game run
resetIdentification();
setIdentificationEnabled(runtimeConfig.identifyItems);
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
installDeathShareWiring({ world });
const _proofWiring = installProofWiring({ world });
world.on("proof:ready", ({ bundle }) => {
  postVerifiedScore(bundle).catch(() => {});
});
// Fire-and-forget: warm the highscores cache as early as possible so dungeon
// generation (synchronous, below) has the best chance of finding it populated.
getHighscores().catch(() => {});
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

function getSpeakerBubbleLiftPx() {
  const scale = Math.max(1, Number(cam?.scale) || 1);
  return Math.max(32, Math.min(96, Math.round(scale * 1.15)));
}

function getSpeakerBubbleAnchorPos(pos) {
  return {
    x: Number(pos?.x || 0),
    y: Number(pos?.y || 0) - 0.68,
  };
}

let _bubbleDialogState = {
  open: false,
  sessionId: 0,
  actorId: 0,
  targetId: 0,
  maxDistance: 2,
};

function createBubbleDialogUi() {
  const el = document.createElement("div");
  const title = document.createElement("div");
  const body = document.createElement("div");
  const choices = document.createElement("div");
  const tail = document.createElement("div");
  const connector = document.createElement("div");
  const speakerDot = document.createElement("div");

  el.id = "speech-bubble-dialog";
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "90",
    display: "none",
    pointerEvents: "auto",
    minWidth: "220px",
    maxWidth: "min(78vw, 360px)",
    padding: "10px 12px 12px",
    borderRadius: "16px",
    border: "2px solid rgba(75,62,43,0.9)",
    background: "rgba(252,248,238,0.98)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
    transform: "translate(-9999px, -9999px)",
    overflow: "visible",
  });
  Object.assign(tail.style, {
    position: "absolute",
    left: "50%",
    bottom: "-14px",
    width: "20px",
    height: "20px",
    background: "rgba(252,248,238,0.98)",
    borderRight: "2px solid rgba(75,62,43,0.9)",
    borderBottom: "2px solid rgba(75,62,43,0.9)",
    transform: "translateX(-50%) rotate(45deg)",
    borderBottomRightRadius: "4px",
    pointerEvents: "none",
    boxShadow: "4px 4px 10px rgba(0,0,0,0.10)",
  });
  Object.assign(connector.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "0",
    height: "3px",
    display: "none",
    pointerEvents: "none",
    transformOrigin: "0 50%",
    backgroundImage: "repeating-linear-gradient(90deg, rgba(90,74,48,0.92) 0 7px, rgba(90,74,48,0) 7px 13px)",
    filter: "drop-shadow(0 0 1px rgba(255,250,240,0.85))",
    zIndex: "91",
  });
  Object.assign(speakerDot.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "10px",
    height: "10px",
    display: "none",
    pointerEvents: "none",
    borderRadius: "999px",
    border: "2px solid rgba(75,62,43,0.95)",
    background: "rgba(252,248,238,1)",
    boxShadow: "0 0 0 2px rgba(255,250,240,0.65)",
    zIndex: "92",
  });
  Object.assign(title.style, {
    font: "700 14px 'Trebuchet MS', sans-serif",
    color: "#4b3e2b",
    marginBottom: "6px",
  });
  Object.assign(body.style, {
    font: "400 15px 'Trebuchet MS', sans-serif",
    lineHeight: "1.35",
    color: "#261f16",
    marginBottom: "10px",
  });
  Object.assign(choices.style, {
    display: "grid",
    gap: "8px",
  });

  el.appendChild(title);
  el.appendChild(body);
  el.appendChild(choices);
  el.appendChild(tail);
  document.body.appendChild(connector);
  document.body.appendChild(speakerDot);
  document.body.appendChild(el);
  return { el, title, body, choices, tail, connector, speakerDot };
}

const bubbleDialogUi = createBubbleDialogUi();

function closeBubbleDialog() {
  _bubbleDialogState = { open: false, sessionId: 0, actorId: 0, targetId: 0, maxDistance: 2 };
  bubbleDialogUi.el.style.display = "none";
  bubbleDialogUi.el.style.transform = "translate(-9999px, -9999px)";
  bubbleDialogUi.connector.style.display = "none";
  bubbleDialogUi.connector.style.width = "0";
  bubbleDialogUi.speakerDot.style.display = "none";
  bubbleDialogUi.choices.innerHTML = "";
}

function openBubbleDialog(detail = {}) {
  const choices = Array.isArray(detail?.choices) ? detail.choices : [];
  _bubbleDialogState = {
    open: true,
    sessionId: Number(detail?.sessionId || 0) | 0,
    actorId: Number(detail?.actorId || 0) | 0,
    targetId: Number(detail?.targetId || 0) | 0,
    maxDistance: Math.max(1, Number(detail?.maxDistance || 2) | 0),
  };
  bubbleDialogUi.title.textContent = String(detail?.speakerName || "Someone");
  bubbleDialogUi.body.textContent = String(detail?.text || "...");
  bubbleDialogUi.choices.innerHTML = "";
  for (const choice of choices) {
    const btn = document.createElement("button");
    btn.textContent = String(choice?.label || choice?.id || "Continue");
    Object.assign(btn.style, {
      minHeight: "40px",
      padding: "8px 10px",
      borderRadius: "10px",
      border: "1px solid rgba(75,62,43,0.35)",
      background: "rgba(255,255,255,0.96)",
      color: "#241d15",
      font: "600 14px 'Trebuchet MS', sans-serif",
      textAlign: "left",
      cursor: "pointer",
      touchAction: "manipulation",
    });
    btn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ui:requestDialogChoice", {
        detail: {
          sessionId: _bubbleDialogState.sessionId,
          choiceId: String(choice?.id || ""),
        },
      }));
    });
    bubbleDialogUi.choices.appendChild(btn);
  }
  bubbleDialogUi.el.style.display = "block";
}

function layoutBubbleDialog() {
  if (!_bubbleDialogState.open) return;
  const speakerPos = getPosition(_bubbleDialogState.targetId || _bubbleDialogState.actorId);
  const pe = playerEntity(world);
  if (speakerPos && pe) {
    const dist = Math.max(
      Math.abs((speakerPos.x | 0) - (pe.pos.x | 0)),
      Math.abs((speakerPos.y | 0) - (pe.pos.y | 0)),
    );
    if (dist > (_bubbleDialogState.maxDistance | 0)) {
      window.dispatchEvent(new CustomEvent("ui:requestDialogClose", {
        detail: { sessionId: _bubbleDialogState.sessionId },
      }));
      return;
    }
  }
  const targetId = _bubbleDialogState.targetId || _bubbleDialogState.actorId;
  const pos = getPosition(targetId);
  if (!pos) {
    closeBubbleDialog();
    return;
  }
  const anchor = getSpeakerBubbleAnchorPos(pos);
  const rect = typeof canvas.getBoundingClientRect === "function"
    ? canvas.getBoundingClientRect()
    : { left: 0, top: 0, width: canvas.offsetWidth || _canvasSetup.cssW, height: canvas.offsetHeight || _canvasSetup.cssH };
  const logicalCanvas = {
    width: canvas.offsetWidth || _canvasSetup.cssW,
    height: canvas.offsetHeight || _canvasSetup.cssH,
  };
  const [localX, localY] = worldToScreen(cam, anchor.x, anchor.y, logicalCanvas);
  const rxScale = rect.width / logicalCanvas.width;
  const ryScale = rect.height / logicalCanvas.height;
  const sx = rect.left + localX * rxScale;
  const sy = rect.top + localY * ryScale;
  const boxW = bubbleDialogUi.el.offsetWidth || 280;
  const boxH = bubbleDialogUi.el.offsetHeight || 120;
  const lift = getSpeakerBubbleLiftPx();
  const viewportW = typeof window !== "undefined" ? window.innerWidth : logicalCanvas.width;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : logicalCanvas.height;
  const left = Math.max(10, Math.min(viewportW - boxW - 10, Math.round(sx - (boxW / 2))));
  const top = Math.max(10, Math.min(viewportH - boxH - 30, Math.round(sy - boxH - 12 - lift)));
  bubbleDialogUi.el.style.transform = `translate(${left}px, ${top}px)`;

  const tailTipX = left + (boxW * 0.5);
  const tailTipY = top + boxH + 18;
  const dx = sx - tailTipX;
  const dy = sy - tailTipY;
  const dist = Math.hypot(dx, dy);
  if (dist > 6) {
    bubbleDialogUi.connector.style.display = "block";
    bubbleDialogUi.connector.style.width = `${Math.round(dist)}px`;
    bubbleDialogUi.connector.style.transform = `translate(${Math.round(tailTipX)}px, ${Math.round(tailTipY)}px) rotate(${Math.atan2(dy, dx)}rad)`;
    bubbleDialogUi.speakerDot.style.display = "block";
    bubbleDialogUi.speakerDot.style.transform = `translate(${Math.round(sx - 5)}px, ${Math.round(sy - 5)}px)`;
  } else {
    bubbleDialogUi.connector.style.display = "none";
    bubbleDialogUi.connector.style.width = "0";
    bubbleDialogUi.speakerDot.style.display = "none";
  }
}

// Post-mortem: keep the simulation ticking after the player dies so the world
// continues to evolve (fires spread, monsters roam, etc.) for a fixed number
// of ticks, then stop and signal that the post-mortem phase is complete.
const POST_MORTEM_TICKS = 10;
const POST_MORTEM_INTERVAL_MS = 500;
let _postMortemInterval = 0;
let _postMortemTicksLeft = 0;
world.on("died", ({ id }) => {
  if (!world.has(id, Player)) return;
  if (_postMortemInterval) return;
  // Death VFX: extended hitstop, shake, flash, jingle, blink sequence
  deathVfx.triggerDeath({ cam, hitstopFx });
  // Dim the lights: ramp vision to 0 over 10 half-second ticks (5s fade)
  blind(world, id, 0, POST_MORTEM_TICKS, 0, 0);
  _postMortemTicksLeft = POST_MORTEM_TICKS;
  _postMortemInterval = setInterval(() => {
    world.tick(1);
    _postMortemTicksLeft--;
    if (_postMortemTicksLeft <= 0) {
      clearInterval(_postMortemInterval);
      _postMortemInterval = 0;
      world.emit("postMortemComplete");
    }
  }, POST_MORTEM_INTERVAL_MS);
});

// --- Active spell selection (app-side state) ---------------------------------
/** @type {string|null} */
let _activeSpellId = null;
const TARGETED_SPELL_CONFIG = Object.freeze({
  blink: Object.freeze({
    fallbackRange: 10,
    requiresLOS: false,
    requiresVisible: false,
    describePrompt(range) {
      return `Choose blink destination (up to ${range} tiles). Tap a tile or use arrow keys + Enter. Esc to cancel.`;
    },
  }),
  meteor: Object.freeze({
    fallbackRange: 12,
    requiresLOS: true,
    requiresVisible: false,
    describePrompt(range) {
      return `Choose meteor target (LOS, range ${range}). Tap a tile or use arrow keys + Enter. Esc to cancel.`;
    },
  }),
  blizzard: Object.freeze({
    fallbackRange: 10,
    requiresLOS: true,
    requiresVisible: true,
    useVisionRange: true,
    describePrompt(range) {
      return `Choose blizzard target (visible tile, up to ${range} tiles). Tap a tile or use arrow keys + Enter. Esc to cancel.`;
    },
  }),
  firestorm: Object.freeze({
    fallbackRange: 10,
    requiresLOS: true,
    requiresVisible: true,
    useVisionRange: true,
    describePrompt(range) {
      return `Choose firestorm target (visible tile, up to ${range} tiles). Tap a tile or use arrow keys + Enter. Esc to cancel.`;
    },
  }),
  phase_strike: Object.freeze({
    fallbackRange: 10,
    requiresLOS: false,
    requiresVisible: false,
    describePrompt(range) {
      return `Choose Phase Strike destination (up to ${range} tiles). Tap a tile or use arrow keys + Enter. Esc to cancel.`;
    },
  }),
});
/** @type {{ spellId: string, spellName: string, range: number, requiresLOS: boolean, requiresVisible?: boolean }|null} */
let _pendingSpellTargeting = null;
/** @type {{ actorId: number, itemId: number, itemName: string, range: number }|null} */
let _pendingThrowTargeting = null;
/** @type {{ spellId: string, spellName: string, range: number, enemies: Array<{id:number,x:number,y:number}>, index: number }|null} */
let _pendingEnemyTargeting = null;
/** @type {{ x: number, y: number }|null} Keyboard targeting cursor (tile coords) */
let _targetCursor = null;
const throwFx = createThrowFxController({
  world,
  resolveItemMeta: (itemId) => {
    const ident = world.get(itemId, NamedIdentity);
    const info = world.get(itemId, ItemInfo);
    return {
      identity: String(ident?.identity || ""),
      isPotion: String(info?.type || "").toLowerCase() === "potion",
    };
  },
});

const pickupFx = createPickupFxController({
  world,
  resolveItemMeta: (itemId) => {
    const ident = world.get(itemId, NamedIdentity);
    return { identity: String(ident?.identity || "") };
  },
  getPosition: (id) => world.get(Number(id || 0), Position) || null,
});
const weatherFx = createWeatherFxController();
const lightingEngine = createLightingEngine();

// Dirty-field tracking for lighting engine — detect player/world changes
// between frames so we only rebuild what actually changed.
let _prevLightPX = -1, _prevLightPY = -1;    // player tile position
let _prevLightFDX = 0, _prevLightFDY = 0;    // player facing direction
let _prevLightStep = -1;                      // last world.step we saw

function getTargetedSpellConfig(spellId) {
  return TARGETED_SPELL_CONFIG[String(spellId || "").toLowerCase()] || null;
}
function computeThrowRange(weight) { return throwFx.computeThrowRange(weight); }
function isSimUiBlocked() { return isInputLocked(); }

/**
 * Convert world-space coordinate to nearest tile center index.
 * World uses integer-centered tile coordinates.
 * @param {number} value
 */
function worldToTile(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * Clamp a tile target to Chebyshev range from an origin.
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {number} maxRange
 */
function clampTargetToRange(fromX, fromY, toX, toY, maxRange) {
  const ox = Number(fromX) | 0;
  const oy = Number(fromY) | 0;
  const tx = Number(toX) | 0;
  const ty = Number(toY) | 0;
  const range = Math.max(0, Number(maxRange) | 0);

  const dx = tx - ox;
  const dy = ty - oy;
  const dist = chebyshevScalar(ox, oy, tx, ty);
  if (dist <= range || range <= 0) return { x: tx, y: ty };

  const scale = range / Math.max(1, dist);
  const cx = ox + Math.round(dx * scale);
  const cy = oy + Math.round(dy * scale);
  return { x: cx, y: cy };
}

function getPlayerVisionRange() {
  const pe = playerEntity(world);
  if (!pe?.id) return 0;
  return Math.max(1, getEffectiveVisionRange(world, pe.id) | 0);
}

const spellCtrl = createActiveSpellController(world);

// Initialize HUD feed updaters with stamina support
const hudFeeds = createHudFeeds(world, {
  getPlayerMana: spellCtrl.getPlayerMana,
  ensureActiveSpell: () => ensureActiveSpell(),
  updateActiveSpellLabel: () => spellCtrl.updateActiveSpellLabel(),
  knownSpellIds: () => spellCtrl.knownSpellIds(),
  getActionBarSlots: () => spellCtrl.getActionBarSlots(),
  getPinnedSpellSlots: () => spellCtrl.getPinnedSpellSlots(),
  autoAssignSlot: (id) => spellCtrl.autoAssignSlot(id),
  autoAssignPinnedSlot: (id) => spellCtrl.autoAssignPinnedSlot(id),
  getFxTime: () => _fxTime,
});

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
import { transitionToDepth, clearFloorCache } from "./rules/environment/dungeon/transition.js";
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
  TILE_SHALLOW_WATER,
  TILE_LAVA,
  TILE_FARMLAND,
  TILE_FENCE,
  TILE_COBBLESTONE,
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
  [TILE_SHALLOW_WATER]: 'water',
  [TILE_LAVA]: 'lava',
  [TILE_MOUNTAIN]:   'mountain',
  [TILE_MOUNTAIN_B]: 'mountain_b',
  [TILE_MOUNTAIN_C]: 'mountain_c',
  [TILE_TREE]: 'tree',
  [TILE_FARMLAND]: 'farmland',
  [TILE_FENCE]:    'fence',
  [TILE_COBBLESTONE]: 'cobblestone',
};

const SURFACE_TILE_KINDS = Object.freeze({
  waterShallow: Object.freeze({ family: "water", tone: "shallow" }),
  water: Object.freeze({ family: "water", tone: "water" }),
  waterDeep: Object.freeze({ family: "water", tone: "deep" }),
  lava: Object.freeze({ family: "lava", tone: "bright" }),
});

function classifySurfaceTile(tile) {
  switch (tile) {
    case TILE_SHALLOW_WATER: return SURFACE_TILE_KINDS.waterShallow;
    case TILE_WATER: return SURFACE_TILE_KINDS.water;
    case TILE_WATER_DEEP: return SURFACE_TILE_KINDS.waterDeep;
    case TILE_LAVA: return SURFACE_TILE_KINDS.lava;
    default: return null;
  }
}

// Allow URL override: ?dungeonScale=0.3 for compact debugging floors
{
  const ds = runtimeConfig.dungeonScale;
  if (Number.isFinite(ds) && ds > 0) dungeonConfig.dungeonScale = ds;
}

// Allow URL override: ?sparsity=0.55 for airier room layouts inside each chunk
{
  const sparsity = runtimeConfig.sparsity;
  if (Number.isFinite(sparsity) && sparsity >= 0 && sparsity <= 1) {
    dungeonConfig.roomSparsity = sparsity;
  }
}

// Allow URL override: ?floor=0|1|... to choose start depth.
const _startDepth = _hasFloorOverride
  ? runtimeConfig.startDepth
  : (readSavedDepth(_pendingSavegame) ?? runtimeConfig.startDepth);
const _initialDepth = (Number.isFinite(_startDepth) && _startDepth >= 0) ? _startDepth : 0;
const _bootFloorPlan = generateFloorPlan(world.seed >>> 0, _initialDepth, null, { dungeonType: runtimeConfig.dungeonType });
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
let spawnPos = initDungeon(world, {
  startDepth: _startDepth,
  tombstoneRepo,
  dungeonType: runtimeConfig.dungeonType,
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
let _tutorialDisabledThisSession = false;
if (_pendingSavegame) {
  updateBootProgress("Applying save snapshot...", _bootDoneUnits);
  try {
    restoreSnapshotFromSavegame(world, _pendingSavegame);
    const savedSpell = _pendingSavegame?.app?.activeSpellId;
    if (typeof savedSpell === "string" && savedSpell.length > 0) { _activeSpellId = savedSpell; spellCtrl.setActiveSpell(savedSpell); }
    const savedSlots = _pendingSavegame?.app?.actionBarSlots;
    if (Array.isArray(savedSlots)) spellCtrl.restoreSlots(savedSlots);
    const savedPinned = _pendingSavegame?.app?.pinnedSpellSlots;
    if (Array.isArray(savedPinned)) spellCtrl.restorePinnedSlots(savedPinned);
    _savegameLoaded = true;
    _proofWiring.resetForLoad();
    updateBootProgress("Loaded save snapshot", _bootDoneUnits);
  } catch (err) {
    console.error("[SAVE] Failed to apply snapshot, continuing as new game.", err);
    clearSavegamePayload();
    _activeSpellId = null; spellCtrl.setActiveSpell(null); spellCtrl.restoreSlots([]); spellCtrl.restorePinnedSlots([]);
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

  // Apply tutorial preference from character creation.
  // ON + all complete: reset localStorage → full replay.
  // ON + partial:     leave alone → resume where they left off.
  // OFF:              don't touch storage → just skip this session. Tips stay for next time.
  if (classData && classData.tutorial === true) {
    const seen = readSeenTips();
    if (seen.size >= GUIDANCE_TIPS.length) {
      try { localStorage.removeItem(GUIDE_STORAGE_KEY); } catch {}
    }
  } else if (classData && classData.tutorial === false) {
    _tutorialDisabledThisSession = true;
  }

  // Apply difficulty settings from character creation
  if (classData && classData.difficulty === 'hard') {
    world[FOV_CONE_DISABLED_KEY] = false;
    setFacingTurnCostEnabled(world, true);
    try { localStorage.setItem('jshack.disableFovCone', 'false'); } catch {}
    try { localStorage.setItem('jshack.facingTurnCost', 'true'); } catch {}
  } else if (classData && classData.difficulty === 'easy') {
    world[FOV_CONE_DISABLED_KEY] = true;
    setFacingTurnCostEnabled(world, false);
    try { localStorage.setItem('jshack.disableFovCone', 'true'); } catch {}
    try { localStorage.setItem('jshack.facingTurnCost', 'false'); } catch {}
  }

  // If the player chose a different seed, regenerate the world
  if (classData && typeof classData.seed === 'number') {
    const chosenSeed = classData.seed >>> 0;
    if (chosenSeed !== (world.seed >>> 0)) {
      // Re-seed the world RNG
      world.seed = chosenSeed;
      world.rand = mulberry32(chosenSeed);
      // Destroy all existing entities (the pre-generated dungeon)
      for (const id of Array.from(world.alive)) world.destroy(id);
      // Re-init gem pricing with the new seed
      initGemPricing(createRng(world.seed ^ 0x6E45));
      // Regenerate the dungeon
      spawnPos = initDungeon(world, { startDepth: _startDepth, tombstoneRepo });
    }
  }

  if (!_savegameLoaded) {
    // Start new games at dawn (start of "work" phase, ~7 AM)
    world.step = PHASE_TURNS.sleep + PHASE_TURNS.breakfast;
    clearFloorCache();
    const stats = classDef?.stats ?? {};

    // Create player at the spawn position with class stats
    if (!playerEntity(world)) {
      createPlayer(world, {
        x: spawnPos.x, y: spawnPos.y,
        name: classData?.name ?? "Hero",
        identity: classDef ? `player_${classDef.id}` : "player",
        maxHp: stats.maxHp ?? 20,
        maxStamina: stats.maxStamina ?? 100,
        staminaRegen: stats.staminaRegen ?? 3.0,
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
      // Hunger: start with 100 turns of satiation ("you ate before entering the dungeon")
      world.add(pe.id, Hunger, { hunger: 0, satiation: 100 });

      // Brain stats from class (intelligence, visionRange)
      const brain = /** @type {{ learnedSpellIds?: string[], intelligence?: number, visionRange?: number }|null } */ (world.get(pe.id, Brain));
      if (brain) {
        if (stats.intelligence != null) brain.intelligence = stats.intelligence;
        if (stats.visionRange != null) brain.visionRange = stats.visionRange;
      }

      // Base stats from class (strength, dexterity, vitality, intelligence, perception)
      world.add(pe.id, BaseStats, {
        strength: stats.strength ?? 10,
        intelligence: stats.intelligence ?? 10,
        dexterity: stats.dexterity ?? 10,
        vitality: stats.vitality ?? 10,
        perception: stats.perception ?? 5,
      });

      // Class-driven loadout
      const inv = world.get(pe.id, Inventory);
      const eq = world.get(pe.id, Equipment);
      const addStarterItem = (itemId, opts = {}) => {
        if (!inv) return 0;
        const createdId = createItemById(world, itemId, opts);
        if (!(createdId > 0)) return 0;
        if (!addToInventory(world, pe.id, createdId, { silent: true })) return 0;
        // Starting gear is always identified
        identify(itemId);
        return createdId;
      };

      if (eq && classDef) {
        for (const [slot, itemId] of Object.entries(classDef.equipment || {})) {
          if (!(slot in eq)) continue;
          eq[slot] = itemId ? (addStarterItem(itemId) || null) : null;
        }
      }
      if (classDef) {
        for (const { itemId, count } of classDef.inventoryItems) {
          addStarterItem(itemId, { count });
        }
      }
      // Starting spell(s) from class — supports both startingSpell (string) and startingSpells (array)
      /** @type {string[]} */
      const classSpells = [];
      if (Array.isArray(classDef?.startingSpells)) {
        for (const s of classDef.startingSpells) { if (s) classSpells.push(String(s)); }
      } else if (classDef?.startingSpell) {
        classSpells.push(String(classDef.startingSpell));
      }
      if (brain && classSpells.length > 0) {
        if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
        // Prepend class spells in order, deduplicating
        const existing = brain.learnedSpellIds.filter((id) => !classSpells.includes(id));
        brain.learnedSpellIds = [...classSpells, ...existing];
        setActiveSpell(classSpells[0]);
      }

    }

    // Spawn pet next to the player (familiar for warlock, kitty otherwise)
    {
      const pe = playerEntity(world);
      if (pe) {
        const ppos = world.get(pe.id, Position);
        const spawnTile = findNearestValidTileAround(world, ppos, {
          maxDistance: 1,
          exclude: [{ x: ppos.x, y: ppos.y }],
        });
        const isWarlock = classDef?.id === 'warlock';
        const petId = world.create();
        world.add(petId, Pet);
        world.add(petId, Position, spawnTile || { x: ppos.x, y: ppos.y });
        world.add(petId, NamedIdentity, {
          name: isWarlock ? "Familiar" : "Kitty",
          identity: isWarlock ? "familiar" : "kitty",
        });
        world.add(petId, Faction, { key: "pet" });
        world.add(petId, Owner, { ownerId: pe.id });
        world.add(petId, Inventory, { items: [], capacity: 1 });
        world.add(petId, Settings, { autoPickup: true, autoPickupKinds: ['currency', 'potion', 'ammo', 'scroll', 'equip'] });
        world.add(petId, Vitality, { maxHp: 30, hp: 30 });
        world.add(petId, Equipment, {
          accuracyDerived: 2,
          damagePowerDerived: 2,
          evadeDerived: 2
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
          rangedCooldown: 0,
        });
        try {
          window.dispatchEvent(new CustomEvent('ui:petExists', {
            detail: { exists: true }
          }));
        } catch (e) { console.debug('[main] dispatch ui:petExists:', e); }
      }
    }

    applyDebugCommands({ world, runtimeConfig });

    // Capture character creation entry conditions for telemetry.
    postCharacterCreated({
      playerName: classData?.name ?? "Hero",
      classId: classDef?.id ?? null,
      className: classDef?.name ?? null,
      seed: (world.seed >>> 0).toString(16),
      startDepth: _startDepth,
      timestamp: Date.now(),
    }).catch(() => {});
  }

  // Ensure deity state is initialized for current player (new game or loaded save).
  {
    const pe = playerEntity(world);
    if (pe) {
      const dev = world.get(pe.id, Devotion);
      const deityId = String(dev?.deityId || classDef?.deityId || chosenDeityId || "");
      if (deityId) {
        if (!dev) world.add(pe.id, Devotion, { deityId, pantheon: true });
        else if (dev?.pantheon == null) dev.pantheon = true;
        initDeity(deityId, world);
      }
    }
  }

  ensureStarterQuests(world);
  ensureLocalGeneratedQuest(world);
  ensureStarterFetchQuestItem(world);

  bootAdvance(_savegameLoaded ? "Restored saved player state" : "Spawned player state");

  // Strip in-flight spell intents and channeling state from all entities before
  // the first tick. These are transient and must not auto-fire on load — the
  // initial tick would otherwise immediately complete a restored channel or cast
  // a lingering CastSpellIntent from the savegame.
  for (const [eid] of world.query(CastSpellIntent)) {
    try { world.remove(eid, CastSpellIntent); } catch {}
  }
  for (const [eid] of world.query(Channeling)) {
    try { world.remove(eid, Channeling); } catch {}
  }

  // Initial world tick — runs all systems once so status effects, equipment stats,
  // and other derived state are fully resolved before the first frame renders.
  stepSim(1);

  // Show tile key overlay on very first run so new players learn the glyphs.
  if (!_savegameLoaded) {
    try {
      const seen = typeof localStorage !== "undefined" && localStorage.getItem(FIRST_RUN_TILE_KEY_KEY) === "1";
      if (!seen) {
        if (typeof localStorage !== "undefined") localStorage.setItem(FIRST_RUN_TILE_KEY_KEY, "1");
        window.setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent("ui:showTileKeyTooltip"));
          } catch (e) { console.debug('[main] dispatch ui:showTileKeyTooltip:', e); }
        }, 400);
      }
    } catch (e) { console.debug('[main] tile key:', e); }
  }

  bootAdvance("Starting render loop");
  requestAnimationFrame((now) => {
    frame(now);
    finishBoot();
  });

  installSceneControls({ world, cam, TILE_PX, defaultZoomScale: CAMERA_START_SCALE, messageLog, runtimeConfig });

  const debugConsole = initDebugConsole({ world, messageLog });
  registerBuiltinCommands(debugConsole, { world, messageLog, lightingEngine });
}

function findNearestTraversalTarget(world, x, y) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'stair_down' && ni.identity !== 'stair_up' && ni.identity !== 'return_portal') continue;
    const dist = chebyshevScalar(pos.x, pos.y, x, y);
    if (dist > 0) continue;
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
    () => (playerEntity(world)?.id || 0),
    { onAction: _proofWiring.recordAction }
  );

  const displayHandler = (action) => {
    if (isSimUiBlocked()) return;
    switch (action.type) {
      case "display.openInventory":
        window.dispatchEvent(new CustomEvent("ui:openInventory"));
        break;
      case "display.openCharacter":
        window.dispatchEvent(new CustomEvent("ui:openCharacter"));
        break;
      case "display.openEquipment":
        window.dispatchEvent(new CustomEvent("ui:openEquipment"));
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
        // 1) Pick up floor items first (even on a chest tile).
        // 2) If no floor items and standing on a chest, open chest UI.
        const p = playerEntity(world);
        if (!p) break;

        // Gather items at player's position, then nearby tiles (death scatter).
        // Pickup radius of 3 lets the player hoover a death pile from adjacent.
        let _pickupIds = itemsAt(world, p.pos.x, p.pos.y);
        if (_pickupIds.length === 0) {
          const _PICKUP_SCAN = 3;
          for (let _pr = 1; _pr <= _PICKUP_SCAN && _pickupIds.length === 0; _pr++) {
            for (let _pdy = -_pr; _pdy <= _pr; _pdy++) {
              for (let _pdx = -_pr; _pdx <= _pr; _pdx++) {
                if (Math.abs(_pdx) !== _pr && Math.abs(_pdy) !== _pr) continue;
                const nearby = itemsAt(world, (p.pos.x | 0) + _pdx, (p.pos.y | 0) + _pdy);
                for (const nid of nearby) _pickupIds.push(nid);
              }
            }
          }
        }
        if (_pickupIds.length > 0) {
          const top = _pickupIds[0];
          if (top > 0) {
            rulesHandler({ type: 'rules.pickupItem', payload: { itemId: top } });
          }
          break;
        }

        let chestId = 0;
        for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
          if (!isChestIdentity(ni.identity)) continue;
          if (pos.x === p.pos.x && pos.y === p.pos.y) {
            chestId = eid;
            break;
          }
        }
        if (chestId) {
          const chestPos = world.get(chestId, Position);
          if (chestPos) {
            rulesHandler({ type: 'rules.worldTap', payload: { x: chestPos.x, y: chestPos.y } });
          }
        }
        break;
      }
      case "display.traverseStairs": {
        const p = playerEntity(world);
        if (!p) break;

        // Contextual Enter behavior: pick up first (classic convenience),
        // then traverse stairs when nothing is available to pick up.
        const underfoot = itemsAt(world, p.pos.x, p.pos.y);
        if (Array.isArray(underfoot) && underfoot.length > 0) {
          rulesHandler({ type: 'rules.pickupItem', payload: {} });
          break;
        }

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

// Register deity mood sampler for the debug graph (key 7).
// The sampler closure bridges rules-layer deity data to the display-layer graph.
window.dispatchEvent(new CustomEvent('debug:registerDeityMoodSampler', {
  detail: {
    sampler: () => {
      const pe = playerEntity(world);
      if (!pe) return null;
      const dev = /** @type {any} */ (world.get(pe.id, Devotion));
      if (!dev?.deityId) return null;
      const deity = getDeityInstance(dev.deityId);
      if (!deity) return null;
      return deity._queryPrecise();
    }
  }
}));

// Register town economy sampler for the debug graph.
window.dispatchEvent(new CustomEvent('debug:registerEconomySampler', {
  detail: {
    sampler: () => {
      for (const [, ds] of world.query(DungeonState)) {
        if ((ds.currentDepth || 0) !== 0) return null;
      }
      return getTownEconomyData(world);
    }
  }
}));

// Register lighting engine perf sampler for the debug graph (Shift+5).
window.dispatchEvent(new CustomEvent('debug:registerLightingPerfSampler', {
  detail: {
    sampler: () => {
      if (!lightingEngine || typeof lightingEngine.getLastFrameStats !== 'function') return null;
      return lightingEngine.getLastFrameStats();
    }
  }
}));

// Register tile inspector sampler for the debug panel (key 5).
const _TILE_NAMES = {
  0:'void', 1:'floor', 2:'wall', 3:'door', 4:'stair_down', 5:'stair_up',
  6:'grass', 7:'water', 8:'mountain', 9:'tree', 10:'grass_a', 11:'grass_c',
  12:'grass_d', 13:'mountain_b', 14:'mountain_c', 15:'water_deep',
  16:'ice', 17:'shallow_water', 18:'lava', 19:'farmland', 20:'fence', 21:'cobblestone',
};
window.dispatchEvent(new CustomEvent('debug:registerTileInspectorSampler', {
  detail: {
    sampler: () => {
      const pe = playerEntity(world);
      if (!pe) return null;
      const { x, y } = pe.pos;
      const tt = getTile(x, y);
      const entities = [];
      forEachInRadius(world, x, y, 0, (id, _pos) => {
        const ni = world.get(id, NamedIdentity);
        const comps = [];
        for (const [ckey, store] of world._store) {
          try {
            if (store && typeof store.has === 'function' && store.has(id)) {
              const data = (typeof store.get === 'function') ? store.get(id) : null;
              const name = store._comp?.name || ckey?.description || '?';
              comps.push({ name, data });
            }
          } catch { /* ignore */ }
        }
        entities.push({
          id,
          name: ni?.name || '???',
          identity: ni?.identity || '',
          components: comps,
        });
      });
      return {
        x, y, tileType: tt,
        tileName: _TILE_NAMES[tt] || `unknown(${tt})`,
        walkable: isWalkable(x, y), opaque: isOpaque(x, y), flyable: isFlyable(x, y),
        visible: isTileVisible(x, y), explored: isTileExplored(x, y),
        entities,
      };
    }
  }
}));

const { buildGroundPickupDetailAt } = installInventoryDataProvider({
  world,
  getActiveSpellId: () => _activeSpellId,
  isSimUiBlocked,
  getMessageLog: () => messageLog,
  tombstoneRepo,
});

// Camera zoom buttons on the vitals gauge
addEventListener('ui:zoom', (e) => {
  const f = Math.max(0.5, Math.min(1.5, Number(e.detail?.factor) || 1));
  const minS = TILE_PX * 0.5;
  const maxS = TILE_PX * 4.0;
  const current = (cam.targetScale || cam.scale || TILE_PX);
  const next = Math.max(minS, Math.min(maxS, current * f));
  zoomTo(cam, next);
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
    const configuredRange = Math.max(
      1,
      Number.isFinite(spell?.range) ? (Number(spell.range) | 0) : (Number(targetedCfg.fallbackRange) | 0),
    );
    const range = targetedCfg.useVisionRange === true ? getPlayerVisionRange() : configuredRange;
    if (_pendingSpellTargeting?.spellId === id) {
      _pendingSpellTargeting = null;
      _targetCursor = null;
      try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
      return;
    }
    _pendingSpellTargeting = {
      spellId: id,
      spellName,
      range,
      requiresLOS: targetedCfg.requiresLOS === true,
      requiresVisible: targetedCfg.requiresVisible === true,
    };
    // Initialize keyboard cursor at player position
    const _pe = playerEntity(world);
    if (_pe) _targetCursor = { x: _pe.pos.x | 0, y: _pe.pos.y | 0 };
    try {
      messageLog.log({
        text: targetedCfg.describePrompt(range),
        type: 'system',
      });
    } catch (e) { console.debug('[main] messageLog failed:', e); }
    return;
  }

  // Enemy-targeted spells: build visible enemy list, Tab to cycle
  const enemySpellDef = getSpell(id);
  if (enemySpellDef?.targeting === 'enemy') {
    const _pe = playerEntity(world);
    if (!_pe) return;
    const px = _pe.pos.x | 0;
    const py = _pe.pos.y | 0;
    const range = Math.max(1, Number(enemySpellDef.range || 8));
    const blocked = buildBlocksVisionMap(world);
    const isBlocked = blockedCallback(blocked);

    /** @type {Array<{id:number,x:number,y:number}>} */
    const enemies = [];
    if (enemySpellDef.selfTargetable) {
      enemies.push({ id: _pe.id, x: px, y: py });
    }
    forEachInRadius(world, px, py, range, (eid, pos) => {
      if (eid === _pe.id) return;
      const fac = world.get(eid, Faction);
      if (!fac || fac.key !== 'enemy') return;
      const vit = /** @type any */ (world.get(eid, Vitality));
      if (!vit || (vit.hp | 0) <= 0) return;
      if (!hasLOS(px, py, pos.x | 0, pos.y | 0, isBlocked)) return;
      if (!isTileVisible(pos.x | 0, pos.y | 0)) return;
      enemies.push({ id: eid, x: pos.x | 0, y: pos.y | 0 });
    });

    if (enemies.length === 0) {
      try { messageLog.log({ text: 'No visible enemies in range.', type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
      return;
    }

    // Sort by Chebyshev distance (nearest first)
    enemies.sort((a, b) => {
      const da = chebyshevScalar(a.x, a.y, px, py);
      const db = chebyshevScalar(b.x, b.y, px, py);
      return da - db;
    });

    // Toggle off if already targeting same spell
    if (_pendingEnemyTargeting?.spellId === id) {
      _pendingEnemyTargeting = null;
      _targetCursor = null;
      try { messageLog.log({ text: `${enemySpellDef.name} targeting cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
      return;
    }

    _pendingEnemyTargeting = {
      spellId: id,
      spellName: enemySpellDef.name,
      range,
      enemies,
      index: 0,
    };
    _targetCursor = { x: enemies[0].x, y: enemies[0].y };
    _pendingSpellTargeting = null;
    _pendingThrowTargeting = null;
    try {
      messageLog.log({
        text: `Choose target for ${enemySpellDef.name}. Tab to cycle enemies, Enter to confirm, Esc to cancel.`,
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
  if (_pendingEnemyTargeting) {
    const spellName = _pendingEnemyTargeting.spellName;
    _pendingEnemyTargeting = null;
    _targetCursor = null;
    ev.preventDefault();
    try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
    return;
  }
  if (_pendingSpellTargeting) {
    const spellName = _pendingSpellTargeting.spellName;
    _pendingSpellTargeting = null;
    _targetCursor = null;
    ev.preventDefault();
    try { messageLog.log({ text: `${spellName} targeting cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
    return;
  }
  if (_pendingThrowTargeting) {
    const itemName = _pendingThrowTargeting.itemName;
    _pendingThrowTargeting = null;
    _targetCursor = null;
    ev.preventDefault();
    try { messageLog.log({ text: `${bracketizeName(itemName)} throw cancelled.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
  }
});

// Enemy targeting: Tab cycles enemies, Enter confirms
addEventListener('keydown', (ev) => {
  if (!_pendingEnemyTargeting) return;

  if (ev.key === 'Tab') {
    ev.preventDefault();
    ev.stopPropagation();
    const targeting = _pendingEnemyTargeting;
    if (ev.shiftKey) {
      targeting.index = (targeting.index - 1 + targeting.enemies.length) % targeting.enemies.length;
    } else {
      targeting.index = (targeting.index + 1) % targeting.enemies.length;
    }
    const enemy = targeting.enemies[targeting.index];
    _targetCursor = { x: enemy.x, y: enemy.y };
    return;
  }

  if (ev.key === 'Enter') {
    ev.preventDefault();
    ev.stopPropagation();
    const pe = playerEntity(world);
    if (!pe) { _pendingEnemyTargeting = null; _targetCursor = null; return; }
    const targeting = _pendingEnemyTargeting;
    const enemy = targeting.enemies[targeting.index];
    _pendingEnemyTargeting = null;
    _targetCursor = null;
    if (typeof targeting.onConfirm === 'function') {
      targeting.onConfirm(enemy.id);
      return;
    }
    const rulesHandler = makeRulesDispatcher(world, () => pe.id);
    rulesHandler({
      type: 'rules.castActiveSpell',
      payload: {
        spellId: targeting.spellId,
        targetId: enemy.id,
        x: enemy.x,
        y: enemy.y,
      },
    });
    return;
  }

  // Swallow direction keys so they don't become movement while targeting
  const _DIR_KEYS = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s','h','j','k','l','y','u','b','n'];
  if (_DIR_KEYS.includes(ev.key)) {
    ev.preventDefault();
    ev.stopPropagation();
    return;
  }
}, { capture: true });

// Keyboard targeting: arrow/vim/numpad keys move cursor, Enter confirms target
addEventListener('keydown', (ev) => {
  if (!_pendingSpellTargeting && !_pendingThrowTargeting) return;
  if (!_targetCursor) return;

  // Direction keys → dx/dy
  /** @type {Record<string, number[]>} */
  const KEY_DIR = {
    ArrowLeft:  [-1,  0], ArrowRight: [1,  0],
    ArrowUp:    [ 0, -1], ArrowDown:  [0,  1],
    h: [-1,  0], l: [1,  0], k: [ 0, -1], j: [0,  1],
    y: [-1, -1], u: [1, -1], b: [-1,  1], n: [1,  1],
  };
  const dir = KEY_DIR[ev.key];
  if (dir && _targetCursor) {
    const pe = playerEntity(world);
    if (!pe) return;
    ev.preventDefault();
    ev.stopPropagation();
    const nx = _targetCursor.x + dir[0];
    const ny = _targetCursor.y + dir[1];
    const activeRange = _pendingSpellTargeting?.range ?? _pendingThrowTargeting?.range ?? 0;
    const clamped = clampTargetToRange(pe.pos.x, pe.pos.y, nx, ny, activeRange);
    _targetCursor.x = clamped.x | 0;
    _targetCursor.y = clamped.y | 0;
    return;
  }

  // Enter confirms the target
  if (ev.key === 'Enter') {
    ev.preventDefault();
    ev.stopPropagation();
    const pe = playerEntity(world);
    if (!pe) { _pendingSpellTargeting = null; _pendingThrowTargeting = null; _targetCursor = null; return; }
    const tx = _targetCursor.x | 0;
    const ty = _targetCursor.y | 0;
    const px = pe.pos.x | 0;
    const py = pe.pos.y | 0;

    if (_pendingSpellTargeting?.spellId) {
      const pending = _pendingSpellTargeting;
      const clamped = clampTargetToRange(px, py, tx, ty, pending.range);
      const finalTx = clamped.x | 0;
      const finalTy = clamped.y | 0;
      const dist = chebyshevScalar(finalTx, finalTy, px, py);
      if (!(dist > 0)) {
        try { messageLog.log({ text: `${pending.spellName} needs another tile.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
        return;
      }
      if (pending.requiresLOS) {
        const blocked = buildBlocksVisionMap(world);
        const isBlocked = blockedCallback(blocked);
        if (!hasLOS(px, py, finalTx, finalTy, isBlocked)) {
          try { messageLog.log({ text: `${pending.spellName} target must be in line of sight.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
          return;
        }
      }
      if (pending.requiresVisible && !isVisibleAt(finalTx, finalTy)) {
        try { messageLog.log({ text: `${pending.spellName} target must be visible.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
        return;
      }
      _pendingSpellTargeting = null;
      _targetCursor = null;
      const rulesHandler = makeRulesDispatcher(world, () => pe.id);
      rulesHandler({ type: 'rules.castActiveSpell', payload: { spellId: pending.spellId, targetId: pe.id, x: finalTx, y: finalTy } });
      return;
    }

    if (_pendingThrowTargeting?.itemId) {
      const pending = _pendingThrowTargeting;
      if ((pending.actorId | 0) !== (pe.id | 0)) { _pendingThrowTargeting = null; _targetCursor = null; return; }
      const clamped = clampTargetToRange(px, py, tx, ty, pending.range);
      const finalTx = clamped.x | 0;
      const finalTy = clamped.y | 0;
      const dist = chebyshevScalar(finalTx, finalTy, px, py);
      if (!(dist > 0)) {
        try { messageLog.log({ text: `${bracketizeName(pending.itemName)} must target another tile.`, type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
        return;
      }
      _pendingThrowTargeting = null;
      _targetCursor = null;
      const rulesHandler = makeRulesDispatcher(world, () => pe.id);
      rulesHandler({ type: 'rules.throwItem', payload: { itemId: pending.itemId, x: finalTx, y: finalTy } });
      return;
    }
  }
}, { capture: true });

// When user taps "Open Chest" on the ground tooltip
addEventListener('ui:tapOpenChest', (e) => {
  if (isSimUiBlocked()) return;
  const chestId = Number(e.detail?.chestId || 0) | 0;
  if (!(chestId > 0)) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const chestPos = world.get(chestId, Position);
  if (!chestPos) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.worldTap', payload: { x: chestPos.x, y: chestPos.y } });
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
      if (!hasCapacityForItem(world, pe.id, id)) continue;
      // Find and remove from the chest that holds it
      for (const [cid, , ni] of world.query(Position, NamedIdentity)) {
        if (!isChestIdentity(ni.identity)) continue;
        if (!inventoryContains(world, cid, id)) continue;
        transferItem(world, id, cid, pe.id);
        const count = world.get(id, ItemInfo)?.count || 1;
        emitSafe(world, 'item:pickup', { actor: pe.id, itemId: id, count });
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
    if (!isTileVisible(tx, ty)) return;
    const dist = chebyshevScalar(tx, ty, px, py);
    if (dist < bestDist) { bestDist = dist; bestId = id; }
  });

  if (!bestId) {
    try { messageLog.log({ text: 'No target in range.', type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
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

// Scroll of Genocide → prompt for monster name, kill all matching, prevent future spawns
world.on('scroll:genocide', ({ actor }) => {
  const input = prompt('Which monster do you want to genocide?');
  if (!input || !input.trim()) {
    world.emit?.('message', { text: 'The scroll crumbles to dust, unused.', type: 'system' });
    return;
  }
  world.emit?.('scroll:genocide:request', { actor, query: input.trim() });
});

// Scroll of Polymorph → enemy targeting reticle, then transform
world.on('scroll:polymorph', ({ actor }) => {
  const _pe = playerEntity(world);
  if (!_pe) return;
  const px = _pe.pos.x | 0;
  const py = _pe.pos.y | 0;
  const range = 8;
  const blocked = buildBlocksVisionMap(world);
  const isBlocked = blockedCallback(blocked);

  /** @type {Array<{id:number,x:number,y:number}>} */
  const enemies = [];
  forEachInRadius(world, px, py, range, (eid, pos) => {
    if (eid === _pe.id) return;
    const fac = world.get(eid, Faction);
    if (!fac || fac.key !== 'enemy') return;
    const vit = /** @type any */ (world.get(eid, Vitality));
    if (!vit || (vit.hp | 0) <= 0) return;
    if (!hasLOS(px, py, pos.x | 0, pos.y | 0, isBlocked)) return;
    if (!isTileVisible(pos.x | 0, pos.y | 0)) return;
    enemies.push({ id: eid, x: pos.x | 0, y: pos.y | 0 });
  });

  if (enemies.length === 0) {
    try { messageLog.log({ text: 'No visible enemies to polymorph.', type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
    return;
  }

  enemies.sort((a, b) => {
    const da = chebyshevScalar(a.x, a.y, px, py);
    const db = chebyshevScalar(b.x, b.y, px, py);
    return da - db;
  });

  _pendingEnemyTargeting = {
    spellId: '__scroll_polymorph__',
    spellName: 'Scroll of Polymorph',
    range,
    enemies,
    index: 0,
    onConfirm: (enemyId) => {
      let targetIdentity;
      const traits = world.get(actor, Traits);
      if (traits?.polymorph_control) {
        const input = prompt('Polymorph into which creature?');
        if (!input || !input.trim()) {
          world.emit?.('message', { text: 'The scroll fizzles.', type: 'system' });
          return;
        }
        const query = input.trim().toLowerCase();
        let best = null;
        let bestScore = Infinity;
        for (const monster of MONSTERS) {
          const name = monster.name.toLowerCase();
          if (name === query) { best = monster; bestScore = 0; break; }
          const score = name.startsWith(query) ? 1
            : name.includes(query) ? 2
            : query.startsWith(name) ? 3
            : Infinity;
          if (score < bestScore) { bestScore = score; best = monster; }
        }
        if (!best || bestScore > 4) {
          world.emit?.('message', { text: 'You cannot picture such a creature. The scroll fizzles.', type: 'system' });
          return;
        }
        targetIdentity = best.id;
      } else {
        const allIds = listAllMonsterIds();
        targetIdentity = allIds[Math.floor(world.rand() * allIds.length)];
      }

      let depth = 1;
      for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth ?? 1; }

      const fromIdent = world.get(enemyId, NamedIdentity);
      const fromName = fromIdent?.identity ? (getMonster(fromIdent.identity)?.name || fromIdent.identity) : 'creature';

      try {
        world.add(enemyId, Polymorph, { targetIdentity, depth, trigger: 'scroll', once: true, revealed: false, hookKey: '' });
      } catch {
        world.mutate(enemyId, Polymorph, (r) => { r.targetIdentity = targetIdentity; r.depth = depth; r.revealed = false; });
      }

      const spawnedId = resolvePolymorph(world, { entityId: enemyId, targetIdentity, depth, actorId: actor, trigger: 'scroll', reason: 'scroll_polymorph' });
      const toName = getMonster(targetIdentity)?.name || targetIdentity;
      if (spawnedId > 0) {
        world.emit?.('message', { text: `The ${fromName} shudders and transforms into a ${toName}!`, type: 'system' });
        const pos = world.get(spawnedId, Position);
        if (pos) world.emit?.('scroll:polymorph:vfx', { x: pos.x | 0, y: pos.y | 0 });
      } else {
        world.emit?.('message', { text: 'The scroll fizzles.', type: 'system' });
      }
    },
  };
  _targetCursor = { x: enemies[0].x, y: enemies[0].y };
  _pendingSpellTargeting = null;
  _pendingThrowTargeting = null;
  try {
    messageLog.log({
      text: 'Choose target for Scroll of Polymorph. Tab to cycle enemies, Enter to confirm, Esc to cancel.',
      type: 'system',
    });
  } catch (e) { console.debug('[main] messageLog failed:', e); }
});

// Scroll of Aggravation → set all living enemies to hunting with player's position
world.on('scroll:aggravation', ({ actor }) => {
  const pe = playerEntity(world);
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

// Scroll of Teleportation → move player to a random walkable tile on this floor
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
});

// Scroll of Summoning → spawn hostile monsters near player
world.on('scroll:summoning', ({ actor }) => {
  const pos = world.get(actor, Position);
  if (!pos) return;
  let depth = 1;
  for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth ?? 1; }
  const rng = createRng(((world.seed ^ (world.step * 0x1337 + 0xDEAD)) >>> 0));
  const count = 2 + (world.rand() * 3 | 0); // 2-4 monsters
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

// Scroll of Decay → destroy organic items (scrolls, potions, food) in player's pack
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
  // Destroy 1-3 random organic items using world.rand() shuffle
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

// Wait button → dispatch wait action
addEventListener('ui:wait', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.wait', payload: {} });
});

// Search button → dispatch search action
addEventListener('ui:search', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.search', payload: {} });
});

// Posture button → cycle combat posture as a turn action
addEventListener('ui:cyclePosture', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.cyclePosture', payload: {} });
});

addEventListener('ui:quickInteract', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.quickInteract', payload: {} });
});

// Pray button → dispatch pray action
addEventListener('ui:pray', () => {
  if (isSimUiBlocked()) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.pray', payload: {} });
});

addEventListener("ui:openBubbleDialog", (ev) => {
  const detail = /** @type {CustomEvent} */ (ev).detail || {};
  openBubbleDialog(detail);
});

addEventListener("ui:closeBubbleDialog", () => {
  closeBubbleDialog();
});

world.on("dungeon:transitioned", () => {
  closeBubbleDialog();
});

world.on("dungeon:teleport-depth", () => {
  closeBubbleDialog();
});

addEventListener("keydown", (ev) => {
  if (!_bubbleDialogState.open) return;
  if (ev.key !== "Escape") return;
  window.dispatchEvent(new CustomEvent("ui:requestDialogClose", {
    detail: { sessionId: _bubbleDialogState.sessionId },
  }));
  ev.preventDefault();
});

// Spell picker data feed and selection
addEventListener('ui:requestSpellData', () => {
  const spells = spellCtrl.learnedSpells().map((spell) => {
    const cd = getSpellCooldown(world, spell.id);
    return {
      ...spell,
      detailLines: describeSpellDetailLines(spell),
      targetEffects: describeSpellTargetEffects(spell),
      cdRemaining: cd ? cd.remaining : 0,
      cdMax: cd ? cd.max : 0,
    };
  });
  const activeSpellId = ensureActiveSpell();
  try { window.dispatchEvent(new CustomEvent('ui:spellData', { detail: { spells, activeSpellId } })); } catch (e) { console.debug('[main] dispatch ui:spellData:', e); }
});
addEventListener('ui:selectActiveSpell', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const spellId = e?.detail?.spellId;
  const bindSlot = e?.detail?.bindSlot;
  if (typeof spellId === 'string' && spellId.length) {
    // If binding to a specific action bar slot, assign it there
    if (typeof bindSlot === 'number' && bindSlot >= 0 && bindSlot < 6) {
      spellCtrl.setSlot(bindSlot, spellId);
    }
    setActiveSpell(spellId);
    // Refresh inventory so the brain-slot active marker updates
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
  }
});

// Action bar spell slot quick-cast (1-6 keys or click)
addEventListener('ui:castSpellSlot', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const slot = Number(e?.detail?.slot);
  if (!(slot >= 0 && slot < 6)) return;
  const slots = spellCtrl.getActionBarSlots();
  const spellId = slots[slot];
  if (!spellId) return;
  setActiveSpell(spellId);
  window.dispatchEvent(new CustomEvent('ui:castActiveSpell'));
});

// Pinned spell dock: set a spell into a pinned slot
addEventListener('ui:setPinnedSpell', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const slot = Number(e?.detail?.slot);
  const spellId = e?.detail?.spellId;
  if (!(slot >= 0 && slot < 4)) return;
  if (typeof spellId === 'string' && spellId.length) {
    spellCtrl.setPinnedSlot(slot, spellId);
  }
});

// Pinned spell dock: cast a pinned spell
addEventListener('ui:castPinnedSpell', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const slot = Number(e?.detail?.slot);
  if (!(slot >= 0 && slot < 4)) return;
  const slots = spellCtrl.getPinnedSpellSlots();
  const spellId = slots[slot];
  if (!spellId) return;
  setActiveSpell(spellId);
  window.dispatchEvent(new CustomEvent('ui:castActiveSpell'));
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
  getSpell,
  resolveItemDisplayName,
  isVisibleAt: isTileVisible,
  components: {
    Equipment,
    ItemInfo,
    NamedIdentity,
    Owner,
    Pet,
    Player,
    Position,
    Devotion,
    Anatomy,
    DungeonState,
    Status,
  },
  soundApi: {
    evaluateSound,
    thresholdForTier,
    HEARING_TIERS,
  },
});

function buildQuickItemPinDetailFromWorld(itemId) {
  const id = Number(itemId || 0) | 0;
  const identity = String(world.get(id, NamedIdentity)?.identity || '');
  return {
    itemId: id,
    identity,
    pinKey: identity || (id > 0 ? `id:${id}` : ''),
  };
}

// Keep quick-slot and pinned chips in sync when items are consumed.
world.on('item:used', ({ itemId }) => {
  const detail = buildQuickItemPinDetailFromWorld(itemId);
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail })); } catch (e) { console.debug('[main] dispatch ui:itemUsed:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});

// Keep quick-slot and pinned chips in sync when items are thrown.
world.on('item:thrown', ({ itemId }) => {
  const detail = buildQuickItemPinDetailFromWorld(itemId);
  try { window.dispatchEvent(new CustomEvent('ui:itemThrown', { detail })); } catch (e) { console.debug('[main] dispatch ui:itemThrown:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});

function findScrollOfIdentifyInPlayerInventory(playerId) {
  for (const id of inventoryItems(world, playerId)) {
    const ni = world.get(id, NamedIdentity);
    if (ni && ni.identity === 'scroll_identify') return id;
  }
  return 0;
}

function buildQuickChipEquippedComparison(ownerId, itemId, slot) {
  const eq = world.get(ownerId, Equipment);
  if (!eq) return null;

  const normalized = String(slot || '').trim().toLowerCase();
  if (!normalized) return null;
  const candidateSlots = normalized === 'ring' ? ['ring1', 'ring2'] : [normalized];
  const validSlots = candidateSlots.filter((name) => GEAR_SLOTS.includes(name));
  if (!validSlots.length) return null;

  for (const gearSlot of validSlots) {
    const eqId = Number(eq[gearSlot] || 0) | 0;
    if (!(eqId > 0) || eqId === itemId) continue;
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

world.on('item:identified', ({ actor, identity }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  const ident = String(identity || '');
  if (!ident) return;
  const inv = world.get(pe.id, Inventory);
  if (!inv) return;
  for (const itemId of inventoryItems(world, pe.id)) {
    const ni = world.get(itemId, NamedIdentity);
    if (!ni || String(ni.identity || '') !== ident) continue;
    const displayItem = buildItemDisplayData(world, itemId);
    try {
      window.dispatchEvent(new CustomEvent('ui:itemIdentified', {
        detail: {
          item: {
            ...(displayItem && typeof displayItem === 'object' ? displayItem : {}),
            id: Number(itemId),
            identity: ident,
            type: world.get(itemId, ItemInfo)?.type || 'item',
            slot: world.get(itemId, ItemInfo)?.slot || '',
            name: resolveItemDisplayName(world, itemId),
            count: world.get(itemId, ItemInfo)?.count || 1,
            rarityName: world.get(itemId, ItemInfo)?.rarityName || 'common',
            glyph: palette?.[ident]?.glyph || '',
            glyphColor: palette?.[ident]?.fg || '#cfe8ff',
            hasScrollOfIdentify: false,
          }
        }
      }));
    } catch (e) { console.debug('[main] dispatch ui:itemIdentified:', e); }
    break;
  }
});

throwFx.installListeners();
pickupFx.installListeners();

world.on('item:pickup', ({ actor, itemId, count }) => {
  const id = Number(itemId || 0) | 0;
  if (id > 0) { _deathLootArcs.delete(id); _deathLootRestPos.delete(id); }
  const info = world.get(itemId, ItemInfo);
  if (!info || info.type !== 'currency') return;
  const pos = world.get(actor, Position);
  if (!pos) return;
  const n = Number.isFinite(count) ? Number(count) : Number(info.count||1);
  if (n > 0) {
    ftext.addGold(pos.x, pos.y, n, { color: '#ffcd45' });
  }
});

function lootRarityColorHex(itemInfo) {
  const type = String(itemInfo?.type || "").toLowerCase();
  if (type === "currency") return "#ffd34d";
  const rarity = String(itemInfo?.rarityName || "common").toLowerCase();
  if (rarity === "legendary") return "#ff8a3d";
  if (rarity === "epic") return "#c77dff";
  if (rarity === "rare") return "#ffd54f";
  if (rarity === "magic") return "#63b3ff";
  return "#c2c2c2";
}

/** @type {Map<number, {fromX:number,fromY:number,toX:number,toY:number,start:number,duration:number,peak:number}>} */
const _deathLootArcs = new Map();
/** @type {Map<number, {x:number,y:number}>} Persistent visual rest positions after arc completes */
const _deathLootRestPos = new Map();
world.on("damaged", ({ target, amount, projectileDelay }) => {
  const tid = Number(target || 0) | 0;
  const d = Number(projectileDelay || 0);
  const dmg = Math.max(0, Number(amount) || 0);
  if (tid > 0 && d > 0 && dmg > 0) {
    impactTracker.record(tid, dmg, _fxTime + d);
    _pendingHitTints.push({ fireAt: _fxTime + d, id: tid });
  } else if (tid > 0 && dmg > 0) {
    triggerHitTint(tid);
  }
});

function seededUnit(seed) {
  const s = (Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0;
  return (s & 0xffff) / 0xffff;
}

function scheduleDeathLootArc(itemId, origin, at, delayOffset, impulse) {
  const id = Number(itemId || 0) | 0;
  if (!(id > 0)) return;
  const fx = _fxTime + (Number(delayOffset) || 0);
  const fromX = Number(origin?.x);
  const fromY = Number(origin?.y);
  let toX = Number(at?.x);
  let toY = Number(at?.y);
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return;

  // Per-item deterministic jitter (two independent axes)
  const j1 = seededUnit(id ^ (world.step | 0));
  const j2 = seededUnit((id * 0x9e3779b9) ^ (world.step | 0));

  // ── Weight physics ──────────────────────────────────────────────
  // Steep curve: coins/scrolls SAIL, swords slide, corpses crater.
  // Feather items (< 0.3) get a boost so they feel airborne.
  const itemInfo = world.get(id, ItemInfo);
  const weight = Math.max(0, Number(itemInfo?.weight || 0));
  const wRaw = 1 / (1 + weight * 0.7);             // steeper falloff
  const feather = weight < 0.3 ? 1.3 - weight : 1; // light = extra floaty
  const wt = Math.min(1.5, wRaw * feather);         // cap at 1.5

  // Separate multipliers for different physics aspects:
  // wScatter  — how far it travels horizontally
  // wLift     — how high the arc peaks (feathers get extra hangtime)
  // wHang     — how long the flight lasts (feathers linger)
  //
  // Crits HAMMER everything — bigger scatter, taller arcs, more hang.
  // Even heavy armor gets launched on a crit. Coins go orbital.
  const crit = !!(impulse?.critical);
  const critAmp = crit ? 1.55 : 1;            // raw distance/spread boost
  const critLift = crit ? 1.7 : 1;            // arcs POP higher
  const critHang = crit ? 1.35 : 1;           // linger in the air longer
  const wScatter = wt * critAmp;
  const wLift    = Math.min(2.8, wt * (weight < 0.5 ? 1.4 : 1.0) * critLift);
  const wHang    = Math.min(2.2, wt * (weight < 0.5 ? 1.3 : weight > 5 ? 0.7 : 1.0) * critHang);

  // ── Impulse ────────────────────────────────────────────────────
  const idx = Number(impulse?.dx || 0);
  const idy = Number(impulse?.dy || 0);
  const force = Math.max(0, Math.min(3, Number(impulse?.force || 0)));
  const cause = String(impulse?.cause || '');

  // ── Scatter profiles ───────────────────────────────────────────
  // push     = directional travel along impulse vector
  // fan      = perpendicular spread (items don't stack on a line)
  // drift    = random scatter when there's no directional impulse
  // All values are BASE + PER_FORCE * force, then * wScatter.
  // Tuned HOT: a frost bolt on a coin should send it 2+ tiles.
  let pushBase = 0.60, pushPerF = 0.45;
  let fanBase  = 0.80, fanPerF  = 0.55;
  let drift    = 0.25;

  if (cause === 'melee' || cause === 'retaliation') {
    // Melee: beefy directional whack, wide fan on crits
    pushBase = 0.70; pushPerF = 0.55;
    fanBase  = 1.00; fanPerF  = 0.70;
  } else if (cause === 'ranged') {
    // Arrow: TIGHT cone, punches hard forward, minimal fan
    pushBase = 1.00; pushPerF = 0.65;
    fanBase  = 0.35; fanPerF  = 0.20;
  } else if (cause === 'spell:phase_strike') {
    // Phase strike: EXPLOSIVE. Everything flies. Arcade mode.
    pushBase = 1.20; pushPerF = 0.80;
    fanBase  = 1.30; fanPerF  = 0.90;
  } else if (cause === 'spell:smite' || cause === 'spell:meteor') {
    // From above: radial starburst, no directional bias
    const angle = (j1 * 2 - 1) * Math.PI;
    const radial = (0.80 + 0.70 * force) * wScatter;
    toX += Math.cos(angle) * radial;
    toY += Math.sin(angle) * radial;
    // Extra random wobble so items don't form a perfect ring
    toX += (j2 - 0.5) * 0.4 * wScatter;
    toY += (j1 - 0.5) * 0.4 * wScatter;
    pushBase = 0; pushPerF = 0; fanBase = 0; fanPerF = 0;
  } else if (cause === 'spell:agony' || cause === 'spell:drain_life:tick') {
    // Agony: slow ooze, items barely shift
    pushBase = 0.15; pushPerF = 0.08;
    fanBase  = 0.20; fanPerF  = 0.10;
    drift = 0.12;
  } else if (cause.startsWith('spell:')) {
    // Generic spell (frost, shadow_bolt, lightning, scorch, blastwave)
    // Strong directional blast — frost bolt sends coins flying
    pushBase = 0.85; pushPerF = 0.60;
    fanBase  = 0.90; fanPerF  = 0.60;
  } else if (!cause || cause === 'starvation') {
    // Crumple: items just... fall out
    pushBase = 0; pushPerF = 0;
    fanBase  = 0; fanPerF  = 0;
    drift = 0.15;
  }

  // Burn/trap: very low, items slump
  if (cause.includes('burn') || cause === 'spike_trap' || cause === 'shock_trap') {
    pushBase = 0.10; pushPerF = 0.05;
    fanBase  = 0.15; fanPerF  = 0.08;
    drift = 0.10;
  }

  // Apply directional scatter
  if ((idx || idy) && (pushBase > 0 || fanBase > 0)) {
    const push = (pushBase + pushPerF * force) * wScatter;
    toX += idx * push;
    toY += idy * push;
    // Perpendicular fan: both sides of the impulse line
    const perpX = -idy;
    const perpY = idx;
    const fan = (j1 - 0.5) * (fanBase + fanPerF * force) * wScatter;
    toX += perpX * fan;
    toY += perpY * fan;
  }
  // Random drift (always applied — gives urn/chest loot some spread too)
  toX += (j1 - 0.5) * drift * wScatter;
  toY += (j2 - 0.5) * drift * wScatter;

  // ── Wall clamping ──────────────────────────────────────────────
  // Binary search along the flight path to find last walkable point.
  const landTileX = Math.round(toX);
  const landTileY = Math.round(toY);
  if (!isWalkable(landTileX, landTileY)) {
    let lo = 0, hi = 1;
    for (let step = 0; step < 8; step++) {
      const mid = (lo + hi) * 0.5;
      const mx = Math.round(fromX + (toX - fromX) * mid);
      const my = Math.round(fromY + (toY - fromY) * mid);
      if (isWalkable(mx, my)) lo = mid; else hi = mid;
    }
    toX = fromX + (toX - fromX) * lo;
    toY = fromY + (toY - fromY) * lo;
  }

  const fdx = toX - fromX;
  const fdy = toY - fromY;
  const dist = Math.sqrt(fdx * fdx + fdy * fdy);
  if (dist > 5) return; // raised cap for big scatter

  // ── Arc timing ─────────────────────────────────────────────────
  // Duration = how long the item is in the air (wHang makes feathers linger)
  // Peak     = max height of the parabola (wLift makes feathers soar)
  let durBase = 0.30, durDist = 0.12, durForce = 0.05;
  let pkBase  = 0.30, pkDist  = 0.25, pkForce  = 0.12;

  if (cause === 'spell:phase_strike') {
    // Snappy launch, huge peak — items POP upward
    durBase = 0.22; durDist = 0.08; durForce = 0.03;
    pkBase  = 0.50; pkDist  = 0.35; pkForce  = 0.20;
  } else if (cause === 'spell:smite' || cause === 'spell:meteor') {
    // Dramatic eruption: tall arcs, moderate duration
    durBase = 0.28; durDist = 0.10; durForce = 0.04;
    pkBase  = 0.55; pkDist  = 0.40; pkForce  = 0.18;
  } else if (cause === 'spell:agony' || cause === 'spell:drain_life:tick') {
    // Slow, heavy, low arcs — items ooze out
    durBase = 0.55; durDist = 0.18; durForce = 0.08;
    pkBase  = 0.12; pkDist  = 0.08; pkForce  = 0.04;
  } else if (cause.includes('burn')) {
    // Crumble: barely lifts, slow settle
    durBase = 0.45; durDist = 0.14; durForce = 0.05;
    pkBase  = 0.10; pkDist  = 0.06; pkForce  = 0.03;
  } else if (cause === 'ranged') {
    // Arrow: FAST, flat trajectory — items punch forward low
    durBase = 0.18; durDist = 0.07; durForce = 0.03;
    pkBase  = 0.20; pkDist  = 0.15; pkForce  = 0.06;
  } else if (cause === 'melee' || cause === 'retaliation') {
    // Melee: satisfying medium arc
    durBase = 0.28; durDist = 0.10; durForce = 0.04;
    pkBase  = 0.35; pkDist  = 0.28; pkForce  = 0.14;
  } else if (cause.startsWith('spell:')) {
    // Generic spell: generous arcs
    durBase = 0.30; durDist = 0.10; durForce = 0.04;
    pkBase  = 0.40; pkDist  = 0.30; pkForce  = 0.14;
  }

  const duration = (durBase + dist * durDist + j1 * 0.08 + force * durForce) * wHang;
  const peak = (pkBase + dist * pkDist + j2 * 0.12 + force * pkForce) * wLift;
  _deathLootArcs.set(id, {
    fromX,
    fromY,
    toX,
    toY,
    start: fx,
    duration,
    peak,
  });
}

function deathLootArcPos(itemId) {
  const id = Number(itemId || 0) | 0;
  if (!(id > 0)) return null;
  const rec = _deathLootArcs.get(id);
  if (!rec) {
    const rest = _deathLootRestPos.get(id);
    return rest ? { x: rest.x, y: rest.y, airborne: false } : null;
  }
  const t = (Math.max(0, _fxTime - rec.start)) / Math.max(0.001, rec.duration);
  if (t >= 1) {
    _deathLootArcs.delete(id);
    _deathLootRestPos.set(id, { x: rec.toX, y: rec.toY });
    return { x: rec.toX, y: rec.toY, airborne: false };
  }
  const ease = 1 - Math.pow(1 - t, 3);
  const lift = 4 * rec.peak * ease * (1 - ease);
  return {
    x: rec.fromX + (rec.toX - rec.fromX) * ease,
    y: rec.fromY + (rec.toY - rec.fromY) * ease - lift,
    airborne: true,
  };
}

world.on("item:dropped", ({ itemId, actor, source, origin, at, targetId, impulse }) => {
  const src = String(source || "");
  if (src === "death") {
    const actorId = Number(actor || 0) | 0;
    const delay = actorId > 0 ? impactTracker.delayFor(actorId, _fxTime) : 0;
    scheduleDeathLootArc(itemId, origin, at, delay, impulse || null);
  } else if (src === "urn") {
    scheduleDeathLootArc(itemId, origin, at, 0);
  } else if (src === "chest") {
    const chestId = Number(targetId || 0) | 0;
    const chestPos = chestId > 0 ? world.get(chestId, Position) : null;
    const o = origin || (chestPos ? { x: chestPos.x | 0, y: chestPos.y | 0 } : null);
    if (o) scheduleDeathLootArc(itemId, o, at, 0);
  }
});

world.on("chest:burst", ({ actor, targetId, origin, drops }) => {
  const ox = Number(origin?.x || 0);
  const oy = Number(origin?.y || 0);
  if (Number.isFinite(ox) && Number.isFinite(oy)) {
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18;
      const spd = 0.12 + (i % 3) * 0.03;
      fx.pool.spawn(new Particle({
        x: ox + Math.cos(a) * 0.12,
        y: oy + Math.sin(a) * 0.08,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 0.04,
        ay: 0.06,
        life: 0.28 + (i % 4) * 0.04,
        size0: 0.05,
        size1: 0.018,
        r: 199,
        g: 125,
        b: 255,
        a0: 0.66,
      }));
    }
  }

  const burstDrops = Array.isArray(drops) ? drops : [];
  for (let i = 0; i < burstDrops.length; i++) {
    const d = burstDrops[i];
    const itemId = Number(d?.itemId || 0) | 0;
    const atX = Number(d?.at?.x || 0);
    const atY = Number(d?.at?.y || 0);
    const info = world.get(itemId, ItemInfo);
    const color = lootRarityColorHex(info);
    const rgb = color.startsWith("#")
      ? {
        r: Number.parseInt(color.slice(1, 3), 16) || 255,
        g: Number.parseInt(color.slice(3, 5), 16) || 255,
        b: Number.parseInt(color.slice(5, 7), 16) || 255,
      }
      : { r: 255, g: 255, b: 255 };
    fx.pool.spawn(new Particle({
      x: atX,
      y: atY - 0.05,
      vx: 0,
      vy: -0.03,
      ay: -0.02,
      life: 0.22,
      size0: 0.055,
      size1: 0.014,
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      a0: 0.62,
    }));
  }

  const pe = playerEntity(world);
  if (!pe || pe.id !== (Number(actor) | 0)) return;
  const chestName = String(world.get(Number(targetId) | 0, NamedIdentity)?.name || "chest").toLowerCase();
  try { messageLog.log({ text: `You crack open the ${chestName}. Loot spills out.`, type: "system" }); } catch {}
  if (DEBUG_DISABLE_LEGACY_FLOOR_PICKUP_TOOLTIP) {
    try { window.dispatchEvent(new CustomEvent("ui:hideGroundItem")); } catch {}
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
    return;
  }
  const detail = buildGroundPickupDetailAt(pe.id, pe.pos.x, pe.pos.y);
  if (detail) {
    try { window.dispatchEvent(new CustomEvent("ui:showGroundItem", { detail })); } catch {}
  } else {
    try { window.dispatchEvent(new CustomEvent("ui:hideGroundItem")); } catch {}
  }
  try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch {}
});

world.on("chest:empty", ({ actor, targetId }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== (Number(actor) | 0)) return;
  const chestName = String(world.get(Number(targetId) | 0, NamedIdentity)?.name || "chest").toLowerCase();
  try { messageLog.log({ text: `The ${chestName} is empty.`, type: "system" }); } catch {}
});
// Centralized quick-slot chip for any item entering player inventory
world.on('inventory:added', ({ ownerId, itemId }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== ownerId) return;
  const info = world.get(itemId, ItemInfo);
  if (!info || info.type === 'currency') return;
  if (info.noQuickChip === true) return;
  if (shouldSuppressRecentPickupChipForEquippedDuplicate(world, ownerId, itemId)) return;
  const hasScrollOfIdentify = findScrollOfIdentifyInPlayerInventory(pe.id) > 0;
  const displayItem = buildItemDisplayData(world, itemId);
  const canApply = isApplyTool(world, pe.id, itemId);
  const applyTargetCount = canApply ? listApplyTargetsForTool(world, pe.id, itemId).length : 0;
  if (displayItem?.noQuickChip === true) return;
  try {
    window.dispatchEvent(new CustomEvent('ui:recentPickup', {
      detail: {
        item: {
          ...(displayItem && typeof displayItem === 'object' ? displayItem : {}),
          id: Number(itemId),
          identity: world.get(itemId, NamedIdentity)?.identity || '',
          type: info.type || 'item',
          slot: info.slot || '',
          name: resolveItemDisplayName(world, itemId),
          count: info.count || 1,
          rarityName: info.rarityName || 'common',
          equippedComparison: buildQuickChipEquippedComparison(ownerId, Number(itemId), info.slot),
          glyph: palette?.[world.get(itemId, NamedIdentity)?.identity]?.glyph || '',
          glyphColor: palette?.[world.get(itemId, NamedIdentity)?.identity]?.fg || '#cfe8ff',
          hasScrollOfIdentify,
          canApply,
          applyTargetCount,
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

      case 'aggressive':
        petState.state = 'aggressive';
        petState.targetX = null;
        petState.targetY = null;
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

  // Broadcast same command to all summoned creatures with PetState
  for (const [sumId, fac, vit] of world.query(Faction, Vitality)) {
    if (!fac || fac.key !== 'summoned') continue;
    if (!vit || vit.hp <= 0) continue;
    const sumPos = world.get(sumId, Position);
    if (!sumPos) continue;
    const sumState = world.get(sumId, PetState);
    if (!sumState) continue;

    const prevState = sumState.state;
    switch (command) {
      case 'follow':
        sumState.state = 'following';
        sumState.targetX = null;
        sumState.targetY = null;
        sumState.targetItemId = 0;
        break;
      case 'stay':
        sumState.state = 'staying';
        sumState.targetX = sumPos.x;
        sumState.targetY = sumPos.y;
        sumState.targetItemId = 0;
        break;
      case 'guard':
        sumState.state = 'guarding';
        sumState.targetX = sumPos.x;
        sumState.targetY = sumPos.y;
        sumState.targetItemId = 0;
        break;
      case 'aggressive':
        sumState.state = 'aggressive';
        sumState.targetX = null;
        sumState.targetY = null;
        sumState.targetItemId = 0;
        break;
      case 'idle':
        sumState.state = 'idle';
        sumState.targetX = null;
        sumState.targetY = null;
        sumState.targetItemId = 0;
        break;
      case 'fetch':
        break; // No fetch for summons (no inventory)
    }

    if (prevState !== sumState.state) {
      sumState.stateEnteredTurn = world.step;
      sumState.commandCooldown = 0;
      try {
        world.emit?.('summon:state:changed', {
          id: sumId,
          prevState,
          newState: sumState.state,
          command
        });
      } catch (e) { console.debug('[main] emit summon:state:changed failed:', e); }
    }
  }
});

// Rotate pet state through common commands (instant, no tick)
window.addEventListener('ui:rotatePetState', () => {
  // State rotation cycle: following → staying → guarding → aggressive → idle → following
  const stateOrder = ['following', 'staying', 'guarding', 'aggressive', 'idle'];

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
                     nextState === 'aggressive' ? 'aggressive' :
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

  // Broadcast same rotation to all summoned creatures with PetState
  for (const [sumId, fac, vit] of world.query(Faction, Vitality)) {
    if (!fac || fac.key !== 'summoned') continue;
    if (!vit || vit.hp <= 0) continue;
    const sumPos = world.get(sumId, Position);
    if (!sumPos) continue;
    const sumState = world.get(sumId, PetState);
    if (!sumState) continue;

    const prevSumState = sumState.state;
    const curIdx = stateOrder.indexOf(sumState.state);
    const nextSumState = curIdx >= 0
      ? stateOrder[(curIdx + 1) % stateOrder.length]
      : 'following';

    sumState.state = nextSumState;
    if (nextSumState === 'staying' || nextSumState === 'guarding') {
      sumState.targetX = sumPos.x;
      sumState.targetY = sumPos.y;
      sumState.targetItemId = 0;
    } else {
      sumState.targetX = null;
      sumState.targetY = null;
      sumState.targetItemId = 0;
    }

    if (prevSumState !== sumState.state) {
      sumState.stateEnteredTurn = world.step;
      sumState.commandCooldown = 0;
      const cmd = nextSumState === 'staying' ? 'stay' :
                  nextSumState === 'guarding' ? 'guard' :
                  nextSumState === 'aggressive' ? 'aggressive' :
                  nextSumState === 'idle' ? 'idle' : 'follow';
      try {
        world.emit?.('summon:state:changed', {
          id: sumId,
          prevState: prevSumState,
          newState: sumState.state,
          command: cmd
        });
      } catch (e) { console.debug('[main] emit summon:state:changed failed:', e); }
    }
  }
});


// Stair traversal logic (messages handled in messageWiring)
const RETURN_PORTAL_IDENTITY = 'return_portal';

/** @type {{
 *   direction?: 'up' | 'down',
 *   targetDepth?: number,
 *   targetPos?: { x: number, y: number },
 *   stairPos?: { x: number, y: number } | null,
 *   fragActorsAtTarget?: boolean,
 *   returnTicket?: { depth: number, x: number, y: number } | null,
 * } | null} */
let _pendingStairTransition = null;
const STAIR_TRANSITION_COOLDOWN_MS = 220;
let _stairTransitionInFlight = false;
let _stairTransitionLockUntilMs = 0;

function isStairTransitionLocked() {
  return _stairTransitionInFlight || Date.now() < _stairTransitionLockUntilMs;
}

function armStairTransitionCooldown() {
  _stairTransitionLockUntilMs = Date.now() + STAIR_TRANSITION_COOLDOWN_MS;
}

function queueStairTransition(direction, stairX = null, stairY = null) {
  const dir = direction === 'up' ? 'up' : (direction === 'down' ? 'down' : null);
  if (!dir) return;
  // Keep transitions at the app loop boundary so we never mutate floors mid-tick.
  if (_pendingStairTransition || isStairTransitionLocked()) return;
  const stairPos = (stairX != null && stairY != null) ? { x: stairX, y: stairY } : null;
  _pendingStairTransition = { direction: dir, stairPos };
}

function queueDepthTransition(targetDepth, opts = {}) {
  const depth = Number(targetDepth);
  if (!Number.isFinite(depth)) return;
  // Keep transitions at the app loop boundary so we never mutate floors mid-tick.
  if (_pendingStairTransition || isStairTransitionLocked()) return;
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
    homecomingLanding: opts?.homecomingLanding === true,
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

function spawnReturnPortal(ticket, atFountain = false) {
  const pe = playerEntity(world);
  if (!pe) return 0;
  destroyReturnPortals();

  /** @type {{ x:number, y:number }|null} */
  let fountainPos = null;
  /** @type {{ x:number, y:number }|null} */
  let bedPos = null;
  /** @type {{ x:number, y:number }|null} */
  let chestPos = null;
  for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni?.identity === 'fountain') {
      fountainPos = { x: pos.x | 0, y: pos.y | 0 };
    } else if (ni?.identity === 'bed_home') {
      bedPos = { x: pos.x | 0, y: pos.y | 0 };
    } else if (ni?.identity === 'chest') {
      chestPos = { x: pos.x | 0, y: pos.y | 0 };
    }
  }

  let portalPos;
  if (atFountain && fountainPos) {
    // Place portal one tile south of the fountain so it's visible and accessible
    portalPos = { x: fountainPos.x, y: fountainPos.y + 1 };
  } else if (bedPos && chestPos) {
    portalPos = {
      x: Math.floor((bedPos.x + chestPos.x) / 2),
      y: Math.floor((bedPos.y + chestPos.y) / 2),
    };
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
  if (isStairTransitionLocked()) return;
  _stairTransitionInFlight = true;
  _pendingStairTransition = null;

  try {
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
      transitionToDepth(world, newDepth, { x: 0, y: 0 }, { direction, stairPos: pending.stairPos || null, tombstoneRepo });
    }

    // Homecoming landing: reposition player at the town fountain
    if (newDepth === 0 && pending.homecomingLanding) {
      let fountainPos = null;
      for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
        if (ni?.identity === 'fountain') {
          fountainPos = { x: pos.x | 0, y: pos.y | 0 };
          break;
        }
      }
      if (fountainPos) {
        for (const [id] of world.query(Player)) {
          world.set(id, Position, { x: fountainPos.x, y: fountainPos.y });
          break;
        }
        for (const [id] of world.query(Pet, PetState)) {
          world.set(id, Position, { x: fountainPos.x, y: fountainPos.y });
        }
      }
    }

    if (newDepth === 0 && pending.returnTicket && pending.returnTicket.depth > 0) {
      spawnReturnPortal(pending.returnTicket, pending.homecomingLanding);
    }

    // Invalidate cached world view and display-only death loot positions
    _cachedView = null;
    _cachedStep = -1;
    _deathLootArcs.clear();
    _deathLootRestPos.clear();
  } finally {
    _stairTransitionInFlight = false;
    armStairTransitionCooldown();
  }
}

world.on('stair:traverse', ({ actor, direction, targetId }) => {
  const sid = Number(targetId) | 0;
  if (!(sid > 0)) return;
  const stairPos = world.get(sid, Position);
  if (!stairPos) return;

  const actorId = Number(actor) | 0;
  const actorPos = actorId > 0 ? world.get(actorId, Position) : null;
  if (!actorPos) return;
  if ((actorPos.x | 0) !== (stairPos.x | 0) || (actorPos.y | 0) !== (stairPos.y | 0)) return;

  const stairX = stairPos.x | 0;
  const stairY = stairPos.y | 0;
  queueStairTransition(direction, stairX, stairY);
});

world.on('dungeon:teleport-depth', ({ targetDepth, source, returnTicket }) => {
  const isHomecoming = String(source || '') === 'scroll_homecoming' || String(source || '') === 'hearthstone';
  queueDepthTransition(targetDepth, {
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

addEventListener('ui:requestTownBoardAccept', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const pe = playerEntity(world);
  if (!pe) return;

  const offer = e?.detail?.offer;
  const qid = acceptNoticeBoardOffer(world, pe.id, offer);
  if (!(qid > 0)) return;

  const payload = buildNoticeBoardPayload(world, pe.id);
  try {
    window.dispatchEvent(new CustomEvent('ui:townBoardData', { detail: payload }));
  } catch (err) {
    console.debug('[main] dispatch ui:townBoardData:', err);
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
installAnvilWiring({
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
installDialogWiring({ world });
installSavegameWiring({
  world,
  playerEntity,
  getActiveSpellId: () => _activeSpellId,
  getActionBarSlots: () => spellCtrl.getActionBarSlots(),
  getPinnedSpellSlots: () => spellCtrl.getPinnedSpellSlots(),
  log: (msg) => messageLog.log({ text: msg, type: 'system' }),
});
bootAdvance("Installed world/UI wiring");

// Item equipped UI updates (message handled in messageWiring)
world.on('item:equipped', ({ itemId }) => {
  const detail = buildQuickItemPinDetailFromWorld(itemId);
  try { window.dispatchEvent(new CustomEvent('ui:itemEquipped', { detail })); } catch (e) { console.debug('[main] dispatch ui:itemEquipped:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});
world.on('item:unequipped', ({ itemId }) => {
  try { window.dispatchEvent(new CustomEvent('ui:itemUnequipped', { detail: { itemId } })); } catch (e) { console.debug('[main] dispatch ui:itemUnequipped:', e); }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
});

function hideTrapTooltip() {
  try { window.dispatchEvent(new CustomEvent('ui:hideTrapTooltip')); } catch (e) { console.debug('[main] dispatch ui:hideTrapTooltip:', e); }
}

// Temporary debug kill-switch while validating modern loot affordances.
// Keep this code-only (no URL/localStorage) to make rollback cheap.
const DEBUG_DISABLE_LEGACY_FLOOR_PICKUP_TOOLTIP = true;

// When player moves, show a mobile-friendly ground item tooltip for non-currency items on the tile
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  if (DEBUG_DISABLE_LEGACY_FLOOR_PICKUP_TOOLTIP) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch (e) { console.debug('[main] dispatch ui:hideGroundItem:', e); }
    return;
  }
  const detail = buildGroundPickupDetailAt(pe.id, to.x, to.y);
  if (!detail) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch (e) { console.debug('[main] dispatch ui:hideGroundItem:', e); }
    return;
  }
  try { window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail })); } catch (e) { console.debug('[main] dispatch ui:showGroundItem:', e); }
});

// When a rack/shelf/case drops an item at the player's feet, refresh ground tooltip
world.on('rack:looted', ({ actor }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== actor) return;
  if (DEBUG_DISABLE_LEGACY_FLOOR_PICKUP_TOOLTIP) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch (e) { console.debug('[main] dispatch ui:hideGroundItem:', e); }
    return;
  }
  const detail = buildGroundPickupDetailAt(pe.id, pe.pos.x, pe.pos.y);
  if (!detail) return;
  try { window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail })); } catch (e) { console.debug('[main] dispatch ui:showGroundItem:', e); }
});

// When player moves, show stair tooltip if standing on stairs
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  shopWiring.handlePlayerMoved();

  // Find traversable targets (stairs or return portal) at exact player position
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
    hideTrapTooltip();
  }

  // Check for adjacent shopkeeper
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'shopkeeper') continue;
    const dist = chebyshevScalar(pos.x, pos.y, to.x, to.y);
    if (dist === 1) {
      world.emit?.('message', { text: 'A shopkeeper is nearby. Bump to trade.', type: 'system' });
      break;
    }
  }

  // Check for adjacent weapon rack
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'weapon_rack') continue;
    const dist = chebyshevScalar(pos.x, pos.y, to.x, to.y);
    if (dist === 1) {
      world.emit?.('message', { text: 'A weapon rack is here. Bump to browse.', type: 'system' });
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

// Trap tooltip can be shown during movement, before trap resolution in the same tick.
// Hide it immediately when the trap resolves against the player.
world.on('trap:triggered', ({ victimId }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== (Number(victimId) | 0)) return;
  hideTrapTooltip();
});

world.on('trap:disarmed', ({ actor }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== (Number(actor) | 0)) return;
  hideTrapTooltip();
});

world.on('trap:disarm:failed', ({ actor }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== (Number(actor) | 0)) return;
  hideTrapTooltip();
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
  if (DEBUG_DISABLE_LEGACY_FLOOR_PICKUP_TOOLTIP) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch (e) { console.debug('[main] dispatch ui:hideGroundItem:', e); }
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[main] dispatch ui:requestInventoryData:', e); }
    return;
  }
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

/**
 * @param {string} key
 */
function humanizeProcStateKey(key) {
  const raw = String(key || "").trim();
  if (!raw) return "Proc";
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * @param {any} procState
 */
function formatProcStateDetail(procState) {
  const label = String(procState?.name || "").trim() || humanizeProcStateKey(procState?.key);
  const detail = String(procState?.description || "").trim();
  const stacks = Math.max(1, Number(procState?.stacks || 1) | 0);
  const turnsLeft = Math.max(0, Number(procState?.turnsLeft || 0) | 0);
  const potency = Number.isFinite(Number(procState?.potency)) ? Number(procState?.potency) : 1;
  const segments = [`x${stacks}`];
  if (turnsLeft > 0) segments.push(`${turnsLeft}t`);
  if (Number.isFinite(potency)) segments.push(`p${potency}`);
  const runtime = segments.join(" · ");
  return detail
    ? `${label}: ${detail} (${runtime})`
    : `${label} (${runtime})`;
}

/**
 * @param {number} tapX
 * @param {number} tapY
 * @returns {null | { entity:any, procState:any }}
 */
function findTappedProcBadge(tapX, tapY) {
  const view = getCachedView();
  const entities = Array.isArray(view?.entities) ? view.entities : [];
  /** @type {null | { entity:any, procState:any, d2:number }} */
  let best = null;
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const procStates = Array.isArray(entity?.procStates) ? entity.procStates : [];
    if (!procStates.length) continue;
    for (let j = 0; j < procStates.length; j++) {
      const procState = procStates[j];
      const vis = getProcStateVisual(procState?.key);
      if (!vis) continue;
      const badge = procBadgeWorldCenter(entity.pos.x, entity.pos.y, j);
      const dx = tapX - badge.x;
      const dy = tapY - badge.y;
      const d2 = dx * dx + dy * dy;
      const hitR = badge.radius + 0.09; // touch-friendly expansion for mobile
      if (d2 > hitR * hitR) continue;
      if (!best || d2 < best.d2) best = { entity, procState, d2 };
    }
  }
  return best ? { entity: best.entity, procState: best.procState } : null;
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

addEventListener('ui:requestQuickChipIdentify', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const targetItemId = Number(e?.detail?.targetItemId || 0);
  if (!Number.isInteger(targetItemId) || targetItemId <= 0) return;
  const pe = playerEntity(world);
  if (!pe) return;
  const toolId = findScrollOfIdentifyInPlayerInventory(pe.id);
  if (!toolId) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.applyItem', payload: { itemId: toolId, targetItemId } });
});

// When user offers an item at an altar from the altar-offering overlay
addEventListener('ui:requestAltarOffer', (ev) => {
  if (isSimUiBlocked()) return;
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const altarId = Number(e?.detail?.altarId || 0);
  const itemId = Number(e?.detail?.itemId || 0);
  if (!Number.isInteger(altarId) || altarId <= 0) return;
  if (!Number.isInteger(itemId) || itemId <= 0) return;

  const pe = playerEntity(world);
  if (!pe) return;

  const pPos = world.get(pe.id, Position);
  const aPos = world.get(altarId, Position);
  if (!pPos || !aPos) return;
  const dist = Math.max(Math.abs((pPos.x | 0) - (aPos.x | 0)), Math.abs((pPos.y | 0) - (aPos.y | 0)));
  if (dist > 1) {
    try { messageLog.log({ text: 'You are too far from the altar.', type: 'system' }); } catch (err) { console.debug('[main] messageLog failed:', err); }
    return;
  }

  const inter = world.get(altarId, Interactable);
  if (!inter || inter.action !== 'prayAltar') return;

  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.altarOffer', payload: { altarId, itemId } });
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (err) { console.debug('[main] dispatch ui:requestInventoryData:', err); }
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

  const pe = playerEntity(world);
  if (!pe) return;
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  if (hasTileTarget || (Number.isInteger(targetId) && targetId > 0)) {
    _pendingThrowTargeting = null;
    const payload = { itemId };
    if (Number.isInteger(targetId) && targetId > 0) payload.targetId = targetId;
    if (hasTileTarget) {
      const info = world.get(itemId, ItemInfo);
      const range = computeThrowRange(Number(info?.weight));
      const tileX = worldToTile(x);
      const tileY = worldToTile(y);
      const clamped = clampTargetToRange(pe.pos.x, pe.pos.y, tileX, tileY, range);
      const dist = Math.max(Math.abs((clamped.x | 0) - (pe.pos.x | 0)), Math.abs((clamped.y | 0) - (pe.pos.y | 0)));
      if (!(dist > 0)) {
        try { messageLog.log({ text: `${bracketizeName(resolveItemDisplayName(world, itemId) || 'item')} must target another tile.`, type: 'system' }); } catch (err) { console.debug('[main] messageLog failed:', err); }
        return;
      }
      payload.x = clamped.x | 0;
      payload.y = clamped.y | 0;
    }
    rulesHandler({ type: 'rules.throwItem', payload });
    return;
  }

  if (!inventoryContains(world, pe.id, itemId)) {
    try { messageLog.log({ text: 'You are not carrying that item.', type: 'system' }); } catch (e) { console.debug('[main] messageLog failed:', e); }
    return;
  }

  const itemName = resolveItemDisplayName(world, itemId) || 'item';
  const info = world.get(itemId, ItemInfo);
  const range = computeThrowRange(Number(info?.weight));
  _pendingSpellTargeting = null;
  _pendingThrowTargeting = { actorId: pe.id, itemId, itemName, range };
  _targetCursor = { x: pe.pos.x | 0, y: pe.pos.y | 0 };
  try {
    messageLog.log({
      text: `Throw ${bracketizeName(itemName)} where? Tap/click a tile or use arrow keys + Enter (up to ${range}). Press Esc to cancel.`,
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
const sceneRuntime = createSceneRuntime({
  world,
  getPlayerEntity: () => playerEntity(world),
  getCam: () => cam,
  getCanvas: () => canvas,
  getCanvasSetup: () => _canvasSetup,
});
installSpeechBubbleWiring({ world, sceneRuntime });
cam.scale = CAMERA_START_SCALE;
cam.targetScale = CAMERA_START_SCALE;
if (PERF.cameraLerp !== null && Number.isFinite(PERF.cameraLerp)) cam.lerpSpeed = Math.max(0, PERF.cameraLerp);

// Enemy-targeted spell casts: tap selects nearest enemy, tap selected enemy confirms.
canvas.addEventListener('pointerdown', (ev) => {
  if (!_pendingEnemyTargeting) return;
  const pe = playerEntity(world);
  if (!pe) { _pendingEnemyTargeting = null; _targetCursor = null; return; }

  const [wx, wy] = cameraClientToWorld(cam, ev.clientX, ev.clientY, canvas);
  const tapX = worldToTile(wx);
  const tapY = worldToTile(wy);

  ev.preventDefault();
  ev.stopPropagation();
  if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();

  const targeting = _pendingEnemyTargeting;

  // Find enemy nearest to the tap point (Manhattan distance)
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < targeting.enemies.length; i++) {
    const e = targeting.enemies[i];
    const d = manhattanScalar(e.x, e.y, tapX, tapY);
    if (d < bestDist) { bestIdx = i; bestDist = d; }
  }
  if (bestIdx < 0) return;

  const selected = targeting.enemies[bestIdx];

  // If tapping the already-selected enemy → confirm and cast
  if (targeting.index === bestIdx) {
    _pendingEnemyTargeting = null;
    _targetCursor = null;
    if (typeof targeting.onConfirm === 'function') {
      targeting.onConfirm(selected.id);
      return;
    }
    const rulesHandler = makeRulesDispatcher(world, () => pe.id);
    rulesHandler({
      type: 'rules.castActiveSpell',
      payload: {
        spellId: targeting.spellId,
        targetId: selected.id,
        x: selected.x,
        y: selected.y,
      },
    });
    return;
  }

  // Otherwise → select this enemy (snap reticle)
  targeting.index = bestIdx;
  _targetCursor = { x: selected.x, y: selected.y };
}, { capture: true });

// Tile-targeted spell casts and throws capture the next tap on the stage.
canvas.addEventListener('pointerdown', (ev) => {
  const pendingSpell = _pendingSpellTargeting;
  const pendingThrow = _pendingThrowTargeting;
  if (!pendingSpell?.spellId && !pendingThrow?.itemId) return;

  const pe = playerEntity(world);
  if (!pe) {
    _pendingSpellTargeting = null;
    _pendingThrowTargeting = null;
    _targetCursor = null;
    return;
  }

  const [wx, wy] = cameraClientToWorld(cam, ev.clientX, ev.clientY, canvas);
  const rawTx = worldToTile(wx);
  const rawTy = worldToTile(wy);

  ev.preventDefault();
  ev.stopPropagation();
  if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();

  if (pendingSpell?.spellId) {
    const px = pe.pos.x | 0;
    const py = pe.pos.y | 0;
    const clamped = clampTargetToRange(px, py, rawTx, rawTy, pendingSpell.range);
    const tx = clamped.x | 0;
    const ty = clamped.y | 0;
    const dist = chebyshevScalar(tx, ty, px, py);
    if (!(dist > 0)) {
      try {
        messageLog.log({
          text: `${pendingSpell.spellName} needs another tile.`,
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
    if (pendingSpell.requiresVisible && !isVisibleAt(tx, ty)) {
      try {
        messageLog.log({
          text: `${pendingSpell.spellName} target must be visible.`,
          type: 'system',
        });
      } catch (e) { console.debug('[main] messageLog failed:', e); }
      return;
    }

    _pendingSpellTargeting = null;
    _targetCursor = null;

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
    _targetCursor = null;
    return;
  }

  const px = pe.pos.x | 0;
  const py = pe.pos.y | 0;
  const clamped = clampTargetToRange(px, py, rawTx, rawTy, pendingThrow.range);
  const tx = clamped.x | 0;
  const ty = clamped.y | 0;
  const dist = chebyshevScalar(tx, ty, px, py);
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
  _targetCursor = null;
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

// Proc-state badges are touchable: tap a badge to inspect stack/turn/potency details.
canvas.addEventListener('pointerdown', (ev) => {
  if (_pendingEnemyTargeting || _pendingSpellTargeting || _pendingThrowTargeting) return;
  const [wx, wy] = cameraClientToWorld(cam, ev.clientX, ev.clientY, canvas);
  const hit = findTappedProcBadge(wx, wy);
  if (!hit) return;
  const who = String(hit.entity?.kind || "").toLowerCase() === "player"
    ? "You"
    : bracketizeName(String(hit.entity?.name || hit.entity?.kind || "Target"));
  try {
    messageLog.log({
      text: `${who}: ${formatProcStateDetail(hit.procState)}`,
      type: 'system',
    });
  } catch (e) { console.debug('[main] messageLog failed:', e); }
  ev.preventDefault();
  ev.stopPropagation();
  if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
}, { capture: true });

// Walk-mode tap interaction: if the tapped tile is a valid pickup/interact target,
// consume the tap and route it through the canonical rules.worldTap path.
canvas.addEventListener('pointerdown', (ev) => {
  if (_pendingEnemyTargeting || _pendingSpellTargeting || _pendingThrowTargeting) return;
  if (isSimUiBlocked()) return;
  if (readInputMode() !== 'walk') return;
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;

  const pe = playerEntity(world);
  if (!pe) return;

  const [wx, wy] = cameraClientToWorld(cam, ev.clientX, ev.clientY, canvas);
  const tx = worldToTile(wx);
  const ty = worldToTile(wy);

  const set = world.get(pe.id, Settings);
  const pickupRange = Math.max(3, Number(set?.pickupRange ?? 0));
  const nearbyOffsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  ];

  const hasTapPickup = nearbyOffsets.some((off) => {
    const cx = (tx | 0) + (off.x | 0);
    const cy = (ty | 0) + (off.y | 0);
    const dist = Math.max(Math.abs((pe.pos.x | 0) - cx), Math.abs((pe.pos.y | 0) - cy));
    return dist <= pickupRange && itemsAt(world, cx, cy).length > 0;
  });

  let hasTapInteract = false;
  for (const off of nearbyOffsets) {
    const cx = (tx | 0) + (off.x | 0);
    const cy = (ty | 0) + (off.y | 0);
    for (const [, pos, inter] of world.query(Position, Interactable)) {
      if (!inter) continue;
      if ((pos.x | 0) !== cx || (pos.y | 0) !== cy) continue;
      const dist = Math.abs((pe.pos.x | 0) - cx) + Math.abs((pe.pos.y | 0) - cy);
      if (dist <= 1) {
        hasTapInteract = true;
        break;
      }
    }
    if (hasTapInteract) break;
  }

  if (!hasTapPickup && !hasTapInteract) return;

  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.worldTap', payload: { x: tx, y: ty } });
  ev.preventDefault();
  ev.stopPropagation();
  if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
}, { capture: true });

function particleWorldToScreen({ x, y, size = 1 }) {
  const sx = (x - cam.x) * cam.scale + canvas.width / (ctx.getTransform().a || 1) * 0.5;
  const sy = (y - cam.y) * cam.scale + canvas.height / (ctx.getTransform().d || 1) * 0.5;
  return { x: sx, y: sy, size: size * cam.scale };
}

// ---- Particle FX (display-only) -------------------------------------------
const fx = new ParticleFX({ capacity: PERF.particleCapacity, seedBase: (world.seed >>> 0) });
fx.ctx = bctx;
// Avoid expensive per-particle transforms: draw in world units under camera transform
fx.worldToScreen = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ size, /** @type {{x:number,y:number,size:number}} */ out) => { out.x = x; out.y = y; out.size = size; };
world.on('dungeon:transitioned', () => {
  fx.pool.count = 0;
  _roofParticleStamp.clear();
  _roofSmokeParticleStamp.clear();
  if (lightingEngine) lightingEngine.invalidateAll();
});
const getPosition = (id) => world.get(Number(id || 0), Position) || null;
const isPetEntity = (id) => world.has(Number(id || 0), Pet);
const isPlayerEntity = (id) => world.has(Number(id || 0), Player);
const getPlayerEntity = () => playerEntity(world);
const getItemInfo = (id) => world.get(Number(id || 0), ItemInfo) || null;
const uiRulesDispatcher = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
const dispatchRulesAction = (action) => uiRulesDispatcher(action);
const resolveDisplayName = (id) => resolveItemDisplayName(world, Number(id || 0));
let _floatTextFovStep = -1;
const isVisibleAt = (x, y) => {
  const step = world.step | 0;
  if (step !== _floatTextFovStep) {
    _floatTextFovStep = step;
    const pe = playerEntity(world);
    if (pe?.id && pe.pos) {
      const radius = getEffectiveVisionRange(world, pe.id);
      const pad = 2;
      const bounds = {
        x0: pe.pos.x - radius - pad,
        y0: pe.pos.y - radius - pad,
        x1: pe.pos.x + radius + pad,
        y1: pe.pos.y + radius + pad,
      };
      const blockedMap = buildBlocksVisionMap(world, bounds);
      const isBlocked = blockedCallback(blockedMap);
      const facing = getNormalizedEntityFacing(world, pe.id);
      const coneDegrees = getEntityFacingConeDegrees(world, pe.id);
      updateFOV(step, pe.pos.x, pe.pos.y, radius, isBlocked, {
        facingDx: facing?.dx || 0,
        facingDy: facing?.dy || 0,
        coneDegrees,
      });
    }
  }
  return !!isTileVisible(Number(x) | 0, Number(y) | 0);
};

const FLYING_FX_INSTALLED = Symbol.for('jshack:display:flyingFx:main:installed');
const FLYING_TAKEOFF_SECONDS = 0.34;
const FLYING_LAND_SECONDS = 0.24;
const FLYING_WAKE_SECONDS = 0.30;
const FLYING_MAX_LIFT = 0.36;
const FLYING_HOVER_BOB = 0.028;

function easeOutCubic(n) {
  const t = clamp01(n);
  return 1 - Math.pow(1 - t, 3);
}

function flyingPhaseFromId(id) {
  const h = (Math.imul((id | 0) ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
  return (h / 0xffffffff) * Math.PI * 2;
}

function buildFlyingPresentation({ id, x, y, progress, wake, wakeKind, fxTime, camScale, phase }) {
  const p = clamp01(progress);
  const lifted = easeOutCubic(p);
  const hoverBob = lifted > 0.001
    ? Math.sin(fxTime * (lifted > 0.96 ? 3.2 : 5.8) + phase) * FLYING_HOVER_BOB * lifted
    : 0;
  const lift = FLYING_MAX_LIFT * lifted + hoverBob;
  const scalePulse = lifted > 0.96
    ? (0.5 + 0.5 * Math.sin(fxTime * 2.7 + phase * 0.7))
    : lifted;
  const glyphScale = 1 + lifted * 0.085 + scalePulse * lifted * 0.02;
  const worldPerPx = 1 / Math.max(1, Number(camScale) || 1);
  const shadowSlideX = (-2.0 * worldPerPx * lifted) - (lift * 0.12);
  const shadowSlideY = (-2.0 * worldPerPx * lifted) - (lift * 0.08);
  return {
    id,
    progress: p,
    lift,
    glyphX: x,
    glyphY: y - lift,
    glyphScale,
    shadowX: x + shadowSlideX,
    shadowY: y + 0.24 + shadowSlideY,
    shadowRx: 0.30 - lifted * 0.04,
    shadowRy: 0.11 - lifted * 0.015,
    shadowAlpha: Math.max(0.08, 0.26 - lifted * 0.06),
    wake: clamp01(wake),
    wakeKind: wakeKind || '',
  };
}

function createFlyingFxController(world) {
  /** @type {Map<number, { progress:number, targetAirborne:boolean, wake:number, wakeKind:string, phase:number }>} */
  const states = new Map();

  function ensureState(id, seed = {}) {
    let rec = states.get(id);
    if (!rec) {
      rec = {
        progress: clamp01(seed.progress ?? 0),
        targetAirborne: !!seed.targetAirborne,
        wake: clamp01(seed.wake ?? 0),
        wakeKind: seed.wakeKind || '',
        phase: flyingPhaseFromId(id),
      };
      states.set(id, rec);
    }
    return rec;
  }

  function installListeners() {
    if (world[FLYING_FX_INSTALLED]) return;
    world[FLYING_FX_INSTALLED] = true;

    world.on('proc:fly:takeoff', ({ id }) => {
      const entityId = Number(id || 0);
      if (!entityId) return;
      const rec = ensureState(entityId, { progress: 0, targetAirborne: true });
      rec.targetAirborne = true;
      rec.progress = Math.max(rec.progress, 0.12);
      rec.wake = 1;
      rec.wakeKind = 'takeoff';
    });

    world.on('proc:fly:land', ({ id }) => {
      const entityId = Number(id || 0);
      if (!entityId) return;
      const rec = ensureState(entityId, { progress: 1, targetAirborne: false });
      rec.targetAirborne = false;
      rec.progress = Math.max(rec.progress, 0.18);
      rec.wake = 1;
      rec.wakeKind = 'land';
    });
  }

  function syncWorldView(worldView) {
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const flying = Array.isArray(e.tags) && e.tags.includes('flying');
      const rec = states.get(e.id);
      if (!flying) {
        if (rec) rec.targetAirborne = false;
        continue;
      }
      if (!rec) {
        states.set(e.id, {
          progress: 1,
          targetAirborne: true,
          wake: 0,
          wakeKind: '',
          phase: flyingPhaseFromId(e.id),
        });
        continue;
      }
      rec.targetAirborne = true;
      if (rec.progress <= 0.001) rec.progress = 1;
    }
  }

  function tick(dt) {
    for (const [id, rec] of states) {
      if (rec.targetAirborne) rec.progress = Math.min(1, rec.progress + (dt / FLYING_TAKEOFF_SECONDS));
      else rec.progress = Math.max(0, rec.progress - (dt / FLYING_LAND_SECONDS));

      rec.wake = Math.max(0, rec.wake - (dt / FLYING_WAKE_SECONDS));
      if (!rec.targetAirborne && rec.progress <= 0.001) {
        states.delete(id);
        continue;
      }
      if (rec.targetAirborne && typeof world.isAlive === 'function' && !world.isAlive(id) && rec.progress >= 0.999) {
        states.delete(id);
      }
    }
  }

  function getPresentation(entity, fxTime, camScale) {
    const flyingTag = Array.isArray(entity?.tags) && entity.tags.includes('flying');
    const rec = states.get(entity.id);
    if (!rec && !flyingTag) {
      return buildFlyingPresentation({
        id: entity.id,
        x: entity.pos.x,
        y: entity.pos.y,
        progress: 0,
        wake: 0,
        wakeKind: '',
        fxTime,
        camScale,
        phase: flyingPhaseFromId(entity.id),
      });
    }
    if (!rec && flyingTag) {
      return buildFlyingPresentation({
        id: entity.id,
        x: entity.pos.x,
        y: entity.pos.y,
        progress: 1,
        wake: 0,
        wakeKind: '',
        fxTime,
        camScale,
        phase: flyingPhaseFromId(entity.id),
      });
    }
    return buildFlyingPresentation({
      id: entity.id,
      x: entity.pos.x,
      y: entity.pos.y,
      progress: rec?.progress ?? 0,
      wake: rec?.wake ?? 0,
      wakeKind: rec?.wakeKind || '',
      fxTime,
      camScale,
      phase: rec?.phase ?? flyingPhaseFromId(entity.id),
    });
  }

  return { installListeners, syncWorldView, tick, getPresentation };
}

const displayRuntime = setupDisplayRuntime({
  world,
  cam,
  fx,
  PERF,
  getFxTime: () => _fxTime,
  getActiveSpellId: () => _activeSpellId,
  setActiveSpell,
  getPosition,
  getEntityIdentity: (id) => String(world.get(Number(id || 0) | 0, NamedIdentity)?.identity || ""),
  getEntityVitality: (id) => world.get(Number(id || 0) | 0, Vitality) || null,
  isVisibleAt,
  isPet: isPetEntity,
  isPlayer: isPlayerEntity,
  getPlayerEntity,
  getPosition,
  getItemInfo,
  resolveItemDisplayName: resolveDisplayName,
  dispatchRulesAction,
  classifySurfaceTile,
  sculptFloor: (x, y, delta, reliefKey) => {
    if (!lightingEngine || typeof lightingEngine.addFloorTileDelta !== "function") return;
    lightingEngine.addFloorTileDelta(x, y, delta, reliefKey);
  },
  sculptFloorBrush: (x, y, delta, radius, opts, reliefKey) => {
    if (!lightingEngine || typeof lightingEngine.addFloorRadialDelta !== "function") return;
    lightingEngine.addFloorRadialDelta(x, y, delta, radius, opts, reliefKey);
  },
  getActiveReliefKey: () => {
    if (!lightingEngine || typeof lightingEngine.getFloorReliefState !== "function") return "__default__";
    return lightingEngine.getFloorReliefState()?.reliefKey ?? "__default__";
  },
  sampleMood: () => {
    const pe = playerEntity(world);
    if (!pe) return null;
    const dev = /** @type {any} */ (world.get(pe.id, Devotion));
    if (!dev?.deityId) return null;
    const deity = getDeityInstance(dev.deityId);
    if (!deity) return null;
    return deity._queryPrecise();
  },
  getDepth: () => {
    for (const [, ds] of world.query(DungeonState)) return ds.currentDepth ?? 0;
    return 0;
  },
});
const {
  statusEmitterFx,
  statusPresentationDelayFx,
  boltFx,
  delayedDeathFx,
  projectileFx,
  spellAreaFx,
  cloudFx,
  surfaceAreaFx,
  spiritWispFx,
  bumpFx,
  recoilFx,
  hitstopFx,
  deathEssenceFx,
  deathVfx,
  ftext,
  goreTick,
} = displayRuntime;
const flyingFx = createFlyingFxController(world);
flyingFx.installListeners();
const slideFx = createSlideFxController();

// Spirit guide tutorial — only on new games, only when tips remain unseen,
// and only if the player didn't uncheck Tutorial at character creation.
if (!_savegameLoaded && !_tutorialDisabledThisSession) {
  const seenTips = readSeenTips();
  const hasUnseen = GUIDANCE_TIPS.some((t) => !seenTips.has(t.id));
  if (hasUnseen) {
    const spiritPointerFx = createSpiritPointerFx({
      getWispScreenPos() {
        const wp = spiritWispFx.getWispPos();
        if (!wp) return null;
        const [sx, sy] = worldToScreen(cam, wp.x, wp.y, canvas);
        const dpr = Math.max(1, canvas.width / Math.max(1, canvas.offsetWidth || canvas.width));
        return { x: sx / dpr, y: sy / dpr };
      },
    });
    installSpiritGuideWiring({
      world,
      sceneRuntime,
      getPlayerEntity: () => playerEntity(world),
      spiritWispFx,
      spiritPointerFx,
    });
  }
}

// ── Size-class display scale map ────────────────────────────────────
const SIZE_CLASS_SCALE = { XS: 0.55, S: 0.72, M: 0.88, L: 1.0, XL: 1.12 };
const _itemZeroOff = { dx: 0, dy: 0 };

// Wire transient lighting effects (gaze beams, chest blooms, etc.)
installLightEventListeners(world, getPosition);

// ---- Visual mappings (display contract) ------------------------------------
const palette = buildPalette();
const glyphAtlas = createGlyphAtlas(palette, { glowLayers: PERF.glowLayers, sizePx: (PERF.quality==='low'?32:64), fontPx: (PERF.quality==='low'?28:56) });
bootAdvance("Prepared render resources");

// ---- Render (display-only; consumes WorldView DTO) -------------------------
let _bgGradH = 0; let _bgGrad = null;
let _fxTime = 0; // display-side time accumulator for simple glyph FX
let _dtSec = 0;  // frame delta for render-internal use
let _renderPlayerBlinded = false;

// Reusable render buffers — hoisted out of hot functions to avoid per-frame GC
const _stackMeta = new Map();
const _stackSeqMeta = new Map();
/** @type {number[]} flat buffer [tile, x, y, ...] for explored-not-visible tiles */
const _exploredTileBuffer = [];
/** @type {Map<number, { hp:number, ratio:number, showUntil:number }>} */
const _healthBarState = new Map();
/** @type {Set<number>} */
const _healthBarSeen = new Set();
/** @type {Set<string>} */
const _roofCoverKeys = new Set();
/** @type {Map<string, number>} */
const _roofParticleStamp = new Map();
/** Separate stamp for large smoldering smoke particles (slower rate). @type {Map<string, number>} */
const _roofSmokeParticleStamp = new Map();
/** @type {Array<{ id:number, pos:{x:number,y:number}, hp:number, maxHp:number, isPet?:boolean }>} */
const _healthBarsToDraw = [];
const _groundLootLabels = [];
const _monsterLabels = [];
const _memoryGlyphByKind = new Map();
const HP_BAR_MEANINGFUL_RATIO_DELTA = 0.08;
const HP_BAR_SHOW_SECONDS = 2.25;
const PET_HP_BAR_SHOW_SECONDS = 3.5;

// ── Hit tint: brief red shift on the entity glyph on successful damage ──
const HIT_TINT_DURATION = 0.18;
/** @type {Map<number, number>} entityId → elapsed seconds since tint started */
const _hitTints = new Map();
/** @type {Array<{ fireAt:number, id:number }>} deferred tints waiting for projectile impact */
const _pendingHitTints = [];

function triggerHitTint(id) { _hitTints.set(id | 0, 0); }
function tickHitTints(dt) {
  for (const [id, t] of _hitTints) {
    const next = t + dt;
    if (next >= HIT_TINT_DURATION) _hitTints.delete(id);
    else _hitTints.set(id, next);
  }
  for (let i = _pendingHitTints.length - 1; i >= 0; i--) {
    if (_fxTime >= _pendingHitTints[i].fireAt) {
      triggerHitTint(_pendingHitTints[i].id);
      _pendingHitTints.splice(i, 1);
    }
  }
}
/** Returns 0..1 tint intensity (0 = no tint). */
function getHitTint(id) {
  const t = _hitTints.get(id | 0);
  if (t === undefined) return 0;
  const k = t / HIT_TINT_DURATION;
  // fast peak at 15%, then smooth decay
  return k < 0.15 ? k / 0.15 : 1 - ((k - 0.15) / 0.85);
}
const PET_CRITICAL_RATIO = 0.35;

/**
 * Draw a small additive aura for entities explicitly tagged with `glowing`.
 * Kept tag-gated so palette `glow` color does not imply runtime glyph FX.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number}, tags?:string[] }} e
 * @param {number} fxTime
 */
function drawGlowingTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 4.2 + e.id * 0.37);
  const rOuter = (0.58 + 0.06 * pulse) * scale;
  const rInner = (0.27 + 0.03 * pulse) * scale;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  outer.addColorStop(0,   `rgba(255,180,80,${(0.24 + 0.14 * pulse).toFixed(3)})`);
  outer.addColorStop(0.55,`rgba(255,110,20,${(0.12 + 0.10 * pulse).toFixed(3)})`);
  outer.addColorStop(1,   'rgba(170,60,10,0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  inner.addColorStop(0, `rgba(255,230,170,${(0.28 + 0.22 * pulse).toFixed(3)})`);
  inner.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a golden legendary glow for `legendary_chest` entities.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawLegendaryChestAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.8 + e.id * 1.3);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.62 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.30 + 0.15 * pulse;
  outerGrad.addColorStop(0,   `rgba(255,190,20,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(220,140,10,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(160,80,0,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.30 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.35 + 0.20 * pulse;
  innerGrad.addColorStop(0, `rgba(255,230,100,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(255,180,30,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a purple epic glow for `magic_chest` entities.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawEpicChestAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 3.0 + e.id * 1.3);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.62 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.28 + 0.14 * pulse;
  outerGrad.addColorStop(0,   `rgba(180,60,255,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(140,40,220,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(80,20,160,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.30 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.32 + 0.18 * pulse;
  innerGrad.addColorStop(0, `rgba(210,120,255,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(160,60,230,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a blue glow for rare-rarity items tagged with `rare_glowing`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawRareGlowAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.6 + e.id * 1.3);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.58 + 0.07 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.22 + 0.12 * pulse;
  outerGrad.addColorStop(0,   `rgba(85,170,255,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(60,130,220,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(30,80,160,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.28 + 0.04 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.28 + 0.16 * pulse;
  innerGrad.addColorStop(0, `rgba(140,200,255,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(85,170,255,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a poison-green glow for entities tagged with `venom_glowing`.
 * Matches the poisoned-item glow style to convey venomous nature.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawVenomTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 3.5 + e.id * 1.3);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Outer soft glow — same palette as poisoned-weapon ground glow
  const rOuter = (0.62 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.30 + 0.15 * pulse;
  outerGrad.addColorStop(0,   `rgba(50,220,70,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(40,190,55,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(20,140,35,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright core
  const rInner = (0.30 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.35 + 0.20 * pulse;
  innerGrad.addColorStop(0, `rgba(100,255,120,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(60,230,80,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw an icy cyan-blue glow for entities tagged with `frost_glowing`.
 * Slow crystalline pulse for frostbite weapons.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawFrostTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.5 + e.id * 1.3);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.62 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.26 + 0.14 * pulse;
  outerGrad.addColorStop(0,   `rgba(100,190,255,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(70,150,230,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(40,100,180,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.30 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.32 + 0.20 * pulse;
  innerGrad.addColorStop(0, `rgba(180,230,255,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a crackling electric blue-white glow for entities tagged with `storm_glowing`.
 * Fast pulse for lightning/capacitive weapons.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawStormTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 5.0 + e.id * 0.91);
  // Flicker: occasional sharp brightness spikes
  const flicker = Math.sin(fxTime * 13.7 + e.id * 2.3) > 0.7 ? 0.3 : 0;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.60 + 0.10 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.22 + 0.16 * pulse + flicker;
  outerGrad.addColorStop(0,   `rgba(120,170,255,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(80,130,240,${(outerA * 0.45).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(40,70,200,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.28 + 0.06 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.30 + 0.25 * pulse + flicker;
  innerGrad.addColorStop(0, `rgba(210,230,255,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(140,180,255,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a dark crimson-purple glow for entities tagged with `soul_glowing`.
 * Vampiric pulse for soul drain weapons.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawSoulTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 3.0 + e.id * 1.7);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.60 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.24 + 0.14 * pulse;
  outerGrad.addColorStop(0,   `rgba(180,40,110,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(140,25,85,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(80,10,50,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.28 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.30 + 0.20 * pulse;
  innerGrad.addColorStop(0, `rgba(220,80,170,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(170,50,120,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a deep crimson glow for entities tagged with `blood_glowing`.
 * Slow throb for hemorrhage / berserk weapons.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawBloodTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.2 + e.id * 1.1);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.60 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.24 + 0.14 * pulse;
  outerGrad.addColorStop(0,   `rgba(200,30,30,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(160,20,20,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(100,10,10,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.28 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.30 + 0.20 * pulse;
  innerGrad.addColorStop(0, `rgba(255,80,60,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(220,40,30,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw an acid yellow-green glow for entities tagged with `caustic_glowing`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawCausticTagAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x, cy = e.pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 3.2 + e.id * 1.5);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const rOuter = (0.60 + 0.08 * pulse) * scale;
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  const outerA = 0.26 + 0.14 * pulse;
  outerGrad.addColorStop(0,   `rgba(190,210,30,${outerA.toFixed(3)})`);
  outerGrad.addColorStop(0.5, `rgba(150,180,20,${(outerA * 0.5).toFixed(3)})`);
  outerGrad.addColorStop(1,   'rgba(100,130,10,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();

  const rInner = (0.28 + 0.05 * pulse) * scale;
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
  const innerA = 0.30 + 0.20 * pulse;
  innerGrad.addColorStop(0, `rgba(230,250,80,${innerA.toFixed(3)})`);
  innerGrad.addColorStop(1, 'rgba(190,220,40,0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a potion-shaped glow keyed off the "!" silhouette.
 * The disabled-kind set lives in worldView so enabling/disabling stays trivial.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, kind:string, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
// --- Potion shimmer tuning ---
const POTION_SHIMMER_SPEED = 2.6;   // pulse frequency (lower = lazier glow)
const POTION_SHIMMER_DEPTH = 0.18;  // how much alpha swings (0 = static, 1 = full throb)

function drawPotionGlyphAura(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x;
  const cy = e.pos.y;
  const look = palette[e.kind] || palette.potion || palette.default;
  const fgHex = look?.fg || "#8fd7ff";

  const pulse = 0.5 + 0.5 * Math.sin(fxTime * POTION_SHIMMER_SPEED + e.id * 0.83);
  const baseA = 0.22 + POTION_SHIMMER_DEPTH * pulse;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const r = (0.42 + 0.06 * pulse) * scale;
  const squeeze = 0.43; // sides 40% narrower than top/bottom — hugs the "!"
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   `${fgHex}${Math.round(baseA * 255).toString(16).padStart(2,'0')}`);
  grad.addColorStop(0.6, `${fgHex}${Math.round(baseA * 0.35 * 255).toString(16).padStart(2,'0')}`);
  grad.addColorStop(1,   `${fgHex}00`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  const steps = 16; // more steps = smoother glow outline but more CPU
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const s = Math.sin(a);
    const rr = r * ((1 - squeeze) + squeeze * s * s);
    const px = cx + rr * Math.cos(a);
    const py = cy + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Fallback unknown potion identities to the generic potion glyph instead of the
 * default bullet. This keeps all potions rendering as "!" even when a new ID
 * has not received a dedicated palette row yet.
 * @param {Map<string, { canvas: HTMLCanvasElement }>} glyphAtlas
 * @param {{ kind:string, tags:string[] }} e
 * @returns {string}
 */
function resolveRenderableKind(glyphAtlas, e) {
  const kind = (typeof e.kind === 'string') ? e.kind : 'default';
  if (glyphAtlas.has(kind)) return kind;
  if (Array.isArray(e.tags) && e.tags.includes('potion_glow')) return 'potion';
  return kind;
}

function resolveMemoryGlyph(kind) {
  const key = (typeof kind === "string" && kind.length) ? kind : "default";
  if (_memoryGlyphByKind.has(key)) return _memoryGlyphByKind.get(key);
  const look = palette[key] || palette.default || {};
  let glyph = "?";
  if (Array.isArray(look.layers) && look.layers.length) {
    for (let i = look.layers.length - 1; i >= 0; i--) {
      const g = look.layers[i]?.glyph;
      if (typeof g === "string" && g.length) {
        glyph = g;
        break;
      }
    }
  } else if (typeof look.glyph === "string" && look.glyph.length) {
    glyph = look.glyph;
  }
  _memoryGlyphByKind.set(key, glyph);
  return glyph;
}

function drawMemoryGlyph(ctx, kind, x, y, alpha = 0.7) {
  const glyph = resolveMemoryGlyph(kind);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha *= Math.max(0, Math.min(1, Number(alpha) || 0));
  ctx.fillStyle = "#9a9a9a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 0.92px monospace";
  ctx.fillText(glyph, x, y + 0.01);
  ctx.restore();
}

// drawKindScaled is imported from atlas.js (supports scale + rotation)

function hasTag(entity, tag) {
  return Array.isArray(entity?.tags) && entity.tags.includes(tag);
}

function hasAnyTag(entity, tags) {
  if (!Array.isArray(entity?.tags)) return false;
  for (let i = 0; i < tags.length; i++) {
    if (entity.tags.includes(tags[i])) return true;
  }
  return false;
}

function lootLabelColorFromTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  if (list.includes("legendary_glowing")) return "#ff9a5a";
  if (list.includes("epic_glowing")) return "#d58bff";
  if (list.includes("rare_glowing")) return "#ffe17a";
  if (list.includes("gold_glow")) return "#ffd34d";
  if (list.includes("potion_glow")) return "#8fd7ff";
  return "#cfd7e6";
}

function lootLabelFromKind(kind, itemId = 0) {
  if ((itemId | 0) > 0) {
    const resolved = String(resolveItemDisplayName(world, itemId) || "").trim();
    if (resolved) return resolved;
  }
  const key = String(kind || "item").trim().toLowerCase();
  if (!key) return "Loot";
  if (key.includes("gold")) return "Gold";
  if (key.includes("potion")) return "Potion";
  if (key.includes("scroll")) return "Scroll";
  if (key.includes("wand")) return "Wand";
  if (key.includes("chest")) return "Chest";
  const words = key.split("_").filter(Boolean);
  const core = words.slice(-2).join(" ");
  const text = core || key;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function drawGroundLootLabels(ctx, labels, fxTime) {
  if (!Array.isArray(labels) || labels.length <= 0) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "700 0.20px monospace";
  for (let i = 0; i < labels.length; i++) {
    const rec = labels[i];
    if (!rec) continue;
    const bob = Math.sin(fxTime * 2.4 + rec.id * 0.13) * 0.03;
    const y = rec.y - 0.55 + bob;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 0.06;
    ctx.strokeText(rec.text, rec.x, y);
    ctx.fillStyle = rec.color;
    ctx.fillText(rec.text, rec.x, y);
  }
  ctx.restore();
}

function monsterLabelFromKind(kind) {
  const key = String(kind || '').trim();
  if (!key || key === 'default') return '';
  return key.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function drawMonsterLabels(ctx, labels, fxTime) {
  if (!Array.isArray(labels) || labels.length <= 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 0.15px monospace';
  for (let i = 0; i < labels.length; i++) {
    const rec = labels[i];
    if (!rec) continue;
    // Offset label Y based on creature scale so it sits above the glyph
    const ss = rec.sizeScale || 1;
    const y = rec.y - (0.30 + 0.22 * ss);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 0.04;
    ctx.strokeText(rec.text, rec.x, y);
    ctx.fillStyle = rec.color;
    ctx.fillText(rec.text, rec.x, y);
  }
  ctx.restore();
}

function drawEntityGlyph(atlas, ctx, entity, scale = 1, rotation = 0) {
  if (hasTag(entity, 'thermal_sensed')) return;

  // Death VFX: player glyph blink (disappears on off-beats) + heartbeat scale
  const isPlayerGlyph = (entity.layer | 0) === 400;
  if (isPlayerGlyph) {
    const blinkAlpha = deathVfx.getPlayerGlyphAlpha(_fxTime);
    if (blinkAlpha < 0.01) return; // blink off-beat — don't draw
    scale *= deathVfx.getPlayerGlyphScale(_fxTime);
  }

  const kind = resolveRenderableKind(atlas, entity);
  const invisible = hasTag(entity, 'invisible');
  const shadowCloak = hasTag(entity, 'shadow_cloak');
  const phaseShift = hasTag(entity, 'phase_shift');
  const memoryRecent = hasTag(entity, 'memory_recent');
  const memoryTampered = hasTag(entity, 'memory_tampered');
  const espSensed = hasTag(entity, 'esp_sensed');
  if (!invisible && !shadowCloak && !phaseShift && !memoryRecent && !espSensed) {
    const tint = getHitTint(entity.id);
    const redPulse = isPlayerGlyph ? deathVfx.getPlayerGlyphRedPulse(_fxTime) : 0;
    if (tint > 0.01 || redPulse > 0.01) {
      ctx.save();
      // Combine hit tint and low-HP red pulse — red pulse shifts hue toward red + boosts brightness
      const t = Math.max(tint, redPulse);
      const hueShift = redPulse > tint ? -30 : -50; // closer to pure red for low-HP pulse
      ctx.filter = `saturate(${1 - t * 0.5}) sepia(${t}) hue-rotate(${hueShift}deg) brightness(${1 + t * 0.4})`;
      drawKindScaled(atlas, ctx, kind, entity.pos.x, entity.pos.y, scale, rotation);
      ctx.restore();
    } else {
      drawKindScaled(atlas, ctx, kind, entity.pos.x, entity.pos.y, scale, rotation);
    }
    return;
  }
  // Memory/ESP can affect many entities at once; avoid costly canvas filter path.
  if (memoryRecent || espSensed) {
    const jx = memoryTampered ? Math.sin(_fxTime * 14 + (entity.id | 0) * 0.73) * 0.045 : 0;
    const jy = memoryTampered ? Math.cos(_fxTime * 13 + (entity.id | 0) * 0.51) * 0.045 : 0;
    ctx.save();
    if (memoryRecent) {
      drawMemoryGlyph(
        ctx,
        kind,
        entity.pos.x + jx,
        entity.pos.y + jy,
        _renderPlayerBlinded
          ? (memoryTampered ? 0.62 : 0.74)
          : (memoryTampered ? 0.58 : 0.70),
      );
    } else {
      ctx.globalAlpha *= 0.52;
      drawKindScaled(atlas, ctx, kind, entity.pos.x, entity.pos.y, scale, rotation);
    }
    ctx.restore();
    return;
  }
  const jx = memoryTampered ? Math.sin(_fxTime * 14 + (entity.id | 0) * 0.73) * 0.045 : 0;
  const jy = memoryTampered ? Math.cos(_fxTime * 13 + (entity.id | 0) * 0.51) * 0.045 : 0;
  ctx.save();
  if (invisible) {
    ctx.filter = 'brightness(0.50) saturate(0.70)';
    ctx.globalAlpha *= 0.82;
  } else if (shadowCloak) {
    ctx.filter = 'brightness(0.72) saturate(0.80)';
    ctx.globalAlpha *= 0.90;
  } else if (phaseShift) {
    ctx.filter = 'brightness(0.86) saturate(0.95)';
    ctx.globalAlpha *= 0.94;
  }
  drawKindScaled(atlas, ctx, kind, entity.pos.x + jx, entity.pos.y + jy, scale, rotation);
  ctx.restore();
}

function drawThermalSensePing(ctx, entity, fxTime) {
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 5.2 + (entity.id | 0) * 0.91);
  const cx = entity.pos.x;
  const cy = entity.pos.y;
  const rOuter = 0.16 + 0.03 * pulse;
  const rInner = 0.06 + 0.02 * pulse;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  outer.addColorStop(0, `rgba(255,90,60,${(0.42 + 0.20 * pulse).toFixed(3)})`);
  outer.addColorStop(1, 'rgba(220,25,15,0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,68,42,${(0.75 + 0.20 * pulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEspSenseHalo(ctx, entity, fxTime) {
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 3.3 + (entity.id | 0) * 0.57);
  const cx = entity.pos.x;
  const cy = entity.pos.y;
  const ringR = 0.41 + 0.05 * pulse;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.038;
  ctx.strokeStyle = `rgba(90,225,255,${(0.34 + 0.20 * pulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.23);
  core.addColorStop(0, `rgba(140,235,255,${(0.16 + 0.08 * pulse).toFixed(3)})`);
  core.addColorStop(1, 'rgba(90,190,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.23, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a small white dot in front of the entity's facing direction.
 * World-space: 1 unit = 1 tile.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ pos:{x:number,y:number}, facing?:{dx:number,dy:number}|null }} entity
 */
function drawFacingDot(ctx, entity) {
  const f = entity?.facing || null;
  const dx = Math.sign(Number(f?.dx || 0));
  const dy = Math.sign(Number(f?.dy || 0));
  if (dx === 0 && dy === 0) return;

  const dotX = entity.pos.x + dx * 0.22;
  const dotY = entity.pos.y + dy * 0.22;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(220,195,95,0.98)';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStoneskinWardAura(ctx, entity, fxTime) {
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.3 + (entity.id | 0) * 0.71);
  const cx = entity.pos.x;
  const cy = entity.pos.y;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const outerR = 0.74 + 0.06 * pulse;
  const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
  outer.addColorStop(0, `rgba(150,225,135,${(0.18 + 0.08 * pulse).toFixed(3)})`);
  outer.addColorStop(0.55, `rgba(95,170,90,${(0.14 + 0.06 * pulse).toFixed(3)})`);
  outer.addColorStop(1, 'rgba(60,120,55,0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.34 + 0.03 * pulse);
  core.addColorStop(0, `rgba(210,255,195,${(0.22 + 0.10 * pulse).toFixed(3)})`);
  core.addColorStop(1, 'rgba(120,190,105,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.34 + 0.03 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHarmonyWardGlowAura(ctx, entity, fxTime) {
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.1 + (entity.id | 0) * 0.93);
  const cx = entity.pos.x;
  const cy = entity.pos.y;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const outerR = 0.78 + 0.07 * pulse;
  const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
  outer.addColorStop(0, `rgba(170,220,255,${(0.20 + 0.08 * pulse).toFixed(3)})`);
  outer.addColorStop(0.50, `rgba(255,220,135,${(0.16 + 0.07 * pulse).toFixed(3)})`);
  outer.addColorStop(1, 'rgba(120,150,255,0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();
  const innerR = 0.42 + 0.05 * pulse;
  const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
  inner.addColorStop(0, `rgba(255,250,210,${(0.26 + 0.10 * pulse).toFixed(3)})`);
  inner.addColorStop(1, 'rgba(210,225,255,0)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Reserved parked prototype.
// Unused by gameplay right now; keep for future status/tag experiments.
const WARD_BUBBLE_RESERVED_TAG = 'ward_bubble_preview';
function drawWardBubbleAura(ctx, entity, fxTime) {
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.0 + (entity.id | 0) * 1.03);
  const cx = entity.pos.x;
  const cy = entity.pos.y;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const a = fxTime * 0.8 + i * (Math.PI / 2);
    const ox = Math.cos(a) * 0.11;
    const oy = Math.sin(a) * 0.11;
    const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, 0.42 + 0.05 * pulse);
    if (i === 0) {
      g.addColorStop(0, `rgba(255,140,80,${(0.24 + 0.08 * pulse).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,100,60,0)');
    } else if (i === 1) {
      g.addColorStop(0, `rgba(120,255,120,${(0.24 + 0.08 * pulse).toFixed(3)})`);
      g.addColorStop(1, 'rgba(80,210,100,0)');
    } else if (i === 2) {
      g.addColorStop(0, `rgba(120,210,255,${(0.24 + 0.08 * pulse).toFixed(3)})`);
      g.addColorStop(1, 'rgba(70,160,255,0)');
    } else {
      g.addColorStop(0, `rgba(255,255,150,${(0.24 + 0.08 * pulse).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,210,110,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 0.42 + 0.05 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(205,230,255,${(0.30 + 0.12 * pulse).toFixed(3)})`;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.62 + 0.05 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawInvisibleVeil(ctx, entity, fxTime, hasAmbushOpener) {
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 3.0 + (entity.id | 0) * 0.67);
  const cx = entity.pos.x;
  const cy = entity.pos.y;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const shellR = 0.64 + 0.05 * pulse;
  const shell = ctx.createRadialGradient(cx, cy, 0, cx, cy, shellR);
  if (hasAmbushOpener) {
    shell.addColorStop(0, `rgba(70,45,110,${(0.16 + 0.08 * pulse).toFixed(3)})`);
    shell.addColorStop(1, 'rgba(30,20,50,0)');
  } else {
    shell.addColorStop(0, `rgba(52,70,98,${(0.14 + 0.06 * pulse).toFixed(3)})`);
    shell.addColorStop(1, 'rgba(22,30,45,0)');
  }
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(cx, cy, shellR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roofCellKey(x, y) {
  return `${x | 0},${y | 0}`;
}

function drawRoofSmoke(ctx, roof, fxTime, fx, quality) {
  if (!roof?.burning && !roof?.smoking) return;
  const _isBurning = !!roof.burning;
  const phase = ((Math.imul((roof.x | 0) + 11, 1103515245) ^ Math.imul((roof.y | 0) + 17, 12345)) >>> 0) / 0xffffffff;
  const bob = 0.5 + 0.5 * Math.sin(fxTime * 1.7 + phase * Math.PI * 2);
  const swell = roof.smoking ? 1 : 0.7;
  const cx = roof.x + (phase - 0.5) * 0.18 + Math.sin(fxTime * 0.9 + phase * 5.1) * 0.025 * swell;
  const cy = roof.y - 0.16 - bob * 0.12 - swell * 0.05;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(26,24,22,${(0.18 + bob * 0.09 + swell * 0.08).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 0.22 + swell * 0.03, 0.12 + swell * 0.03, 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 0.06, cy - 0.13 - swell * 0.03, 0.18 + swell * 0.02, 0.11 + swell * 0.02, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 0.09, cy - 0.22 - swell * 0.06, 0.15 + swell * 0.03, 0.09 + swell * 0.03, -0.18, 0, Math.PI * 2);
  ctx.fill();

  if (_isBurning) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,122,34,${(0.14 + bob * 0.08).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(roof.x - 0.04, roof.y - 0.05, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,210,120,${(0.08 + bob * 0.05).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(roof.x + 0.05, roof.y - 0.08, 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 4; i++) {
    const ashPhase = phase * 11.0 + i * 0.97;
    const fall = (fxTime * (0.55 + i * 0.08) + ashPhase) % 1.0;
    const ax = roof.x - 0.18 + i * 0.11 + Math.sin(fxTime * 1.3 + ashPhase) * 0.03;
    const ay = roof.y - 0.10 + fall * 0.42;
    const alpha = 0.20 + (1 - fall) * 0.18;
    ctx.strokeStyle = `rgba(170,168,160,${alpha.toFixed(3)})`;
    ctx.lineWidth = 0.018 + i * 0.002;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 0.018);
    ctx.lineTo(ax - 0.012, ay + 0.022);
    ctx.stroke();
  }
  ctx.restore();

  if (quality === 'low' || !fx?.pool) return;

  // Large billowing smoke for smoldering (post-fire) — slow rate, long TTL.
  if (roof.smoking) {
    const smokeTick = Math.floor(fxTime * 0.7 + phase * 7);
    const smokeKey = roofCellKey(roof.x, roof.y);
    const lastSmokeTick = _roofSmokeParticleStamp.get(smokeKey) ?? -1;
    if (smokeTick !== lastSmokeTick) {
      _roofSmokeParticleStamp.set(smokeKey, smokeTick);
      // Three large billow puffs, each offset and staggered.
      const drifts = [
        { ox: (phase - 0.5) * 0.28, oy: -0.12, vxd:  0.04, life: 7.6 + bob * 1.2, s0: 0.80, s1: 0.42, rr: 64, gg: 62, bb: 58, a: 0.38 },
        { ox: (phase - 0.5) * 0.14, oy: -0.06, vxd: -0.03, life: 6.8 + bob * 1.4, s0: 0.90, s1: 0.50, rr: 102, gg: 98, bb: 92, a: 0.30 },
        { ox: (phase - 0.5) * 0.38, oy: -0.18, vxd:  0.02, life: 8.8 + bob * 1.0, s0: 0.66, s1: 0.30, rr: 148, gg: 144, bb: 136, a: 0.22 },
      ];
      for (let di = 0; di < drifts.length; di++) {
        const d = drifts[di];
        fx.pool.spawn(new Particle({
          x: roof.x + d.ox,
          y: roof.y + d.oy,
          vx: d.vxd + (phase - 0.5) * 0.02,
          vy: -0.10 - bob * 0.05,
          ay: -0.012,
          life: d.life,
          size0: d.s0,
          size1: d.s1,
          r: d.rr, g: d.gg, b: d.bb,
          a0: d.a * 0.45,
          a1: Math.min(0.46, d.a * 1.18),
        }));
      }
    }
  }

  const particleTick = Math.floor(fxTime * 7 + phase * 13);
  const particleKey = roofCellKey(roof.x, roof.y);
  const lastTick = _roofParticleStamp.get(particleKey) ?? -1;
  if (lastTick === particleTick) return;
  _roofParticleStamp.set(particleKey, particleTick);

  fx.pool.spawn(new Particle({
    x: roof.x + (phase - 0.5) * 0.18,
    y: roof.y - 0.14,
    vx: (phase - 0.5) * 0.05,
    vy: -0.14 - bob * 0.06,
    ay: -0.03,
    life: 1.55 + bob * 0.45,
    size0: 0.045,
    size1: 0.020,
    r: 72,
    g: 70,
    b: 66,
    a0: 0.14,
    a1: 0.30,
  }));
  fx.pool.spawn(new Particle({
    x: roof.x - 0.10 + bob * 0.08,
    y: roof.y - 0.10,
    vx: -0.02 + (phase - 0.5) * 0.04,
    vy: 0.08 + bob * 0.03,
    ay: 0.08,
    life: 0.55,
    size0: 0.032,
    size1: 0.010,
    r: 182,
    g: 178,
    b: 168,
    a0: 0.34,
  }));
  if (_isBurning && particleTick % 2 === 0) {
    fx.pool.spawn(new Particle({
      x: roof.x + 0.03 - phase * 0.10,
      y: roof.y - 0.06,
      vx: (phase - 0.5) * 0.08,
      vy: -0.18 - bob * 0.08,
      ay: -0.04,
      life: 0.26,
      size0: 0.040,
      size1: 0.010,
      r: 255,
      g: 138,
      b: 48,
      a0: 0.50,
    }));
  }
}

function drawFlyingShadow(ctx, presentation) {
  if (!presentation || presentation.progress <= 0.001) return;

  const { shadowX, shadowY, shadowRx, shadowRy, shadowAlpha, wake, wakeKind, progress } = presentation;

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${(shadowAlpha * 0.45).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRx * 1.55, shadowRy * 1.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(6,8,14,${shadowAlpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, shadowAlpha * 0.42).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRx * 0.72, shadowRy * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  if (wake > 0.001) {
    const u = 1 - wake;
    const ringRx = shadowRx + 0.08 + u * 0.24;
    const ringRy = shadowRy + 0.04 + u * 0.10;
    const ringAlpha = wake * (wakeKind === 'land' ? 0.24 : 0.20) * progress;
    ctx.lineWidth = 0.028 + wake * 0.014;
    ctx.strokeStyle = wakeKind === 'land'
      ? `rgba(255,188,120,${ringAlpha.toFixed(3)})`
      : `rgba(120,205,255,${ringAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, ringRx, ringRy, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw a small static star directly above the head of entities tagged with `rare`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawRareStar(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x;
  const cy = e.pos.y - 0.65 * scale; // directly above the glyph (glyph spans y-0.5 to y+0.5)
  const R = 0.09 * scale;  // outer point radius
  const r = 0.035 * scale; // inner point radius
  const POINTS = 4;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft glow halo behind the star
  const haloR = R * 2.0;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
  halo.addColorStop(0, 'rgba(255,255,200,0.20)');
  halo.addColorStop(1, 'rgba(255,240,120,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();

  // 4-pointed star shape
  ctx.fillStyle = 'rgba(255,252,200,0.90)';
  ctx.beginPath();
  for (let i = 0; i < POINTS * 2; i++) {
    const angle = (i * Math.PI) / POINTS - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    if (i === 0) ctx.moveTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
    else ctx.lineTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a 👁️ icon above blinded entities for the duration of the effect.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawBlindEye(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x;
  const cy = e.pos.y - 0.72 * scale;

  // Gentle pulse
  const pulse = 0.85 + Math.sin(fxTime * 2.5) * 0.15;
  const dy = cy + Math.sin(fxTime * 1.8) * 0.025;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft violet glow halo
  const haloR = 0.2 * scale;
  const halo = ctx.createRadialGradient(cx, dy, 0, cx, dy, haloR);
  halo.addColorStop(0, `rgba(120,60,200,${(0.25 * pulse).toFixed(2)})`);
  halo.addColorStop(1, 'rgba(100,50,180,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, dy, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Eye glyph
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.9 * pulse;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${0.32 * scale}px sans-serif`;
  ctx.fillText('\u{1F441}\u{FE0F}', cx, dy);

  ctx.restore();
}

/**
 * Draw a yellow "!" above quest giver NPCs (mirrors drawRareStar pattern).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id:number, pos:{x:number,y:number} }} e
 * @param {number} fxTime
 */
function drawQuestBang(ctx, e, fxTime, scale = 1) {
  const cx = e.pos.x;
  const cy = e.pos.y - 0.72 * scale;

  // Gentle bob
  const bob = Math.sin(fxTime * 2.0) * 0.03;
  const dy = cy + bob;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft yellow glow halo
  const haloR = 0.18 * scale;
  const halo = ctx.createRadialGradient(cx, dy, 0, cx, dy, haloR);
  halo.addColorStop(0, 'rgba(255,220,40,0.25)');
  halo.addColorStop(1, 'rgba(255,200,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, dy, haloR, 0, Math.PI * 2);
  ctx.fill();

  // "!" glyph
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,220,40,0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${0.32 * scale}px sans-serif`;
  ctx.fillText('!', cx, dy);

  ctx.restore();
}


/**
 * @param {number} n
 */
function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * Bars are hidden by default and appear when HP changes enough to be informative.
 * Pet bars also stay visible while critically low.
 * @param {{ id:number, hp?:number, maxHp?:number, showHealthBar?:boolean, isPet?:boolean }} e
 * @param {number} now
 */
function shouldShowHealthBar(e, now) {
  if (!e || !e.showHealthBar) return false;
  const maxHp = Math.max(1, Number(e.maxHp) | 0);
  const rawHp = Math.max(0, Math.min(maxHp, Number(e.hp) | 0));
  // Use visual HP — add back damage whose projectile hasn't arrived yet
  const hp = impactTracker.visualHp(e.id, rawHp, maxHp, now);
  if (hp <= 0) {
    _healthBarState.delete(e.id);
    return false;
  }

  const ratio = clamp01(hp / maxHp);
  let state = _healthBarState.get(e.id);
  if (!state) {
    const seededShow = ratio < 1 ? (now + 0.9) : -Infinity;
    state = { hp, ratio, showUntil: seededShow };
    _healthBarState.set(e.id, state);
  } else {
    const hpDelta = Math.abs(hp - state.hp);
    const ratioDelta = Math.abs(ratio - state.ratio);
    const meaningfulHpDelta = Math.max(1, Math.ceil(maxHp * 0.06));
    if (ratioDelta >= HP_BAR_MEANINGFUL_RATIO_DELTA || hpDelta >= meaningfulHpDelta) {
      state.showUntil = now + (e.isPet ? PET_HP_BAR_SHOW_SECONDS : HP_BAR_SHOW_SECONDS);
    }
    state.hp = hp;
    state.ratio = ratio;
  }

  _healthBarSeen.add(e.id);
  if (e.isPet && ratio <= PET_CRITICAL_RATIO) return true;
  return now <= state.showUntil;
}

function pruneHealthBarState() {
  for (const id of _healthBarState.keys()) {
    if (!_healthBarSeen.has(id)) _healthBarState.delete(id);
  }
  _healthBarSeen.clear();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ pos:{x:number,y:number}, hp:number, maxHp:number, isPet?:boolean }} e
 */
function drawEntityHealthBar(ctx, e) {
  const maxHp = Math.max(1, Number(e.maxHp) | 0);
  const rawHp = Math.max(0, Math.min(maxHp, Number(e.hp) | 0));
  const hp = impactTracker.visualHp(e.id, rawHp, maxHp, _fxTime);
  const ratio = clamp01(hp / maxHp);
  const ss = e._sizeScale || 1;
  const width = 0.68 * ss;
  const height = 0.06;
  const y = e.pos.y + (0.22 + 0.21 * ss);
  const x = e.pos.x - (width * 0.5);
  const pad = 0.01;
  const innerW = Math.max(0, width - (pad * 2));
  const innerH = Math.max(0.01, height - (pad * 2));
  const fillW = innerW * ratio;
  const hue = Math.round(120 * ratio);

  ctx.save();
  ctx.fillStyle = 'rgba(10,12,18,0.8)';
  ctx.fillRect(x, y, width, height);
  if (fillW > 0.002) {
    ctx.fillStyle = `hsl(${hue} 85% 48%)`;
    ctx.fillRect(x + pad, y + pad, fillW, innerH);
  }
  ctx.strokeStyle = e.isPet ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 0.014;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function render(worldView) {
  const W = _canvasSetup.cssW;
  const H = _canvasSetup.cssH;
  const effectiveWeather = worldView.playerSheltered ? "clear" : (worldView.weather || "clear");
  const playerId = Number(worldView?.player?.id || 0) | 0;
  let playerBlinded = false;
  if (playerId > 0 && Array.isArray(worldView?.entities)) {
    for (let i = 0; i < worldView.entities.length; i++) {
      const e = worldView.entities[i];
      if ((Number(e?.id || 0) | 0) !== playerId) continue;
      playerBlinded = Array.isArray(e.tags) && e.tags.includes("blinded");
      break;
    }
  }
  _renderPlayerBlinded = playerBlinded;

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
  const _zpOff = getZoomPunchScale(cam);
  if (_zpOff) cam.scale += _zpOff;
  applyCamera(bctx, cam, back);
  if (_zpOff) cam.scale -= _zpOff;

  // Compute view bounds in world units for culling
  const viewHalfW = W * 0.5 / (cam.scale || 1);
  const viewHalfH = H * 0.5 / (cam.scale || 1);
  const vx0 = cam.x - viewHalfW - 1; // add small margin
  const vy0 = cam.y - viewHalfH - 1;
  const vx1 = cam.x + viewHalfW + 1;
  const vy1 = cam.y + viewHalfH + 1;

  if (playerBlinded) {
    bctx.save();
    bctx.fillStyle = "#000";
    bctx.fillRect(vx0 - 1, vy0 - 1, (vx1 - vx0) + 2, (vy1 - vy0) + 2);
    bctx.restore();
  }

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
    // When the lighting engine is active, draw ALL explored tiles at full
    // alpha and let the vision mask handle visibility visually.  This
    // eliminates the blocky tile-level FOV boundary entirely — the smooth
    // sub-tile vision mask is the only visual boundary.
    // On quality=low (no lighting engine), fall back to the old two-pass
    // visible/explored split.
    const _lightingActive = PERF.quality !== 'low';

    if (_lightingActive) {
      worldView.tileGrid.forEachTileInRect(tx0, ty0, tx1, ty1, (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ tile) => {
        if ((isVisible && isVisible(x, y)) || (isExplored && isExplored(x, y))) {
          const kind = tileKinds[tile];
          if (kind) drawKind(glyphAtlas, bctx, kind, x, y);
        }
      });
    } else {
      worldView.tileGrid.forEachTileInRect(tx0, ty0, tx1, ty1, (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ tile) => {
        if (isVisible && isVisible(x, y)) {
          const kind = tileKinds[tile];
          if (kind) drawKind(glyphAtlas, bctx, kind, x, y);
        } else if (isExplored && isExplored(x, y)) {
          _exploredTileBuffer.push(tile, x, y);
        }
      });
      if (_exploredTileBuffer.length > 0) {
        if (playerBlinded) {
          for (let i = 0; i < _exploredTileBuffer.length; i += 3) {
            const kind = tileKinds[_exploredTileBuffer[i] ?? 0];
            if (!kind) continue;
            drawMemoryGlyph(
              bctx,
              kind,
              _exploredTileBuffer[i + 1] ?? 0,
              _exploredTileBuffer[i + 2] ?? 0,
              0.72,
            );
          }
        } else {
          bctx.globalAlpha = 0.35;
          for (let i = 0; i < _exploredTileBuffer.length; i += 3) {
            const kind = tileKinds[_exploredTileBuffer[i] ?? 0];
            if (kind) drawKind(glyphAtlas, bctx, kind, _exploredTileBuffer[i + 1] ?? 0, _exploredTileBuffer[i + 2] ?? 0);
          }
          bctx.globalAlpha = 1.0;
        }
      }
    }
  }

  surfaceAreaFx.tick(_dtSec, worldView, { vx0, vx1, vy0, vy1 }, effectiveWeather);
  surfaceAreaFx.draw(bctx);

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
      const visible = isVis && isVis(eng.pos.x, eng.pos.y);
      bctx.globalAlpha = visible ? 0.6 : 0.2;
      const label = eng.text.length > 8 ? eng.text.slice(0, 7) + '\u2026' : eng.text;
      if (eng.profane && visible) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004 + eng.pos.x * 3.7);
        bctx.shadowColor = 'rgba(255,60,60,0.9)';
        bctx.shadowBlur = 4 + 6 * pulse;
        bctx.fillStyle = '#ff6655';
        bctx.fillText(label, eng.pos.x, eng.pos.y + 0.28);
        bctx.shadowBlur = 0;
        bctx.shadowColor = 'transparent';
      } else {
        bctx.fillStyle = '#8899aa';
        bctx.fillText(label, eng.pos.x, eng.pos.y + 0.28);
      }
    }
    bctx.globalAlpha = 1.0;
    bctx.restore();
  }

  // Pass 2: entities (doors, stairs, monsters, items, player)
  // Keep only the top-most ground item glyph per tile.
  _stackMeta.clear(); // "x,y" -> topItemId
  _stackSeqMeta.clear(); // "x,y" -> best stackSeq seen
  _healthBarsToDraw.length = 0;
  _groundLootLabels.length = 0;
  _monsterLabels.length = 0;
  flyingFx.syncWorldView(worldView);
  slideFx.syncWorldView(worldView.entities || []);
  delayedDeathFx.syncWorldView(worldView);
  const renderEntities = delayedDeathFx.getRenderableEntities(worldView.entities);
  const stackMeta = _stackMeta;
  const stackSeqMeta = _stackSeqMeta;
  for (let i = 0; i < renderEntities.length; i++) {
    const e = renderEntities[i];
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const layer = Number.isFinite(e.layer) ? (e.layer | 0) : 300;
    if (layer !== 250) continue;
    if (throwFx.isItemHidden(e.id)) continue;
    if (delayedDeathFx.isItemHidden(e.id)) continue;
    const tileKey = `${e.pos.x},${e.pos.y}`;
    const seq = (e.stackSeq | 0) || 0;
    const prevSeq = stackSeqMeta.get(tileKey) ?? -1;
    // Higher stackSeq wins; if tied, later id (higher entity ID) wins.
    if (seq > prevSeq || (seq === prevSeq)) {
      stackMeta.set(tileKey, e.id);
      stackSeqMeta.set(tileKey, seq);
    }
  }

  // Draw order: doors/stairs (200) → items (250) → actors (300) → player (400)
  // Entities are sorted by layer, so drawing inline gives correct z-order.

  for (let i = 0; i < renderEntities.length; i++) {
    const e = renderEntities[i];
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    const layer = Number.isFinite(e.layer) ? (e.layer | 0) : 300;

    if (layer === 250) {
      if (throwFx.isItemHidden(e.id) || delayedDeathFx.isItemHidden(e.id)) continue;
      const arcPos = deathLootArcPos(e.id);
      const vOff = e.visualOff || _itemZeroOff;
      const itemRender = arcPos
        ? { ...e, pos: { x: arcPos.x, y: arcPos.y } }
        : (vOff.dx || vOff.dy) ? { ...e, pos: { x: e.pos.x + vOff.dx, y: e.pos.y + vOff.dy } } : e;
      const itemKind = resolveRenderableKind(glyphAtlas, itemRender);
      const paletteBase = (glyphAtlas.get(itemKind) || glyphAtlas.get('default') || {}).baseScale || 1;
      const finalItemScale = (e.itemScale || 1) * paletteBase;
      drawKindScaled(glyphAtlas, bctx, itemKind, itemRender.pos.x, itemRender.pos.y, finalItemScale, e.rotation || 0);
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('glowing')) {
        drawGlowingTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (Array.isArray(itemRender.tags) && itemRender.tags.includes('venom_glowing')) {
        drawVenomTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('frost_glowing')) {
        drawFrostTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('storm_glowing')) {
        drawStormTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('soul_glowing')) {
        drawSoulTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('blood_glowing')) {
        drawBloodTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('caustic_glowing')) {
        drawCausticTagAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (Array.isArray(itemRender.tags) && itemRender.tags.includes('legendary_glowing')) {
        drawLegendaryChestAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (Array.isArray(itemRender.tags) && itemRender.tags.includes('epic_glowing')) {
        drawEpicChestAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (Array.isArray(itemRender.tags) && itemRender.tags.includes('rare_glowing')) {
        drawRareGlowAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (Array.isArray(itemRender.tags) && itemRender.tags.includes('potion_glow')) {
        drawPotionGlyphAura(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('rare')) {
        drawRareStar(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('quest_giver')) {
        drawQuestBang(bctx, itemRender, _fxTime, finalItemScale);
      }
      if (PERF.quality !== 'low' && Array.isArray(itemRender.tags) && itemRender.tags.includes('blinded')) {
        drawBlindEye(bctx, itemRender, _fxTime, finalItemScale);
      }
      const topItemId = stackMeta.get(`${e.pos.x},${e.pos.y}`) || 0;
      const playerPos = worldView?.player?.pos;
      if (
        (arcPos || topItemId === e.id)
        && playerPos
        && (!worldView?.isVisible || worldView.isVisible(e.pos.x, e.pos.y))
        && chebyshevScalar(playerPos.x | 0, playerPos.y | 0, e.pos.x | 0, e.pos.y | 0) <= 3
      ) {
        _groundLootLabels.push({
          id: e.id,
          x: itemRender.pos.x,
          y: itemRender.pos.y,
          text: lootLabelFromKind(e.kind, e.id),
          color: lootLabelColorFromTags(e.tags),
        });
      }
      continue;
    }

    // Slide easing — smooth movement between tiles (skip player)
    const isPlayer = (e.layer | 0) === 400;
    const slidePos = isPlayer ? null : slideFx.getPosition(e.id, e.pos.x, e.pos.y);
    const slidEntity = slidePos && slidePos.sliding
      ? { ...e, pos: { x: slidePos.x, y: slidePos.y } }
      : e;

    // Bump lunge — attacker glyphs lurch toward their target (player + monsters)
    const bumpOff = bumpFx.getOffset(e.id);
    const bumpEntity = (bumpOff.dx || bumpOff.dy)
      ? { ...slidEntity, pos: { x: slidEntity.pos.x + bumpOff.dx, y: slidEntity.pos.y + bumpOff.dy } }
      : slidEntity;

    // Recoil — defender jolts away from impact direction + rotation wince
    const recoilOff = recoilFx.getOffset(e.id);
    const recoilEntity = (recoilOff.dx || recoilOff.dy)
      ? { ...bumpEntity, pos: { x: bumpEntity.pos.x + recoilOff.dx, y: bumpEntity.pos.y + recoilOff.dy } }
      : bumpEntity;

    const flyingPresentation = flyingFx.getPresentation(recoilEntity, _fxTime, cam.scale);
    const renderEntity = flyingPresentation.progress > 0.001
      ? { ...recoilEntity, pos: { x: flyingPresentation.glyphX, y: flyingPresentation.glyphY } }
      : recoilEntity;

    // Size-class scaling — small creatures render smaller, big ones bigger
    const sizeScale = SIZE_CLASS_SCALE[e.sizeClass] || 1;
    const entityScale = flyingPresentation.glyphScale * sizeScale;
    const entityRotation = recoilOff.rotation || 0;

    if (hasTag(renderEntity, 'thermal_sensed')) {
      drawThermalSensePing(bctx, renderEntity, _fxTime);
      continue;
    }

    drawFlyingShadow(bctx, flyingPresentation);
    drawEntityGlyph(glyphAtlas, bctx, renderEntity, entityScale, entityRotation);
    if (hasTag(renderEntity, 'esp_sensed')) {
      drawEspSenseHalo(bctx, renderEntity, _fxTime);
    }
    if ((renderEntity.layer | 0) >= 300 && !hasTag(renderEntity, 'memory_recent') && !hasTag(renderEntity, 'esp_sensed')) {
      drawFacingDot(bctx, renderEntity);
    }
    if (shouldShowHealthBar(renderEntity, _fxTime)) {
      _healthBarsToDraw.push({ ...renderEntity, _sizeScale: sizeScale });
    }

    // Actor name labels — hostile actors + pets, visible and within range
    if (
      (renderEntity.layer | 0) === 300
      && renderEntity.showHealthBar
      && !hasTag(renderEntity, 'memory_recent')
      && !hasTag(renderEntity, 'esp_sensed')
      && !hasTag(renderEntity, 'thermal_sensed')
      && (!worldView?.isVisible || worldView.isVisible(renderEntity.pos.x, renderEntity.pos.y))
    ) {
      const label = monsterLabelFromKind(renderEntity.kind);
      if (label) {
        _monsterLabels.push({
          id: renderEntity.id,
          x: renderEntity.pos.x,
          y: renderEntity.pos.y,
          text: label,
          color: '#e8d4c0',
          sizeScale,
        });
      }
    }

    // Spawner (nest) labels — show "Rat Nest" etc. when visible
    if (
      renderEntity.kind === 'spawner'
      && (!worldView?.isVisible || worldView.isVisible(renderEntity.pos.x, renderEntity.pos.y))
    ) {
      const ni = world.get(renderEntity.id, NamedIdentity);
      if (ni?.name) {
        _monsterLabels.push({
          id: renderEntity.id,
          x: renderEntity.pos.x,
          y: renderEntity.pos.y,
          text: ni.name,
          color: '#8b4513',
          sizeScale,
        });
      }
    }

    // Glyph-FX: passive glow aura for entities tagged "glowing"
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('glowing')) {
      drawGlowingTagAura(bctx, renderEntity, _fxTime);
    }
    if (Array.isArray(renderEntity.tags) && renderEntity.tags.includes('venom_glowing')) {
      drawVenomTagAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('frost_glowing')) {
      drawFrostTagAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('storm_glowing')) {
      drawStormTagAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('soul_glowing')) {
      drawSoulTagAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('blood_glowing')) {
      drawBloodTagAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('caustic_glowing')) {
      drawCausticTagAura(bctx, renderEntity, _fxTime);
    }
    if (Array.isArray(renderEntity.tags) && renderEntity.tags.includes('legendary_glowing')) {
      drawLegendaryChestAura(bctx, renderEntity, _fxTime);
    }
    if (Array.isArray(renderEntity.tags) && renderEntity.tags.includes('epic_glowing')) {
      drawEpicChestAura(bctx, renderEntity, _fxTime);
    }
    if (Array.isArray(renderEntity.tags) && renderEntity.tags.includes('rare_glowing')) {
      drawRareGlowAura(bctx, renderEntity, _fxTime);
    }
    if (Array.isArray(renderEntity.tags) && renderEntity.tags.includes('potion_glow')) {
      drawPotionGlyphAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('rare')) {
      drawRareStar(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('quest_giver')) {
      drawQuestBang(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('blinded')) {
      drawBlindEye(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && hasTag(renderEntity, 'invisible')) {
      drawInvisibleVeil(bctx, renderEntity, _fxTime, hasTag(renderEntity, 'shadow_cloak'));
    }
    if (PERF.quality !== 'low' && hasTag(renderEntity, 'stoneskin')) {
      drawStoneskinWardAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && hasAnyTag(renderEntity, ['resist_fire', 'resist_poison', 'resist_electric', 'resist_acid'])) {
      drawHarmonyWardGlowAura(bctx, renderEntity, _fxTime);
    }
    if (PERF.quality !== 'low' && hasTag(renderEntity, WARD_BUBBLE_RESERVED_TAG)) {
      drawWardBubbleAura(bctx, renderEntity, _fxTime);
    }

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
      bctx.arc(renderEntity.pos.x, renderEntity.pos.y, 0.35, 0, Math.PI * 2);
      bctx.fill();
      bctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
      bctx.lineWidth = 0.06;
      const rad = 0.42 + 0.04 * Math.sin(t * 1.7);
      bctx.beginPath();
      bctx.arc(renderEntity.pos.x, renderEntity.pos.y, rad, 0, Math.PI * 2);
      bctx.stroke();
      bctx.restore();
    }

    // Glyph-FX: invulnerability aegis ward
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('invulnerable')) {
      drawAegisWardGlyphFx(
        bctx,
        '@',
        renderEntity.pos.x,
        renderEntity.pos.y,
        1.0,
        _fxTime,
        0,
        (renderEntity.id | 0) ^ 0xA381,
        renderEntity.pos.y,
        { gain: 1 }
      );
    }

    // Glyph-FX: frozen — pulsing icy blue radial glow (outer halo + bright inner core)
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('frozen')) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 1.4);
      const cx = renderEntity.pos.x, cy = renderEntity.pos.y;
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
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('shocked')) {
      bctx.save();
      const cx = renderEntity.pos.x, cy = renderEntity.pos.y;
      const _sid = (renderEntity.id || 0) | 0;
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
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('thorns')) {
      /** @type {CanvasRenderingContext2D} */
      const g = /** @type any */ (bctx);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cx = renderEntity.pos.x, cy = renderEntity.pos.y;
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
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('_fire_aura')) {
      /** @type {CanvasRenderingContext2D} */
      const g = /** @type any */ (bctx);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cx = renderEntity.pos.x, cy = renderEntity.pos.y;

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

    // Glyph-FX: spinning 4-point stars above confused/stunned entities
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && (renderEntity.tags.includes('confused') || renderEntity.tags.includes('stunned'))) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      bctx.lineWidth = 0.035;
      bctx.globalAlpha = 0.9;
      for (let j = 0; j < 3; j++) {
        const ang = _fxTime * 2.2 + (j / 3) * Math.PI * 2;
        const sx = renderEntity.pos.x + Math.cos(ang) * 0.32;
        const sy = renderEntity.pos.y + Math.sin(ang) * 0.12 - 0.52; // flattened orbit above head
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
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('bleeding')) {
      bctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 7.0 + renderEntity.id * 0.3);
      bctx.globalCompositeOperation = 'source-over';
      bctx.fillStyle = `rgba(160,0,0,${(0.08 + 0.07 * pulse).toFixed(3)})`;
      bctx.beginPath();
      bctx.arc(renderEntity.pos.x, renderEntity.pos.y, 0.44 + 0.04 * pulse, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }

    // Glyph-FX: poisoned — pulsing green glow
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('poisoned')) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 3.5 + renderEntity.id * 1.3);
      const cx = renderEntity.pos.x, cy = renderEntity.pos.y;
      // Outer soft glow
      const rOuter = 0.62 + 0.08 * pulse;
      const outerGrad = bctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
      const outerA = 0.30 + 0.15 * pulse;
      outerGrad.addColorStop(0, `rgba(50,220,70,${outerA.toFixed(3)})`);
      outerGrad.addColorStop(0.5, `rgba(40,190,55,${(outerA * 0.5).toFixed(3)})`);
      outerGrad.addColorStop(1, 'rgba(20,140,35,0)');
      bctx.fillStyle = outerGrad;
      bctx.beginPath();
      bctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      bctx.fill();
      // Inner bright core
      const rInner = 0.30 + 0.05 * pulse;
      const innerGrad = bctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
      const innerA = 0.35 + 0.20 * pulse;
      innerGrad.addColorStop(0, `rgba(100,255,120,${innerA.toFixed(3)})`);
      innerGrad.addColorStop(1, 'rgba(60,230,80,0)');
      bctx.fillStyle = innerGrad;
      bctx.beginPath();
      bctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }

    // Glyph-FX: agony — pulsing dark purple shadow aura
    if (PERF.quality !== 'low' && Array.isArray(renderEntity.tags) && renderEntity.tags.includes('agony')) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 4.0 + renderEntity.id * 0.7);
      const cx = renderEntity.pos.x, cy = renderEntity.pos.y;
      // Outer shadow haze
      const rOuter = 0.65 + 0.12 * pulse;
      const outerGrad = bctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
      const outerA = 0.32 + 0.18 * pulse;
      outerGrad.addColorStop(0, `rgba(160,50,220,${outerA.toFixed(3)})`);
      outerGrad.addColorStop(0.55, `rgba(110,25,170,${(outerA * 0.50).toFixed(3)})`);
      outerGrad.addColorStop(1, 'rgba(50,10,90,0)');
      bctx.fillStyle = outerGrad;
      bctx.beginPath();
      bctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      bctx.fill();
      // Inner bright core
      const rInner = 0.30 + 0.06 * pulse;
      const innerGrad = bctx.createRadialGradient(cx, cy, 0, cx, cy, rInner);
      const innerA = 0.48 + 0.28 * pulse;
      innerGrad.addColorStop(0, `rgba(200,80,255,${innerA.toFixed(3)})`);
      innerGrad.addColorStop(1, 'rgba(130,40,200,0)');
      bctx.fillStyle = innerGrad;
      bctx.beginPath();
      bctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }

    // Glyph-FX: proc state badges (doom_clock, cataclysm_mark, etc.) — above-right of entity
    if (renderEntity.procStates) {
      drawProcStateBadges(bctx, renderEntity.pos.x, renderEntity.pos.y, renderEntity.procStates, _fxTime, renderEntity.id);
    }

    // Equipment corner badges — melee right, ranged/zap bottom-left, shield top-left
    if (renderEntity.equipBadges) {
      const eb = renderEntity.equipBadges;
      const resolved = {};
      if (eb.weaponIdentity) {
        const pe = palette[eb.weaponIdentity];
        if (pe) { resolved.weaponGlyph = pe.glyph; resolved.weaponColor = pe.fg; }
        else { resolved.weaponGlyph = ')'; resolved.weaponColor = '#bbbbbb'; }
      }
      if (eb.offhandIdentity) {
        const pe = palette[eb.offhandIdentity];
        if (pe) { resolved.offhandGlyph = pe.glyph; resolved.offhandColor = pe.fg; }
        else { resolved.offhandGlyph = ')'; resolved.offhandColor = '#bbbbbb'; }
      }
      if (eb.rangedIdentity) {
        const pe = palette[eb.rangedIdentity];
        if (pe) { resolved.rangedGlyph = pe.glyph; resolved.rangedColor = pe.fg; }
        else { resolved.rangedGlyph = ')'; resolved.rangedColor = '#88bbdd'; }
      }
      if (eb.shieldIdentity) {
        const pe = palette[eb.shieldIdentity];
        if (pe) { resolved.shieldGlyph = pe.glyph; resolved.shieldColor = pe.fg; }
        else { resolved.shieldGlyph = '['; resolved.shieldColor = '#88bbdd'; }
      }
      drawEquipmentBadges(bctx, renderEntity.pos.x, renderEntity.pos.y, resolved, _fxTime, renderEntity.id);
    }
  }



  drawGroundLootLabels(bctx, _groundLootLabels, _fxTime);
  drawMonsterLabels(bctx, _monsterLabels, _fxTime);

  for (let i = 0; i < _healthBarsToDraw.length; i++) {
    drawEntityHealthBar(bctx, _healthBarsToDraw[i]);
  }
  pruneHealthBarState();

  // ---- Lighting engine pass (SDF sub-tile overlay) --------------------------
  // Placed before spell FX so bolts/meteors/projectiles appear bright on top
  // of the darkness, while tiles + entities are properly darkened.
  if (PERF.quality !== 'low') {
    const _lights = collectLightSources(worldView, { quality: PERF.quality, fxTime: _fxTime, dt: _dtSec });
    collectFxLights(_lights, { boltFx, spellAreaFx, projectileFx, cloudFx, surfaceAreaFx, statusEmitterFx, spiritWispFx });
    const _ambient = computeAmbient(worldView);
    const _roofMask = worldView.isOverworld ? isRoofed : null;
    const _visionDef = getVisionDef();
    const _lightOpaque = worldView.isBlockedVision || isOpaque;

    // Dirty-field: detect player movement / facing change → invalidate vision.
    // Detect game-step advance → invalidate geometry (handles pickaxe, doors, etc.)
    {
      const pp = worldView.player?.pos;
      const pf = worldView.playerFacing;
      const px = pp ? pp.x : -1, py = pp ? pp.y : -1;
      const fdx = pf ? pf.dx : 0, fdy = pf ? pf.dy : 0;
      const step = world.step || 0;
      if (px !== _prevLightPX || py !== _prevLightPY
        || fdx !== _prevLightFDX || fdy !== _prevLightFDY) {
        lightingEngine.invalidateVision();
        _prevLightPX = px; _prevLightPY = py;
        _prevLightFDX = fdx; _prevLightFDY = fdy;
      }
      // Any game step could change geometry (pickaxe, door, meteor) — invalidate
      // the SDF once per step so we don't miss structural changes.
      if (step !== _prevLightStep) {
        lightingEngine.invalidateGeometry();
        lightingEngine.invalidateSurface();
        _prevLightStep = step;
      }
    }

    lightingEngine.render(
      bctx,
      _lights,
      _lightOpaque,
      vx0,
      vy0,
      vx1,
      vy1,
      _ambient,
      undefined,
      _roofMask,
      _visionDef,
      surfaceAreaFx.getSurfaceRegions(),
      _fxTime,
      worldView.currentDepth ?? 0,
    );
  }

  drawWorldEffects({
    bctx,
    worldView,
    glyphAtlas,
    boltFx,
    spellAreaFx,
    projectileFx,
    throwFx,
    pickupFx,
    cloudFx,
    spiritWispFx,
    deathEssenceFx,
    fx,
    PERF,
  });

  // Weather particles (rain) drawn above entities but under roofs
  // Suppress when player is sheltered indoors (intact roof overhead)
  weatherFx.tick(_dtSec, effectiveWeather, { vx0, vx1, vy0, vy1 }, cam);
  weatherFx.draw(bctx, cam);

  _roofCoverKeys.clear();
  if (Array.isArray(worldView?.roofs) && worldView.roofs.length) {
    for (let i = 0; i < worldView.roofs.length; i++) {
      const roof = worldView.roofs[i];
      if (roof.x < vx0 || roof.x > vx1 || roof.y < vy0 || roof.y > vy1) continue;
      _roofCoverKeys.add(roofCellKey(roof.x, roof.y));
      bctx.globalAlpha = Number.isFinite(roof.alpha) ? roof.alpha : 1.0;
      drawKind(glyphAtlas, bctx, roof.kind, roof.x, roof.y);
      drawRoofSmoke(bctx, roof, _fxTime, fx, PERF.quality);
    }
    bctx.globalAlpha = 1.0;
  }
  if (typeof cloudFx.drawBurnPlumes === 'function') {
    cloudFx.drawBurnPlumes(bctx);
  }

  if (_roofCoverKeys.size > 0) {
    for (let i = 0; i < renderEntities.length; i++) {
      const e = renderEntities[i];
      if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
      if (!Array.isArray(e.tags)) continue;
      if (!_roofCoverKeys.has(roofCellKey(e.pos.x, e.pos.y))) continue;

      if (e.tags.includes('flying')) {
        const slidePos2 = slideFx.getPosition(e.id, e.pos.x, e.pos.y);
        const slidEntity2 = slidePos2.sliding ? { ...e, pos: { x: slidePos2.x, y: slidePos2.y } } : e;
        const bumpOff2 = bumpFx.getOffset(e.id);
        const bumpEntity2 = (bumpOff2.dx || bumpOff2.dy)
          ? { ...slidEntity2, pos: { x: slidEntity2.pos.x + bumpOff2.dx, y: slidEntity2.pos.y + bumpOff2.dy } }
          : slidEntity2;
        const recoilOff2 = recoilFx.getOffset(e.id);
        const recoilEntity2 = (recoilOff2.dx || recoilOff2.dy)
          ? { ...bumpEntity2, pos: { x: bumpEntity2.pos.x + recoilOff2.dx, y: bumpEntity2.pos.y + recoilOff2.dy } }
          : bumpEntity2;
        const flyingPresentation = flyingFx.getPresentation(recoilEntity2, _fxTime, cam.scale);
        const renderEntity = flyingPresentation.progress > 0.001
          ? { ...recoilEntity2, pos: { x: flyingPresentation.glyphX, y: flyingPresentation.glyphY } }
          : recoilEntity2;
        const roofSizeScale = SIZE_CLASS_SCALE[e.sizeClass] || 1;

        const roofRotation = recoilOff2.rotation || 0;
        drawFlyingShadow(bctx, flyingPresentation);
        drawEntityGlyph(glyphAtlas, bctx, renderEntity, flyingPresentation.glyphScale * roofSizeScale, roofRotation);
        if (shouldShowHealthBar(renderEntity, _fxTime)) {
          drawEntityHealthBar(bctx, renderEntity);
        }
      } else if (e.tags.includes('above_roof')) {
        drawEntityGlyph(glyphAtlas, bctx, e);
      }
    }
  }

  drawTargetingReticle({
    bctx,
    targetCursor: _targetCursor,
    hasPendingSpellTargeting: !!_pendingSpellTargeting,
    hasPendingThrowTargeting: !!_pendingThrowTargeting,
    hasPendingEnemyTargeting: !!_pendingEnemyTargeting,
    fxTime: _fxTime,
  });

  // Float text is the top-most world-space layer so roofs and cover never occlude it.
  ftext.render(bctx);

  bctx.restore();

  // Present backbuffer once (reset transform to identity for exact pixel copy)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(back, 0, 0);
  ctx.restore();

  // Heavy rain dark tint overlay (also suppressed indoors)
  weatherFx.drawScreenTint(ctx, W, H, effectiveWeather);

  // Night / dawn / dusk tints replaced by lighting engine ambient (sun/moon).
  // Falls back to CSS tints on quality=low where the engine is disabled.
  if (PERF.quality === 'low') {
    if (worldView.nightAlpha > 0.01) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(8, 12, 28, ${(worldView.nightAlpha * 0.38).toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (worldView.dawnAlpha > 0.01) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(255, 150, 40, ${(worldView.dawnAlpha * 0.16).toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (worldView.duskAlpha > 0.01) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(210, 70, 20, ${(worldView.duskAlpha * 0.16).toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  // Death VFX screen overlays: desaturation, vignette, flash
  deathVfx.drawDesaturation(ctx, W, H);
  deathVfx.drawLowHpVignette(ctx, W, H, _fxTime);
  deathVfx.drawDeathFlash(ctx, W, H);

  // Screen-space wrath flash drawn after world present so lethal hits still read.
  drawScreenEffects({ ctx, W, H, boltFx });
  sceneRuntime.drawSpeechBubble(ctx);

  drawRulesProfilerOverlay({ ctx, quality: PERF.quality, prof: /** @type any */ (window).__JSHACK_RULES_PROF });
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
  // Hitstop: scale display dt (gore, bumps, particles all slow in unison)
  const displayDt = hitstopFx.scale(dtSec);
  _fxTime += displayDt;
  _dtSec = displayDt;
  impactTracker.flush(_fxTime);

  // Sim step is scene-controlled; keep paused (no tick) unless a scene/input advances it.
  stepSim(0);
  flushPendingStairTransition();

  // Advance display-only systems (fx.step moved below — needs worldView for emitter origins)
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);
  updateZoomPunch(cam, dtSec);
  tickDisplayEffects({ dtSec, boltFx, spellAreaFx, projectileFx, throwFx, pickupFx, cloudFx, spiritWispFx, deathEssenceFx, ftext, goreTick });
  delayedDeathFx.tick(dtSec);
  flyingFx.tick(dtSec);
  slideFx.tick(dtSec);
  bumpFx.tick(dtSec);
  recoilFx.tick(dtSec);
  tickHitTints(dtSec);
  deathVfx.tick(dtSec);
  sceneRuntime.tick(dtSec);

  // Update vitals HUD if changed (lightweight per-frame check)
  hudFeeds.updateVitalsHUD();
  hudFeeds.updateCombatHUD();
  hudFeeds.updateDepthHUD();
  hudFeeds.updateTurnHUD();
  hudFeeds.updateGoldHUD();
  hudFeeds.updatePetHUD();
  hudFeeds.updateActiveSpellHUD();
  hudFeeds.updateCalendarHUD();
  layoutBubbleDialog();

  // Render
  const rawView = getCachedView();
  const view = statusPresentationDelayFx.filterWorldView(rawView, _fxTime);
  if (view.player && !cam._detached) {
    followEntity(cam, view.player.pos, dtSec, 6.0);
  }

  // Feed player HP ratio to death VFX (low-HP heartbeat warning)
  if (view.player) {
    const pe = view.entities.find(e => e.id === view.player.id);
    if (pe && pe.maxHp > 0) deathVfx.setPlayerHpRatio(pe.hp / pe.maxHp);
  }

  // Sync spirit wisp depth (dungeon only)
  spiritWispFx.setDepth(view.currentDepth ?? 0);

  // Status particle emitter reconciliation + advance particles
  if (PERF.particleCapacity > 0) {
    statusEmitterFx.step(dtSec, view, _fxTime);
  }

  applyHallucinationSway({ cam, view, fxTime: _fxTime });

  render(view);

  requestAnimationFrame(frame);
}



// ---- Character creation gate -------------------------------------------------
// Savegames bypass char creation; new games show the selection screen first.
if (_savegameLoaded) {
  _finalizeNewGame(null);
} else if (runtimeConfig.params.get('test') === '1') {
  // ?test=1 — skip char creation, auto-start as Outlaw "Debug Agent"
  finishBoot();
  _finalizeNewGame({ name: 'Debug Agent', classId: 'outlaw', seed: 0xC0FFEE, difficulty: 'easy' });
} else {
  // Fade out the boot loader so the char creation panel is visible
  finishBoot();

  const displayOrder = listClassIds();
  const idxDruid = displayOrder.indexOf('druid');
  const idxWarden = displayOrder.indexOf('warden');
  if (idxDruid !== -1 && idxWarden !== -1) {
    [displayOrder[idxDruid], displayOrder[idxWarden]] = [displayOrder[idxWarden], displayOrder[idxDruid]];
  }

  const classDisplayData = displayOrder.map(id => {
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
    defaultSeed: _bootSeed,
    tutorialTipCount: GUIDANCE_TIPS.length,
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

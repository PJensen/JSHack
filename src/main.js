// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "./main/scheduler.js";
import { playerEntity, findNearestValidTileAround } from "./rules/utils/queries.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera } from "./display/camera/controller.js";
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
import { initStatusLine } from "./display/ui/statusLine.js";
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
import { Faction } from "./rules/components/Faction.js";
import { ShopInventory } from "./rules/components/ShopInventory.js";
import { createFrom } from "./lib/ecs-js/archetype.js";
import { GoldStack } from "./rules/archetypes/Items.js";
import { forEachInRadius } from "./rules/utils/spatialIndex.js";
import { hasLOS } from "./shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "./rules/utils/vision.js";
import { Engraving } from "./rules/components/Engraving.js";
import { Pet } from "./rules/components/Pet.js";
import { Owner } from "./rules/components/Owner.js";
import { Hunger } from "./rules/components/Hunger.js";

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

// Quality/perf controls
const PERF = (() => {
  const params = new URLSearchParams(window.location.search || '');
  // Mobile-first defaults: fast without any URL args
  const q = (params.get('quality') || (typeof localStorage !== 'undefined' ? 
    localStorage.getItem('jshack.quality') : 'high') || 'high').toLowerCase();
  // Cap DPR on mobile/high-DPR screens to avoid excessive fill-rate costs
  const defaultCap = 1.5; // mobile-first
  const dprCapArg = Number(params.get('dprCap')) || Number((typeof localStorage !== 'undefined' && localStorage.getItem('jshack.dprCap')) || 0);
  const dprCap = Number.isFinite(dprCapArg) && dprCapArg > 0 ? dprCapArg : defaultCap;
  const isLow = q === 'low';
  const isHigh = q === 'high';
  return {
    quality: q,
    dprCap: isHigh ? 3 : (isLow ? 1 : dprCap),
    glowLayers: isLow ? 0 : 2,
    particleCapacity: isLow ? 512 : 4096,
    // Default to snap camera (no perceived lag); can override via ?cameraLerp=number
    cameraLerp: (params.get('cameraLerp') !== null ? Number(params.get('cameraLerp')) : 0)
  };
})();

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

// ---- App wires rules/ (no display logic here) ------------------------------
const world = new World({ seed: 0xa77a77 });
configureWorld(world);
// Only app/scenes step the sim (deterministic). We’ll keep it paused here.
function stepSim(dtTurns = 0) { if (dtTurns > 0) { world.tick(dtTurns); } }

// --- Active spell selection (app-side state) ---------------------------------
/** @type {string|null} */
let _activeSpellId = null;
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
function ensureActiveSpell() {
  if (_activeSpellId) return _activeSpellId;
  const list = learnedSpells();
  _activeSpellId = (list[0]?.id) || null;
  updateActiveSpellLabel();
  return _activeSpellId;
}
function setActiveSpell(id) {
  _activeSpellId = (typeof id === 'string' && id.length) ? id : null;
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
import { initDungeon } from "./rules/environment/dungeon/index.js";
import { transitionToDepth } from "./rules/environment/dungeon/transition.js";
import { TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP } from "./rules/environment/dungeon/constants.js";
import { dungeonConfig } from "./rules/environment/dungeon/dungeonConfig.js";
const _tileKindMap = { [TILE_FLOOR]: 'floor', [TILE_WALL]: 'wall', [TILE_DOOR]: 'floor', [TILE_STAIR_DOWN]: 'stair_down', [TILE_STAIR_UP]: 'stair_up' };

// Allow URL override: ?dungeonScale=0.3 for compact debugging floors
{
  const ds = parseFloat(new URLSearchParams(window.location.search).get('dungeonScale'));
  if (Number.isFinite(ds) && ds > 0) dungeonConfig.dungeonScale = ds;
}

// Allow URL override: ?floor=6 to skip straight to a specific depth
const _startDepth = parseInt(new URLSearchParams(window.location.search).get('floor'), 10) || 1;

// Initialize the procedural dungeon (entire floor generated up front)
const spawnPos = initDungeon(world, { startDepth: _startDepth });

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

// Create player at the spawn position (center of first room in origin chunk)
if (!playerEntity(world)) {
  createPlayer(world, { x: spawnPos.x, y: spawnPos.y, name: "Hero" });
}

// Set player stats
{
  const pe = playerEntity(world);
  if (pe) {
    // Mana and vitality
    world.add(pe.id, Mana, { mana: 50, maxMana: 50, manaRegen: 0.1 });
    world.add(pe.id, Vitality, { hp: 100, maxHp: 100 });
    // 10-turn invulnerability at start
    const ae = world.get(pe.id, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) {
      ae.effects.push({ key: 'invulnerable', turnsLeft: 10, potency: 1 });
    } else {
      world.add(pe.id, ActiveEffects, { effects: [{ key: 'invulnerable', turnsLeft: 10, potency: 1 }] });
    }
    // Hunger: start with 100 turns of satiation ("you ate before entering the dungeon")
    world.add(pe.id, Hunger, { hunger: 0, satiation: 100 });
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
  }
}

// Deity: bind player to Mol'Khar and wire deity events to message log
{
  const pe = playerEntity(world);
  if (pe) {
    world.add(pe.id, Devotion, { deityId: 'molkhar' });
    const deity = initDeity('molkhar');
    if (deity) {
      // Cooldown tracker: deity events only fire messages every N ticks
      const _deityCooldowns = { wrath: 0, demand: 0, utterance: 0 };
      const DEITY_COOLDOWN = 30; // minimum ticks between repeated messages

      deity.on('wrath', ({ intensity, tick }) => {
        if (tick - _deityCooldowns.wrath < DEITY_COOLDOWN) return;
        _deityCooldowns.wrath = tick;
        const dmg = Math.round(5 + intensity * 10);
        log(`Mol'Khar's wrath strikes you! (${dmg} damage)`);
        const vit = /** @type any */ (world.get(pe.id, Vitality));
        if (vit) {
          const newHp = Math.max(0, vit.hp - dmg);
          world.set(pe.id, Vitality, { ...vit, hp: newHp });
          try { world.emit?.('damage', { id: pe.id, amount: dmg, source: 0 }); } catch {}
          if (newHp <= 0) try { world.emit?.('died', { id: pe.id }); } catch {}
        }
      });
      deity.on('miracle', ({ serenity }) => {
        // Miracles are rare enough — no cooldown needed
        const heal = Math.round(10 + serenity * 10);
        log(`Mol'Khar grants you a miracle! (+${heal} HP)`);
        const vit = /** @type any */ (world.get(pe.id, Vitality));
        if (vit) {
          const newHp = Math.min(vit.maxHp, vit.hp + heal);
          world.set(pe.id, Vitality, { ...vit, hp: newHp });
          try { world.emit?.('healed', { id: pe.id, amount: heal }); } catch {}
        }
      });
      deity.on('demand', ({ tick }) => {
        if (tick - _deityCooldowns.demand < DEITY_COOLDOWN) return;
        _deityCooldowns.demand = tick;
        log("Mol'Khar hungers for blood!");
      });
      // moodShift is already self-limiting (only fires on actual transitions)
      deity.on('moodShift', ({ to }) => {
        const labels = {
          wrath: 'wrathful', serenity: 'serene', hunger: 'hungry',
          amusement: 'amused', sorrow: 'sorrowful', chaos: 'chaotic',
        };
        log(`Mol'Khar grows ${labels[to] || to}.`);
      });
      deity.on('utterance', ({ dominant, tick }) => {
        if (tick - _deityCooldowns.utterance < DEITY_COOLDOWN) return;
        _deityCooldowns.utterance = tick;
        const lines = {
          wrath: '"More blood!" bellows Mol\'Khar.',
          serenity: '"You serve well," whispers Mol\'Khar.',
          hunger: '"Feed me, mortal," growls Mol\'Khar.',
          amusement: 'Mol\'Khar laughs at your antics.',
          sorrow: 'Mol\'Khar weeps silently.',
          chaos: 'The air crackles with divine unease.',
        };
        log(lines[dominant?.dimension] || 'Mol\'Khar stirs.');
      });
    }
  }
}

// Give player a Scroll of Mapping (reveals full dungeon — debug aid)
import { ScrollOfMapping } from "./rules/archetypes/Items.js";
{
  const pe = playerEntity(world);
  if (pe) {
    const inv = world.get(pe.id, Inventory);
    if (inv && Array.isArray(inv.items)) {
      const scrollId = createFrom(world, ScrollOfMapping, {});
      inv.items.push(scrollId);
    }
  }
}

// ---- Input setup (display/input → rules/display) ---------------------------
const inputDisposers = [];
{
  const rulesHandler = makeRulesDispatcher(
    /** @type any */(world),
    () => (playerEntity(world)?.id || 0)
  );

  const displayHandler = (action) => {
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
        // Gather items at player's position. Open chooser only when there are >1 items.
        const p = playerEntity(world);
        if (!p) break;
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
            const name = world.get(id, NamedIdentity);
            return { id, type: info?.type || 'item', name: name?.name || info?.type || 'item', count: info?.count || 1 };
          });
          window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items } }));
        }
        break;
      }
      default:
        break;
    }
  };

  setupInput({ canvas, rulesHandler, displayHandler, onDispose: inputDisposers, touchFeedback: true });
}

// ---- Display UI overlays + data feeds -------------------------------------
initOverlays();
initHUD();
initStatusLine();

// Provide inventory data to overlay when requested
addEventListener('ui:requestInventoryData', () => {
  const p = playerEntity(world);
  const items = [];
  if (p) {
    const inv = world.get(p.id, Inventory);
    const eq = world.get(p.id, Equipment);
    if (inv && Array.isArray(inv.items)) {
      for (const id of inv.items) {
        const info = world.get(id, ItemInfo);
        const name = world.get(id, NamedIdentity);
        if (info) {
          const equippedSlot = (eq && (
            (eq.weapon === id && 'weapon') ||
            (eq.armor === id && 'armor') ||
            (eq.shield === id && 'shield') ||
            (eq.ring1 === id && 'ring1') ||
            (eq.ring2 === id && 'ring2') ||
            (eq.ammo === id && 'ammo')
          )) || null;
          items.push({
            id,
            type: info.type,
            description: info.description,
            count: info.count,
            slot: info.slot,
            name: name?.name,
            rarityName: info.rarityName,
            bonuses: info.bonuses || {},
            affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
            equipped: Boolean(equippedSlot),
            equippedSlot,
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

// Provide message log entries (placeholder until rules log is wired)
addEventListener('ui:requestMessageLogData', () => {
  const entries = messageLog.slice();
  window.dispatchEvent(new CustomEvent('ui:messageLogData', { detail: { entries } }));
});

// Active spell button click → cast (or open spell picker if none active)
addEventListener('ui:castActiveSpell', () => {
  const id = ensureActiveSpell();
  if (!id) {
    try { window.dispatchEvent(new CustomEvent('ui:openSpellPicker')); } catch {}
    return;
  }
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler({ type: 'rules.castActiveSpell', payload: { spellId: id } });
});

// When user selects items from the pickup chooser overlay
addEventListener('ui:requestPickup', (e) => {
  const arr = e.detail?.itemIds;
  if (!Array.isArray(arr) || !arr.length) return;
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  for (const id of arr) {
    if (Number.isInteger(id) && id > 0) {
      rulesHandler({ type: 'rules.pickupItem', payload: { itemId: id } });
    }
  }
});

// Ranged shoot button / 'r' key → auto-target nearest visible enemy and fire
addEventListener('ui:shootRanged', () => {
  const pe = playerEntity(world);
  if (!pe) return;
  const eq = /** @type any */ (world.get(pe.id, Equipment));
  const weaponId = Number(eq?.weapon || 0);
  const weaponInfo = weaponId ? world.get(weaponId, ItemInfo) : null;
  if (!weaponInfo || weaponInfo.subtype !== 'bow') {
    log('You need a bow to shoot.');
    return;
  }
  const maxRange = weaponInfo.range || 8;
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
  rulesHandler({ type: 'rules.rangedAttack', payload: { targetId: bestId } });
});

// Engrave button → prompt for text, then dispatch engrave action
addEventListener('ui:engrave', () => {
  const pe = playerEntity(world);
  if (!pe) return;
  const text = prompt('Engrave what on the ground?');
  if (!text || !text.trim()) return;
  const rulesHandler = makeRulesDispatcher(world, () => pe.id);
  rulesHandler({ type: 'rules.engrave', payload: { text: text.trim() } });
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
/** @type {string[]} */
const messageLog = [];
/** @param {string} msg */
function log(msg) {
  messageLog.push(msg);
  if (messageLog.length > 50) messageLog.shift();
  // Update always-on ticker
  try { window.dispatchEvent(new CustomEvent('ui:updateMessageTicker', { detail: { entries: messageLog } })); } catch {}
}
/** Format helpers for message log */
function nameOfEntity(id) {
  const pe = playerEntity(world);
  const playerId = pe?.id || 0;
  const n = Number(id || 0);
  if (playerId && n === playerId) return 'You';
  const ni = world.get(n, NamedIdentity);
  const label = ni?.name;
  return label ? bracketizeName(label) : `Entity ${n}`;
}
function nameOfItem(id) {
  const n = Number(id || 0);
  const ni = world.get(n, NamedIdentity);
  const info = world.get(n, ItemInfo);
  const label = ni?.name || info?.description || info?.type;
  return label ? bracketizeName(label) : `item ${n}`;
}

world.on('drank', ({ actor, itemId, target }) => {
  const who = nameOfEntity(actor);
  const it = nameOfItem(itemId);
  const tgt = nameOfEntity(target || actor);
  if (tgt === 'You' && who === 'You') {
    log(`You drink ${it}.`);
  } else if (who === tgt) {
    log(`${who} drinks ${it}.`);
  } else {
    log(`${who} uses ${it} on ${tgt}.`);
  }
  // Dismiss the quick-slot chip for this item
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch {}
});
world.on('castSpell', ({ actor, spellId, targetId }) => {
  const who = nameOfEntity(actor);
  const tgt = nameOfEntity(targetId || actor);
  const s = getSpell(String(spellId || _activeSpellId || ''));
  const label = s?.name ? bracketizeName(s.name) : '[Spell]';
  if (who === 'You' && tgt === 'You') log(`You cast ${label}.`);
  else if (who === 'You') log(`You cast ${label} on ${tgt}.`);
  else if (tgt === 'You') log(`${who} casts ${label} on you.`);
  else log(`${who} casts ${label} on ${tgt}.`);
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
world.on('spell:not-known', ({ actor, spellId }) => {
  log(`You don't know that spell${spellId?` [${spellId}]`:''}.`);
});
world.on('spell:unknown', ({ actor, spellId }) => {
  log(`Unknown spell${spellId?` [${spellId}]`:''}.`);
});
world.on('spell:oom', ({ actor, spellId, need, have }) => {
  log(`Not enough mana to cast [${String(spellId||'spell')}] (need ${need}, have ${have}).`);
});
// Legacy generic damage hook (spells and DoTs may emit this)
world.on('damage', ({ id, amount, source, critical, crit }) => {
  const who = nameOfEntity(id);
  const atk = Number(source||0) ? nameOfEntity(source) : null;
  const critTxt = (critical || crit) ? ' (CRIT!)' : '';
  if (atk) log(`${atk} hits ${who} for ${amount}${critTxt}.`);
  else log(`${who} takes ${amount} damage${critTxt}.`);
});
world.on('healed', ({ id, amount }) => {
  const who = nameOfEntity(id);
  log(`${who} heals ${amount}.`);
  const pos = world.get(Number(id||0), Position);
  if (pos && Number.isFinite(amount)) {
    try { ftext.addHeal(pos.x, pos.y, amount, { color: '#7BFF7B' }); } catch {}
  }
});
world.on('died', ({ id }) => {
  const who = nameOfEntity(id);
  log(`${who} dies.`);
});
// Floating text hooks: damage and gold pickups
// Deterministic combat damage (from combatSystem)
world.on('damaged', ({ target, amount, critical, crit, source }) => {
  const t = Number(target||0) || 0;
  const pos = /** @type any */ (world.get(t, Position));
  const pe = playerEntity(world);
  const isPlayer = !!pe && pe.id === t;
  if (pos && Number.isFinite(amount)) {
    // Player damage is RED, others remain yellow-ish
    const col = isPlayer ? '#ff6060' : '#ffd966';
    ftext.addDamage(pos.x, pos.y, amount, { dmg: amount, color: col, crit: !!(critical || crit) });
  }
  // Message log: "A hits B for N (CRIT!)"
  const defName = nameOfEntity(target);
  const atkName = nameOfEntity(source);
  const critTxt = (critical || crit) ? ' (CRIT!)' : '';
  // Try to include weapon label if attacker has one
  let weaponLabel = '';
  if (Number(source||0)) {
    const eq = /** @type any */ (world.get(Number(source||0), Equipment));
    const wid = Number(eq?.weapon || 0);
    if (wid) {
      const wname = /** @type any */ (world.get(wid, NamedIdentity))?.name;
      if (wname) weaponLabel = ` with ${bracketizeName(wname)}`;
    } else if (world.has(Number(source||0), Player)) {
      weaponLabel = ' with bare fists';
    }
  }
  log(`${atkName} hits ${defName}${weaponLabel} for ${amount}${critTxt}.`);
});
world.on('damage', ({ id, amount, at, critical, crit }) => {
  const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : world.get(Number(id||0), Position);
  const pe = playerEntity(world);
  const isPlayer = !!pe && pe.id === Number(id||0);
  if (pos && Number.isFinite(amount)) {
    const col = isPlayer ? '#ff6060' : '#ffd966';
    ftext.addDamage(pos.x, pos.y, amount, { dmg: amount, color: col, crit: !!(critical || crit) });
  }
});
// Generic status text UX hook (optional): kind='miss'|'immune'|...
world.on('status', ({ id, kind, at, text, source }) => {
  const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : world.get(Number(id||0), Position);
  if (!pos) return;
  const style = (String(kind||'')).toLowerCase() === 'miss' ? 'miss' : ((String(kind||'')).toLowerCase() === 'immune' ? 'immune' : 'status');
  const label = String(text || kind || '').toUpperCase() || (style === 'miss' ? 'MISS' : (style === 'immune' ? 'IMMUNE' : 'STATUS'));
  try { ftext.addStatus(pos.x, pos.y, label, { style }); } catch {}
  // Verbose log for combat statuses when we have participants
  const tgt = nameOfEntity(id);
  const src = Number(source||0) ? nameOfEntity(source) : null;
  if (style === 'miss' && src) log(`${src} misses ${tgt}.`);
  if (style === 'immune' && src) log(`${src} can't hurt ${tgt}.`);
});
// Ranged combat feedback
world.on('ranged:no-ammo', ({ attacker }) => {
  const who = nameOfEntity(attacker);
  log(who === 'You' ? 'You have no arrows.' : `${who} is out of ammo.`);
  const pos = world.get(Number(attacker||0), Position);
  if (pos) try { ftext.addStatus(pos.x, pos.y, 'NO AMMO', { style: 'status' }); } catch {}
});
world.on('ranged:blocked', ({ attacker, target }) => {
  const who = nameOfEntity(attacker);
  log(who === 'You' ? 'Your shot is blocked.' : `${who}'s shot is blocked.`);
});
world.on('ranged:out-of-range', ({ attacker, target }) => {
  const who = nameOfEntity(attacker);
  const tgt = nameOfEntity(target);
  log(who === 'You' ? `${tgt} is out of range.` : `${who}'s target is out of range.`);
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
  const name = world.get(itemId, NamedIdentity);
  try {
    window.dispatchEvent(new CustomEvent('ui:recentPickup', {
      detail: {
        item: {
          id: Number(itemId),
          type: info.type || 'item',
          slot: info.slot || '',
          name: name?.name || info.description || info.type || 'item',
          count: info.count || 1
        }
      }
    }));
  } catch {}
});
// Pet pickup: log when the pet picks up an item
world.on('item:pickup', ({ actor, itemId, count }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id === actor) return; // skip player pickups (handled elsewhere)
  const petName = nameOfEntity(actor);
  const it = nameOfItem(itemId);
  log(`${petName} picks up ${it}.`);
});
// Pet deliver: log when the pet drops an item at the player's feet
world.on('pet:deliver', ({ petId, actor, itemId, itemName, count }) => {
  const petName = nameOfEntity(petId);
  // Use pre-resolved itemName since the item entity may be destroyed after stacking
  const label = itemName ? bracketizeName(itemName) : nameOfItem(itemId);
  log(`${petName} drops ${label} at your feet.`);
  // Trigger inventory UI refresh
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});
// Engrave event → combat log + float text
world.on('engrave', ({ actor, text, x, y }) => {
  const who = nameOfEntity(actor);
  log(`${who} engrave${who === 'You' ? '' : 's'} "${text}" on the ground.`);
  try { ftext.addStatus(x, y - 0.3, `"${text}"`, { color: '#8899aa', life: 1.2 }); } catch {}
});
// Engraving scrambled by foot traffic
world.on('engrave:scrambled', ({ actor, text, x, y }) => {
  const pe = playerEntity(world);
  if (!pe) return;
  const ppos = world.get(pe.id, Position);
  // Only log if the player can see the tile
  if (ppos && Math.max(Math.abs(ppos.x - x), Math.abs(ppos.y - y)) <= 10) {
    const who = nameOfEntity(actor);
    log(`${who} scuff${who === 'You' ? '' : 's'} the engraving underfoot.`);
  }
});

// Refresh inventory UI when any item is used (consumed/learned/etc.)
world.on('item:used', ({ actor, itemId }) => {
  // Dismiss the quick-slot chip for this item
  try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch {}
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});
// Log spell learning events
world.on('spell:learned', ({ actor, spellId }) => {
  const s = getSpell(String(spellId||''));
  const label = s?.name ? `[${s.name}]` : `[${String(spellId||'spell')}]`;
  // set active spell if none selected, and tell the user
  if (!_activeSpellId) {
    setActiveSpell(String(spellId));
    log(`You learn ${label}. It is now your active spell.`);
  } else {
    log(`You learn ${label}.`);
  }
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});
world.on('spell:already-known', ({ actor, spellId }) => {
  const s = getSpell(String(spellId||''));
  const label = s?.name ? `[${s.name}]` : `[${String(spellId||'spell')}]`;
  log(`You already know ${label}.`);
});
world.on('spell:learn-denied', ({ actor, reason, need, have, spellId }) => {
  const s = getSpell(String(spellId||''));
  const label = s?.name ? `[${s.name}]` : (spellId ? `[${String(spellId)}]` : 'that spell');
  let msg = `You can't learn ${label}.`;
  if (reason === 'intelligence') msg = `You need more intelligence to learn ${label} (need ${need}, have ${have}).`;
  if (reason === 'unknown-spell') msg = `This tome is inscrutable.`;
  log(msg);
});
world.on('interaction', ({ action, result, items: droppedIds, targetId }) => {
  if (action === 'toggleDoor') {
    log(`The door ${result === 'opened' ? 'opens' : (result === 'closed' ? 'closes' : 'is locked')}.`);
  }
  if (action === 'openChest') {
    log('You open the chest!');
    // Auto-pickup currency drops silently
    const nonCurrency = [];
    if (Array.isArray(droppedIds)) {
      for (const eid of droppedIds) {
        const info = world.get(eid, ItemInfo);
        if (!info) continue;
        if (info.type === 'currency') {
          // Auto-pickup gold immediately
          const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
          rulesHandler({ type: 'rules.pickupItem', payload: { itemId: eid } });
        } else {
          const name = world.get(eid, NamedIdentity);
          nonCurrency.push({
            id: eid,
            type: info.type || 'item',
            name: name?.name || info.type || 'item',
            count: info.count || 1,
            rarityName: info.rarityName || 'common',
            bonuses: info.bonuses || {},
            affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
          });
        }
      }
    }
    if (nonCurrency.length === 1) {
      // Single item — show ground tooltip for quick pickup
      const it = nonCurrency[0];
      try {
        window.dispatchEvent(new CustomEvent('ui:showGroundItem', {
          detail: {
            mode: 'single',
            item: it,
            pickupRange: 2,
          }
        }));
      } catch {}
    } else if (nonCurrency.length > 1) {
      // Multiple items — open the pickup chooser directly
      try {
        window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items: nonCurrency } }));
      } catch {}
    }
  }
});

// Stair traversal: handle level transitions
world.on('stair:traverse', ({ actor, targetId, direction }) => {
  let currentDepth = 1;
  for (const [, state] of world.query(DungeonState)) {
    currentDepth = state.currentDepth;
    break;
  }

  const newDepth = direction === 'down' ? currentDepth + 1 : currentDepth - 1;
  if (newDepth < 1) {
    log('You cannot ascend any further.');
    return;
  }

  log(`You ${direction === 'down' ? 'descend' : 'ascend'} the stairs...`);
  transitionToDepth(world, newDepth, { x: 0, y: 0 }, { direction });

  // Invalidate cached world view
  _cachedView = null;
  _cachedStep = -1;
});

// UI stair tooltip tap → trigger stair traverse
addEventListener('ui:requestStairTraverse', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const stairId = e?.detail?.stairId;
  const direction = e?.detail?.direction || 'down';
  const pe = playerEntity(world);
  if (!pe) return;

  world.emit?.('stair:traverse', {
    actor: pe.id,
    targetId: stairId,
    direction
  });
});

// ---- Shop event wiring -------------------------------------------------------

/** Count the player's gold from inventory */
function playerGoldCount() {
  const pe = playerEntity(world);
  if (!pe) return 0;
  const inv = world.get(pe.id, Inventory);
  if (!inv) return 0;
  for (const id of inv.items) {
    const info = world.get(id, ItemInfo);
    if (info && info.type === 'currency') return info.count || 0;
  }
  return 0;
}

/** Build item detail for the shop UI from an entity ID */
function buildShopItemDetail(id, markup) {
  const info = world.get(id, ItemInfo);
  const name = world.get(id, NamedIdentity);
  if (!info) return null;
  return {
    id,
    name: name?.name || info.description || info.type || 'item',
    type: info.type,
    slot: info.slot,
    count: info.count || 1,
    value: info.value || 0,
    buyPrice: Math.ceil((info.value || 0) * markup),
    rarityName: info.rarityName || 'common',
    description: info.description || '',
    bonuses: info.bonuses || {},
    affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
  };
}

/** Dispatch current shop state to the UI */
function dispatchShopData(shopkeeperId, buyMarkup, sellDiscount) {
  const shop = world.get(shopkeeperId, ShopInventory);
  if (!shop) return;
  const shopItems = [];
  for (const id of (shop.items || [])) {
    const detail = buildShopItemDetail(id, buyMarkup);
    if (detail) shopItems.push(detail);
  }
  const pe = playerEntity(world);
  const playerItems = [];
  if (pe) {
    const inv = world.get(pe.id, Inventory);
    if (inv) {
      for (const id of inv.items) {
        const info = world.get(id, ItemInfo);
        if (!info || info.type === 'currency') continue;
        const name = world.get(id, NamedIdentity);
        playerItems.push({
          id,
          name: name?.name || info.description || info.type || 'item',
          type: info.type,
          slot: info.slot,
          count: info.count || 1,
          value: info.value || 0,
          sellPrice: Math.floor((info.value || 0) * sellDiscount),
          rarityName: info.rarityName || 'common',
          description: info.description || '',
        });
      }
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:shopData', { detail: {
      shopkeeperId, shopItems, playerItems,
      gold: playerGoldCount(),
      buyMarkup, sellDiscount,
    }}));
  } catch {}
}

// When shop:open fires from interaction system → open shop UI
world.on('shop:open', ({ actor, targetId, shopItems, buyMarkup, sellDiscount }) => {
  log('You approach the shopkeeper.');
  dispatchShopData(targetId, buyMarkup, sellDiscount);
  try { window.dispatchEvent(new CustomEvent('ui:openShop', { detail: { shopkeeperId: targetId, buyMarkup, sellDiscount } })); } catch {}
});

// Buy request from shop UI
addEventListener('ui:requestBuy', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const { shopkeeperId, itemId } = e?.detail || {};
  const pe = playerEntity(world);
  if (!pe) return;

  const shop = world.get(shopkeeperId, ShopInventory);
  if (!shop) return;
  const info = world.get(itemId, ItemInfo);
  if (!info) return;

  const buyMarkup = shop.buyMarkup ?? 1.0;
  const price = Math.ceil((info.value || 0) * buyMarkup);
  const gold = playerGoldCount();

  if (gold < price) {
    log('You cannot afford that.');
    return;
  }

  // Deduct gold
  const inv = world.get(pe.id, Inventory);
  if (inv) {
    for (const gid of inv.items) {
      const gi = world.get(gid, ItemInfo);
      if (gi && gi.type === 'currency') {
        world.mutate(gid, ItemInfo, r => { r.count = (r.count || 0) - price; });
        break;
      }
    }
  }

  // Transfer item from shop to player inventory
  const idx = shop.items.indexOf(itemId);
  if (idx !== -1) shop.items.splice(idx, 1);
  if (inv) {
    try { world.remove(itemId, Position); } catch {}
    inv.items.push(itemId);
  }

  const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
  log(`You buy ${bracketizeName(itemName)} for ${price} gold.`);

  // Refresh shop UI
  dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5);
});

// Sell request from shop UI
addEventListener('ui:requestSell', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const { shopkeeperId, itemId } = e?.detail || {};
  const pe = playerEntity(world);
  if (!pe) return;

  const shop = world.get(shopkeeperId, ShopInventory);
  if (!shop) return;
  const info = world.get(itemId, ItemInfo);
  if (!info) return;

  const sellDiscount = shop.sellDiscount ?? 0.5;
  const price = Math.floor((info.value || 0) * sellDiscount);

  // Remove from player inventory
  const inv = world.get(pe.id, Inventory);
  if (inv) {
    const idx = inv.items.indexOf(itemId);
    if (idx !== -1) inv.items.splice(idx, 1);
  }

  // Unequip if equipped
  const eq = world.get(pe.id, Equipment);
  if (eq) {
    for (const slot of ['weapon', 'armor', 'shield', 'ring1', 'ring2', 'ammo']) {
      if (eq[slot] === itemId) { eq[slot] = null; break; }
    }
  }

  // Add item to shop stock
  shop.items.push(itemId);

  // Add gold to player
  if (inv) {
    let found = false;
    for (const gid of inv.items) {
      const gi = world.get(gid, ItemInfo);
      if (gi && gi.type === 'currency') {
        world.mutate(gid, ItemInfo, r => { r.count = (r.count || 0) + price; });
        found = true;
        break;
      }
    }
    if (!found && price > 0) {
      // Player has no gold stack yet — create one
      const gid = createFrom(world, GoldStack, {});
      try { world.remove(gid, Position); } catch {}
      world.mutate(gid, ItemInfo, r => { r.count = price; });
      inv.items.push(gid);
    }
  }

  const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
  log(`You sell ${bracketizeName(itemName)} for ${price} gold.`);

  // Refresh shop UI
  dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5);
});

// ---- End shop event wiring ---------------------------------------------------

// ---- Chest event wiring -------------------------------------------------------

/** Build item detail for the chest UI from an entity ID */
function buildChestItemDetail(id) {
  const info = world.get(id, ItemInfo);
  const name = world.get(id, NamedIdentity);
  if (!info) return null;
  return {
    id,
    name: name?.name || info.description || info.type || 'item',
    type: info.type,
    slot: info.slot,
    count: info.count || 1,
    rarityName: info.rarityName || 'common',
    description: info.description || '',
    bonuses: info.bonuses || {},
    affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
  };
}

/** Dispatch current chest state to the UI */
function dispatchChestData(chestId) {
  const inv = world.get(chestId, Inventory);
  if (!inv) return;
  const chestItems = [];
  for (const id of (inv.items || [])) {
    const detail = buildChestItemDetail(id);
    if (detail) chestItems.push(detail);
  }
  const pe = playerEntity(world);
  const playerItems = [];
  if (pe) {
    const playerInv = world.get(pe.id, Inventory);
    if (playerInv) {
      for (const id of playerInv.items) {
        const info = world.get(id, ItemInfo);
        if (!info || info.type === 'currency') continue;
        const name = world.get(id, NamedIdentity);
        playerItems.push({
          id,
          name: name?.name || info.description || info.type || 'item',
          type: info.type,
          slot: info.slot,
          count: info.count || 1,
          rarityName: info.rarityName || 'common',
          description: info.description || '',
        });
      }
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('ui:chestData', { detail: {
      chestId, chestItems, playerItems,
    }}));
  } catch {}
}

// When chest:open fires from interaction system → open chest UI
world.on('chest:open', ({ actor, targetId }) => {
  log('You open the chest.');
  dispatchChestData(targetId);
  try { window.dispatchEvent(new CustomEvent('ui:openChest', { detail: { chestId: targetId } })); } catch {}
});

// Take request from chest UI
addEventListener('ui:requestChestTake', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const { chestId, itemId } = e?.detail || {};
  const pe = playerEntity(world);
  if (!pe) return;

  const chestInv = world.get(chestId, Inventory);
  if (!chestInv) return;

  // Verify item is in chest
  const idx = chestInv.items.indexOf(itemId);
  if (idx === -1) return;

  // Check player inventory capacity
  const playerInv = world.get(pe.id, Inventory);
  if (playerInv && playerInv.items.length >= playerInv.capacity) {
    log('Your inventory is full.');
    return;
  }

  // Transfer item from chest to player
  chestInv.items.splice(idx, 1);
  if (playerInv) {
    try { world.remove(itemId, Position); } catch {}
    playerInv.items.push(itemId);
  }

  const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
  log(`You take ${bracketizeName(itemName)} from the chest.`);

  dispatchChestData(chestId);
});

// Put request from chest UI
addEventListener('ui:requestChestPut', (ev) => {
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const { chestId, itemId } = e?.detail || {};
  const pe = playerEntity(world);
  if (!pe) return;

  const chestInv = world.get(chestId, Inventory);
  if (!chestInv) return;
  const info = world.get(itemId, ItemInfo);
  if (!info) return;

  // Check chest capacity
  if (chestInv.items.length >= chestInv.capacity) {
    log('The chest is full.');
    return;
  }

  // Remove from player inventory
  const playerInv = world.get(pe.id, Inventory);
  if (playerInv) {
    const idx = playerInv.items.indexOf(itemId);
    if (idx !== -1) playerInv.items.splice(idx, 1);
  }

  // Unequip if equipped
  const eq = world.get(pe.id, Equipment);
  if (eq) {
    for (const slot of ['weapon', 'armor', 'shield', 'ring1', 'ring2', 'ammo']) {
      if (eq[slot] === itemId) { eq[slot] = null; break; }
    }
  }

  // Add to chest inventory
  chestInv.items.push(itemId);

  const itemName = world.get(itemId, NamedIdentity)?.name || 'item';
  log(`You put ${bracketizeName(itemName)} in the chest.`);

  dispatchChestData(chestId);
});

// ---- End chest event wiring ---------------------------------------------------

// Update inventory and log when an item is equipped
world.on('item:equipped', ({ actor, itemId, slot, name }) => {
  const label = name ? bracketizeName(name) : `item ${itemId}`;
  log(`You equip ${label}${slot ? ' ('+slot+')' : ''}.`);
  // Dismiss the quick-slot chip for this item
  try { window.dispatchEvent(new CustomEvent('ui:itemEquipped', { detail: { itemId } })); } catch {}
  // Refresh the open inventory panel (if open)
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});

// When player moves, show a mobile-friendly ground item tooltip for non-currency items on the tile
world.on('moved', ({ id, to }) => {
  const pe = playerEntity(world);
  if (!pe || pe.id !== id) return;
  const ids = itemsAt(world, to.x, to.y);
  // Filter out currency; we want deliberate pickup for non-gold
  const nonCurrency = ids.filter((eid) => {
    const info = world.get(eid, ItemInfo);
    return info && info.type !== 'currency';
  });
  if (!nonCurrency.length) {
    try { window.dispatchEvent(new CustomEvent('ui:hideGroundItem')); } catch {}
    return;
  }
  // If multiple items, prompt chooser on click; otherwise show direct-pick tooltip
  if (nonCurrency.length > 1) {
    const items = nonCurrency.map((eid) => {
      const info = world.get(eid, ItemInfo);
      const name = world.get(eid, NamedIdentity);
      return { id: eid, type: info?.type || 'item', name: name?.name || info?.type || 'item', count: info?.count || 1 };
    });
    try {
      window.dispatchEvent(new CustomEvent('ui:showGroundItem', { detail: { mode: 'multi', count: items.length, items } }));
    } catch {}
    return;
  }
  // Single item: build tooltip content
  const itemId = nonCurrency[0];
  const info = world.get(itemId, ItemInfo);
  const name = world.get(itemId, NamedIdentity);
  const set = world.get(pe.id, Settings);
  const pickupRange = Math.max(0, Number(set?.pickupRange ?? 0));
  const affixes = Array.isArray(info?.affixes) ? info.affixes.slice() : [];
  const bonuses = info?.bonuses && typeof info.bonuses === 'object' ? { ...info.bonuses } : {};
  const payload = {
    mode: 'single',
    item: {
      id: itemId,
      name: name?.name || info?.description || info?.type || 'item',
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

  // Find stairs within Chebyshev distance 1
  let nearestStair = null;
  let nearestDist = Infinity;
  for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity !== 'stair_down' && ni.identity !== 'stair_up') continue;
    const dist = Math.max(Math.abs(pos.x - to.x), Math.abs(pos.y - to.y));
    if (dist <= 1 && dist < nearestDist) {
      nearestDist = dist;
      nearestStair = { id: eid, identity: ni.identity };
    }
  }

  if (nearestStair) {
    const direction = nearestStair.identity === 'stair_down' ? 'down' : 'up';
    try {
      window.dispatchEvent(new CustomEvent('ui:showStairTooltip', {
        detail: { stairId: nearestStair.id, direction }
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
  /** @type {CustomEvent} */ // @ts-ignore
  const e = ev;
  const itemId = e?.detail?.itemId;
  if (!Number.isInteger(itemId)) return;
  const action = { type: 'rules.useItem', payload: { itemId } };
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler(action);
});

// ---- Display camera (resource) ---------------------------------------------
const cam = createCamera(); // { x,y, scale, target*, shake* }
cam.scale = TILE_PX;
cam.targetScale = TILE_PX;
if (PERF.cameraLerp !== null && Number.isFinite(PERF.cameraLerp)) cam.lerpSpeed = Math.max(0, PERF.cameraLerp);
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
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
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

  // Spell bolt VFX (world-space additive glow)
  if (bctx) drawBoltEffects(bctx);
  if (bctx) drawMeteorEffects(bctx);
  if (bctx) drawBlastwaveEffects(bctx);
  if (bctx) drawFrostEffects(bctx);
  if (bctx) drawArrowEffects(bctx);

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
    const s = fx.stats();
    ctx.fillText(`particles: ${s.active}/${s.capacity}  emitters:${s.emitters}`, 8, 8); // DEBUG
    const fpsInt = Math.max(0, Math.round(_fpsEMA || 0));
    ctx.fillText(`fx fps: ${fpsInt}`, 8, 24); // DEBUG

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

  // Advance display-only systems (fx.step moved below — needs worldView for emitter origins)
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);
  // Display-only VFX lifetimes
  updateBoltFx(dtSec);
  updateMeteorFx(dtSec);
  updateBlastwaveFx(dtSec);
  updateFrostFx(dtSec);
  updateArrowFx(dtSec);
  ftext.step(dtSec);

  // Update vitals HUD if changed (lightweight per-frame check)
  updateVitalsHUD();
  updateCombatHUD();
  updateDepthHUD();

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

// --- Depth HUD feed (dungeon level) ----------------------------------------
let _lastDepth = -1;
function updateDepthHUD() {
  for (const [, state] of world.query(DungeonState)) {
    const d = state.currentDepth;
    if (d !== _lastDepth) {
      _lastDepth = d;
      try { window.dispatchEvent(new CustomEvent('ui:updateDepth', { detail: { depth: d } })); } catch {}
    }
    break;
  }
}

// --- Vitals HUD feed (HP/Mana) --------------------------------------------
let _lastVitals = { hp: -1, maxHp: -1, mana: -1, maxMana: -1 };
function updateVitalsHUD() {
  const pe = playerEntity(world);
  if (!pe) return;
  /** @type {{ hp?:number, maxHp?:number }|null} */
  const vit = /** @type any */ (world.get(pe.id, Vitality));
  const m = getPlayerMana();
  const hp = Number(vit?.hp ?? 0), maxHp = Number(vit?.maxHp ?? 0);
  if (hp !== _lastVitals.hp || maxHp !== _lastVitals.maxHp || m.mana !== _lastVitals.mana || m.maxMana !== _lastVitals.maxMana) {
    _lastVitals = { hp, maxHp, mana: m.mana, maxMana: m.maxMana };
    try { window.dispatchEvent(new CustomEvent('ui:updateVitals', { detail: _lastVitals })); } catch {}
  }
}

// --- Combat HUD feed (weapon, defense, statuses) -------------------------
let _lastCombatHud = { weaponId: -1, atk: -999, def: -999, statusSig: '', affixSig: '' };
function updateCombatHUD() {
  const pe = playerEntity(world);
  if (!pe) return;
  const eq = /** @type any */ (world.get(pe.id, Equipment));
  const st = /** @type any */ (world.get(pe.id, ActiveEffects));
  const wid = Number(eq?.weapon || 0);
  const atk = Number(eq?.attackDerived || 0);
  const def = Number(eq?.defenseDerived || 0);
  const wInfo = wid ? world.get(wid, ItemInfo) : null;
  const wName = wid ? (world.get(wid, NamedIdentity)?.name || wInfo?.description || wInfo?.type) : '';
  const dmgDice = wInfo?.damageDice || '';
  const statuses = Array.isArray(st?.effects) ? st.effects.map((e) => ({ key: String(e.key||e.type||'').toLowerCase(), turns: Number(e.turnsLeft||e.duration||0), stacks: Number(e.stacks||1) })) : [];
  const statusSig = statuses.map(s=>`${s.key}:${s.turns}:${s.stacks}`).join('|');

  // Collect equipped affix names for HUD display
  const affixIds = [];
  const pushAffixes = (id) => {
    const info = id ? world.get(id, ItemInfo) : null;
    const arr = info && Array.isArray(info.affixes) ? info.affixes : [];
    for (const a of arr) affixIds.push(String(a));
  };
  if (eq) {
    pushAffixes(Number(eq.weapon||0));
    pushAffixes(Number(eq.armor||0));
    pushAffixes(Number(eq.ring1||0));
    pushAffixes(Number(eq.ring2||0));
  }
  // Do not show Thorns as a persistent affix chip; it should only appear in Status when it procs
  const affixNames = affixIds
    .filter((id) => !/^thorns/i.test(String(id)))
    .map((id) => (AFFIX_DEFS?.[id]?.name) || id);
  const affixSig = affixNames.join('|');
  if (_lastCombatHud.weaponId !== wid || _lastCombatHud.atk !== atk || _lastCombatHud.def !== def || _lastCombatHud.statusSig !== statusSig || _lastCombatHud.affixSig !== affixSig) {
    _lastCombatHud = { weaponId: wid, atk, def, statusSig, affixSig };
    try {
      window.dispatchEvent(new CustomEvent('ui:updateCombatHUD', { detail: {
        weapon: wid ? { id: wid, name: wName || null, damageDice: dmgDice || null, attack: atk } : null,
        defense: def,
        statuses,
        affixes: affixNames
      }}));
    } catch {}
  }
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
requestAnimationFrame(frame);

// ---- Minimal demo “scene” controls (display-only) --------------------------
addEventListener("keydown", (e) => {
  const { key, code } = e;
  const zoomIn  = key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
  const zoomOut = key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract";

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

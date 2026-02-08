// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "../app/rules/scheduler.js";
import { playerEntity } from "./rules/utils/queries.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera } from "./display/camera/controller.js";
import { updateShake, startShake } from "./display/camera/shake.js";
import { zoomTo, jumpTo } from "./display/camera/utils.js";

// display/ particles (pure display-side FX; no ECS, no rules)
import { ParticleFX } from "./display/passes/vfx/particles/particlePool.js";
// input wiring (display-only router)
import { setupInput } from "./display/input/InputRouter.js";
import { enableInputLockdown } from "./display/input/lockdown.js";
import { makeRulesDispatcher } from "../app/input/rulesDispatch.js";
// simple UI overlays
import { initOverlays } from "./display/ui/overlay.js";
import { initHUD } from "./display/ui/hud.js";
import { Inventory } from "./rules/components/Inventory.js";
import { Equipment } from "./rules/components/Equipment.js";
import { ItemInfo } from "./rules/components/ItemInfo.js";
import { NamedIdentity } from "./rules/components/NamedIdentity.js";
import { Position } from "./rules/components/Position.js";
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

// Initialize the procedural dungeon (chunks loaded by chunkManagementSystem each tick)
const spawnPos = initDungeon(world);

// Create player at the spawn position (center of first room in origin chunk)
if (!playerEntity(world)) {
  createPlayer(world, { x: spawnPos.x, y: spawnPos.y, name: "Hero" });
}

// Set player stats
{
  const pe = playerEntity(world);
  if (pe) {
    // Mana and vitality
    world.add(pe.id, Mana, { mana: 50, maxMana: 50, manaRegen: 1 });
    world.add(pe.id, Vitality, { hp: 100, maxHp: 100 });
    // 10-turn invulnerability at start
    const ae = world.get(pe.id, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) {
      ae.effects.push({ key: 'invulnerable', turnsLeft: 10, potency: 1 });
    } else {
      world.add(pe.id, ActiveEffects, { effects: [{ key: 'invulnerable', turnsLeft: 10, potency: 1 }] });
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
            (eq.ring2 === id && 'ring2')
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
  }
  window.dispatchEvent(new CustomEvent('ui:inventoryData', { detail: { items } }));
});

// Provide message log entries (placeholder until rules log is wired)
addEventListener('ui:requestMessageLogData', () => {
  const entries = messageLog.slice();
  window.dispatchEvent(new CustomEvent('ui:messageLogData', { detail: { entries } }));
});

// Active spell button click → cast
addEventListener('ui:castActiveSpell', () => {
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  const id = ensureActiveSpell();
  rulesHandler({ type: 'rules.castActiveSpell', payload: id ? { spellId: id } : {} });
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
  if (typeof spellId === 'string' && spellId.length) setActiveSpell(spellId);
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
// Refresh inventory UI when any item is used (consumed/learned/etc.)
world.on('item:used', ({ actor, itemId }) => {
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
});
// Log spell learning events
world.on('spell:learned', ({ actor, spellId }) => {
  const s = getSpell(String(spellId||''));
  const label = s?.name ? `[${s.name}]` : `[${String(spellId||'spell')}]`;
  log(`You learn ${label}.`);
  try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch {}
  // set active spell if none selected
  if (!_activeSpellId) { setActiveSpell(String(spellId)); }
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
world.on('interaction', ({ action, result }) => {
  if (action === 'toggleDoor') {
    log(`The door ${result === 'opened' ? 'opens' : (result === 'closed' ? 'closes' : 'is locked')}.`);
  }
});
// Update inventory and log when an item is equipped
world.on('item:equipped', ({ actor, itemId, slot, name }) => {
  const label = name ? bracketizeName(name) : `item ${itemId}`;
  log(`You equip ${label}${slot ? ' ('+slot+')' : ''}.`);
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

// Optionally attach an emitter to a stable key (e.g., player id) later
// fx.ensureEmitter(playerId, preset);

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

  // Draw entities (glyph-based, mapped from kind/tags)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw tiles first, then actors/items for layering without per-frame array allocs
  const isTileKind = (k) => k === 'floor' || k === 'wall' || (typeof k === 'string' && (k.startsWith('door_') || k.startsWith('stair_')));

  // Set glyph height in world units once per frame (pre-transform px). With camera.scale=TILE_PX,
  // 1px here becomes TILE_PX on screen, matching tile size.
  // We now use pre-rendered glyph bitmaps; font is not used for entities.
  // Compute simple view bounds in world units for culling
  const viewHalfW = W * 0.5 / (cam.scale || 1);
  const viewHalfH = H * 0.5 / (cam.scale || 1);
  const vx0 = cam.x - viewHalfW - 1; // add small margin
  const vy0 = cam.y - viewHalfH - 1;
  const vx1 = cam.x + viewHalfW + 1;
  const vy1 = cam.y + viewHalfH + 1;

  // Pass 1: tiles
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (!isTileKind(e.kind)) continue;
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
  const k = (typeof e.kind === 'string') ? e.kind : 'default';
  drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);
  }

  // Pass 2: non-tiles
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (isTileKind(e.kind)) continue;
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
  const k = (typeof e.kind === 'string') ? e.kind : 'default';
  drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);

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
  }

  // Spell bolt VFX (world-space additive glow)
  if (bctx) drawBoltEffects(bctx);
  if (bctx) drawMeteorEffects(bctx);
  if (bctx) drawBlastwaveEffects(bctx);

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
    // ctx.fillText(`particles: ${s.active}/${s.capacity}  emitters:${s.emitters}`, 8, 8);
    const fpsInt = Math.max(0, Math.round(_fpsEMA || 0));
    // ctx.fillText(`fx fps: ${fpsInt}`, 8, 24);

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

  // Advance display-only systems
  if (PERF.particleCapacity > 0) fx.step(dtSec);
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);
  // Display-only VFX lifetimes
  updateBoltFx(dtSec);
  updateMeteorFx(dtSec);
  updateBlastwaveFx(dtSec);
  ftext.step(dtSec);

  // Update vitals HUD if changed (lightweight per-frame check)
  updateVitalsHUD();
  updateCombatHUD();

  // Render
  const view = getCachedView();
  // keep camera centered on player if present
  if (view.player) {
    // Directly set follow target at player world coords
    followEntity(cam, view.player.pos, dtSec, 6.0);
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
  const statuses = Array.isArray(st?.effects) ? st.effects.map((e) => ({ key: String(e.key||e.type||'').toLowerCase(), turns: Number(e.turnsLeft||e.duration||0) })) : [];
  const statusSig = statuses.map(s=>`${s.key}:${s.turns}`).join('|');

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

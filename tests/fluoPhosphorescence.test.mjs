// tests/fluoPhosphorescence.test.mjs
// Fluorite phosphorescence: charges from energetic (blue/UV) sources,
// emits cyan-green, persists after source removed, decays over ~18s.
// Tests the display-layer gem interaction pass in collectLightSources.

import {
  collectLightSources,
  installLightEventListeners,
} from "../src/display/lighting/sources/index.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function makeEventBus() {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    emit(event, payload) {
      for (const fn of (handlers.get(event) || [])) fn(payload);
    },
  };
}

// ---- Fixtures ----------------------------------------------------------------

const GEM_ID    = 42;
const STORM_ID  = 43;
const PLAYER_ID = 1;
const GEM_X = 10, GEM_Y = 10;

const fluoOptical = {
  lightPass:    0.65,
  lightReflect: 0.45,
  lightAbsorb:  0.15,
  dispersion:   0.04,
  tint:         [0.85, 0.95, 1.0],
  pattern:      'gem_fluorite',
  emissive:     false,
};

function makeFluoGem() {
  return {
    id:         GEM_ID,
    pos:        { x: GEM_X, y: GEM_Y },
    tags:       [],
    layer:      250,
    kind:       'gem_fluorite',
    gemOptical: { ...fluoOptical },
  };
}

// Storm entity 2 tiles from gem — within caustic range (CAUSTIC_DIST_SQ=64).
// Emits STORM_WHITE [200,210,255] — blue-dominant, triggers fluorescence.
function makeStormEntity() {
  return {
    id:   STORM_ID,
    pos:  { x: GEM_X + 2, y: GEM_Y },
    tags: ['storm_glowing'],
    layer: 300,
    kind: 'lightning',
  };
}

// Torch entity same distance — WARM_ORANGE [255,190,120], NOT blue-dominant.
function makeWarmEntity() {
  return {
    id:   44,
    pos:  { x: GEM_X + 2, y: GEM_Y },
    tags: ['torch'],
    layer: 300,
    kind: 'torch',
  };
}

function makeView(entities) {
  return {
    player:              { id: PLAYER_ID, pos: { x: 100, y: 100 } },
    entities: [
      // Player entity far away, no torch — produces no light
      { id: PLAYER_ID, pos: { x: 100, y: 100 }, tags: [], layer: 300, kind: 'player' },
      ...entities,
    ],
    playerVisionRadius:  0,
    playerFacing:        null,
    playerConeDegrees:   360,
    turn:                1,
  };
}

// Match the hardcoded fluorite emission color [40, 230, 180] and corona [30, 180, 140].
function hasFluoEmission(lights) {
  return lights.some(l =>
    Array.isArray(l.color) &&
    l.color[0] <= 80 && l.color[1] >= 170 && l.color[2] >= 140,
  );
}

// ---- Tests -------------------------------------------------------------------

const bus = makeEventBus();
installLightEventListeners(bus, () => ({ x: 0, y: 0 }));

Deno.test("fluorite: warm torch source does not charge or emit", () => {
  bus.emit("dungeon:transitioned");
  const lights = collectLightSources(
    makeView([makeFluoGem(), makeWarmEntity()]),
    { fxTime: 0, dt: 0.016 },
  );
  assert(!hasFluoEmission(lights), "warm/red light should not charge fluorite");
});

Deno.test("fluorite: energetic blue source (storm) triggers cyan-green emission", () => {
  bus.emit("dungeon:transitioned");
  const lights = collectLightSources(
    makeView([makeFluoGem(), makeStormEntity()]),
    { fxTime: 0, dt: 0.016 },
  );
  assert(hasFluoEmission(lights), "storm light should charge fluorite and trigger phosphorescence");
});

Deno.test("fluorite: phosphorescence persists after source removed (dt=0)", () => {
  bus.emit("dungeon:transitioned");
  // Frame 1: charge
  collectLightSources(
    makeView([makeFluoGem(), makeStormEntity()]),
    { fxTime: 0, dt: 0.016 },
  );
  // Frame 2: source gone, no time elapsed — charge intact
  const lights = collectLightSources(
    makeView([makeFluoGem()]),
    { fxTime: 0.016, dt: 0 },
  );
  assert(hasFluoEmission(lights), "fluorite should still glow after source removed (phosphorescence)");
});

Deno.test("fluorite: charge fully decays over 20s with no source", () => {
  bus.emit("dungeon:transitioned");
  // Charge
  collectLightSources(
    makeView([makeFluoGem(), makeStormEntity()]),
    { fxTime: 0, dt: 0.016 },
  );
  // Decay: FLUO_DECAY=0.055/s — 20s drains max charge of 1.0 completely
  const lights = collectLightSources(
    makeView([makeFluoGem()]),
    { fxTime: 20, dt: 20 },
  );
  assert(!hasFluoEmission(lights), "fluorite charge should fully decay after 20s");
});

Deno.test("fluorite: dungeon:transitioned clears charge immediately", () => {
  // Charge
  collectLightSources(
    makeView([makeFluoGem(), makeStormEntity()]),
    { fxTime: 0, dt: 0.016 },
  );
  // Transition — clears _fluoCharges
  bus.emit("dungeon:transitioned");
  // dt=0, no new charging, no decay needed
  const lights = collectLightSources(
    makeView([makeFluoGem()]),
    { fxTime: 0, dt: 0 },
  );
  assert(!hasFluoEmission(lights), "level transition should wipe fluorite phosphorescence");
});

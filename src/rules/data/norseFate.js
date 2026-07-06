import { Hamingja } from "../components/Hamingja.js";
import { Landvaettir } from "../components/Landvaettir.js";
import { Position } from "../components/Position.js";

export const LANDVAETTIR_SITE_DEFS = Object.freeze({
  strange_grove: Object.freeze({
    id: 'strange_grove',
    name: 'Landvaettir of the Strange Grove',
    attachedTo: 'landmark',
    anchor: 'grove',
    dormant: true,
    visible: false,
    disposition: 'watchful',
    discovery: ['search', 'spirit_guide', 'spirit_essence'],
    stateKeys: ['appeased', 'offended', 'remembered'],
    description: 'The grove itself has a presence. It notices harvest, violence, offerings, and return visits.',
  }),
  graveyard: Object.freeze({
    id: 'graveyard',
    name: 'Landvaettir of the Graveyard',
    attachedTo: 'landmark',
    anchor: 'graves',
    dormant: true,
    visible: false,
    disposition: 'solemn',
    discovery: ['search', 'corpse', 'spirit_essence'],
    stateKeys: ['appeased', 'disturbed', 'remembered'],
    description: 'The burial ground carries a local memory separate from any single ghost or corpse.',
  }),
  old_well: Object.freeze({
    id: 'old_well',
    name: 'Landvaettir of the Old Well',
    attachedTo: 'landmark',
    anchor: 'water',
    dormant: true,
    visible: false,
    disposition: 'listening',
    discovery: ['search', 'offering', 'spirit_guide'],
    stateKeys: ['appeased', 'offended', 'remembered'],
    description: 'The well is not a creature. It is a place with a mood and a memory.',
  }),
});

export const HAMINGJA_DEFAULTS = Object.freeze({
  id: 'hamingja',
  name: 'Hamingja',
  luck: 1,
  inherited: true,
  transferable: false,
});

export function getLandvaettirSite(id) {
  return LANDVAETTIR_SITE_DEFS[id] ?? null;
}

export function attachLandvaettir(world, entityId, siteId, opts = {}) {
  const def = getLandvaettirSite(siteId);
  if (!def || !(entityId > 0)) return false;
  const pos = world.get(entityId, Position);
  const originX = Number.isFinite(opts.originX) ? (Number(opts.originX) | 0) : (pos?.x | 0) || 0;
  const originY = Number.isFinite(opts.originY) ? (Number(opts.originY) | 0) : (pos?.y | 0) || 0;
  const rec = {
    siteId,
    originX,
    originY,
    radius: Number.isFinite(opts.radius) ? Math.max(0, Number(opts.radius) | 0) : 6,
    disposition: String(opts.disposition || def.disposition || "dormant"),
    visible: opts.visible === true || def.visible === true,
    memory: String(opts.memory || ""),
  };
  if (world.has(entityId, Landvaettir)) world.set(entityId, Landvaettir, rec);
  else world.add(entityId, Landvaettir, rec);
  return true;
}

export function attachHamingja(world, entityId, opts = {}) {
  if (!(entityId > 0)) return false;
  const rec = {
    lineageId: String(opts.lineageId || ""),
    luck: Number.isFinite(opts.luck) ? Number(opts.luck) : HAMINGJA_DEFAULTS.luck,
    inherited: opts.inherited !== false,
    transferable: false,
    sourceRunId: String(opts.sourceRunId || ""),
  };
  if (world.has(entityId, Hamingja)) world.set(entityId, Hamingja, rec);
  else world.add(entityId, Hamingja, rec);
  return true;
}

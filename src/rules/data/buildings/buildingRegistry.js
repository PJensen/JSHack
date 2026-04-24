import tavern from './tavern.js';
import windmill from './windmill.js';
import cottage from './cottage.js';
import wellPlaza from './well_plaza.js';
import smithy from './smithy.js';
import apothecary from './apothecary.js';
import church from './church.js';
import gemStore from './gem_store.js';
import bookShop from './book_shop.js';
import herbalistHut from './herbalist_hut.js';
import generalStore from './general_store.js';

export const BUILDING_DEFS = {
  tavern,
  windmill,
  cottage,
  well_plaza: wellPlaza,
  smithy,
  apothecary,
  church,
  gem_store: gemStore,
  book_shop: bookShop,
  herbalist_hut: herbalistHut,
  general_store: generalStore,
};

export const BUILDING_POOL = [
  'tavern', 'windmill', 'cottage', 'well_plaza', 'smithy',
  'apothecary', 'church', 'gem_store', 'book_shop', 'herbalist_hut', 'general_store'
];

/**
 * Get random building from pool
 * @param {object} rng - world.rand or seeded RNG
 * @param {string[]} [exclude=[]] - building keys to exclude
 * @returns {string} building key
 */
export function pickRandomBuilding(rng, exclude = []) {
  const available = BUILDING_POOL.filter(k => !exclude.includes(k));
  if (available.length === 0) return null;
  const idx = Math.floor(rng() * available.length);
  return available[idx];
}

/**
 * Check if building footprint overlaps with occupied tiles
 * @param {Map} chunks - chunk map
 * @param {number} anchorX
 * @param {number} anchorY
 * @param {object} buildingDef
 * @param {function} isOccupied - predicate (x, y) => boolean
 * @returns {boolean} true if no overlap
 */
export function canPlaceBuilding(chunks, anchorX, anchorY, buildingDef, isOccupied) {
  for (const { dx, dy } of buildingDef.tiles) {
    const wx = anchorX + dx;
    const wy = anchorY + dy;
    if (isOccupied(wx, wy)) return false;
  }
  return true;
}

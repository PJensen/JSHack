import { DeathApplied } from '../components/DeathApplied.js';
import { Position } from '../components/Position.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { Player } from '../components/Player.js';
import { DungeonState } from '../components/DungeonState.js';

const TOMBSTONE_REPOSITORY = Symbol.for('jshack:tombstone:repository');
const TOMBSTONE_SEEN = Symbol.for('jshack:tombstone:seenPerStep');
const TOMBSTONE_EPOCH_MS = 1704067200000; // 2024-01-01T00:00:00.000Z

/**
 * @param {string} text
 * @returns {number}
 */
function hashText32(text) {
  let h = 0x811c9dc5;
  const src = String(text || '');
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * @param {World} world
 * @param {{ playerId: number, depth: number, cause: string, killerIdentity: string | null }} spec
 */
function buildTombstoneId(world, spec) {
  const seed = world.seed >>> 0;
  const step = Math.max(0, world.step | 0);
  const payload = `${seed}:${step}:${spec.playerId | 0}:${spec.depth | 0}:${spec.cause}:${spec.killerIdentity || ''}`;
  const hash = hashText32(payload).toString(16);
  return `ts_${seed.toString(16)}_${step}_${hash}`;
}

/**
 * Configure the tombstone repository used by tombstoneSystem.
 *
 * @param {World} world - ECS world instance
 * @param {TombstoneRepository} repository - Tombstone repository instance
 */
export function installTombstoneDeathListener(world, repository) {
  if (!world || !repository) return;
  world[TOMBSTONE_REPOSITORY] = repository;
}

function ensureSeenState(world) {
  const rec = world[TOMBSTONE_SEEN];
  if (rec && typeof rec === 'object' && rec.ids instanceof Set) return rec;
  const created = { step: -1, ids: new Set() };
  world[TOMBSTONE_SEEN] = created;
  return created;
}

/**
 * Captures player deaths and saves them to the tombstone repository.
 * @param {World} world - ECS world instance
 */
export function tombstoneSystem(world) {
  const repository = world?.[TOMBSTONE_REPOSITORY];
  if (!repository) return;

  const seen = ensureSeenState(world);
  const step = world.step | 0;
  if (seen.step !== step) {
    seen.step = step;
    seen.ids.clear();
  }

  for (const [, death] of world.query(DeathApplied)) {
    const id = Number(death.target || 0) | 0;
    // Only capture player deaths
    if (!world.has(id, Player)) continue;
    if (seen.ids.has(id)) continue;
    seen.ids.add(id);

    const pos = world.get(id, Position);
    const ident = world.get(id, NamedIdentity);

    // Get current depth from DungeonState
    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) {
      depth = ds.currentDepth || 1;
      break;
    }

    // Determine cause of death and killer attribution
    let deathCause = death.cause || 'unknown';
    let killerName = null;
    let killerIdentity = null;

    const killer = Number(death.killer || 0) | 0;
    if (killer) {
      const killerIdent = world.get(killer, NamedIdentity);
      if (killerIdent) {
        killerName = killerIdent.name;
        killerIdentity = killerIdent.identity;
      }
    }

    const turn = Math.max(0, world.step | 0);
    const timestamp = TOMBSTONE_EPOCH_MS + (turn * 1000);

    // Create tombstone record
    const record = {
      id: buildTombstoneId(world, {
        playerId: id | 0,
        depth: depth | 0,
        cause: String(deathCause || 'unknown'),
        killerIdentity,
      }),
      depth,
      cause: deathCause,
      killerName,
      killerIdentity,
      timestamp,
      turn,
      playerName: ident?.name || 'Hero'
    };

    // Save to repository
    try {
      repository.save(record);
      console.log(`Tombstone saved: ${record.playerName} died on depth ${depth} (${deathCause})`);
    } catch (err) {
      console.error('Failed to save tombstone on death:', err);
    }
  }
}

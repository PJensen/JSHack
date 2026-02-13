import { Position } from '../components/Position.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { Player } from '../components/Player.js';
import { DungeonState } from '../components/DungeonState.js';

/**
 * Install tombstone death listener
 * Captures player deaths and saves them to the tombstone repository
 * @param {World} world - ECS world instance
 * @param {TombstoneRepository} repository - Tombstone repository instance
 */
export function installTombstoneDeathListener(world, repository) {
  if (!world || !repository) return;

  world.on('died', ({ id, killer, cause }) => {
    // Only capture player deaths
    if (!world.has(id, Player)) return;

    const pos = world.get(id, Position);
    const ident = world.get(id, NamedIdentity);

    // Get current depth from DungeonState
    let depth = 1;
    for (const [, ds] of world.query(DungeonState)) {
      depth = ds.currentDepth || 1;
      break;
    }

    // Determine cause of death
    let deathCause = 'unknown';
    let killerName = null;
    let killerIdentity = null;

    if (cause) {
      // Environmental death (starvation, etc.)
      deathCause = cause;
    } else if (killer) {
      // Combat or entity-caused death
      deathCause = 'combat';
      const killerIdent = world.get(killer, NamedIdentity);
      if (killerIdent) {
        killerName = killerIdent.name;
        killerIdentity = killerIdent.identity;
      }
    }

    // Create tombstone record
    const record = {
      id: `ts_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      depth,
      cause: deathCause,
      killerName,
      killerIdentity,
      timestamp: Date.now(),
      turn: world.step || 0,
      playerName: ident?.name || 'Hero'
    };

    // Save to repository
    try {
      repository.save(record);
      console.log(`Tombstone saved: ${record.playerName} died on depth ${depth} (${deathCause})`);
    } catch (err) {
      console.error('Failed to save tombstone on death:', err);
    }
  });
}

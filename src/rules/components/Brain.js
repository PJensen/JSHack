import { defineComponent } from '../../lib/ecs-js/index.js';

export const Brain = defineComponent(
    'Brain',
    {
        learnedSpellIds: [],
        itemKnowledgeIdentities: [],
        seenTiles: null,
        intelligence: 10,
    },
    {
        validate(rec) {
            if (!rec || !Array.isArray(rec.learnedSpellIds))
                throw new Error('Brain: learnedSpellIds must be an array');
            if (rec.seenTiles != null && !(rec.seenTiles instanceof Uint8Array)) {
                throw new Error('Brain: seenTiles must be a Uint8Array or null');
            }
            return true;
        }
    }
);

/**
 * Allocate a fresh seenTiles buffer for a Brain component.
 * @param {number} tileCount
 */
export function createSeenTilesBuffer(tileCount = 0) {
    const len = Number.isFinite(tileCount) && tileCount > 0 ? tileCount | 0 : 0;
    return new Uint8Array(len);
}

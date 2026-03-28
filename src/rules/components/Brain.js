import { defineComponent } from '../../lib/ecs-js/index.js';

export const Brain = defineComponent(
    'Brain',
    {
        learnedSpellIds: [],
        itemKnowledgeIdentities: [],
        seenTiles: new Uint8Array(),
        intelligence: 10,
        visionRange: 8,
        fovConeDegrees: null,
    },
    {
        validate(rec) {
            if (!rec || !Array.isArray(rec.learnedSpellIds))
                throw new Error('Brain: learnedSpellIds must be an array');  
            return true;
        }
    }
);

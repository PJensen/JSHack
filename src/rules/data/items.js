
export const ITEM_DEFS = {
    book_lightning: {
        id: 'book_lightning',
        name: 'Spellbook of Lightning',
        type: 'learn',
        slot: 'brain',
        rarity: 1,
        rarityName: 'rare',
        description: 'Grants the ability to cast a lightning spell.',
    }
};

export function listItems() { return Object.values(ITEM_DEFS); }
export function getItem(id) { return ITEM_DEFS[id] || null; }
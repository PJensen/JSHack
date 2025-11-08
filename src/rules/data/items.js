
export const ITEM_DEFS = {
    book_lightning: {
        id: 'book_lightning',
        name: 'Spellbook of Lightning',
        type: 'learn',
        slot: 'brain',
        rarity: 1,
        rarityName: 'rare',
        description: 'Grants the ability to cast a lightning spell.',
    },
    scroll_blastwave: {
        id: 'scroll_blastwave',
        name: 'Scroll of Blast Wave',
        type: 'scroll',
        slot: 'bag',
        rarity: 1,
        rarityName: 'rare',
        description: 'Casts Blast Wave without learning it.'
    }
};

export function listItems() { return Object.values(ITEM_DEFS); }
export function getItem(id) { return ITEM_DEFS[id] || null; }

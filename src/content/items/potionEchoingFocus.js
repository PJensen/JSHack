import { defineItem } from '../define.js';

defineItem('potion_echoing_focus', {
  name: 'Potion of Echoing Focus',
  type: 'potion',
  glyph: '!',
  color: '#d28cff',
  glow: '#8c4fc4',
  scale: 0.65,
  material: 'glass',
  rarity: 'rare',
  value: 65,
  weight: 0.5,
  description: 'A bright violet draught that makes every instinct feel one heartbeat ahead.',
  potion: {
    route: 'oral',
    doses: 1,
    channels: [],
    effects: [
      { key: 'keen_eye', potency: 1, onset: 0, peak: 0, duration: 20, stack: 'refresh', maxStacks: 1 },
      { key: 'lucky', potency: 1, onset: 0, peak: 0, duration: 20, stack: 'refresh', maxStacks: 1 },
    ],
    toxicity: null,
    feel: 'Your thoughts arrive before danger does.',
  },
});

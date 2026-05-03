// Pure data tables and stateless helpers for combat message rendering.
// No world, log, or component access — import freely from anywhere.

export const MELEE_VERBS = {
  stab:   ['stab', 'stabs'],
  slash:  ['slash', 'slashes'],
  blunt:  ['bash', 'bashes'],
  strike: ['hit', 'hits'],
};

export const SPELL_VERBS = {
  fire:      ['burn', 'burns'],
  lightning: ['shock', 'shocks'],
  electric:  ['shock', 'shocks'],
  ice:       ['freeze', 'freezes'],
  frost:     ['freeze', 'freezes'],
  cold:      ['freeze', 'freezes'],
  poison:    ['poison', 'poisons'],
  acid:      ['corrode', 'corrodes'],
  arcane:    ['blast', 'blasts'],
  plasma:    ['sear', 'sears'],
  radiation: ['irradiate', 'irradiates'],
  shadow:    ['torment', 'torments'],
  nature:    ['ravage', 'ravages'],
  generic:   ['wound', 'wounds'],
};

export const CRIT_MELEE = {
  stab:  ['skewer', 'skewers'],
  slash: ['cleave', 'cleaves'],
  blunt: ['crush', 'crushes'],
};

export const MISS_VERBS = {
  stab:  ['stab at', 'stabs at'],
  slash: ['swing at', 'swings at'],
  blunt: ['swing at', 'swings at'],
};

export const FLAVOR_ADVERBS = Object.freeze({
  brutal:    'brutally',
  vicious:   'viciously',
  savage:    'savagely',
  precise:   'precisely',
  ruthless:  'ruthlessly',
});

export const IMPACT_BY_WEAPON = Object.freeze({
  pickaxe: Object.freeze({
    light:       ["The pick's point chips in."],
    solid:       ["The pick bites deep and twists."],
    heavy:       ["The pickaxe hooks bone and wrenches free."],
    devastating: ["A devastating quarry-bite caves everything in."],
  }),
  mace: Object.freeze({
    light:       ["The mace clips hard enough to rattle teeth."],
    solid:       ["The mace lands square and the frame buckles."],
    heavy:       ["The mace caves ribs with a wet thud."],
    devastating: ["A devastating crush folds armor like tin."],
  }),
  dagger: Object.freeze({
    light:       ["A quick nick draws first blood."],
    solid:       ["The dagger slides between plates."],
    heavy:       ["The dagger drives in to the hilt."],
    devastating: ["A devastating thrust finds something vital."],
  }),
  sword: Object.freeze({
    light:       ["Steel kisses and opens a line."],
    solid:       ["The edge bites and parts flesh cleanly."],
    heavy:       ["The blade shears through with brutal leverage."],
    devastating: ["A devastating cut nearly takes them in half."],
  }),
  axe: Object.freeze({
    light:       ["The axe nicks and tears away."],
    solid:       ["The axe buries and rips free."],
    heavy:       ["The axe hews deep with a splintering crack."],
    devastating: ["A devastating hew nearly drops them where they stand."],
  }),
  spear: Object.freeze({
    light:       ["The spear jabs and tests the guard."],
    solid:       ["The spear punches through the centerline."],
    heavy:       ["The spear drives through and jerks back bloody."],
    devastating: ["A devastating impalement pins them in place."],
  }),
  bow: Object.freeze({
    light:       ["The shot grazes and stings."],
    solid:       ["The arrow thunks in deep."],
    heavy:       ["The shaft punches through with force."],
    devastating: ["A devastating shot hammers straight through."],
  }),
  unarmed: Object.freeze({
    light:       ["A sharp clip catches them."],
    solid:       ["A hard strike snaps the head back."],
    heavy:       ["A brutal body shot empties their lungs."],
    devastating: ["A devastating blow drops them to a knee."],
  }),
  weapon: Object.freeze({
    light:       ["A glancing cut still draws blood."],
    solid:       ["A clean hit lands true."],
    heavy:       ["A heavy strike tears through defenses."],
    devastating: ["A devastating strike breaks the fight open."],
  }),
  spell: Object.freeze({
    light:       ["The magic scorches, but only just."],
    solid:       ["The spell hits with a sharp pulse."],
    heavy:       ["The spell detonates across their body."],
    devastating: ["A devastating surge of power rips through them."],
  }),
});

export const DEATH_BY_ATTACK = {
  stab:  [(w) => `${w} slumps off the blade.`,
          (w) => `${w} is run through.`,
          (w) => `${w} staggers and falls, pierced clean.`],
  slash: [(w) => `${w} is cut down.`,
          (w) => `${w} is cleaved apart.`,
          (w) => `${w} drops in a spray of gore.`],
  blunt: [(w) => `${w} crumples from the impact.`,
          (w) => `${w} is bludgeoned into the ground.`,
          (w) => `${w} folds like a sack of wet grain.`],
  strike:[(w) => `${w} falls.`,
          (w) => `${w} goes limp.`,
          (w) => `${w} collapses.`],
};

export const DEATH_BY_ELEMENT = {
  fire:      [(w) => `${w} burns to cinders.`,
              (w) => `${w} is consumed by flame.`],
  cold:      [(w) => `${w} freezes solid and shatters.`,
              (w) => `${w} is flash-frozen where it stands.`],
  lightning: [(w) => `${w} is fried to a crisp.`,
              (w) => `${w} convulses and drops, smoking.`],
  poison:    [(w) => `${w} chokes on venom and expires.`,
              (w) => `${w} froths and collapses.`],
  acid:      [(w) => `${w} dissolves in a hiss of acid.`,
              (w) => `${w} melts into a puddle.`],
  plasma:    [(w) => `${w} is vaporized.`,
              (w) => `${w} disintegrates in a flash of plasma.`],
  arcane:    [(w) => `${w} unravels under the arcane force.`,
              (w) => `${w} is torn apart by raw magic.`],
  starvation:[(w) => `${w} keels over from hunger.`],
};

export const DEATH_BY_GORE = {
  spark:  [(w) => `${w} sparks violently and shuts down.`,
           (w) => `${w} detonates in a shower of sparks.`],
  ichor:  [(w) => `${w} bursts, spattering ichor across the floor.`,
           (w) => `${w} oozes apart.`],
  none:   [(w) => `${w} is destroyed.`,
           (w) => `${w} is no more.`],
};

export const DEATH_CRIT = {
  stab:      [(w) => `${w} is skewered — dead before hitting the floor.`],
  slash:     [(w) => `${w} is bisected in a single stroke.`],
  blunt:     [(w) => `${w} is pulverized.`],
  fire:      [(w) => `${w} explodes into a pillar of flame!`],
  cold:      [(w) => `${w} shatters into a thousand frozen pieces!`],
  lightning: [(w) => `A bolt rips through ${w} — nothing but char remains.`],
  acid:      [(w) => `${w} dissolves into nothing — not even bones remain.`],
};

export const DEATH_BY_SIZE = {
  S: [(w) => `${w} pops like a grape.`,
      (w) => `${w} crumples into a tiny heap.`],
  L: [(w) => `${w} topples like a felled tree.`,
      (w) => `${w} crashes to the ground — the floor shakes.`],
};

export const DEATH_FALLBACK = [
  (w) => `${w} dies.`,
  (w) => `${w} expires.`,
  (w) => `${w} is no more.`,
  (w) => `${w} falls.`,
  (w) => `${w} collapses in a heap.`,
];

/** Conjugate verb for first- vs third-person. name==='You' → you-form. */
export function v(name, youForm, theyForm) {
  return name === 'You' ? youForm : theyForm;
}

export function toPastVerb(verb) {
  const vb = String(verb || '').toLowerCase();
  if (!vb) return '';
  if (vb === 'hit' || vb === 'hits') return 'hit';
  if (vb === 'slash' || vb === 'slashes') return 'slashed';
  if (vb === 'stab' || vb === 'stabs') return 'stabbed';
  if (vb === 'bash' || vb === 'bashes') return 'bashed';
  if (vb === 'skewer' || vb === 'skewers') return 'skewered';
  if (vb === 'cleave' || vb === 'cleaves') return 'cleaved';
  if (vb === 'crush' || vb === 'crushes') return 'crushed';
  if (vb.endsWith('es')) return `${vb.slice(0, -2)}ed`;
  if (vb.endsWith('s')) return `${vb.slice(0, -1)}ed`;
  return `${vb}ed`;
}

export function adverbForFlavor(flavor) {
  const f = String(flavor || '').trim().toLowerCase();
  if (!f) return '';
  return FLAVOR_ADVERBS[f] || f;
}

export function impactLabel(amount, maxHp, isCrit) {
  const dmg = Math.max(0, Number(amount || 0));
  const max = Math.max(0, Number(maxHp || 0));
  const ratio = max > 0 ? (dmg / max) : 0;
  let label = 'light';
  if (ratio >= 0.4 || dmg >= 16) label = 'devastating';
  else if (ratio >= 0.25 || dmg >= 10) label = 'heavy';
  else if (ratio >= 0.12 || dmg >= 5) label = 'solid';
  if (isCrit && label !== 'devastating') {
    if (label === 'solid') label = 'heavy';
    else if (label === 'heavy') label = 'devastating';
    else label = 'solid';
  }
  return label;
}

export function pick(arr, step) {
  return arr[(step || 0) % arr.length];
}

export function pickImpact(pool, seed) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const n = Math.abs((Number(seed || 0) | 0)) % pool.length;
  return String(pool[n]);
}

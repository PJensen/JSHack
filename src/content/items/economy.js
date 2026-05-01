// Economy, material, food, seed, reagent, relic, and junk items.
import { defineItem } from '../define.js';
import { canTouchstoneDipTarget, createTouchstoneDipHook, EAT_ON_USE } from '../../rules/data/itemCatalogHooks.js';

// ── Relics (quest items) ──────────────────────────────────────────────

defineItem('stone_touchstone', {
  name: 'Touchstone', type: 'tool', material: 'mineral', rarity: 'common', value: 45, weight: 10,
  description: 'A gray stone used to identify gem quality by streak and hardness.',
  hooks: { can_dip_target: canTouchstoneDipTarget, on_dip: createTouchstoneDipHook() },
});

defineItem('relic_ember_censer', {
  name: 'Ember Censer', type: 'tool', material: 'metal', rarity: 'artifact', value: 420, weight: 6,
  description: 'A soot-black censer that never stops breathing warm ash. Town elders want it back, intact.',
});

defineItem('relic_glass_heart', {
  name: 'Glass Heart', type: 'tool', material: 'glass', rarity: 'artifact', value: 440, weight: 2,
  description: 'A clear heart-shot crystal that pulses with trapped heat. It feels important in the worst way.',
});

defineItem('relic_pale_idol', {
  name: 'Pale Idol', type: 'tool', material: 'bone', rarity: 'artifact', value: 400, weight: 4,
  description: 'A chalk-white idol worn smooth by terrified hands. It should not have been left below.',
});

defineItem('relic_stone_tongue', {
  name: 'Stone Tongue', type: 'tool', material: 'mineral', rarity: 'artifact', value: 430, weight: 5,
  description: 'A carved shard shaped like a speaking tongue. It tastes of old rain and sealed crypts.',
});

// ── Food ─────────────────────────────────────────────────────────────

defineItem('food_ration', {
  name: 'Ration', type: 'food', material: 'organic', rarity: 'common', value: 10, weight: 1,
  description: 'A dry but filling travel ration.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_iron_ration', {
  name: 'Iron Ration', type: 'food', material: 'organic', rarity: 'common', value: 25, weight: 1.5,
  description: 'A well-preserved military ration. Very filling.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_wild_berries', {
  name: 'Wild Berries', type: 'food', material: 'organic', rarity: 'common', value: 4, weight: 0.2,
  description: 'A handful of sweet wild berries.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_wild_herbs', {
  name: 'Wild Herbs', type: 'food', material: 'organic', rarity: 'common', value: 3, weight: 0.15,
  description: 'Fresh herbs with a sharp, earthy bite.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_raw_fish', {
  name: 'Raw Fish', type: 'food', material: 'organic', rarity: 'common', value: 8, weight: 0.7,
  nutrition: 120, shelfLife: 1080,
  description: 'A clean silver fish, fresh from nearby water.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_golden_carp', {
  name: 'Golden Carp', type: 'food', material: 'organic', rarity: 'rare', value: 75, weight: 0.9,
  nutrition: 180, shelfLife: 1440,
  description: 'A rare gold-scaled carp prized by cooks, collectors, and lucky anglers.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_moonfin', {
  name: 'Moonfin', type: 'food', material: 'organic', rarity: 'epic', value: 140, weight: 0.6,
  nutrition: 220, shelfLife: 2160,
  description: 'A luminous fish that flickers like moonlight under clear water.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_wheat', {
  name: 'Wheat', type: 'food', material: 'organic', rarity: 'common', value: 5, weight: 0.3,
  description: 'A sheaf of golden wheat. Can be cooked into bread.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_carrot', {
  name: 'Carrot', type: 'food', material: 'organic', rarity: 'common', value: 4, weight: 0.4,
  description: 'A fresh carrot, pulled straight from the soil.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_corn', {
  name: 'Corn', type: 'food', material: 'organic', rarity: 'common', value: 8, weight: 1.0,
  description: 'An ear of golden corn.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_flour', {
  name: 'Flour', type: 'ingredient', material: 'organic', rarity: 'common', value: 7, weight: 0.6,
  description: 'A sack of fresh-milled flour ready for the tavern kitchen.',
});

defineItem('food_stew', {
  name: 'Town Stew', type: 'food', material: 'organic', rarity: 'common', value: 14, weight: 0.8,
  nutrition: 220, shelfLife: 1440,
  description: 'A steaming bowl of tavern stew, rich with grain and herbs.',
  hooks: { on_use: EAT_ON_USE },
});

defineItem('food_mushrooms', {
  name: 'Dungeon Mushrooms', type: 'food', material: 'organic', rarity: 'common', value: 3, weight: 0.15,
  description: 'Pale mushrooms from the dungeon depths. Probably safe.',
  hooks: {
    on_use: (ctx, state) => {
      const result = EAT_ON_USE(ctx, state);
      const actor = Number(state?.actor || ctx.actor || 0) | 0;
      ctx.mutate.pushEffect(actor, { key: 'hallucinating', turnsLeft: 30, potency: 1, stacks: 1 });
      ctx.mutate.pushEffect(actor, { key: 'berserk', turnsLeft: 30, potency: 1, stacks: 1 });
      ctx.io.emit('mushroom:hallucinate', { actor });
      return result;
    },
  },
});

// ── Economy tools & weapons ───────────────────────────────────────────

defineItem('tool_hatchet', {
  name: 'Work Hatchet', type: 'weapon', material: 'iron', rarity: 'common', value: 18, weight: 2.0,
  bonuses: { attack: 2 }, damageDice: '1d6', damageType: 'slash', staminaCost: 6,
  description: 'A practical woodsman\'s hatchet made for work before war.',
});

defineItem('tool_kitchen_knife', {
  name: 'Kitchen Knife', type: 'weapon', material: 'iron', rarity: 'common', value: 12, weight: 0.6,
  bonuses: { attack: 1 }, damageDice: '1d3', damageType: 'pierce', staminaCost: 3,
  description: 'A narrow kitchen knife for carving roots, herbs, and stew meat.',
});

// ── Economy materials ─────────────────────────────────────────────────

defineItem('water_bucket', {
  name: 'Water Bucket', type: 'utility', material: 'wood', rarity: 'common', value: 2, weight: 1.4,
  description: 'A heavy bucket of clean water drawn from the town well.',
});

defineItem('fuel_firewood', {
  name: 'Firewood', type: 'fuel', material: 'wood', rarity: 'common', value: 4, weight: 1.0,
  description: 'A bundled armful of split firewood.',
});

defineItem('material_iron', {
  name: 'Iron Ingot', type: 'material', material: 'iron', rarity: 'common', value: 9, weight: 1.1,
  description: 'A bar of workable iron smelted from ore at a hot forge.',
});

defineItem('material_lumber', {
  name: 'Lumber', type: 'material', material: 'wood', rarity: 'common', value: 6, weight: 1.2,
  description: 'Cut lumber stacked for repairs, handles, and framing work.',
});

defineItem('ore_iron', {
  name: 'Iron Ore', type: 'material', material: 'iron', rarity: 'common', value: 12, weight: 2.0,
  description: 'A chunk of raw iron ore, heavy and rust-red.',
});

defineItem('ore_coal', {
  name: 'Coal', type: 'material', material: 'mineral', rarity: 'common', value: 6, weight: 1.5,
  description: 'A lump of coal, black and crumbly.',
});

defineItem('ore_stone', {
  name: 'Stone Chip', type: 'material', material: 'mineral', rarity: 'common', value: 2, weight: 1.0,
  description: 'A rough chip of grey stone.',
});

// ── Seeds ─────────────────────────────────────────────────────────────

defineItem('seed_wheat', {
  name: 'Wheat Seeds', type: 'seed', material: 'organic', rarity: 'common', value: 2, weight: 0.1,
  description: 'A handful of golden wheat seeds.',
});

defineItem('seed_carrot', {
  name: 'Carrot Seeds', type: 'seed', material: 'organic', rarity: 'common', value: 2, weight: 0.1,
  description: 'Tiny carrot seeds ready to plant.',
});

defineItem('seed_corn', {
  name: 'Corn Seeds', type: 'seed', material: 'organic', rarity: 'common', value: 2, weight: 0.1,
  description: 'A few kernels of seed corn.',
});

// ── Reagents / ingredients ────────────────────────────────────────────

defineItem('reagent_thorn_pod',     { name: 'Thorn Pods',       type: 'ingredient', material: 'organic',  rarity: 'common',   value: 6,  weight: 0.2,  description: 'Hardened thorn pods packed with sharp resin.' });
defineItem('reagent_venom_frond',   { name: 'Venom Fronds',     type: 'ingredient', material: 'organic',  rarity: 'common',   value: 7,  weight: 0.2,  description: 'Slick venom fronds that reek of bitter alkaloids.' });
defineItem('reagent_moonleaf',      { name: 'Moonleaf',         type: 'ingredient', material: 'organic',  rarity: 'common',   value: 8,  weight: 0.15, description: 'Cool silver leaves prized for soothing brews.' });
defineItem('reagent_ember_root',    { name: 'Ember Root',       type: 'ingredient', material: 'organic',  rarity: 'common',   value: 8,  weight: 0.2,  description: 'A hot, peppery root that keeps its heat long after harvest.' });
defineItem('reagent_spider_leg',    { name: 'Spider Leg',       type: 'ingredient', material: 'organic',  rarity: 'common',   value: 7,  weight: 0.15, description: 'A hooked spider leg, dried stiff for poison work and binding sigils.' });
defineItem('reagent_venom_gland',   { name: 'Venom Gland',      type: 'ingredient', material: 'organic',  rarity: 'uncommon', value: 12, weight: 0.2,  description: 'A sealed venom sac prized by poisoners and enchanters alike.' });
defineItem('reagent_resin',         { name: 'Binding Resin',    type: 'ingredient', material: 'resin',    rarity: 'common',   value: 8,  weight: 0.2,  description: 'Sticky amber resin used to seal enchantments into gear.' });
defineItem('reagent_bone_dust',     { name: 'Bone Dust',        type: 'ingredient', material: 'bone',     rarity: 'common',   value: 8,  weight: 0.15, description: 'Pale dust from shattered bone, useful for warding work.' });
defineItem('reagent_ectoplasm',     { name: 'Ectoplasm',        type: 'ingredient', material: 'organic',  rarity: 'uncommon', value: 13, weight: 0.15, description: 'Cold spectral residue that clings to glass and cloth.' });
defineItem('reagent_rune_fragment', { name: 'Rune Fragment',    type: 'ingredient', material: 'stone',    rarity: 'uncommon', value: 14, weight: 0.1,  description: 'A splinter of worked sigil-stone, still holding a charge.' });
defineItem('reagent_frost_core',    { name: 'Frost Core',       type: 'ingredient', material: 'ice',      rarity: 'uncommon', value: 15, weight: 0.25, description: 'A crystal heart of trapped cold lifted from winter-touched foes.' });
defineItem('reagent_beast_claw',    { name: 'Beast Claw',       type: 'ingredient', material: 'bone',     rarity: 'common',   value: 9,  weight: 0.2,  description: 'A heavy claw with enough bite left in it to anchor tougher wards.' });
defineItem('reagent_cursed_thread', { name: 'Cursed Thread',    type: 'ingredient', material: 'cloth',    rarity: 'uncommon', value: 16, weight: 0.05, description: 'Black thread knotted with a whisper of malice.' });

// ── Fishing & junk ────────────────────────────────────────────────────

defineItem('fishing_kelp', {
  name: 'Kelp', type: 'ingredient', material: 'organic', rarity: 'common', value: 5, weight: 0.2,
  description: 'A slick ribbon of kelp, useful in broths and coastal alchemy.',
});

defineItem('junk_soggy_boot', {
  name: 'Soggy Boot', type: 'junk', material: 'leather', rarity: 'common', value: 1, weight: 1.1,
  description: 'One ruined boot. The other one is probably also cursed by mildew.',
});

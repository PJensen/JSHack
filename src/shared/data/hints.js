// shared/data/hints.js
// "Did you know?" tips shown on the character creation screen.
// Add entries freely — one short sentence per hint.
// Mined from: itemCatalog.js, spells.js, monsters.js, dungeon constants, townfolk.js.

export const HINTS = [
  // -- Combat & Stamina --
  "Running out of stamina mid-fight causes fumbles.",
  "Equipping a one-handed weapon while one is already held dual-wields automatically.",
  "Offhand attacks are less accurate and deal reduced damage.",
  "Two-handed weapons leave no room for a shield.",
  "Some weapons apply status effects on hit — wolves bleed you, centipedes shock you.",

  // -- Consumables & Items --
  "Items can be thrown. Some are more useful in flight than in hand.",
  "Pets will pick up nearby items and carry them for you.",
  "A pickaxe mines ore and stone. It is also a weapon, if an awkward one.",
  "An axe chops trees for lumber. Enemies do not enjoy it either.",
  "You can drink from fountains. The effects vary.",
  "A Potion of Poison can coat a weapon instead of being quaffed.",
  "Holy water quenches flames and carries a blessing. It also removes curses from equipment.",
  "Dipping a potion in plain water removes its curse. Unholy water reverses that.",
  "Scrolls and books are paper. Dipping them in any water ruins them permanently.",
  "The Hearthstone returns you to the surface — and remembers the way back.",
  "A Touchstone identifies gem quality by streak. Glass looks valuable until tested.",
  "Stoneskin potion can harden your gear, not just your skin.",
  "Anti-Venom clears all poison instantly.",

  "Starving blocks mana regeneration entirely. Hungry adventurers make poor wizards.",
  "Corpses decay over time. Rancid meat still feeds you, but the risks compound.",
  "Eating eel flesh coats your nerves in brine. You become resistant to electricity.",
  "Eat enough diseased meat and your stomach stops caring. Immunity has a cost.",

  // -- Terrain & Environment --
  "Fire spreads to adjacent flammable tiles.",
  "Fire turns paper into ash.",
  "Stepping on ice sends you sliding until you hit a wall.",
  "Shallow water extinguishes burning.",
  "Lava scorches on every step. There is no safe way to wade through it.",
  "Rain extinguishes burning, including burning structures.",

  // -- Spells & Magic --
  "Lightning chains — it leaps from foe to foe.",
  "Blink snaps to the nearest safe tile if you are confused. The destination may surprise you.",
  "Homecoming returns you to the surface and stores a return ticket to where you were.",
  "Phase Strike dashes through enemies on a line, stunning those you cross.",
  "Rampage spends all your mana but grants 100 turns of battle fury.",
  "Flash Heal also deals holy damage to enemies standing next to you.",
  "Frost lingers longer on lighter creatures.",
  "Casting Agony starts a shadow curse that ticks damage every turn for up to ten turns.",

  // -- Equipment & Affixes --
  "Some weapons hit harder below 30% HP. The kill shot is built in.",
  "A vampiric blade heals its wielder with each strike. About a third of what it deals.",
  "Thorns retaliate when you are struck. They do not chain — only one sting per hit.",
  "Bad luck does not merely fail to help you. It can make a trap you would have dodged find you anyway.",

  // -- Monsters & AI --
  "Some monsters will not aggro until you step within arm's reach.",
  "Pack creatures alert nearby members of their species when they spot you.",
  "Wounded monsters may retreat — a fleeing enemy can lead you into a trap.",
  "The Floating Eye stuns you if you stand still in its line of sight too long.",
  "Liches summon skeletons and cast Agony. Wraiths throw Shadow Bolts.",
  "Dragons breathe fire in a line, not a cone.",
  "Golems occasionally heal themselves mid-fight.",
  "Gargoyles regenerate HP when struck.",
  "Vampires drain life on each hit.",
  "Watch out, Cave Spiders can jump.",
  "The Devourer deals extra damage to afflicted targets — apply a status effect first.",
  "Grid bugs can only move along cardinal axes. Nobody knows why.",

  // -- World & Navigation --
  "Stairs preserve your position. Descend at (x,y), arrive at (x,y) on the floor below.",
  "The deeper you go, the harder the enemies and the better the loot.",
  "The overworld is always at depth 0. Homecoming and Hearthstone take you there.",
  "Every stair tile is reachable from your spawn point.",

  // -- NPCs & Economy --
  "The smith forges tools from ore and coal. Keep them supplied.",
  "The barkeep cooks stew from flour, water, firewood, and a knife.",
  "Workers will replace a lost tool from the smithy chest if one is available.",
  "Villagers eat once per day. If the stew runs short, they go hungry.",

  // -- Books & Lore --
  "Loki appreciates a good engraving. Leave a message and see what happens.",
  "Loki also approves of offering him cursed items. He finds it funny.",
  "Seraphine dislikes killing, but makes an exception for the undead.",
  "Eating your pet has consequences. Lasting ones.",
  "Shrines and deity worship are deeper than they appear. Experiment.",
  "A god who truly favors you may intervene. These miracles are not guaranteed — only earned.",
  "Vision damage heals slowly. Some of it may not.",
  "Cats follow you, fetch items, and drop them at your feet. Do not question why.",
  "Rat corpse: disease. Snake corpse: poison. Floating eye corpse: you forget who you are. There is a pattern.",
  "The spike trap deals 35% of max HP. You can see it — right before it is too late.",
  "Snake traps release several serpents when triggered. Nobody is sure where they were hiding.",

  // -- Polymorph --
  "The Polymorph scroll transforms a visible enemy into a random creature. It takes three turns to channel.",
  "With the Polymorph Control trait, you choose what the target becomes. Partial names work.",
  "If your polymorph target name does not match any creature, the spell fizzles.",

  // -- Traps & Electrocution --
  "Shock traps deal all their damage up front in one jolt. There is no lingering shock.",
  "Electrocution blinds you briefly but deafens you for much longer. Your ears recover slower than your eyes.",

  // -- Bad Consumables --
  "Not every potion is helpful. Paralysis, hallucination, blindness, weakness, and confusion all come in bottles.",
  "A Potion of Weakness reduces both your max HP and max stamina. The debuff lingers.",

  // -- Survivability & Gear --
  "Gear with max HP bonuses raises your effective maximum. Healing spells respect the new cap.",
  "Heavy armor favors defense and health. Leather favors attack and stamina. Cloth favors mana and spellcasting.",
  "The Voidmind Athame is a caster's best friend — light damage, but enormous mana and spell hit bonuses.",

  // -- Pets & Hazards --
  "Your own area-of-effect hazards will not harm your pet. Cast freely near allies.",

  // -- Status Effects --
  "Stun blocks all actions for its duration.",
  "Burning deals damage each turn and can spread to nearby tiles.",
  "Blind degrades your vision range over several turns, then fades.",
  "Frost slows movement.",

  // -- Misc --
  "The seed determines the entire dungeon layout. Share it to give someone your exact world.",
  "Seeds can be entered as hex (0xC0FFEE) or plain numbers.",
  "On PC, you can use ~ to open the console and enter debug commands. Try 'god' for fun.",
];

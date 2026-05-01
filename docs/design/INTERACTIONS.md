# Wild NetHack-Style Interactions — Full Brainstorm

## POTIONS & LIQUIDS

1. **Throw a potion of poison at a burning enemy** — the heat vaporizes it into a poison gas cloud (HazardArea, medium: air)
2. **Drink holy water while cursed** — lifts the curse from yourself, not just items
3. **Throw holy water at undead** — deals bonus holy damage, chance to instantly destroy skeletons
4. **Drink a potion while confused** — you spill half of it, getting the topical/splash effect instead of oral
5. **Quaff poison with iron_stomach trait** — you vomit violently but cure hunger to "normal" (emergency food)
6. **Dip a weapon in a potion of stoneskin** — coats it, next 5 hits apply 1-turn stagger
7. **Throw any potion at a rust monster** — the liquid rusts it, dealing bonus damage
8. **Drink water while hallucinating** — "This tastes like... purple?" — cures hallucination (placebo clarity)
9. **Throw a potion of fire at a frozen enemy** — thermal shock deals 2x damage
10. **Drink a blessed potion** — double duration/potency on all effects

## FOOD & HUNGER

11. **Eat a corpse while starving** — you eat so fast you choke (1-turn stun), but gain bonus nutrition
12. **Eat a flaming bat corpse** — cures frozen status, gives fire_blood buff
13. **Eat a lichen corpse** — never decays (lichens are preserved), always "fresh"
14. **Offer food at a deity altar while famished** — deity takes pity, grants satiation AND favor
15. **Eat a mimic corpse** — you briefly become sticky, enemies that hit you lose their weapon (disarm on-hit for 10 turns)
16. **Eat rancid food with gluttonous trait** — immune to sickness chance, full nutrition
17. **Cook food by dropping it on a fire hazard tile** — rancid/putrid food becomes "charred" (50% nutrition, no sickness)
18. **Eat a phase spider corpse while confused** — the phase_shift buff cures confusion (phases your brain back together)

## EQUIPMENT & BEATITUDE

19. **Equip a cursed weapon** — can't unequip it until you uncurse it (classic NetHack)
20. **Equip cursed boots** — can't remove them; if they're heavy, -1 speed
21. **Blessed weapon vs undead** — +2 damage bonus, chance to proc "smite" on hit
22. **Cursed ring** — stuck on finger, negative version of the ring's effect
23. **Wield a blessed staff while channeling** — -25% mana cost on channeled spells
24. **Equip cursed helmet** — "It slides down over your eyes" — -2 vision range
25. **Blessed armor** — 10% chance to negate a status effect on hit
26. **Cursed weapon fumble** — higher fumble chance, and fumbles can hit YOU

## ALIGNMENT & DEITY

27. **Kill a helpless/stunned enemy as Lawful Good** — alignment shifts toward Neutral ("that was dishonorable")
28. **Eat a corpse of your own deity's sacred creature** — massive favor loss, deity curses you
29. **Pray while burning** — if deity is favorable, extinguishes fire; if wrathful, makes it worse
30. **Pray while poisoned** — favorable deity cures poison, chaotic deity "enjoys watching you suffer" (no help)
31. **Chaotic alignment + kill streak** — enter blood_rage automatically (berserker instinct)
32. **Lawful alignment + spare a fleeing enemy** (let them escape) — favor boost with lawful deities
33. **Evil alignment + eat a corpse in view of a townsperson** — they flee in terror, shops close
34. **Pray at an altar with a cursed item in hand** — deity uncurses it (costs favor)
35. **Sacrifice a blessed item at altar** — 3x favor compared to normal sacrifice
36. **Pray while hallucinating** — you contact a random deity, not your own

## ENVIRONMENTAL & HAZARDS

37. **Step into water while burning** — extinguishes fire (duh), but also rusts iron armor
38. **Cast lightning at a water tile** — electrifies all water tiles in connected pool, shocking everything standing in water
39. **Throw a scroll into a fire hazard** — it burns (paper material), puff of magic smoke applies a random weakened scroll effect in radius
40. **Dig into a wall adjacent to water** — floods the corridor (water hazard tiles flow outward)
41. **Stand on a fire tile while wearing blessed armor** — fire resistance doubled
42. **Drop oil flask on floor + fire spell** — creates persistent fire hazard (5x5)
43. **Frozen + hit with blunt damage** — "shatter" bonus: 2x blunt damage while frozen
44. **Step on a gas trap while burning** — EXPLOSION, big AoE fire damage (gas ignites), destroys the trap
45. **Dig downward on a trap** — destroys the trap but costs extra stamina

## COMBAT & TACTICS

46. **Attack a stone_taunter while blinded** — immune to taunt (can't see the taunting)
47. **Shield bash a casting enemy** — interrupts their spell channel, wastes their mana
48. **Hit a frozen enemy with a piercing weapon** — bonus pierce damage (ice is brittle)
49. **Dual-wield + berserk** — offhand penalty reduced to -1 (frenzy compensates for coordination)
50. **Attack while invisible** — guaranteed crit on first hit (ambush bonus), then invisibility breaks
51. **Throw your weapon at a fleeing enemy** — weapon lands on their tile, they might pick it up (humanoid AI)
52. **Prone/knocked down + enemy walks over you** — free trip attack, they stumble (stagger)
53. **Hit a demon with a blessed weapon** — bonus holy damage + chance to banish (instakill at <15% HP)
54. **Offhand torch** — provides light radius bonus, chance to apply burning on offhand hit
55. **Hit a plant-type enemy while they're burning** — 3x fire damage (plants are tinder)

## SPELLS & MAGIC

56. **Cast heal on an undead enemy** — damages them instead (positive energy harms undead)
57. **Cast blink while confused** — you teleport to a random location on the floor (not where you aimed)
58. **Cast frost on a water tile** — freezes it into walkable ice (slippery: chance to fall prone when walking on it)
59. **Cast scorch while standing in rain** — halved damage (weather interaction)
60. **Cast lightning while standing in water** — damages yourself too (conductor!)
61. **Cast summon_skeleton in a room full of corpses** — summons extra skeletons (one per corpse consumed)
62. **Cast shadow_veil while in darkness** — extended duration (shadows feed shadows)
63. **Cast entangle on a tile with a tree** — triple radius (roots from the tree spread)
64. **Cast meteor on a frozen enemy cluster** — thermal shock: stun everything in radius
65. **Cast heal while starving** — heals HP but costs double mana (body is weak)

## TRAITS & PERMANENT PROGRESSION

66. **Eat 5 rat corpses** (already tracked!) — gain **plague_carrier** trait: immune to disease, but townspeople won't trade with you
67. **Get stunned by floating eye 3 times and survive** — gain **third_eye** (triggered by repeated exposure)
68. **Kill 10 undead as Lawful Good** — gain **holy_warrior** trait: +1 damage vs undead permanently
69. **Eat a nymph corpse** — gain **fey_grace** buff; eat 3 total — permanent **charm** trait (shop prices -20%)
70. **Survive being below 5% HP 5 times** — gain **deathless_resilience** trait: once per floor, survive a killing blow with 1 HP
71. **Dual-wield for 100 kills** — gain **ambidextrous** trait naturally (practice makes perfect)
72. **Eat corpses of every elemental type** — gain **elemental_attunement**: all elemental resists +5%

## PETS & COMPANIONS

73. **Feed your pet a blessed item** — pet gains a temporary buff
74. **Pet walks over a trap** — triggers it on the pet (pets aren't immune!)
75. **Pet eats a monster corpse** — gets the same corpse-eat buff a player would
76. **Command pet to fetch while it's confused** — brings back a random item, not what you wanted
77. **Pet kills an enemy** — no XP for you, but deity favor if it's a sacrifice-worthy kill

## MIMICS & TRICKERY

78. **Open a chest that's actually a mimic** — it bites you and spits out a random cursed item
79. **Throw a cursed item at a mimic** — it eats it and becomes docile for 10 turns
80. **Attack a mimic while hallucinating** — "You attack the treasure chest. Wait, that's a wall."
81. **Mimic dies near other items** — 10% chance a nearby floor item becomes a new mimic (they reproduce!)

## DEATH & DESPERATION

82. **Pray while at 1 HP** — even an unfavorable deity might save you (small chance), with a price
83. **Eat a lich corpse** — lichdom_echo buff, but if you die while active, you rise as a hostile lich (game over with style)
84. **Quaff unknown potion while starving** — desperation! +50% effect potency, but if it's poison, instant death
85. **Read a scroll while blinded** — "You can't read this!" — wastes the scroll... unless you have third_eye

## RUST MONSTER SPECIALS

86. **Rust monster hits your equipped metal armor** — reduces its armor bonus permanently by 1
87. **Throw a metal weapon at a rust monster** — it eats it and heals
88. **Rust monster touches a blessed metal item** — the blessing protects it (one-time shield, blessing consumed)
89. **Hit a rust monster with a wooden/bone weapon** — no rust interaction, safe to melee

## WEATHER INTERACTIONS

90. **Heavy rain + lightning spell** — +50% damage and chains to one extra target (wet conductors)
91. **Rain + fire hazards on floor** — rain gradually extinguishes them (2x faster in heavy rain)
92. **Rain + paper scrolls in open inventory** — chance to waterlog them
93. **Pray for rain during clear weather** — if deity is nature-aligned and favorable, triggers rain

## TRULY WILD

94. **Polymorph into a rust monster** — touching enemies rusts THEIR equipment
95. **Polymorph into a floating eye** — you gain the gaze stun ability against enemies
96. **Throw a gem at a dragon** — if it matches dragon's loot table, dragon becomes passive (bribed)
97. **Name your weapon** — +1 to hit (sentimental attachment)
98. **Kick a wall while confused** — hurt yourself. Kick while berserk — you dig it (rage strength)
99. **Read a scroll of teleport while on the overworld** — teleports to a random town building
100. **Drop a ring in holy water, then equip it** — ring becomes blessed, double its bonus effect
